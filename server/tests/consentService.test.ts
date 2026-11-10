import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Consent Service (DPDP Act Compliance)', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let ashaToken: string;
  let patientToken: string;
  let otherPatientToken: string;
  const patientId = 'PAT-PAD-9901';
  let createdConsentId: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsConsent');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('Pass@2026');

    // ASHA worker
    await User.create({
      userId: 'usr_asha_consent',
      username: 'asha.consent',
      role: 'asha',
      fullName: 'ASHA Worker',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    // Patient
    await User.create({
      userId: patientId,
      username: 'patient.target',
      role: 'patient',
      fullName: 'Target Patient',
      patientId,
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    // Another patient
    await User.create({
      userId: 'PAT-PAD-OTHER',
      username: 'patient.other',
      role: 'patient',
      fullName: 'Other Patient',
      patientId: 'PAT-PAD-OTHER',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    const ashaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'asha.consent', password: 'Pass@2026' });
    ashaToken = ashaLogin.body.data.accessToken;

    const patLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'patient.target', password: 'Pass@2026' });
    patientToken = patLogin.body.data.accessToken;

    const otherPatLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'patient.other', password: 'Pass@2026' });
    otherPatientToken = otherPatLogin.body.data.accessToken;
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('records patient informed consent for screening_ai_analysis', async () => {
    const res = await request(app)
      .post('/api/v1/consent')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        patientId,
        purpose: 'screening_ai_analysis',
        witnessName: 'Village Sarpanch',
        language: 'te',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.consentId).toBeDefined();
    expect(res.body.data.patientId).toBe(patientId);
    expect(res.body.data.purpose).toBe('screening_ai_analysis');
    expect(res.body.data.status).toBe('granted');

    createdConsentId = res.body.data.consentId;
  });

  it('verifies active consent on /consent/verify', async () => {
    const res = await request(app)
      .get(`/api/v1/consent/verify?patientId=${patientId}&purpose=screening_ai_analysis`)
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.hasValidConsent).toBe(true);
    expect(res.body.data.consent).toBeDefined();
    expect(res.body.data.consent.status).toBe('granted');
  });

  it('allows patient to query their own consent history', async () => {
    const res = await request(app)
      .get(`/api/v1/consent/patient/${patientId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.consents.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.consents[0].purpose).toBe('screening_ai_analysis');
  });

  it('strictly rejects patient attempting to access another patient consents (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/consent/patient/${patientId}`)
      .set('Authorization', `Bearer ${otherPatientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows patient to revoke their consent', async () => {
    const res = await request(app)
      .post(`/api/v1/consent/${createdConsentId}/revoke`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('revoked');

    // Verification check should now return hasValidConsent: false
    const verifyRes = await request(app)
      .get(`/api/v1/consent/verify?patientId=${patientId}&purpose=screening_ai_analysis`)
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.hasValidConsent).toBe(false);
  });
});
