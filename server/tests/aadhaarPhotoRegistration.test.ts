import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Aadhaar photo patient registration boundary', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();
  let patientId: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAadhaarPhotoRegistration');
    await mongoose.connect(replSet.getUri());
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('creates an unverified patient account without requiring PIN, Aadhaar numbers, or card images', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register-aadhaar-photo')
      .send({
        consent: true,
        name: 'Rani Sample',
        yearOfBirth: 1990,
        gender: 'female',
        address: 'C/O Sample, House 1-2, Vankachinta',
        village: 'Vankachinta',
        mandal: 'Paderu',
        pincode: '531024',
        mobile: '9876543210',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.patientId).toMatch(/^PAD-[A-F0-9]{6}$/);
    expect(response.body.data.user.verificationStatus).toBe('UNVERIFIED');
    patientId = response.body.data.patientId;

    const saved = await User.findOne({ patientId });
    expect(saved).not.toBeNull();
    expect(saved?.passwordHash).toBeTruthy();
    expect(saved?.toObject()).not.toHaveProperty('aadhaarNumber');
    expect(saved?.toObject()).not.toHaveProperty('aadhaarHash');
    expect(saved?.toObject()).not.toHaveProperty('photoFront');
  });

  it('rejects payload properties that could carry Aadhaar identifiers or photos', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register-aadhaar-photo')
      .send({
        consent: true,
        name: 'Rani Sample',
        yearOfBirth: 1990,
        gender: 'female',
        village: 'Vankachinta',
        mandal: 'Paderu',
        aadhaarNumber: '234567890123',
        frontImage: 'data:image/png;base64,private',
      });

    expect(response.status).toBe(400);
  });

  it('allows returning patients to use the existing Mobile OTP login and preserves their Patient ID', async () => {
    const sent = await request(app)
      .post('/api/v1/auth/patient/send-otp')
      .send({ phone: '9876543210', purpose: 'LOGIN' });
    expect(sent.status).toBe(200);

    const login = await request(app)
      .post('/api/v1/auth/patient/verify-otp')
      .send({ phone: '9876543210', otp: '123456', purpose: 'LOGIN' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.patientId).toBe(patientId);
    expect(login.body.data.user.fullName).toBe('Rani Sample');
    expect(login.body.data.accessToken).toBeTruthy();
  });

  it('allows scoped medical officers to verify in person and blocks patient self-verification', async () => {
    await User.create({
      userId: 'usr_medical_officer_verify',
      username: 'medical.verify',
      role: 'medical_officer',
      fullName: 'Medical Officer',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: 'test-hash',
      status: 'active',
      simulation: true,
    });
    const medicalToken = signAccessToken({
      userId: 'usr_medical_officer_verify',
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
    });
    const verification = await request(app)
      .patch(`/api/v1/patients/${patientId}/verify`)
      .set('Authorization', `Bearer ${medicalToken}`);

    expect(verification.status).toBe(200);
    expect(verification.body.data.verificationStatus).toBe('VERIFIED');
    const verifiedPatient = await User.findOne({ patientId });
    expect(verifiedPatient?.hospitalId).toBe('hosp_paderu_dh');

    const patientToken = signAccessToken({
      userId: 'usr_patient_self_verify',
      role: 'patient',
      scopes: getRoleCapabilities('patient'),
    });
    const denied = await request(app)
      .patch(`/api/v1/patients/${patientId}/verify`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(denied.status).toBe(403);
  });
});
