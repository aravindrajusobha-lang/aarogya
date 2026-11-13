import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { ASR_MANDALS } from '../src/modules/reference/asrGeographyData.js';
import { createTestReplicaSet } from './setupReplSet.js';

const MANDAL = ASR_MANDALS[0];
const base = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Synthetic Elder', yearOfBirth: 1955, gender: 'female', mandalId: MANDAL.mandalId, village: 'Synthetic Village',
  address: 'Near Old Mango Tree, Synthetic Village', consent: true, clientMutationId: crypto.randomUUID(), ...overrides,
});

describe('Simple patient registration & login (Aadhaar / ABHA / mobile)', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;

  const phoneToken = async (phone: string) => {
    await request(app).post('/api/v1/otp/send').send({ phone, purpose: 'REGISTER' });
    const res = await request(app).post('/api/v1/otp/verify').send({ phone, otp: '123456', purpose: 'REGISTER' });
    return res.body.phoneToken as string;
  };

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsPatientEasy');
    await mongoose.connect(replSet.getUri());
    app = createApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('lists mandals and villages publicly', async () => {
    const res = await request(app).get('/api/v1/patient/easy/places');
    expect(res.status).toBe(200);
    expect(res.body.data.mandals.length).toBeGreaterThan(5);
    expect(res.body.data.mandals[0]).toHaveProperty('nameTe');
  });

  it('registers from Aadhaar card details without OTP and rejects any Aadhaar number field', async () => {
    const withNumber = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'aadhaar', aadhaarNumber: '234123412346' }));
    expect(withNumber.status).toBe(400);
    const withImage = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'aadhaar', cardImage: 'data:image/jpeg;base64,AAAA' }));
    expect(withImage.status).toBe(400);

    const res = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'aadhaar' }));
    expect(res.status).toBe(201);
    expect(res.body.data.patientId).toMatch(/^PAD-/);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.hospitalId).toBe(MANDAL.catchmentHospitalId);
    const stored: any = await User.findOne({ patientId: res.body.data.patientId }).lean();
    expect(JSON.stringify(stored)).not.toMatch(/234123412346/);
  });

  it('registers with mobile OTP, blocks duplicates, and logs in with mobile + OTP', async () => {
    const token = await phoneToken('9876500011');
    expect(token).toBeTruthy();
    const noToken = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'mobile' }));
    expect(noToken.status).toBe(400);

    const clientMutationId = crypto.randomUUID();
    const res = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'mobile', phoneToken: token, clientMutationId }));
    expect(res.status).toBe(201);
    expect(res.body.data.user.phone).toBe('+919876500011');
    const replay = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'mobile', phoneToken: token, clientMutationId }));
    expect(replay.body.data.patientId).toBe(res.body.data.patientId);

    const dup = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'mobile', phoneToken: await phoneToken('9876500011') }));
    expect(dup.status).toBe(409);

    const send = await request(app).post('/api/v1/patient/easy/login/send-otp').send({ phone: '9876500011' });
    expect(send.status).toBe(200);
    expect(send.body.data.sentTo).toContain('0011');
    const login = await request(app).post('/api/v1/patient/easy/login').send({ phone: '9876500011', otp: '123456' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.patientId).toBe(res.body.data.patientId);

    expect((await request(app).post('/api/v1/patient/easy/login/send-otp').send({ phone: '9876509999' })).status).toBe(404);
  });

  it('registers with ABHA number (stored hashed + masked) and logs in with ABHA + OTP to the linked mobile', async () => {
    const abha = '91-1234-5678-9012';
    const bad = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'abha', abhaNumber: '1234', phoneToken: await phoneToken('9876500022') }));
    expect(bad.status).toBe(400);
    const res = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'abha', abhaNumber: abha, phoneToken: await phoneToken('9876500022') }));
    expect(res.status).toBe(201);
    const stored: any = await User.findOne({ patientId: res.body.data.patientId }).lean();
    expect(stored.abhaMasked).toBe('XX-XXXX-XXXX-9012');
    expect(JSON.stringify(stored)).not.toContain('91123456789012');

    const dup = await request(app).post('/api/v1/patient/easy/register').send(base({ method: 'abha', abhaNumber: '91123456789012', phoneToken: await phoneToken('9876500033') }));
    expect(dup.status).toBe(409);

    const send = await request(app).post('/api/v1/patient/easy/login/send-otp').send({ abhaNumber: abha });
    expect(send.status).toBe(200);
    const login = await request(app).post('/api/v1/patient/easy/login').send({ abhaNumber: abha, otp: '123456' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.abhaMasked).toBe('XX-XXXX-XXXX-9012');
    expect((await request(app).post('/api/v1/patient/easy/login').send({ abhaNumber: abha, otp: '000000' })).status).toBe(401);
  });
});
