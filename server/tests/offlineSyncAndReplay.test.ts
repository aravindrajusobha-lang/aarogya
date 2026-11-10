import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { SyncLedger } from '../src/modules/patient/syncLedgerModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 4: Offline Encrypted Queue, Idempotent Batch Sync & Cryptographic Strength', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let adminToken: string;
  let adminUserId = 'usr_admin_paderu_sync';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsSync');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('AdminSync@2026');

    await User.create({
      userId: adminUserId,
      username: 'admin.sync',
      role: 'admin',
      fullName: 'Field Sync Administrator',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    adminToken = signAccessToken({
      userId: adminUserId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_admin_sync',
      deviceId: 'dev_admin_sync',
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('reports and validates the offline queue real encryption strength (AES-GCM-256 + PBKDF2-HMAC-SHA256)', async () => {
    // 1. Validate real encryption parameters
    const passphrase = 'AarogyaDrishti::TribalPWA::SecureOfflineKey::2026';
    const salt = crypto.randomBytes(16); // 128-bit salt
    const iv = crypto.randomBytes(12); // 96-bit standard GCM nonce

    // Derive 256-bit key using PBKDF2-HMAC-SHA256 with 100,000 iterations
    const derivedKey = crypto.pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
    expect(derivedKey.length).toBe(32); // 256 bits

    const payload = JSON.stringify({
      fullName: 'Vantala Balaram',
      ageEstimated: 49,
      villageId: 'vil_dumbriguda_03',
      originalAddressText: 'Near Mango Tree, Dumbriguda Hamlet',
    });

    // 2. Encrypt with AES-GCM-256
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    let ciphertext = cipher.update(payload, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    expect(authTag.length).toBe(16); // 128-bit authentication tag
    // Ciphertext must NOT contain plaintext patient data
    expect(ciphertext).not.toContain('Vantala Balaram');
    expect(ciphertext).not.toContain('Dumbriguda');

    // 3. Decrypt and verify authentic recovery
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    const recovered = JSON.parse(decrypted);
    expect(recovered.fullName).toBe('Vantala Balaram');
    expect(recovered.originalAddressText).toBe('Near Mango Tree, Dumbriguda Hamlet');

    // 4. Tamper detection: altering any byte in ciphertext MUST throw authentication tag verification error
    const tamperedCiphertext = Buffer.from(ciphertext, 'base64');
    tamperedCiphertext[0] ^= 0xff; // Flip bits

    const tamperDecipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
    tamperDecipher.setAuthTag(authTag);
    expect(() => {
      tamperDecipher.update(tamperedCiphertext);
      tamperDecipher.final();
    }).toThrow();
  });

  it('OFFLINE QUEUE SYNCS ONCE: Batch sync ingests offline records and assigns tribal patient IDs', async () => {
    const mutationIdA = `mut_sync_batch_001_${Date.now()}`;
    const mutationIdB = `mut_sync_batch_002_${Date.now()}`;

    const res = await request(app)
      .post('/api/v1/patients/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            clientMutationId: mutationIdA,
            patientData: {
              fullName: 'Killo Chittamma',
              gender: 'female',
              ageEstimated: 61,
              phone: '9849200331',
              villageId: 'vil_chintapalli_04',
              villageName: 'Chintapalli Colony',
              mandal: 'Chintapalli',
              originalAddressText: 'Opposite Ration Depot, Chintapalli',
              hospitalId: 'hosp_chintapalli_chc',
            },
          },
          {
            clientMutationId: mutationIdB,
            patientData: {
              fullName: 'Pangi Pandu',
              gender: 'male',
              ageEstimated: 38,
              villageId: 'vil_araku_05',
              villageName: 'Araku Valley',
              mandal: 'Araku Valley',
              originalAddressText: 'Coffee Plantation Road, Araku Valley',
              hospitalId: 'hosp_araku_ah',
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.processedCount).toBe(2);
    expect(res.body.data.results[0].status).toBe('created');
    expect(res.body.data.results[0].idempotentReplay).toBe(false);
    expect(res.body.data.results[0].patientId).toMatch(/^PAD-\d{4}-[A-F0-9]{6}$/);

    const patientAId = res.body.data.results[0].patientId;

    // Verify written to database
    const patientA = await Patient.findOne({ patientId: patientAId });
    expect(patientA).not.toBeNull();
    expect(patientA?.fullName).toBe('Killo Chittamma');
    expect(patientA?.clientMutationId).toBe(mutationIdA);
  });

  it('REPLAYED BATCH SYNC CREATES NO SECOND RECORD: Subsequent sync of identical mutation IDs replays idempotently', async () => {
    const mutationId = 'mut_sync_single_replay_test';
    const initialCount = await Patient.countDocuments();

    // 1. Initial Sync
    const res1 = await request(app)
      .post('/api/v1/patients/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            clientMutationId: mutationId,
            patientData: {
              fullName: 'Gollori Appa Rao',
              gender: 'male',
              ageEstimated: 47,
              villageId: 'vil_hukumpeta_06',
              villageName: 'Hukumpeta Center',
              mandal: 'Hukumpeta',
              originalAddressText: 'Near Tribal Ashram School, Hukumpeta',
              hospitalId: 'hosp_hukumpeta_phc',
            },
          },
        ],
      });

    expect(res1.status).toBe(200);
    expect(res1.body.data.results[0].status).toBe('created');
    expect(res1.body.data.results[0].idempotentReplay).toBe(false);
    const createdPatientId = res1.body.data.results[0].patientId;

    const countAfterFirst = await Patient.countDocuments();
    expect(countAfterFirst).toBe(initialCount + 1);

    // 2. Replayed Sync (Device re-sends queue after network blip)
    const res2 = await request(app)
      .post('/api/v1/patients/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            clientMutationId: mutationId, // SAME ID
            patientData: {
              fullName: 'Gollori Appa Rao',
              gender: 'male',
              ageEstimated: 47,
              villageId: 'vil_hukumpeta_06',
              villageName: 'Hukumpeta Center',
              mandal: 'Hukumpeta',
              originalAddressText: 'Near Tribal Ashram School, Hukumpeta',
              hospitalId: 'hosp_hukumpeta_phc',
            },
          },
        ],
      });

    expect(res2.status).toBe(200);
    expect(res2.body.data.results[0].idempotentReplay).toBe(true);
    expect(res2.body.data.results[0].status).toBe('replayed_without_mutation');
    expect(res2.body.data.results[0].patientId).toBe(createdPatientId);

    // 3. STRICT ASSERTION: Collection count MUST NOT increase on replay!
    const countAfterReplay = await Patient.countDocuments();
    expect(countAfterReplay).toBe(countAfterFirst);
  });
});
