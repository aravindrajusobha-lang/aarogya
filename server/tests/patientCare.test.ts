import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Appointment } from '../src/modules/appointment/appointmentModel.js';
import { CareTransfer, PatientCare } from '../src/modules/consultation/patientCareModel.js';
import { canTreatPatient } from '../src/modules/consultation/patientCareService.js';
import { Consent } from '../src/modules/consent/consentModel.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';
import { readFileSync } from 'node:fs';

describe('Patient selection and approved doctor transfers', () => {
  let repl: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;
  const tokens: Record<string, string> = {};
  const post = (doctor: string, patient: string, action: string, body: any = {}) => request(app).post(`/api/v1/patient-care/${patient}/${action}`).set('Authorization', `Bearer ${tokens[doctor]}`).send({ mutationId: crypto.randomUUID(), ...body });
  const get = (doctor: string, path = '') => request(app).get(`/api/v1/patient-care${path}`).set('Authorization', `Bearer ${tokens[doctor]}`);
  beforeAll(async () => {
    repl = await createTestReplicaSet('rsPatientCare'); await mongoose.connect(repl.getUri()); app = createApp();
    await Promise.all([PatientCare.init(), CareTransfer.init()]);
    for (const id of ['a', 'b', 'c']) {
      await User.create({ userId: id, username: id, fullName: `Dr ${id}`, role: 'medical_officer', hospitalId: `h_${id}`, passwordHash: 'x', status: 'active', verificationStatus: 'verified' });
      tokens[id] = signAccessToken({ userId: id, role: 'medical_officer', hospitalId: `h_${id}`, scopes: getRoleCapabilities('medical_officer') });
    }
    for (const patientId of ['P1', 'P2', 'P3']) await User.create({ userId: `u_${patientId}`, username: patientId, fullName: `Demo ${patientId}`, patientId, hospitalId: 'h_a', role: 'patient', passwordHash: 'x', status: 'active' });
    tokens.patient = signAccessToken({ userId: 'u_P1', role: 'patient', patientId: 'P1', scopes: getRoleCapabilities('patient') } as any);
    for (const [i, mode] of ['online', 'offline'].entries()) await Appointment.create({ appointmentId: `APT${i}`, patientId: i ? 'P2' : 'P1', patientName: `Demo P${i + 1}`, destinationHospitalId: 'h_a', assignedDoctorId: 'a', department: 'General', slotStartTime: new Date(Date.now() + i * 3600000), slotEndTime: new Date(Date.now() + i * 3600000 + 1200000), status: 'completed', type: 'clinical_consultation', consultationMode: mode, requestedBy: { userId: 'u_P1', role: 'patient' } });
  }, 60000);
  afterAll(async () => { await mongoose.disconnect(); await repl?.stop(); });

  it('lists both online and offline patients and supports exact ID across facilities', async () => {
    const mine = await get('a'); expect(mine.status).toBe(200);
    expect(mine.body.data.patients.map((p: any) => p.patientId).sort()).toEqual(['P1', 'P2']);
    expect((await get('b')).body.data.patients).toEqual([]);
    expect((await get('b', '/P1')).body.data).toMatchObject({ canTreat: false, doctor: { userId: 'a' } });
    expect((await get('b', '/UNKNOWN')).status).toBe(404);
    expect((await get('patient', '/P1')).status).toBe(403);
    expect((await request(app).get('/api/v1/patient-care')).status).toBe(401);
  });
  it('requires current doctor approval, grants cross-facility care and replays safely', async () => {
    expect((await post('b', 'P1', 'claim')).status).toBe(409);
    const mutationId = crypto.randomUUID();
    const sent = await post('b', 'P1', 'request', { mutationId }); expect(sent.status).toBe(200);
    const requestId = sent.body.data.requestId;
    expect((await post('b', 'P1', 'request', { mutationId })).body.data).toEqual(sent.body.data);
    expect((await post('c', 'P1', 'request', { mutationId })).status).toBe(409);
    expect(await CareTransfer.countDocuments({ patientId: 'P1' })).toBe(1);
    expect(await canTreatPatient('b', 'P1')).toBe(false);
    expect((await post('b', 'P1', 'approve', { requestId })).status).toBe(403);
    expect((await post('c', 'P1', 'approve', { requestId })).status).toBe(403);
    const competing = await post('c', 'P1', 'request'); expect(competing.status).toBe(200);
    const approvalMutation = crypto.randomUUID();
    const approved = await post('a', 'P1', 'approve', { requestId, mutationId: approvalMutation }); expect(approved.status).toBe(200);
    expect((await post('a', 'P1', 'approve', { requestId, mutationId: approvalMutation })).body.data).toEqual(approved.body.data);
    expect(await canTreatPatient('b', 'P1')).toBe(true);
    expect(await canTreatPatient('a', 'P1')).toBe(false);
    expect((await CareTransfer.findOne({ requestId: competing.body.data.requestId }))?.status).toBe('superseded');
    expect((await post('a', 'P1', 'approve', { requestId: competing.body.data.requestId })).status).toBe(403);
    expect((await get('b')).body.data.patients.map((p: any) => p.patientId)).toContain('P1');
    expect((await get('a')).body.data.patients.map((p: any) => p.patientId)).toContain('P1');
  });
  it('enforces approved access in screening and prescriptions without removing consent', async () => {
    const oldSession = await request(app).post('/api/v1/consultation-sessions/APT0/start').set('Authorization', `Bearer ${tokens.a}`).send({ clientMutationId: crypto.randomUUID() });
    expect(oldSession.status).toBe(403); expect(oldSession.body.error.code).toBe('TRANSFER_REQUIRED');
    const assess = (doctor: string) => request(app).post('/api/ai/risk-assessment').set('Authorization', `Bearer ${tokens[doctor]}`).send({ patientId: 'P1', answers: {} });
    expect((await assess('a')).status).toBe(403);
    const noConsent = await assess('b'); expect(noConsent.status).toBe(403); expect(noConsent.body.error.code).toBe('CONSENT_REQUIRED');
    await Consent.create({ consentId: 'care_consent', patientId: 'P1', purpose: 'screening_ai_analysis', status: 'granted', validUntil: new Date(Date.now() + 86400000), actorId: 'u_P1', actorRole: 'patient', language: 'en' });
    expect((await assess('b')).status).toBe(200);
    const prescribe = (doctor: string) => request(app).post('/api/v1/prescriptions').set('Authorization', `Bearer ${tokens[doctor]}`).send({ mutationId: crypto.randomUUID(), patientId: 'P1', patientName: 'Demo P1', clinicalObservations: 'Demo review', medicines: [{ medicineName: 'Demo medicine', dosage: 'Demo', frequency: 'Demo', durationDays: 1 }] });
    expect((await prescribe('a')).status).toBe(403); expect((await prescribe('b')).status).toBe(201);
  });
  it('rejects without granting care and allows a patient without a doctor to be assigned', async () => {
    const r = await post('b', 'P2', 'request'); expect(r.status).toBe(200);
    expect((await post('a', 'P2', 'reject', { requestId: r.body.data.requestId })).status).toBe(200);
    expect(await canTreatPatient('b', 'P2')).toBe(false);
    expect((await post('c', 'P3', 'claim')).status).toBe(200);
    expect((await post('b', 'P3', 'claim')).status).toBe(409);
    await User.updateOne({ userId: 'c' }, { status: 'inactive' });
    expect((await get('c', '/P3')).status).toBe(403); expect(await canTreatPatient('c', 'P3')).toBe(false);
  });
  it('keeps the doctor records screen free of prescription and download controls', () => {
    const source = readFileSync(new URL('../../client/src/portal/doctor/PatientRecordsPage.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/PrescriptionModal|window\.print|\bdownload\s*=|<a\s/);
    expect(source).toContain("t('care.readOnly')");
  });
});
