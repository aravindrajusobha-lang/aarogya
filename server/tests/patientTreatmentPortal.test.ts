import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Prescription } from '../src/modules/prescription/prescriptionModel.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { StoredFile } from '../src/modules/storage/storageModel.js';
import { ScreeningPhoto } from '../src/modules/screening/screeningPhotoModel.js';
import { rm } from 'node:fs/promises';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Patient treatment portal API', () => {
  const app = createApp();
  const patientId = 'PAT-PORTAL-TEST-1';
  const otherPatientId = 'PAT-PORTAL-TEST-2';
  const patientUserId = 'USR-PORTAL-TEST-1';
  let replSet: Awaited<ReturnType<typeof createTestReplicaSet>>;
  let patientToken: string;
  const prescriptionId = 'RX-PORTAL-TEST-1';
  const createdTreatmentPhotoIds: string[] = [];
  const createdTreatmentFileIds: string[] = [];

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsPatientTreatmentPortal');
    await mongoose.connect(replSet.getUri());
    await User.create({
      userId: patientUserId, username: 'patient_portal_test', fullName: 'Demo Patient',
      role: 'patient', patientId, passwordHash: 'unused', mfaEnabled: false,
    });
    await User.create({ userId: 'USR-PORTAL-TEST-2', username: 'patient_portal_test_2', fullName: 'Other Patient', role: 'patient', patientId: otherPatientId, passwordHash: 'unused', mfaEnabled: false });
    patientToken = signAccessToken({ userId: patientUserId, role: 'patient', scopes: getRoleCapabilities('patient') });
    await Prescription.create({
      prescriptionId, patientId, patientName: 'Demo Patient', doctorId: 'DR-TEST', doctorName: 'Demo Clinician',
      doctorSpecialty: 'Dental Surgeon', hospitalId: 'HOSP-TEST', hospitalName: 'Demo Facility',
      clinicalObservations: 'Clinician record for portal test', diagnosisImpression: 'Clinician assessment',
      medicines: [{ medicineName: 'Demo medicine', dosage: '1 tablet', frequency: 'Once daily', durationDays: 5, instructions: 'After food' }],
      status: 'active', simulation: true,
    });
  });

  afterAll(async () => {
    const files = await StoredFile.find({ fileId: { $in: createdTreatmentFileIds } }).lean();
    await Promise.all(files.map((file) => rm(file.storedPath, { force: true }).catch(() => undefined)));
    await StoredFile.deleteMany({ fileId: { $in: createdTreatmentFileIds } });
    await ScreeningPhoto.deleteMany({ photoId: { $in: createdTreatmentPhotoIds } });
    await mongoose.disconnect();
    await replSet?.stop();
  });

  it('registers a synthetic patient with consent and mutation ID without requiring OTP', async () => {
    const registration = await request(app).post('/api/v1/patient/auth/register').send({
      fullName: 'Portal Registration Demo',
      phone: '9876543211',
      gender: 'female',
      yearOfBirth: 1994,
      village: 'Demo Village',
      mandal: 'Paderu',
      address: 'Near the community centre',
      consentGiven: true,
      clientMutationId: 'eb71ca89-53aa-4d08-9b43-389ba16857d0',
    });

    expect(registration.status).toBe(201);
    expect(registration.body.data.user.role).toBe('patient');
    expect(registration.body.data.user.patientId).toBeTruthy();
    expect(registration.body.data.accessToken).toBeTruthy();
  });

  it('starts tracking from an owned prescription, saves an idempotent log, and denies another patient’s plan', async () => {
    const startMutation = '7f1bbf22-40a7-4f16-92a5-19879ac91bde';
    const start = await request(app).post('/api/patient/treatment-plans/from-prescription')
      .set('Authorization', `Bearer ${patientToken}`).send({ mutationId: startMutation, prescriptionId });
    expect(start.status).toBe(201);
    expect(start.body.data.plan.patientId).toBe(patientId);
    const replay = await request(app).post('/api/patient/treatment-plans/from-prescription')
      .set('Authorization', `Bearer ${patientToken}`).send({ mutationId: startMutation, prescriptionId });
    expect(replay.status).toBe(201);
    expect(replay.body.data.idempotentReplay).toBe(true);

    const plan = start.body.data.plan;
    const photoMutationId = 'f6df142a-a474-4db9-80a6-aec7464653c8';
    const photo = await request(app).post(`/api/patient/treatment-plans/${plan.treatmentPlanId}/photos`)
      .set('Authorization', `Bearer ${patientToken}`)
      .field('mutationId', photoMutationId)
      .field('consentGiven', 'true')
      .attach('photo', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'progress.jpg', contentType: 'image/jpeg' });
    expect(photo.status).toBe(201);
    expect(photo.body.data.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
    createdTreatmentPhotoIds.push(photo.body.data.photoProgress.photoId);
    createdTreatmentFileIds.push(photo.body.data.photoProgress.fileId);

    const privatePhoto = await request(app).get(`/api/v1/storage/files/${photo.body.data.photoProgress.fileId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(privatePhoto.status).toBe(200);

    const save = await request(app).post('/api/patient/treatment-logs')
      .set('Authorization', `Bearer ${patientToken}`).send({
        mutationId: 'b5723fb1-04ad-45a0-8b2b-6001c7c1458a',
        treatmentPlanId: plan.treatmentPlanId,
        date: new Date().toISOString().slice(0, 10),
        medicineLogs: [{ medicineId: plan.medicines[0].medicineId, taken: true }],
        photoProgress: photo.body.data.photoProgress,
      });
    expect(save.status).toBe(200);
    expect(save.body.data.log.adherencePercentage).toBe(100);
    expect(save.body.data.log.photoProgress.photoId).toBe(photo.body.data.photoProgress.photoId);

    const otherToken = signAccessToken({ userId: 'USR-PORTAL-TEST-2', role: 'patient', scopes: getRoleCapabilities('patient') });
    const denied = await request(app).get(`/api/patient/treatment-plans/${plan.treatmentPlanId}/logs`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(denied.status).toBe(404);
  });

  it('requires explicit consent for profile updates and keeps profile, chat, and support data scoped', async () => {
    const noConsent = await request(app).put('/api/patient/profile')
      .set('Authorization', `Bearer ${patientToken}`).send({ mutationId: '5eb63d7a-df93-4a5a-9e2a-927a211f3244', fullName: 'Updated Demo Patient' });
    expect(noConsent.status).toBe(400);

    const profileUpdate = await request(app).put('/api/patient/profile')
      .set('Authorization', `Bearer ${patientToken}`).send({
        mutationId: '6cc1f1c4-820c-4651-ae13-58149f1e0ad5', consentGiven: true,
        fullName: 'Updated Demo Patient', yearOfBirth: 1985, gender: 'female', village: 'Demo Village', mandal: 'Demo Mandal',
      });
    expect(profileUpdate.status).toBe(200);
    expect(profileUpdate.body.data.profile.fullName).toBe('Updated Demo Patient');
    expect(profileUpdate.body.data.profile.passwordHash).toBeUndefined();
    const profileReplay = await request(app).put('/api/patient/profile')
      .set('Authorization', `Bearer ${patientToken}`).send({
        mutationId: '6cc1f1c4-820c-4651-ae13-58149f1e0ad5', consentGiven: true,
        fullName: 'Updated Demo Patient', yearOfBirth: 1985, gender: 'female', village: 'Demo Village', mandal: 'Demo Mandal',
      });
    expect(profileReplay.body.data.idempotentReplay).toBe(true);

    const sent = await request(app).post('/api/patient/screenings/SCREEN-OWN-1/chat')
      .set('Authorization', `Bearer ${patientToken}`).send({
        mutationId: 'b587fe4d-68e5-47b2-8606-86fdb9ac0911', message: 'What does this report wording mean?', language: 'en',
        reportContext: 'DEMO AI screening support observation.', shareProfileContext: false,
      });
    expect(sent.status).toBe(200);
    const history = await request(app).get('/api/patient/screenings/SCREEN-OWN-1/chat')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(history.status).toBe(200);
    expect(history.body.data.messages).toHaveLength(2);

    const ticketBody = { mutationId: 'b8d4cf31-d539-4e25-8dfa-36649a027edc', category: 'technical', subject: 'Portal help', description: 'I need help opening a saved report.' };
    const ticket = await request(app).post('/api/patient/support-tickets').set('Authorization', `Bearer ${patientToken}`).send(ticketBody);
    const ticketReplay = await request(app).post('/api/patient/support-tickets').set('Authorization', `Bearer ${patientToken}`).send(ticketBody);
    expect(ticket.status).toBe(201);
    expect(ticketReplay.body.data.idempotentReplay).toBe(true);

    const otherToken = signAccessToken({ userId: 'USR-PORTAL-TEST-2', role: 'patient', scopes: getRoleCapabilities('patient') });
    const otherHistory = await request(app).get('/api/patient/screenings/SCREEN-OWN-1/chat').set('Authorization', `Bearer ${otherToken}`);
    const otherTickets = await request(app).get('/api/patient/support-tickets').set('Authorization', `Bearer ${otherToken}`);
    expect(otherHistory.body.data.messages).toHaveLength(0);
    expect(otherTickets.body.data.tickets).toHaveLength(0);
  });

  it('stores and replays patient reminder preference updates', async () => {
    const preferences = { mutationId: '6fce935c-46a2-42f7-844d-19f99d7fc024', channels: { inApp: true, sms: false, email: true }, preferredLanguage: 'te' };
    const update = await request(app).put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${patientToken}`).send(preferences);
    expect(update.status).toBe(200);
    expect(update.body.data.preferences.channels.email).toBe(true);
    const replay = await request(app).put('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${patientToken}`).send(preferences);
    expect(replay.status).toBe(200);
    expect(replay.body.data.idempotentReplay).toBe(true);
  });
});
