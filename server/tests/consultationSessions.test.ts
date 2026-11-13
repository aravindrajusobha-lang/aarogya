import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type AddressInfo } from 'node:http';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { attachConsultationSocket } from '../src/modules/consultation/consultationSocket.js';
import { Consultation } from '../src/modules/consultation/consultationModel.js';
import { Appointment } from '../src/modules/appointment/appointmentModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { ConsultationNote } from '../src/modules/teleconsultation/teleconsultationModel.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { computeNextFollowUp } from '../src/modules/consultation/consultationSessionRoutes.js';
import { createTestReplicaSet } from './setupReplSet.js';

const HOSPITAL = 'hospital_session_01';
const receive = <T = any>(socket: Socket, event: string) => new Promise<T>((resolve) => socket.once(event, resolve));

async function makeAppointment(appointmentId: string, mode: 'online' | 'offline', startsInMinutes: number, status = 'confirmed') {
  const slotStartTime = new Date(Date.now() + startsInMinutes * 60_000);
  await Appointment.create({
    appointmentId,
    consultationMode: mode,
    patientId: 'patient_session_01',
    patientName: 'Synthetic Session Patient',
    destinationHospitalId: HOSPITAL,
    assignedDoctorId: 'session_doctor',
    assignedDoctorName: 'Dr. Synthetic',
    slotStartTime,
    slotEndTime: new Date(slotStartTime.getTime() + 20 * 60_000),
    durationMinutes: 20,
    status,
    type: 'clinical_consultation',
    requestedBy: { userId: 'session_patient', role: 'patient' },
    reschedulingHistory: [],
    offlineQueued: false,
  });
}

