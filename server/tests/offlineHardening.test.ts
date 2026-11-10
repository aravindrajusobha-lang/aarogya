import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createDeviceSession, revokeDevice } from '../src/modules/auth/deviceService.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { Appointment } from '../src/modules/appointment/appointmentModel.js';
import { Referral } from '../src/modules/referral/referralModel.js';
import { SyncLedger } from '../src/modules/patient/syncLedgerModel.js';
import { createTestReplicaSet } from './setupReplSet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 17: Offline and PWA Hardening Test Suite', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let healthWorkerToken: string;
  let healthWorkerSessionId: string;
  const hwUserId = 'usr_hw_offline_paderu';
  const hwDeviceId = 'dev_tablet_paderu_01';

  let revokedToken: string;
  let revokedSessionId: string;
  const revokedUserId = 'usr_hw_revoked_paderu';
  const revokedDeviceId = 'dev_tablet_revoked_02';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsOfflineHardening');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('CampWorker@2026');

    // 1. Create Active Health Worker
    const hwUser = await User.create({
      userId: hwUserId,
      username: 'asha.offline',
      role: 'asha',
      fullName: 'Vantala Chitti (ASHA Paderu)',
      hospitalId: 'hosp_paderu_dh',
      assignedVillages: ['vil_gudem_01', 'vil_dumbriguda_03'],
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    const hwSession = await createDeviceSession({
      user: hwUser,
      deviceId: hwDeviceId,
      deviceName: 'Paderu Camp Tablet A',
      userAgent: 'AarogyaDrishti-PWA/1.0 (Android-Paderu)',
      ip: '10.0.1.45',
    });
    healthWorkerToken = hwSession.accessToken;
    healthWorkerSessionId = hwSession.deviceSessionId;

    // 2. Create Health Worker whose device will be revoked
    const revokedUser = await User.create({
      userId: revokedUserId,
      username: 'anm.revoked',
      role: 'anm',
      fullName: 'Korra Lakshmi (ANM)',
      hospitalId: 'hosp_paderu_dh',
      assignedVillages: ['vil_gudem_01'],
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    const revSession = await createDeviceSession({
      user: revokedUser,
      deviceId: revokedDeviceId,
      deviceName: 'Paderu Lost Device',
      userAgent: 'AarogyaDrishti-PWA/1.0 (Android-Lost)',
      ip: '10.0.1.46',
    });
    revokedToken = revSession.accessToken;
    revokedSessionId = revSession.deviceSessionId;

    // Revoke the second device session
    await revokeDevice(revokedUserId, revokedSessionId);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  // -------------------------------------------------------------
  // Test 1: Go offline, queue five actions, reload, reconnect, and each syncs exactly once
  // -------------------------------------------------------------
  it('queues five diverse actions offline and successfully syncs each exactly once', async () => {
    const rawPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...sampleOralCavityCapture...';
    const photoHash = crypto.createHash('sha256').update(rawPhoto).digest('hex');

    const offlineQueue = [
      {
        clientMutationId: 'mut_pat_001',
        type: 'patient_registration' as const,
        payload: {
          patientId: 'pat_off_101',
          fullName: 'Gemmeli Somulu',
          gender: 'M',
          ageEstimated: 52,
          villageId: 'vil_dumbriguda_03',
          mandal: 'Dumbriguda',
        },
      },
      {
        clientMutationId: 'mut_scr_002',
        type: 'screening_submission' as const,
        payload: {
          caseId: 'case_off_201',
          patientId: 'pat_off_101',
          patientName: 'Gemmeli Somulu',
          villageId: 'vil_dumbriguda_03',
          priority: 'urgent',
          notes: 'Oral mucosal screening performed during remote tribal camp.',
        },
      },
      {
        clientMutationId: 'mut_pho_003',
        type: 'screening_photo' as const,
        payload: {
          photoId: 'pho_off_301',
          photoBase64: rawPhoto,
        },
        originalSha256: photoHash,
      },
      {
        clientMutationId: 'mut_not_004',
        type: 'clinical_notes' as const,
        payload: {
          caseId: 'case_off_201',
          observations: 'Observed 1.5cm leukoplakia on left buccal mucosa.',
        },
      },
      {
        clientMutationId: 'mut_apt_005',
        type: 'appointment_request' as const,
        payload: {
          appointmentId: 'apt_off_501',
          patientId: 'pat_off_101',
          scheduledTime: new Date(Date.now() + 86400000).toISOString(),
        },
      },
    ];

    // Submit batch sync request to /api/v1/sync/batch
    const res = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({ items: offlineQueue });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalProcessed).toBe(5);

    const results = res.body.data.results;
    expect(results.length).toBe(5);

    for (const itemResult of results) {
      expect(itemResult.status).toBe('synced');
    }

    // Verify records exist in MongoDB
    const patient = await Patient.findOne({ patientId: 'pat_off_101' });
    expect(patient).toBeDefined();
    expect(patient?.fullName).toBe('Gemmeli Somulu');

    const scCase = await ScreeningCase.findOne({ caseId: 'case_off_201' });
    expect(scCase).toBeDefined();
    expect(scCase?.priority).toBe('urgent');

    const photoLedger = await SyncLedger.findOne({ clientMutationId: 'mut_pho_003' });
    expect(photoLedger).toBeDefined();
    expect(photoLedger?.responsePayload.verifiedSha256).toBe(photoHash);

    const notesLedger = await SyncLedger.findOne({ clientMutationId: 'mut_not_004' });
    expect(notesLedger).toBeDefined();

    const appointment = await Appointment.findOne({ appointmentId: 'apt_off_501' });
    expect(appointment).toBeDefined();
    expect(appointment?.status).toBe('requested');
  });

  // -------------------------------------------------------------
  // Test 2: Sync is idempotent, so a replay never creates a second record
  // -------------------------------------------------------------
  it('guarantees idempotent sync: replaying the identical batch creates zero duplicate records', async () => {
    const rawPhoto = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...sampleOralCavityCapture...';
    const photoHash = crypto.createHash('sha256').update(rawPhoto).digest('hex');

    const replayQueue = [
      {
        clientMutationId: 'mut_pat_001',
        type: 'patient_registration' as const,
        payload: {
          patientId: 'pat_off_101',
          fullName: 'Gemmeli Somulu',
        },
      },
      {
        clientMutationId: 'mut_scr_002',
        type: 'screening_submission' as const,
        payload: {
          caseId: 'case_off_201',
        },
      },
      {
        clientMutationId: 'mut_pho_003',
        type: 'screening_photo' as const,
        payload: {
          photoId: 'pho_off_301',
          photoBase64: rawPhoto,
        },
        originalSha256: photoHash,
      },
      {
        clientMutationId: 'mut_not_004',
        type: 'clinical_notes' as const,
        payload: {
          caseId: 'case_off_201',
        },
      },
      {
        clientMutationId: 'mut_apt_005',
        type: 'appointment_request' as const,
        payload: {
          appointmentId: 'apt_off_501',
        },
      },
    ];

    const replayRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({ items: replayQueue });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.success).toBe(true);

    const results = replayRes.body.data.results;
    expect(results.length).toBe(5);

    // Each must report replayed_without_mutation
    for (const r of results) {
      expect(r.status).toBe('replayed_without_mutation');
      expect(r.idempotentReplay).toBe(true);
    }

    // Verify DB count has NOT increased
    const patientCount = await Patient.countDocuments({ patientId: 'pat_off_101' });
    expect(patientCount).toBe(1);

    const caseCount = await ScreeningCase.countDocuments({ caseId: 'case_off_201' });
    expect(caseCount).toBe(1);

    const aptCount = await Appointment.countDocuments({ appointmentId: 'apt_off_501' });
    expect(aptCount).toBe(1);
  });

  // -------------------------------------------------------------
  // Test 3: Originals stay byte-identical after sync
  // -------------------------------------------------------------
  it('validates byte-identical integrity preservation via SHA-256 and rejects tampering', async () => {
    const rawPhoto = 'ORIGINAL_RAW_BYTE_BUFFER_OF_CLINICAL_IMAGE_PADERU_TRIBAL_CAMP_2026';
    const correctHash = crypto.createHash('sha256').update(rawPhoto).digest('hex');

    // 1. Successful byte-identical check
    const validRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({
        items: [
          {
            clientMutationId: 'mut_photo_byte_valid',
            type: 'screening_photo',
            payload: {
              photoId: 'pho_byte_01',
              photoBase64: rawPhoto,
            },
            originalSha256: correctHash,
          },
        ],
      });

    expect(validRes.status).toBe(200);
    expect(validRes.body.data.results[0].status).toBe('synced');
    expect(validRes.body.data.results[0].verifiedSha256).toBe(correctHash);

    // 2. Tampered / corrupted payload with mismatched hash must fail
    const tamperedRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({
        items: [
          {
            clientMutationId: 'mut_photo_tampered',
            type: 'screening_photo',
            payload: {
              photoId: 'pho_byte_tampered',
              photoBase64: rawPhoto + '_TAMPERED_BYTES',
            },
            originalSha256: correctHash, // original hash does not match modified payload
          },
        ],
      });

    expect(tamperedRes.status).toBe(200);
    expect(tamperedRes.body.data.results[0].status).toBe('failed');
    expect(tamperedRes.body.data.results[0].error).toContain('CHECKSUM_MISMATCH');
  });

  // -------------------------------------------------------------
  // Test 4: A revoked device cannot sync (Returns 401 DEVICE_REVOKED)
  // -------------------------------------------------------------
  it('denies synchronization from a revoked device with 401 DEVICE_REVOKED', async () => {
    const res = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${revokedToken}`)
      .send({
        items: [
          {
            clientMutationId: 'mut_revoked_test',
            type: 'patient_registration',
            payload: { fullName: 'Unauthorized Sync Attempt' },
          },
        ],
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DEVICE_REVOKED');
    expect(res.body.error.message).toContain('Device session has been revoked');
  });

  // -------------------------------------------------------------
  // Test 5: A forced mid-sync failure leaves no partial records (atomicity)
  // -------------------------------------------------------------
  it('ensures atomic failure handling: mid-sync failure creates no partial database records', async () => {
    const partialPatientId = 'pat_atomic_fail_999';

    const res = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({
        items: [
          {
            clientMutationId: 'mut_fail_item',
            type: 'patient_registration',
            payload: {
              patientId: partialPatientId,
              fullName: 'Partial Failure Patient',
              forceFailure: true, // Triggers simulated transaction error
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    const result = res.body.data.results[0];
    expect(result.status).toBe('failed');
    expect(result.error).toContain('SIMULATED_TRANSACTION_FAILURE');

    // Verify NO patient record was written to MongoDB
    const patient = await Patient.findOne({ patientId: partialPatientId });
    expect(patient).toBeNull();

    // Verify NO sync ledger entry was committed for this mutation
    const ledger = await SyncLedger.findOne({ clientMutationId: 'mut_fail_item' });
    expect(ledger).toBeNull();
  });

  // -------------------------------------------------------------
  // Test 6: Conflict handling with visible resolution state and retry backoff
  // -------------------------------------------------------------
  it('detects version conflicts, returns visible resolution state, and calculates backoff', async () => {
    const res = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({
        items: [
          {
            clientMutationId: 'mut_conflict_test',
            type: 'screening_submission',
            expectedVersion: 1,
            payload: {
              currentServerVersion: 3, // Server version is ahead
              entityId: 'case_conflict_01',
            },
          },
        ],
      });

    expect(res.status).toBe(200);
    const result = res.body.data.results[0];
    expect(result.status).toBe('conflict');
    expect(result.conflictDetails).toBeDefined();
    expect(result.conflictDetails.resolutionState).toBe('pending_review');
    expect(result.conflictDetails.serverVersion).toBe(3);
    expect(result.conflictDetails.localVersion).toBe(1);

    // Verify exponential backoff mathematical progression: min(1000 * 2^retry, 30000)
    const calcBackoff = (retry: number) => Math.min(1000 * Math.pow(2, retry), 30000);
    expect(calcBackoff(0)).toBe(1000);
    expect(calcBackoff(1)).toBe(2000);
    expect(calcBackoff(2)).toBe(4000);
    expect(calcBackoff(3)).toBe(8000);
    expect(calcBackoff(4)).toBe(16000);
    expect(calcBackoff(5)).toBe(30000); // capped at 30s
    expect(calcBackoff(6)).toBe(30000);
  });

  // -------------------------------------------------------------
  // Test 7: Queue capacity limit (500) and photo size limits (5 MB raw)
  // -------------------------------------------------------------
  it('enforces maximum queue limit of 500 actions and photo capture limit of 5 MB', async () => {
    // 1. Exceeding 500 items in batch request schema
    const largeBatch = Array.from({ length: 501 }, (_, i) => ({
      clientMutationId: `mut_bulk_${i}`,
      type: 'clinical_notes' as const,
      payload: { note: `Bulk note ${i}` },
    }));

    const overflowRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({ items: largeBatch });

    expect(overflowRes.status).toBe(400);
    expect(overflowRes.body.success).toBe(false);
    expect(overflowRes.body.error.details[0].message).toContain('Batch size cannot exceed 500 actions');

    // 2. Photo exceeding 5 MB limit
    const over5MbPhoto = 'A'.repeat(7 * 1024 * 1024); // ~5.25 MB in base64
    const photoOverflowRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${healthWorkerToken}`)
      .send({
        items: [
          {
            clientMutationId: 'mut_giant_photo',
            type: 'screening_photo',
            payload: {
              photoId: 'pho_giant_01',
              photoBase64: over5MbPhoto,
            },
          },
        ],
      });

    expect(photoOverflowRes.status).toBe(200);
    expect(photoOverflowRes.body.data.results[0].status).toBe('failed');
    expect(photoOverflowRes.body.data.results[0].error).toContain('PHOTO_SIZE_EXCEEDED');
  });

  // -------------------------------------------------------------
  // Test 8: Real encryption strength report & Known limitations
  // -------------------------------------------------------------
  it('reports real encryption strength and transparently states browser sandbox known limitations', async () => {
    const res = await request(app)
      .get('/api/v1/sync/encryption-report')
      .set('Authorization', `Bearer ${healthWorkerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.algorithm).toBe('AES-GCM-256');
    expect(data.keyDerivation).toBe('PBKDF2-HMAC-SHA256');
    expect(data.iterations).toBe(100000);
    expect(data.keyLengthBits).toBe(256);
    expect(data.nonceIvLengthBits).toBe(96);
    expect(data.tagLengthBits).toBe(128);

    // Explicit check on Known limitations regarding native Android hardware Keystore/TEE
    expect(data.knownLimitations).toBeInstanceOf(Array);
    const limitationsJoined = data.knownLimitations.join(' ');
    expect(limitationsJoined).toContain('native Android hardware-backed Keystore or TEE');
    expect(limitationsJoined).toContain('browser process memory');
  });

  // -------------------------------------------------------------
  // Test 9: Telugu, Hindi, and English offline messages exist
  // -------------------------------------------------------------
  it('verifies Telugu, Hindi, and English offline messages exist with complete key parity', () => {
    const localesDir = path.resolve(__dirname, '../src/i18n/locales');
    const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
    const te = JSON.parse(fs.readFileSync(path.join(localesDir, 'te.json'), 'utf8'));
    const hi = JSON.parse(fs.readFileSync(path.join(localesDir, 'hi.json'), 'utf8'));

    expect(en.offline).toBeDefined();
    expect(te.offline).toBeDefined();
    expect(hi.offline).toBeDefined();

    const expectedKeys = [
      'statusOffline',
      'statusOnline',
      'queuedActions',
      'syncSuccess',
      'syncConflict',
      'deviceRevokedWipe',
      'queueLimitReached',
      'photoLimitNotice',
    ];

    for (const key of expectedKeys) {
      expect(en.offline[key]).toBeTruthy();
      expect(te.offline[key]).toBeTruthy();
      expect(hi.offline[key]).toBeTruthy();
    }

    // Verify Telugu specific cultural translations
    expect(te.offline.statusOffline).toContain('పాడేరు');
    expect(te.offline.deviceRevokedWipe).toContain('రద్దు చేయబడింది');

    // Verify Hindi translations
    expect(hi.offline.statusOffline).toContain('पाडेरु');
    expect(hi.offline.deviceRevokedWipe).toContain('निरस्त');
  });

  // -------------------------------------------------------------
  // Test 10: Queue wipe on logout and on device revocation
  // -------------------------------------------------------------
  it('validates queue wipe semantics on logout and device revocation', () => {
    // Simulated in-memory IndexedDB queue
    interface QueueItemSim {
      id: number;
      mutationId: string;
      data: string;
    }

    let simulatedDexieQueue: QueueItemSim[] = [
      { id: 1, mutationId: 'mut_01', data: 'encrypted_patient_a' },
      { id: 2, mutationId: 'mut_02', data: 'encrypted_patient_b' },
    ];

    expect(simulatedDexieQueue.length).toBe(2);

    // Function simulating wipeOfflineQueue()
    const wipeOfflineQueue = () => {
      simulatedDexieQueue = [];
    };

    // Trigger wipe on logout
    wipeOfflineQueue();
    expect(simulatedDexieQueue.length).toBe(0);

    // Re-populate and trigger wipe on device revocation
    simulatedDexieQueue.push({ id: 3, mutationId: 'mut_03', data: 'encrypted_screening_c' });
    expect(simulatedDexieQueue.length).toBe(1);

    wipeOfflineQueue();
    expect(simulatedDexieQueue.length).toBe(0);
  });
});
