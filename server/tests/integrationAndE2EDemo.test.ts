import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import crypto from 'crypto';

import { createApp } from '../src/app.js';
import { runMasterSeed } from '../src/modules/seed/masterSeed.js';
import { User } from '../src/modules/auth/userModel.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { Camp } from '../src/modules/camp/campModel.js';
import { Appointment } from '../src/modules/appointment/appointmentModel.js';
import { BiopsyCase } from '../src/modules/biopsy/biopsyModel.js';
import { Referral } from '../src/modules/referral/referralModel.js';
import { Teleconsultation } from '../src/modules/teleconsultation/teleconsultationModel.js';
import { SyncLedger } from '../src/modules/patient/syncLedgerModel.js';
import { createDeviceSession, revokeDevice } from '../src/modules/auth/deviceService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 19: Compulsory End-to-End Demo Script & Jury Acceptance Tests', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Role tokens for the end-to-end demo flow
  let sysadminToken: string;
  let adminToken: string;
  let moToken: string;
  let anmToken: string;
  let ashaToken: string;
  let patientToken: string;

  let ashaSessionId: string;
  let patientRegistrationMutationId: string;
  let newPatientId: string;
  let newCaseId: string;
  let photoData: string;
  let photoSha256: string;
  let testCampId: string;
  let testAppointmentId: string;
  let testBiopsyId: string;
  let testReferralId: string;
  let testConsultationId: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsIntegrationE2E');
    await mongoose.connect(replSet.getUri());

    // Populate all Part 3 master seed data in clean environment
    await runMasterSeed();

    // Generate authenticated device sessions for all 6 demo actors
    const sysUser = (await User.findOne({ username: 'sysadmin.itda' }))!;
    const adminUser = (await User.findOne({ username: 'admin.paderu' }))!;
    const moUser = (await User.findOne({ username: 'doctor.paderu' }))!;
    const anmUser = (await User.findOne({ username: 'anm.chintapalli' }))!;
    const ashaUser = (await User.findOne({ username: 'asha.pad01' }))!;
    const patUser = (await User.findOne({ username: 'patient.pad01' }))!;

    const s1 = await createDeviceSession({ user: sysUser, deviceId: 'dev_sys_01', deviceName: 'ITDA Command Console', userAgent: 'Chrome/130', ip: '10.0.1.1' });
    sysadminToken = s1.accessToken;

    const s2 = await createDeviceSession({ user: adminUser, deviceId: 'dev_adm_01', deviceName: 'Admin Laptop Paderu', userAgent: 'Chrome/130', ip: '10.0.1.2' });
    adminToken = s2.accessToken;

    const s3 = await createDeviceSession({ user: moUser, deviceId: 'dev_mo_01', deviceName: 'MO Clinical Workstation', userAgent: 'Chrome/130', ip: '10.0.1.3' });
    moToken = s3.accessToken;

    const s4 = await createDeviceSession({ user: anmUser, deviceId: 'dev_anm_01', deviceName: 'ANM Tablet Chintapalli', userAgent: 'Android/14', ip: '10.0.1.4' });
    anmToken = s4.accessToken;

    const s5 = await createDeviceSession({ user: ashaUser, deviceId: 'dev_asha_01', deviceName: 'ASHA Field Tablet Hukumpeta', userAgent: 'Android/14', ip: '10.0.1.5' });
    ashaToken = s5.accessToken;
    ashaSessionId = s5.deviceSessionId;

    const s6 = await createDeviceSession({ user: patUser, deviceId: 'dev_pat_01', deviceName: 'Patient Mobile App', userAgent: 'Android/14', ip: '10.0.1.6' });
    patientToken = s6.accessToken;
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  // =========================================================================
  // JURY TEST 1: System Baseline & Simulation Demarcation
  // =========================================================================
  it('Jury Test 1: Verifies platform baseline health and non-dismissible simulation banners', async () => {
    const healthRes = await request(app).get('/api/v1/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.success).toBe(true);
    expect(healthRes.body.data.simulation).toBe(true);
    expect(healthRes.body.data.status).toBe('HEALTHY');
  });

  // =========================================================================
  // JURY TEST 2: Step 1 — Frontline Intake & Verbatim Address Preservation
  // =========================================================================
  it('Jury Test 2: ASHA registers patient with OTP-free intake & verbatim address preservation', async () => {
    patientRegistrationMutationId = `mut_pat_demo_${Date.now()}`;
    const intakeRes = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        fullName: 'Gemmeli Devudu',
        gender: 'male',
        ageEstimated: 46,
        phone: '+918912345688',
        villageId: 'vil_dumbriguda_03',
        villageName: 'Dumbriguda Hamlet',
        mandal: 'Dumbriguda',
        district: 'Alluri Sitharama Raju',
        hospitalId: 'hosp_paderu_dh',
        originalAddressText: 'Opposite Gothula Water Canal, Bagata Habitation, Dumbriguda',
        clientMutationId: patientRegistrationMutationId,
      });

    expect(intakeRes.status).toBe(201);
    expect(intakeRes.body.success).toBe(true);
    newPatientId = intakeRes.body.data.patient.patientId;
    expect(newPatientId).toBeDefined();

    // Verify verbatim address unchanged in DB
    const patientDoc = await Patient.findOne({ patientId: newPatientId });
    expect(patientDoc?.originalAddressText).toBe(
      'Opposite Gothula Water Canal, Bagata Habitation, Dumbriguda'
    );
  });

  // =========================================================================
  // JURY TEST 3: Step 2 — Oral Screening, Photo Capture & Demo AI Assistance
  // =========================================================================
  it('Jury Test 3: Conducts oral mucosal screening with photo & DEMO AI safety banner', async () => {
    photoData = 'RAW_PIXEL_BUFFER_OF_ORAL_MUCOSA_LEUKOPLAKIA_LESSION_PADERU_2026';
    photoSha256 = crypto.createHash('sha256').update(photoData).digest('hex');

    const screenRes = await request(app)
      .post('/api/v1/screening/cases')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        patientId: newPatientId,
        patientName: 'Gemmeli Devudu',
        villageId: 'vil_dumbriguda_03',
        villageName: 'Dumbriguda Hamlet',
        priority: 'urgent',
        photoIds: [`pho_${photoSha256.slice(0, 10)}`],
      });

    expect(screenRes.status).toBe(201);
    newCaseId = screenRes.body.data.case.caseId;
    expect(newCaseId).toBeDefined();

    // Demo AI inference request
    const aiRes = await request(app)
      .post('/api/v1/screening/ai/analyze')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ photoSha256 });

    expect(aiRes.status).toBe(200);
    expect(aiRes.body.data.disclaimer).toContain('DEMO AI SCREENING SUPPORT ONLY');
  });

  // =========================================================================
  // JURY TEST 4: Step 3 — Offline Queue Batch Sync & Idempotent Replay
  // =========================================================================
  it('Jury Test 4: Offline queue synchronization: byte-identical verification & idempotent replay', async () => {
    const offlineItem = {
      clientMutationId: `mut_sync_e2e_${Date.now()}`,
      type: 'screening_photo' as const,
      payload: {
        photoId: `pho_${photoSha256.slice(0, 8)}`,
        photoBase64: photoData,
      },
      originalSha256: photoSha256,
    };

    // 1. Initial Sync
    const syncRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ items: [offlineItem] });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.data.results[0].status).toBe('synced');
    expect(syncRes.body.data.results[0].verifiedSha256).toBe(photoSha256);

    // 2. Idempotent Replay: Exact same payload resubmitted must NOT create duplicate records
    const replayRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ items: [offlineItem] });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.data.results[0].status).toBe('replayed_without_mutation');
    expect(replayRes.body.data.results[0].idempotentReplay).toBe(true);

    const ledgerCount = await SyncLedger.countDocuments({ clientMutationId: offlineItem.clientMutationId });
    expect(ledgerCount).toBe(1);
  });

  // =========================================================================
  // JURY TEST 5: Step 4 — Medical Officer Review Queue & Case Assessment
  // =========================================================================
  it('Jury Test 5: Medical Officer reviews assigned case and records non-diagnostic assessment', async () => {
    // Assign case to Dr. Suresh Varma
    await ScreeningCase.updateOne(
      { caseId: newCaseId },
      { $set: { assignedMoId: 'usr_mo_003', assignedMoName: 'Dr. Suresh Varma, MD', status: 'assigned' } }
    );

    // MO lists active case queue
    const queueRes = await request(app)
      .get('/api/v1/screening/cases?assignedMoId=usr_mo_003')
      .set('Authorization', `Bearer ${moToken}`);

    expect(queueRes.status).toBe(200);
    const caseInQueue = queueRes.body.data.items.find((c: any) => c.caseId === newCaseId);
    expect(caseInQueue).toBeDefined();

    // MO records clinical assessment
    const assessRes = await request(app)
      .post(`/api/v1/screening/cases/${newCaseId}/assess`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({
        clinicalImpression: 'Clinical examination confirms homogeneous leukoplakic plaque. Recommended for incisional biopsy.',
        riskCategorization: 'high_risk_support',
        recommendedFollowUpDays: 14,
        lesionObserved: true,
        anatomicalSite: 'Right buccal mucosa',
      });

    expect(assessRes.status).toBe(201);
    expect(assessRes.body.success).toBe(true);
  });

  // =========================================================================
  // JURY TEST 6: Step 5 — Screening Camp Lifecycle (PUBLISHED required to start)
  // =========================================================================
  it('Jury Test 6: Enforces screening camp lifecycle: rejecting DRAFT to ONGOING transition', async () => {
    // 1. Create Camp in DRAFT
    const createRes = await request(app)
      .post('/api/v1/camps')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Araku Valley Oral Health Outreach Camp',
        hospitalId: 'hosp_paderu_dh',
        villageId: 'vil_dumbriguda_03',
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date(Date.now() + 2 * 86400000).toISOString(),
        targetPopulation: 150,
        location: {
          address: 'Community Hall, Dumbriguda Village',
        },
      });

    expect(createRes.status).toBe(201);
    testCampId = createRes.body.data.camp.campId;

    // 2. Attempt to start camp while DRAFT -> Must be rejected with 400!
    const illegalStartRes = await request(app)
      .post(`/api/v1/camps/${testCampId}/start`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(illegalStartRes.status).toBe(400);
    expect(illegalStartRes.body.error.message).toContain('Camp must be PUBLISHED before starting');

    // 3. Publish Camp
    const publishRes = await request(app)
      .post(`/api/v1/camps/${testCampId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(publishRes.status).toBe(200);

    // 4. Now Start Camp -> Allowed
    const startRes = await request(app)
      .post(`/api/v1/camps/${testCampId}/start`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(startRes.status).toBe(200);

    // 5. Complete Camp
    const completeRes = await request(app)
      .post(`/api/v1/camps/${testCampId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.camp.status).toBe('completed');
  });

  // =========================================================================
  // JURY TEST 7: Step 6 — Appointment Booking & Self-Confirmation Prevention
  // =========================================================================
  it('Jury Test 7: Prevents requester self-confirmation and books appointment slot safely', async () => {
    // 1. ASHA requests appointment for patient
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    if (futureDate.getDay() === 0) futureDate.setDate(futureDate.getDate() + 1);
    futureDate.setHours(10, 0, 0, 0);
    const slotStart = new Date(futureDate);
    const slotEnd = new Date(futureDate.getTime() + 20 * 60000);

    const reqRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({
        patientId: newPatientId,
        destinationHospitalId: 'hosp_paderu_dh',
        slotStartTime: slotStart.toISOString(),
        slotEndTime: slotEnd.toISOString(),
        reason: 'Biopsy preparation consultation',
      });

    expect(reqRes.status).toBe(201);
    testAppointmentId = reqRes.body.data.appointment.appointmentId;

    // 2. Requester (ASHA) attempts to confirm their own appointment -> Must be rejected with 403!
    const selfConfirmRes = await request(app)
      .post(`/api/v1/appointments/${testAppointmentId}/confirm`)
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(selfConfirmRes.status).toBe(403);

    // 3. Authorized Hospital Manager confirms appointment
    const confirmRes = await request(app)
      .post(`/api/v1/appointments/${testAppointmentId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.appointment.status).toBe('confirmed');
  });

  // =========================================================================
  // JURY TEST 8: Step 7 — Biopsy Specimen Lifecycle & Controlled Result Release
  // =========================================================================
  it('Jury Test 8: Biopsy tracking: RECOLLECTION_REQUIRED loop & controlled result release', async () => {
    // 1. MO orders biopsy
    const orderRes = await request(app)
      .post('/api/v1/biopsy')
      .set('Authorization', `Bearer ${moToken}`)
      .send({
        patientId: newPatientId,
        patientName: 'Gemmeli Devudu',
        hospitalId: 'hosp_paderu_dh',
        anatomicalLocation: 'Right buccal mucosal plaque',
      });

    expect(orderRes.status).toBe(201);
    testBiopsyId = orderRes.body.data.biopsy.biopsyId;

    // 2. Schedule and collect specimen
    await request(app)
      .post(`/api/v1/biopsy/${testBiopsyId}/schedule`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ procedureDate: new Date().toISOString(), scheduledHospitalId: 'hosp_paderu_dh' });

    await request(app)
      .post(`/api/v1/biopsy/${testBiopsyId}/collect`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ specimenBarcode: 'BAR_PAD_001_A', tissueType: 'Epithelial tissue' });

    // 3. Laboratory marks RECOLLECTION_REQUIRED
    const recollectRes = await request(app)
      .post(`/api/v1/biopsy/${testBiopsyId}/recollection-required`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Specimen drying artifact encountered during transit.' });

    expect(recollectRes.status).toBe(200);
    expect(recollectRes.body.data.biopsy.status).toBe('RECOLLECTION_REQUIRED');

    // 4. Re-collect specimen and send to lab
    await request(app)
      .post(`/api/v1/biopsy/${testBiopsyId}/collect`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ specimenBarcode: 'BAR_PAD_001_B', tissueType: 'Epithelial tissue' });

    await request(app)
      .post(`/api/v1/biopsy/${testBiopsyId}/send-to-lab`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ destinationLabName: 'KGH Visakhapatnam Pathology Department' });

    // 5. Pathologist records findings
    const findingsRes = await request(app)
      .post(`/api/v1/biopsy/${testBiopsyId}/findings`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pathologistName: 'Dr. Radhika, MD (Pathology)',
        specimenAdequacy: 'Adequate for evaluation',
        grossDescription: 'Single mucosal fragment 0.4 x 0.3 cm',
        microscopicObservations: 'Histological evaluation reveals mild epithelial dysplasia with hyperkeratosis.',
        pathologistImpression: 'Mild dysplasia with keratosis',
      });
    expect(findingsRes.status).toBe(200);

    // 6. Patient cannot view findings until released!
    const unreleasedView = await request(app)
      .get(`/api/v1/biopsy/${testBiopsyId}/findings`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(unreleasedView.status).toBe(403);

    // 7. Medical Officer formally releases results
    const releaseRes = await request(app)
      .post(`/api/v1/biopsy/${testBiopsyId}/release-result`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({
        patientSummaryMessage: 'Biopsy analysis completed. Please attend your scheduled follow-up consultation.',
        recommendedAction: 'Schedule follow-up appointment with Medical Officer',
      });
    expect(releaseRes.status).toBe(200);

    // 8. Patient can now view released findings
    const releasedView = await request(app)
      .get(`/api/v1/biopsy/${testBiopsyId}/findings`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(releasedView.status).toBe(200);
    expect(releasedView.body.data.findings.microscopicObservations).toContain('mild epithelial dysplasia');
  });

  // =========================================================================
  // JURY TEST 9: Step 8 — Tertiary Referral & Specialist Navigation Reminders
  // =========================================================================
  it('Jury Test 9: Creates tertiary referral to KGH Visakhapatnam with privacy-safe navigation', async () => {
    // 1. MO creates tertiary referral
    const refRes = await request(app)
      .post('/api/v1/referrals')
      .set('Authorization', `Bearer ${moToken}`)
      .send({
        patientId: newPatientId,
        sourceHospitalId: 'hosp_paderu_dh',
        destinationHospitalId: 'hosp_kgh_vsp',
        reasonForReferral: 'Secondary surgical oncology evaluation for buccal lesion',
      });

    expect(refRes.status).toBe(201);
    testReferralId = refRes.body.data.referral.referralId;

    // Destination hospital (or system admin) accepts the referral
    const acceptRes = await request(app)
      .post(`/api/v1/referrals/${testReferralId}/accept`)
      .set('Authorization', `Bearer ${sysadminToken}`);
    expect(acceptRes.status).toBe(200);

    // 2. Reminder scheduled with patient privacy: condition name NOT mentioned
    const scheduleReminderRes = await request(app)
      .post(`/api/v1/referrals/${testReferralId}/schedule`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ scheduledDate: new Date(Date.now() + 2 * 86400000).toISOString() });

    expect(scheduleReminderRes.status).toBe(200);
    const reminderMsg = scheduleReminderRes.body.data.referral.followUpReminder.reminderText;
    expect(reminderMsg).not.toContain('cancer');
    expect(reminderMsg).not.toContain('tumor');
  });

  // =========================================================================
  // JURY TEST 10: Step 9 — Teleconsultation & BLOCKED Video Adapter Stub
  // =========================================================================
  it('Jury Test 10: Teleconsultation flow: clinician versioned notes & BLOCKED media adapters', async () => {
    // 1. Request teleconsultation
    const tcRes = await request(app)
      .post('/api/v1/teleconsultation')
      .set('Authorization', `Bearer ${moToken}`)
      .send({
        patientId: newPatientId,
        patientName: 'Gemmeli Devudu',
        hospitalId: 'hosp_paderu_dh',
        assignedClinicianId: 'usr_mo_003',
        assignedClinicianName: 'Dr. Suresh Kumar (MO)',
      });

    expect(tcRes.status).toBe(201);
    testConsultationId = tcRes.body.data.consultation.consultationId;

    // 2. Video and voice adapter checks: MUST return BLOCKED status
    const videoRes = await request(app)
      .get(`/api/v1/teleconsultation/${testConsultationId}/video-session`)
      .set('Authorization', `Bearer ${moToken}`);

    expect(videoRes.status).toBe(200);
    expect(videoRes.body.data.videoStatus.status).toBe('BLOCKED');

    const voiceRes = await request(app)
      .get(`/api/v1/teleconsultation/${testConsultationId}/voice-session`)
      .set('Authorization', `Bearer ${moToken}`);

    expect(voiceRes.status).toBe(200);
    expect(voiceRes.body.data.voiceStatus.status).toBe('BLOCKED');

    // 3. Record clinician consultation notes
    const noteRes = await request(app)
      .post(`/api/v1/teleconsultation/${testConsultationId}/notes`)
      .set('Authorization', `Bearer ${moToken}`)
      .send({ noteText: 'Case discussion concluded. Surgical margins reviewed.' });

    expect(noteRes.status).toBe(201);
    expect(noteRes.body.data.note.currentVersion).toBe(1);
    expect(noteRes.body.data.note.originalHash).toBeDefined();
  });

  // =========================================================================
  // JURY TEST 11: Step 10 — Spatial Map (13 Endpoints) & Small-Count Suppression
  // =========================================================================
  it('Jury Test 11: Queries all 13 spatial map endpoints and verifies small-count cell suppression', async () => {
    const mapEndpoints = [
      '/api/v1/map/villages',
      '/api/v1/map/villages/vil_dumbriguda_03',
      '/api/v1/map/villages/vil_dumbriguda_03/workers',
      '/api/v1/map/villages/vil_dumbriguda_03/facilities',
      '/api/v1/map/villages/vil_dumbriguda_03/screenings-summary',
      '/api/v1/map/villages/vil_dumbriguda_03/risk-metrics',
      '/api/v1/map/villages/vil_dumbriguda_03/camps',
      '/api/v1/map/clusters',
      '/api/v1/map/boundaries/mandals',
      '/api/v1/map/corridors/transport',
      '/api/v1/map/connectivity-zones',
      '/api/v1/map/heatmap/screening-coverage',
      '/api/v1/map/geo-export',
    ];

    expect(mapEndpoints.length).toBe(13);

    for (const ep of mapEndpoints) {
      const res = await request(app).get(ep).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    }

    // Verify cell suppression on low count (< 5)
    const summaryRes = await request(app)
      .get('/api/v1/map/villages/vil_dumbriguda_03/screenings-summary')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(summaryRes.body.data.metrics.totalScreenings.isSuppressed).toBe(true);
    expect(summaryRes.body.data.metrics.totalScreenings.displayValue).toBe('< 5');
  });

  // =========================================================================
  // JURY TEST 12: Step 11 — Aadhaar Verification Simulation (4 Endpoints)
  // =========================================================================
  it('Jury Test 12: Aadhaar simulation: 4 MOCK-labelled endpoints with non-custodial masking', async () => {
    // 1. Generate OTP
    const otpRes = await request(app)
      .post('/api/v1/mock/aadhaar/generate-otp')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ testAadhaarNumber: '999900011234', purpose: 'Patient Registration' });

    expect(otpRes.status).toBe(200);
    expect(otpRes.body.data.mock).toBe(true);
    expect(otpRes.body.data.label).toBe('MOCK');
    expect(otpRes.body.data.maskedAadhaar).toBe('XXXX-XXXX-1234');

    // 2. Verify OTP
    const verifyOtpRes = await request(app)
      .post('/api/v1/mock/aadhaar/verify-otp')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ transactionId: otpRes.body.data.transactionId, otp: '123456' });

    expect(verifyOtpRes.status).toBe(200);
    expect(verifyOtpRes.body.data.mock).toBe(true);
    expect(verifyOtpRes.body.data.status).toBe('simulated_match');

    // 3. Demographic Auth
    const demoRes = await request(app)
      .post('/api/v1/mock/aadhaar/demographic-auth')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ testAadhaarNumber: '999900011234', name: 'Gemmeli Devudu', yearOfBirth: '1980', gender: 'male' });

    expect(demoRes.status).toBe(200);
    expect(demoRes.body.data.mock).toBe(true);

    // 4. Status
    const statusRes = await request(app)
      .get('/api/v1/mock/aadhaar/status')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.mock).toBe(true);
    expect(statusRes.body.data.realIntegration).toBe('BLOCKED');
  });

  // =========================================================================
  // JURY TEST 13: Step 12 — Device Revocation & Logout Queue Wipe
  // =========================================================================
  it('Jury Test 13: Enforces device revocation and verifies queue wipe semantics', async () => {
    // 1. Revoke ASHA session
    await revokeDevice('usr_asha_005', ashaSessionId);

    // 2. Subsequent sync call from revoked session must fail with 401 DEVICE_REVOKED
    const syncAfterRevocationRes = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${ashaToken}`)
      .send({ items: [] });

    expect(syncAfterRevocationRes.status).toBe(401);
    expect(syncAfterRevocationRes.body.error.code).toBe('DEVICE_REVOKED');
  });
});