describe('Doctor-controlled consultation sessions (start/end time + follow-up frequency)', () => {
  let replSet: MongoMemoryReplSet;
  let httpServer: ReturnType<typeof createServer>;
  let realtime: ReturnType<typeof attachConsultationSocket>;
  let origin: string;
  let app: ReturnType<typeof createApp>;
  let doctorToken: string;
  let otherDoctorToken: string;
  let patientToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsConsultationSessions');
    await mongoose.connect(replSet.getUri());
    await User.create([
      { userId: 'session_patient', username: 'session_patient', fullName: 'Synthetic Session Patient', role: 'patient', patientId: 'patient_session_01', passwordHash: 'test-hash', mfaEnabled: false, status: 'active' },
      { verificationStatus: 'verified', userId: 'session_doctor', username: 'session_doctor', fullName: 'Dr. Synthetic', role: 'medical_officer', hospitalId: HOSPITAL, passwordHash: 'test-hash', mfaEnabled: false, status: 'active' },
      { verificationStatus: 'verified', userId: 'session_other_doctor', username: 'session_other_doctor', fullName: 'Dr. Other', role: 'medical_officer', hospitalId: HOSPITAL, passwordHash: 'test-hash', mfaEnabled: false, status: 'active' },
    ]);
    doctorToken = signAccessToken({ userId: 'session_doctor', role: 'medical_officer', hospitalId: HOSPITAL, scopes: getRoleCapabilities('medical_officer') });
    otherDoctorToken = signAccessToken({ userId: 'session_other_doctor', role: 'medical_officer', hospitalId: HOSPITAL, scopes: getRoleCapabilities('medical_officer') });
    patientToken = signAccessToken({ userId: 'session_patient', role: 'patient', scopes: getRoleCapabilities('patient') });
    app = createApp();
    httpServer = createServer(app);
    realtime = attachConsultationSocket(httpServer, ['http://localhost']);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  }, 60000);

  afterAll(async () => {
    if (realtime) await new Promise<void>((resolve) => realtime.close(() => resolve()));
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('computes follow-up dates from the chosen frequency', () => {
    const endedAt = new Date('2026-01-01T10:00:00.000Z');
    expect(computeNextFollowUp(endedAt, 'none')).toEqual({});
    expect(computeNextFollowUp(endedAt, 'weekly')).toEqual({ intervalDays: 7, nextFollowUpAt: new Date('2026-01-08T10:00:00.000Z') });
    expect(computeNextFollowUp(endedAt, 'custom', 10).intervalDays).toBe(10);
  });

  it('lets the assigned doctor start an online consultation hours before the slot, and the patient then joins the room', async () => {
    const appointmentId = 'apt_session_online_early';
    await makeAppointment(appointmentId, 'online', 6 * 60);

    const denied = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/start`).set('Authorization', `Bearer ${otherDoctorToken}`).send({ clientMutationId: crypto.randomUUID() });
    expect(denied.status).toBe(403);
    const patientDenied = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/start`).set('Authorization', `Bearer ${patientToken}`).send({ clientMutationId: crypto.randomUUID() });
    expect(patientDenied.status).toBe(403);

    const mutationId = crypto.randomUUID();
    const started = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/start`).set('Authorization', `Bearer ${doctorToken}`).send({ clientMutationId: mutationId });
    expect(started.status).toBe(200);
    expect(started.body.data.session.startedAt).toBeTruthy();
    expect(started.body.data.session.endedAt).toBeNull();

    const replay = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/start`).set('Authorization', `Bearer ${doctorToken}`).send({ clientMutationId: mutationId });
    expect(replay.body.data.idempotentReplay).toBe(true);
    expect(await Consultation.countDocuments({ appointmentId })).toBe(1);

    const patient = connectSocket(origin, { auth: { token: patientToken }, transports: ['websocket'], reconnection: false });
    await new Promise<void>((resolve, reject) => { patient.once('connect', () => resolve()); patient.once('connect_error', reject); });
    const joined = receive(patient, 'consultation:joined');
    patient.emit('consultation:join', { appointmentId });
    expect((await joined).appointmentId).toBe(appointmentId);
    patient.close();
  });

  it('records end time, duration, versioned notes and follow-up frequency, and completes the appointment', async () => {
    const appointmentId = 'apt_session_offline';
    await makeAppointment(appointmentId, 'offline', 30);
    const start = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/start`).set('Authorization', `Bearer ${doctorToken}`).send({ clientMutationId: crypto.randomUUID() });
    expect(start.status).toBe(200);
    expect(start.body.data.session.status).toBe('IN_CALL');
    expect((await Appointment.findOne({ appointmentId }).lean() as any).status).toBe('checked_in');

    const notEnded = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/end`).set('Authorization', `Bearer ${doctorToken}`).send({ clientMutationId: crypto.randomUUID(), followUp: { frequency: 'custom' } });
    expect(notEnded.status).toBe(400);

    const endMutation = crypto.randomUUID();
    const ended = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/end`).set('Authorization', `Bearer ${doctorToken}`).send({
      clientMutationId: endMutation,
      notes: 'Area examined in person. Review in two weeks.',
      followUp: { frequency: 'biweekly', plannedSessions: 3, instructions: 'Return for review.' },
    });
    expect(ended.status).toBe(200);
    const session = ended.body.data.session;
    expect(session.status).toBe('COMPLETED');
    expect(session.endedAt).toBeTruthy();
    expect(session.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(session.followUp).toMatchObject({ frequency: 'biweekly', intervalDays: 14, plannedSessions: 3 });
    expect(new Date(session.followUp.nextFollowUpAt).getTime()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
    expect((await Appointment.findOne({ appointmentId }).lean() as any).status).toBe('completed');
    const note: any = await ConsultationNote.findOne({ consultationId: session.consultationId }).lean();
    expect(note.currentVersion).toBe(1);
    expect(note.originalHash).toMatch(/^[0-9a-f]{64}$/);

    const replay = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/end`).set('Authorization', `Bearer ${doctorToken}`).send({ clientMutationId: endMutation, followUp: { frequency: 'biweekly' } });
    expect(replay.body.data.idempotentReplay).toBe(true);
    const again = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/end`).set('Authorization', `Bearer ${doctorToken}`).send({ clientMutationId: crypto.randomUUID(), followUp: { frequency: 'none' } });
    expect(again.status).toBe(409);

    const history = await request(app).get('/api/v1/consultation-sessions/history').set('Authorization', `Bearer ${patientToken}`);
    expect(history.status).toBe(200);
    const entry = history.body.data.sessions.find((item: any) => item.appointmentId === appointmentId);
    expect(entry).toMatchObject({ status: 'COMPLETED', consultationMode: 'offline' });
    expect(entry.followUp.frequency).toBe('biweekly');
  });

  it('refuses to start a consultation for an appointment the doctor has not accepted', async () => {
    const appointmentId = 'apt_session_requested';
    await makeAppointment(appointmentId, 'online', 60, 'requested');
    const response = await request(app).post(`/api/v1/consultation-sessions/${appointmentId}/start`).set('Authorization', `Bearer ${doctorToken}`).send({ clientMutationId: crypto.randomUUID() });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('APPOINTMENT_NOT_CONFIRMED');
  });
});
