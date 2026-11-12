import crypto from 'node:crypto';
import { ConsultationChat } from '../src/modules/consultation/consultationChatModel.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type AddressInfo } from 'node:http';
import mongoose from 'mongoose';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { attachConsultationSocket } from '../src/modules/consultation/consultationSocket.js';
import { Consultation } from '../src/modules/consultation/consultationModel.js';
import { Appointment } from '../src/modules/appointment/appointmentModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

const receive = <T = any>(socket: Socket, event: string) => new Promise<T>((resolve) => socket.once(event, resolve));

describe('Appointment WebRTC Socket.IO transport', () => {
  let replSet: MongoMemoryReplSet;
  let httpServer: ReturnType<typeof createServer>;
  let realtime: ReturnType<typeof attachConsultationSocket>;
  let origin: string;
  let patientToken: string;
  let doctorToken: string;
  let workerToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsConsultationSocket');
    await mongoose.connect(replSet.getUri());
    await User.create([
      { userId: 'socket_patient', username: 'socket_patient', fullName: 'Synthetic Patient', role: 'patient', patientId: 'patient_socket_01', passwordHash: 'test-hash', mfaEnabled: false, status: 'active' },
      { verificationStatus: 'verified', userId: 'socket_doctor', username: 'socket_doctor', fullName: 'Assigned Clinician', role: 'medical_officer', hospitalId: 'hospital_socket_01', passwordHash: 'test-hash', mfaEnabled: false, status: 'active' },
      { userId: 'socket_worker', username: 'socket_worker', fullName: 'Field Worker', role: 'asha', passwordHash: 'test-hash', mfaEnabled: false, status: 'active' },
    ]);
    patientToken = signAccessToken({ userId: 'socket_patient', role: 'patient', scopes: getRoleCapabilities('patient') });
    doctorToken = signAccessToken({ userId: 'socket_doctor', role: 'medical_officer', hospitalId: 'hospital_socket_01', scopes: getRoleCapabilities('medical_officer') });
    workerToken = signAccessToken({ userId: 'socket_worker', role: 'asha', scopes: getRoleCapabilities('asha') });
    httpServer = createServer(createApp());
    realtime = attachConsultationSocket(httpServer, ['http://localhost']);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  }, 60000);

  afterAll(async () => {
    if (realtime) await new Promise<void>((resolve) => realtime.close(() => resolve()));
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('rejects authenticated roles that are not patients or assigned clinicians', async () => {
    const client = connectSocket(origin, { auth: { token: workerToken }, transports: ['websocket'], reconnection: false });
    const error = await new Promise<Error>((resolve) => client.once('connect_error', resolve));
    expect(error.message).toContain('cannot enter a consultation');
    client.close();
  });

  it('admits only the appointment patient and assigned doctor, then relays signaling between them', async () => {
    const appointmentId = 'apt_webrtc_socket_01';
    const slotStartTime = new Date(Date.now() - 60_000);
    await Appointment.create({
      appointmentId,
      consultationMode: 'online',
      patientId: 'patient_socket_01',
      patientName: 'Synthetic Patient',
      destinationHospitalId: 'hospital_socket_01',
      assignedDoctorId: 'socket_doctor',
      slotStartTime,
      slotEndTime: new Date(Date.now() + 20 * 60_000),
      durationMinutes: 20,
      status: 'confirmed',
      type: 'clinical_consultation',
      requestedBy: { userId: 'socket_patient', role: 'patient' },
      reschedulingHistory: [],
      offlineQueued: false,
    });

    const patient = connectSocket(origin, { auth: { token: patientToken }, transports: ['websocket'], reconnection: false });
    await new Promise<void>((resolve, reject) => { patient.once('connect', () => resolve()); patient.once('connect_error', reject); });
    const waiting = receive(patient, 'consultation:error');
    patient.emit('consultation:join', { appointmentId });
    expect((await waiting).message).toContain('doctor has not started');
    const doctor = connectSocket(origin, { auth: { token: doctorToken }, transports: ['websocket'], reconnection: false });
    await new Promise<void>((resolve, reject) => { doctor.once('connect', () => resolve()); doctor.once('connect_error', reject); });
    const doctorJoin = receive(doctor, 'consultation:joined');
    doctor.emit('consultation:join', { appointmentId });
    expect(await doctorJoin).toMatchObject({ appointmentId, role: 'medical_officer', peerPresent: false });
    const patientJoin = receive(patient, 'consultation:joined');
    patient.emit('consultation:join', { appointmentId });
    expect(await patientJoin).toMatchObject({ appointmentId, role: 'patient', peerPresent: true });
    const messageId = crypto.randomUUID();
    const chat = receive(doctor, 'consultation:chat-message');
    patient.emit('consultation:chat', { messageId, text: 'Hello doctor' });
    expect(await chat).toMatchObject({ messageId, text: 'Hello doctor', role: 'patient' });
    const replay = receive(patient, 'consultation:chat-message');
    patient.emit('consultation:chat', { messageId, text: 'Hello doctor' });
    await replay;
    expect(await ConsultationChat.countDocuments({ messageId })).toBe(1);
    expect((await Consultation.findOne({ appointmentId }))?.status).toBe('IN_CALL');

    const relayedSignal = receive(doctor, 'webrtc:signal');
    patient.emit('webrtc:signal', { type: 'offer', data: { type: 'offer', sdp: 'synthetic-offer' } });
    await expect(relayedSignal).resolves.toEqual({ type: 'offer', data: { type: 'offer', sdp: 'synthetic-offer' } });
    patient.disconnect();
    doctor.disconnect();
  });
});
