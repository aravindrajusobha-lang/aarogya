import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Consent } from '../src/modules/consent/consentModel.js';
import { AiScreening } from '../src/modules/ai/aiScreeningModel.js';
import { savePrivateFile } from '../src/modules/storage/storageService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

const PATIENT_ID = 'patient_reanalysis_01';
const geminiJson = {
  observedCondition: 'A raised white patch is visible on the inner cheek.',
  conditionCategory: 'white_lesion',
  riskTier: 'moderate_risk_support',
  confidenceScore: 0.81,
  anatomicalSite: 'Left inner cheek',
  visualFindings: ['White patch about 1 cm', 'Slightly rough surface'],
  recommendedDoctor: { specialty: 'Oral medicine specialist', facility: 'District hospital', urgency: 'priority', timelineDays: 10, consultationReason: 'Examine the white patch.' },
  urgentRedFlags: ['Bleeding from the patch'],
  possibleConditions: ['white patch (leukoplakia)', 'frictional keratosis', 'malignant change'],
  possibleCauses: ['Rubbing from a sharp tooth', 'Tobacco or betel use'],
  whatToTellClinician: ['When you first noticed it'],
  patientExplanation: 'A white patch is visible. A photo cannot show the cause, so a doctor should examine it.',
  answerText: 'A white patch is visible; please see a doctor.',
  speechText: 'A white patch is visible. Please see a doctor.',
};

describe('Detailed re-analysis of a stored screening photo', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;
  let patientToken: string;
  let otherPatientToken: string;
  let originalId: string;

  beforeAll(async () => {
    vi.stubEnv('GCS_BUCKET_NAME', '');
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-test-model');
    replSet = await createTestReplicaSet('rsReanalysis');
    await mongoose.connect(replSet.getUri());
    app = createApp();
    await User.create([
      { userId: 're_patient', username: 're_patient', fullName: 'Synthetic Patient', role: 'patient', patientId: PATIENT_ID, passwordHash: 'x', mfaEnabled: false, status: 'active' },
      { userId: 're_other', username: 're_other', fullName: 'Other Patient', role: 'patient', patientId: 'patient_other_02', passwordHash: 'x', mfaEnabled: false, status: 'active' },
    ]);
    patientToken = signAccessToken({ userId: 're_patient', role: 'patient', scopes: getRoleCapabilities('patient'), patientId: PATIENT_ID } as any);
    otherPatientToken = signAccessToken({ userId: 're_other', role: 'patient', scopes: getRoleCapabilities('patient'), patientId: 'patient_other_02' } as any);
    await Consent.create({ consentId: 'cns_re_01', patientId: PATIENT_ID, purpose: 'screening_ai_analysis', status: 'granted', validUntil: new Date(Date.now() + 86_400_000), actorId: 're_patient', actorRole: 'patient', language: 'en', simulation: true });
    const stored = await savePrivateFile({ originalFilename: 'oral.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('synthetic-image-bytes'), uploader: { id: 're_patient', role: 'patient', patientId: PATIENT_ID } as any, category: 'patients/oral-images', patientId: PATIENT_ID });
    const original = await AiScreening.create({
      patientId: PATIENT_ID, performedBy: { userId: 're_patient', username: 're_patient', role: 'patient' },
      label: 'opmd', confidence: 0.38, probabilities: { opmd: 0.38 }, referToSpecialist: true, modelVersion: 'v2.0.0-trained-mod', source: 'server',
      imageRef: stored.fileId, clinicianReview: { status: 'PENDING' }, consentGiven: true, consentTimestamp: new Date(), syncStatus: 'SYNCED', clientId: crypto.randomUUID(),
    });
    originalId = original.screeningId;
  }, 60000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('shows a basic-only result as such, then creates a new detailed record without touching the original', async () => {
    const before = await request(app).get(`/api/ai/screenings/${originalId}/summary`).set('Authorization', `Bearer ${patientToken}`);
    expect(before.status).toBe(200);
    expect(before.body.data.analysisSource).toBe('basic');
    expect(before.body.data.lowConfidence).toBe(true);
    expect(JSON.stringify(before.body.data)).not.toMatch(/opmd|malignant/i);

    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiJson) }] } }] }) } as any;
      }
      return realFetch(url, init);
    }));

    const denied = await request(app).post(`/api/ai/screenings/${originalId}/reanalyze`).set('Authorization', `Bearer ${otherPatientToken}`).send({ clientId: crypto.randomUUID() });
    expect(denied.status).toBe(403);

    const clientId = crypto.randomUUID();
    const res = await request(app).post(`/api/ai/screenings/${originalId}/reanalyze`).set('Authorization', `Bearer ${patientToken}`).send({ clientId, language: 'en' });
    expect(res.status).toBe(200);
    const newId = res.body.data.screeningId;
    expect(newId).not.toBe(originalId);

    const replay = await request(app).post(`/api/ai/screenings/${originalId}/reanalyze`).set('Authorization', `Bearer ${patientToken}`).send({ clientId });
    expect(replay.body.data).toMatchObject({ screeningId: newId, idempotentReplay: true });

    const original: any = await AiScreening.findOne({ screeningId: originalId }).lean();
    expect(original.label).toBe('opmd');
    expect(original.geminiAnalysis).toBeUndefined();

    const summary = await request(app).get(`/api/ai/screenings/${newId}/summary`).set('Authorization', `Bearer ${patientToken}`);
    const data = summary.body.data;
    expect(data.analysisSource).toBe('detailed');
    expect(data.reanalysisOf).toBe(originalId);
    expect(data.riskLevel).toBe('moderate');
    expect(data.visualFindings).toContain('White patch about 1 cm');
    expect(data.possibleConditions).toEqual(['white patch (leukoplakia)', 'frictional keratosis']);
    expect(data.nextStep).toMatchObject({ withinDays: 10, suggestedDoctorType: 'Oral medicine specialist', facility: 'District hospital' });
    expect(JSON.stringify(data)).not.toMatch(/malignant/i);
  });
});
