import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Consent } from '../src/modules/consent/consentModel.js';
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
