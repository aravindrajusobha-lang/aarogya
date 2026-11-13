import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { Appointment } from '../src/modules/appointment/appointmentModel.js';
import { Consent } from '../src/modules/consent/consentModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

const H1 = 'hosp_rec_1';
const H2 = 'hosp_rec_2';
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const istDate = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10);

describe('Doctor availability ranges, patient record lookup and live-call captures', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;
  const token: Record<string, string> = {};

  beforeAll(async () => {
    vi.stubEnv('GCS_BUCKET_NAME', '');
    vi.stubEnv('CLOUDINARY_CLOUD_NAME', '');
    replSet = await createTestReplicaSet('rsDoctorRecords');
    await mongoose.connect(replSet.getUri());
    app = createApp();
    await Hospital.create([
      { hospitalId: H1, name: 'Facility One', type: 'district_hospital', district: 'ASR', mandal: 'Paderu' },
      { hospitalId: H2, name: 'Facility Two', type: 'area_hospital', district: 'ASR', mandal: 'Araku' },
    ]);
    const doc = (userId: string, hospitalId: string) => ({ userId, username: userId, fullName: `Dr ${userId}`, role: 'medical_officer', hospitalId, passwordHash: 'x', status: 'active', verificationStatus: 'verified' });
    await User.create([
      doc('rec_doc_a', H1), doc('rec_doc_b', H1), doc('rec_doc_c', H2),
      { userId: 'rec_pat', username: 'rec_pat', fullName: 'Synthetic Patient', role: 'patient', patientId: 'PAT-REC-1', hospitalId: H1, passwordHash: 'x', status: 'active' },
    ]);
    for (const id of ['rec_doc_a', 'rec_doc_b', 'rec_doc_c']) token[id] = signAccessToken({ userId: id, role: 'medical_officer', hospitalId: id === 'rec_doc_c' ? H2 : H1, scopes: getRoleCapabilities('medical_officer') });
    token.patient = signAccessToken({ userId: 'rec_pat', role: 'patient', scopes: getRoleCapabilities('patient'), patientId: 'PAT-REC-1' } as any);
  }, 60000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('publishes a start–end window split into slots; patients see available and booked slots; per-doctor conflicts', async () => {
    const date = istDate(2);
    const range = await request(app).post('/api/v1/consultations/doctor/availability/range').set('Authorization', `Bearer ${token.rec_doc_a}`)
      .send({ date, startTime: '10:00', endTime: '11:00', durationMinutes: 20, mutationId: crypto.randomUUID() });
    expect(range.status).toBe(201);
    expect(range.body.data.created).toBe(3);
    // Second doctor at the SAME facility publishes the same window.
    await request(app).post('/api/v1/consultations/doctor/availability/range').set('Authorization', `Bearer ${token.rec_doc_b}`)
      .send({ date, startTime: '10:00', endTime: '10:40', durationMinutes: 20, mutationId: crypto.randomUUID() });

    const slots = (await request(app).get(`/api/v1/consultations/availability/rec_doc_a?date=${date}`).set('Authorization', `Bearer ${token.patient}`)).body.data.slots;
    expect(slots.map((s: any) => s.status)).toEqual(['available', 'available', 'available']);
    expect(slots[0].durationMinutes).toBe(20);

    const book = (doctorId: string, slot: any) => request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token.patient}`).send({
      patientId: 'PAT-REC-1', destinationHospitalId: H1, assignedDoctorId: doctorId, slotStartTime: slot.startTime, slotEndTime: slot.endTime,
      consultationMode: 'online', consentGiven: true, visitDetails: { shareProfile: true }, type: 'clinical_consultation', mutationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(),
    });
    expect((await book('rec_doc_a', slots[0])).status).toBe(201);
    // Different doctor, same facility, same time: must be allowed now.
    const slotsB = (await request(app).get(`/api/v1/consultations/availability/rec_doc_b?date=${date}`).set('Authorization', `Bearer ${token.patient}`)).body.data.slots;
    expect((await book('rec_doc_b', slotsB[0])).status).toBe(201);

    const after = (await request(app).get(`/api/v1/consultations/availability/rec_doc_a?date=${date}`).set('Authorization', `Bearer ${token.patient}`)).body.data.slots;
    expect(after.map((s: any) => s.status)).toEqual(['booked', 'available', 'available']);
    expect(after[0].booking).toBeUndefined();

    const mine = (await request(app).get('/api/v1/consultations/doctor/availability').set('Authorization', `Bearer ${token.rec_doc_a}`)).body.data.slots;
    const booked = mine.find((s: any) => s.status === 'booked');
    expect(booked.booking.patientName).toBeTruthy();
    expect((await request(app).delete(`/api/v1/consultations/doctor/availability/${booked.slotId}`).set('Authorization', `Bearer ${token.rec_doc_a}`)).status).toBe(409);
    const free = mine.find((s: any) => s.status === 'available');
    expect((await request(app).delete(`/api/v1/consultations/doctor/availability/${free.slotId}`).set('Authorization', `Bearer ${token.rec_doc_a}`)).status).toBe(200);
  });

  it('lets verified doctors read across facilities by exact ID and records each viewer', async () => {
    const own = await request(app).get('/api/v1/patient-records/PAT-REC-1').set('Authorization', `Bearer ${token.rec_doc_b}`);
    expect(own.status).toBe(200);
    expect(own.body.data.patient.fullName).toBe('Synthetic Patient');
    expect(own.body.data.appointments.length).toBeGreaterThanOrEqual(1);

    const other = await request(app).get('/api/v1/patient-records/PAT-REC-1').set('Authorization', `Bearer ${token.rec_doc_c}`);
    expect(other.status).toBe(200);
    expect(other.body.data.access).toMatchObject({ reason: 'verified_doctor_lookup', consentedShare: false, canPrescribe: false });
    expect(other.body.data.appointments.length).toBeGreaterThanOrEqual(1);
    expect(other.headers['cache-control']).toBe('private, no-store');
    expect(await AuditLog.countDocuments({ action: 'PATIENT_RECORD_ACCESSED', resourceId: 'PAT-REC-1', actorId: 'rec_doc_c' })).toBe(1);

    const again = await request(app).get('/api/v1/patient-records/PAT-REC-1').set('Authorization', `Bearer ${token.rec_doc_a}`);
    const viewers = again.body.data.activity.filter((a: any) => a.type === 'viewed').map((a: any) => a.by);
    expect(viewers).toEqual(expect.arrayContaining(['Dr rec_doc_a', 'Dr rec_doc_b', 'Dr rec_doc_c']));
  });

  it('rejects unknown IDs, unauthenticated requests, patients and unverified or inactive doctors', async () => {
    const path = '/api/v1/patient-records/PAT-REC-1';
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path).set('Authorization', `Bearer ${token.patient}`)).status).toBe(403);
    expect((await request(app).get('/api/v1/patient-records/NO-SUCH-PATIENT').set('Authorization', `Bearer ${token.rec_doc_c}`)).status).toBe(404);
    await User.updateOne({ userId: 'rec_doc_c' }, { verificationStatus: 'pending_verification' });
    expect((await request(app).get(path).set('Authorization', `Bearer ${token.rec_doc_c}`)).status).toBe(403);
    await User.updateOne({ userId: 'rec_doc_c' }, { verificationStatus: 'verified', status: 'inactive' });
    expect((await request(app).get(path).set('Authorization', `Bearer ${token.rec_doc_c}`)).status).toBe(403);
    await User.updateOne({ userId: 'rec_doc_c' }, { status: 'active' });
  });

  it('saves a live-call capture to the patient record, notifies via records, and gates AI analysis on consent', async () => {
    const appointment: any = await Appointment.findOne({ assignedDoctorId: 'rec_doc_a', patientId: 'PAT-REC-1' }).lean();
    await Appointment.updateOne({ appointmentId: appointment.appointmentId }, { $set: { status: 'confirmed' } });
    const capture = () => request(app).post(`/api/v1/consultation-sessions/${appointment.appointmentId}/captures`).set('Authorization', `Bearer ${token.rec_doc_a}`)
      .field('clientId', crypto.randomUUID()).field('note', 'Left cheek close-up').attach('image', JPEG, { filename: 'frame.jpg', contentType: 'image/jpeg' });
    expect((await capture()).status).toBe(409); // no active session yet

    await request(app).post(`/api/v1/consultation-sessions/${appointment.appointmentId}/start`).set('Authorization', `Bearer ${token.rec_doc_a}`).send({ clientMutationId: crypto.randomUUID() });
    const saved = await capture();
    expect(saved.status).toBe(201);
    const { captureId, fileId } = saved.body.data.capture;

    const denied = await request(app).post(`/api/v1/consultation-sessions/${appointment.appointmentId}/captures`).set('Authorization', `Bearer ${token.rec_doc_b}`)
      .field('clientId', crypto.randomUUID()).attach('image', JPEG, { filename: 'frame.jpg', contentType: 'image/jpeg' });
    expect(denied.status).toBe(403);

    const records = await request(app).get('/api/v1/patient-records/PAT-REC-1').set('Authorization', `Bearer ${token.rec_doc_a}`);
    expect(records.body.data.captures.map((c: any) => c.captureId)).toContain(captureId);
    const image = await request(app).get(`/api/v1/patient-records/PAT-REC-1/files/${fileId}`).set('Authorization', `Bearer ${token.rec_doc_a}`);
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toContain('image/jpeg');
    expect((await request(app).get(`/api/v1/patient-records/PAT-REC-1/files/${fileId}`).set('Authorization', `Bearer ${token.rec_doc_c}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/patient-records/NO-SUCH-PATIENT/files/${fileId}`).set('Authorization', `Bearer ${token.rec_doc_c}`)).status).toBe(404);

    const mine = await request(app).get('/api/v1/consultation-sessions/captures/my').set('Authorization', `Bearer ${token.patient}`);
    expect(mine.body.data.captures[0].captureId).toBe(captureId);

    const noConsent = await request(app).post(`/api/v1/consultation-sessions/captures/${captureId}/analyze`).set('Authorization', `Bearer ${token.rec_doc_a}`);
    expect(noConsent.status).toBe(403);
    expect(noConsent.body.error.code).toBe('CONSENT_REQUIRED');

    await Consent.create({ consentId: 'cns_rec_1', patientId: 'PAT-REC-1', purpose: 'screening_ai_analysis', status: 'granted', validUntil: new Date(Date.now() + 86400000), actorId: 'rec_pat', actorRole: 'patient', language: 'en', simulation: true });
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => String(url).includes('generativelanguage') ? {
      ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ observedCondition: 'A pale area', conditionCategory: 'white_lesion', riskTier: 'moderate_risk_support', confidenceScore: 0.7, anatomicalSite: 'Left cheek', visualFindings: ['Pale patch'], recommendedDoctor: { specialty: 'Oral medicine specialist', facility: 'District hospital', urgency: 'priority', timelineDays: 10, consultationReason: 'Review' }, answerText: 'A pale patch.', speechText: 'A pale patch.' }) }] } }] }),
    } as any : realFetch(url, init)));
    const analysed = await request(app).post(`/api/v1/consultation-sessions/captures/${captureId}/analyze`).set('Authorization', `Bearer ${token.rec_doc_a}`);
    expect(analysed.status).toBe(200);
    expect(analysed.body.data.summary.riskLevel).toBe('moderate');
    const replay = await request(app).post(`/api/v1/consultation-sessions/captures/${captureId}/analyze`).set('Authorization', `Bearer ${token.rec_doc_a}`);
    expect(replay.body.data.screeningId).toBe(analysed.body.data.screeningId);
  });
});
