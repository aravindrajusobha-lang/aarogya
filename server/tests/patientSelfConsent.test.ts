import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Consent } from '../src/modules/consent/consentModel.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(256, 7)]);
const gemini = { observedCondition: 'A pale area', conditionCategory: 'white_lesion', riskTier: 'moderate_risk_support', confidenceScore: 0.7, anatomicalSite: 'Cheek', visualFindings: ['Pale patch'], recommendedDoctor: { specialty: 'Dentist', facility: 'PHC', urgency: 'priority', timelineDays: 10, consultationReason: 'Review' }, answerText: 'A pale patch.', speechText: 'A pale patch.' };

describe('Patient self-consent for their own photo analysis', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;
  let patientToken: string;
  let ashaToken: string;

  beforeAll(async () => {
    vi.stubEnv('GCS_BUCKET_NAME', '');
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    replSet = await createTestReplicaSet('rsSelfConsent');
    await mongoose.connect(replSet.getUri());
    app = createApp();
    await User.create([
      { userId: 'sc_pat', username: 'sc_pat', fullName: 'Synthetic Patient', role: 'patient', patientId: 'PAT-SC-1', hospitalId: 'hosp_sc', passwordHash: 'x', status: 'active' },
      { userId: 'sc_asha', username: 'sc_asha', fullName: 'Synthetic ASHA', role: 'asha', hospitalId: 'hosp_sc', passwordHash: 'x', status: 'active' },
    ]);
    await Patient.create([
      {
        patientId: 'PAT-SC-1',
        fullName: 'Synthetic Patient',
        gender: 'female',
        ageEstimated: 42,
        villageId: 'VIL-SC-1',
        villageName: 'Synthetic Village',
        mandal: 'Synthetic Mandal',
        district: 'Synthetic District',
        originalAddressText: 'Synthetic address',
        hospitalId: 'hosp_sc',
        registeredBy: 'sc_asha',
      },
      {
        patientId: 'PAT-SC-ASHA-1',
        fullName: 'Synthetic ASHA Patient',
        gender: 'male',
        ageEstimated: 35,
        villageId: 'VIL-SC-2',
        villageName: 'Synthetic Village',
        mandal: 'Synthetic Mandal',
        district: 'Synthetic District',
        originalAddressText: 'Synthetic address',
        hospitalId: 'hosp_sc',
        registeredBy: 'sc_asha',
      },
      {
        patientId: 'PAT-SC-OTHER',
        fullName: 'Other Worker Patient',
        gender: 'female',
        ageEstimated: 39,
        villageId: 'VIL-SC-3',
        villageName: 'Other Village',
        mandal: 'Other Mandal',
        district: 'Synthetic District',
        originalAddressText: 'Synthetic address',
        hospitalId: 'hosp_sc',
        registeredBy: 'sc_other',
      },
    ]);
    patientToken = signAccessToken({ userId: 'sc_pat', role: 'patient', scopes: getRoleCapabilities('patient'), patientId: 'PAT-SC-1' } as any);
    ashaToken = signAccessToken({ userId: 'sc_asha', role: 'asha', hospitalId: 'hosp_sc', scopes: getRoleCapabilities('asha') });
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => String(url).includes('generativelanguage')
      ? { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(gemini) }] } }] }) } as any
      : realFetch(url, init)));
  }, 60000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  const analyze = (token: string, patientId: string, consentGiven: string) => request(app).post('/api/ai/analyze').set('Authorization', `Bearer ${token}`)
    .field('patientId', patientId).field('consentGiven', consentGiven).field('clientId', crypto.randomUUID()).attach('image', JPEG, { filename: 'mouth.jpg', contentType: 'image/jpeg' });

  it('blocks staff without recorded consent, even if they tick consent', async () => {
    const res = await analyze(ashaToken, 'PAT-SC-1', 'true');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CONSENT_REQUIRED');
  });

  it('allows an ASHA to screen and track only their own registered patients', async () => {
    const consent = await request(app)
      .post('/api/v1/consent')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ patientId: 'PAT-SC-ASHA-1', purpose: 'screening_ai_analysis' });
    expect(consent.status).toBe(201);

    const analysis = await analyze(ashaToken, 'PAT-SC-ASHA-1', 'true');
    expect(analysis.status).toBe(200);
    const screeningId = analysis.body.data.screeningId;

    const history = await request(app)
      .get('/api/ai/screenings?patientId=PAT-SC-ASHA-1')
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(history.status).toBe(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({
      screeningId,
      clinicianReview: { status: 'PENDING' },
      disclaimer: expect.any(String),
    });
    expect(history.body.data[0]).not.toHaveProperty('imageRef');

    const outOfScope = await request(app)
      .get('/api/ai/screenings?patientId=PAT-SC-OTHER')
      .set('Authorization', `Bearer ${ashaToken}`);
    expect(outOfScope.status).toBe(403);
    expect(outOfScope.body.error.code).toBe('PATIENT_SCOPE_DENIED');
  });

  it("records the patient's own agreement as a consent and analyses the photo", async () => {
    const res = await analyze(patientToken, 'PAT-SC-1', 'true');
    expect(res.status).toBe(200);
    const consent: any = await Consent.findOne({ patientId: 'PAT-SC-1', purpose: 'screening_ai_analysis' }).lean();
    expect(consent).toMatchObject({ status: 'granted', actorRole: 'patient', actorId: 'sc_pat' });
    expect(new Date(consent.validUntil).getTime()).toBeGreaterThan(Date.now() + 300 * 86400000);
  });

  it("does not let a patient grant consent for someone else's record", async () => {
    const res = await analyze(patientToken, 'PAT-OTHER', 'true');
    expect(res.status).toBe(403);
    expect(await Consent.countDocuments({ patientId: 'PAT-OTHER' })).toBe(0);
  });
});
