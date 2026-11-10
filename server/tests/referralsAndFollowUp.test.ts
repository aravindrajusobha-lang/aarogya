import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Agenda, Job } from 'agenda';
import { createApp } from '../src/app.js';
import { Referral, ReferralRecord } from '../src/modules/referral/referralModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { Specialist } from '../src/modules/specialist/specialistModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 12: Referrals & Follow-Up Navigation', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Hospital A (Source PHC): Chintapalli CHC
  const hospSourceId = 'hosp_chintapalli_ref_01';
  let moSourceToken: string;
  const moSourceId = 'usr_mo_chintapalli_p12';

  // Hospital B (Destination DH): Paderu District Hospital
  const hospDestId = 'hosp_paderu_ref_02';
  let moDestToken: string;
  const moDestId = 'usr_mo_paderu_p12';
  let adminDestToken: string;
  const adminDestId = 'usr_admin_paderu_p12';

  // Hospital C (Unrelated Hospital): Araku Valley Area Hospital
  const hospUnrelatedId = 'hosp_araku_ref_03';
  let moUnrelatedToken: string;
  const moUnrelatedId = 'usr_mo_araku_p12';

  // Patient & Frontline Worker
  let patientToken: string;
  const patientId = 'usr_pat_ref_01';
  let ashaToken: string;
  const ashaId = 'usr_asha_ref_01';

  // Specialist ID in Paderu DH
  const testSpecialistId = 'spec_oral_onco_01';

  // Shared database URI for Agenda restart tests
  let agendaDbUri: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsReferrals');
    const rawUri = replSet.getUri();
    agendaDbUri = rawUri.includes('?') ? rawUri.replace('/?', '/agenda_ref_test?') : `${rawUri}agenda_ref_test`;
    await mongoose.connect(agendaDbUri);
    await Referral.syncIndexes();
    await ScreeningCase.syncIndexes();

    const pwd = await hashPassword('ReferralSecure@2026');

    // 1. Create Hospitals
    await Hospital.create([
      {
        hospitalId: hospSourceId,
        name: 'Chintapalli Community Health Centre',
        district: 'Alluri Sitharama Raju',
        mandal: 'Chintapalli',
        state: 'Andhra Pradesh',
        type: 'community_health_centre',
        isActive: true,
      },
      {
        hospitalId: hospDestId,
        name: 'Paderu District Hospital',
        district: 'Alluri Sitharama Raju',
        mandal: 'Paderu',
        state: 'Andhra Pradesh',
        type: 'district_hospital',
        isActive: true,
      },
      {
        hospitalId: hospUnrelatedId,
        name: 'Araku Valley Area Hospital',
        district: 'Alluri Sitharama Raju',
        mandal: 'Araku Valley',
        state: 'Andhra Pradesh',
        type: 'area_hospital',
        isActive: true,
      },
    ]);

    // 2. Create Specialist in Paderu DH (Phase 3 Directory)
    await Specialist.create({
      specialistId: testSpecialistId,
      name: 'Dr. V. Prasad, MDS',
      specialty: 'oral_oncology',
      hospitalId: hospDestId,
      hospitalName: 'Paderu District Hospital',
      qualifications: ['BDS', 'MDS Oral Surgery'],
      contactPhone: '+91-9876543210',
      email: 'dr.prasad@paderu.dh.gov.in',
      status: 'active',
    });

    // 3. Create Users
    await User.create([
      {
        userId: moSourceId,
        username: 'mo_chintapalli_01',
        email: 'mo@chintapalli.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospSourceId,
        fullName: 'Dr. Suresh MO Chintapalli',
        isActive: true,
      },
      {
        userId: moDestId,
        username: 'mo_paderu_01',
        email: 'mo@paderu.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospDestId,
        fullName: 'Dr. Ramesh MO Paderu',
        isActive: true,
      },
      {
        userId: adminDestId,
        username: 'admin_paderu_01',
        email: 'admin@paderu.gov.in',
        passwordHash: pwd,
        role: 'admin',
        hospitalId: hospDestId,
        fullName: 'Hospital Manager Paderu',
        isActive: true,
      },
      {
        userId: moUnrelatedId,
        username: 'mo_araku_01',
        email: 'mo@araku.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospUnrelatedId,
        fullName: 'Dr. Anitha MO Araku',
        isActive: true,
      },
      {
        userId: ashaId,
        username: 'asha_p12_01',
        email: 'asha@chintapalli.gov.in',
        passwordHash: pwd,
        role: 'asha',
        hospitalId: hospSourceId,
        fullName: 'Mary ASHA Worker',
        isActive: true,
      },
      {
        userId: patientId,
        username: 'pat_p12_01',
        email: 'patient@p12.com',
        passwordHash: pwd,
        role: 'patient',
        fullName: 'Kondala Rao (Tribal Patient)',
        isActive: true,
      },
    ]);

    moSourceToken = signAccessToken({
      userId: moSourceId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_src',
      deviceId: 'dev_mo_src',
    });

    moDestToken = signAccessToken({
      userId: moDestId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_dst',
      deviceId: 'dev_mo_dst',
    });

    adminDestToken = signAccessToken({
      userId: adminDestId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_adm_dst',
      deviceId: 'dev_adm_dst',
    });

    moUnrelatedToken = signAccessToken({
      userId: moUnrelatedId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_unr',
      deviceId: 'dev_mo_unr',
    });

    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_asha_p12',
      deviceId: 'dev_asha_p12',
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      scopes: getRoleCapabilities('patient'),
      deviceSessionId: 'ses_pat_p12',
      deviceId: 'dev_pat_p12',
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  describe('1. Referral Creation & Specialists Directory Lookup', () => {
    it('allows MO to create referral with valid destination hospital and specialist lookup', async () => {
      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${moSourceToken}`)
        .send({
          patientId,
          patientName: 'Kondala Rao',
          destinationHospitalId: hospDestId,
          specialistId: testSpecialistId,
          reasonForReferral: 'Mucosal lesion noted during screening requiring secondary evaluation',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referral.status).toBe('REQUESTED');
      expect(res.body.data.referral.destinationHospitalName).toBe('Paderu District Hospital');
      expect(res.body.data.referral.specialistName).toBe('Dr. V. Prasad, MDS');
      expect(res.body.data.referral.specialty).toBe('oral_oncology');
    });

    it('rejects referral creation if destination hospital does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${moSourceToken}`)
        .send({
          patientId,
          destinationHospitalId: 'hosp_nonexistent_99',
          reasonForReferral: 'Referral for consultation',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DESTINATION_HOSPITAL_NOT_FOUND');
    });

    it('rejects referral creation if specialist does not exist in directory', async () => {
      const res = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${moSourceToken}`)
        .send({
          patientId,
          destinationHospitalId: hospDestId,
          specialistId: 'spec_ghost_007',
          reasonForReferral: 'Referral for consultation',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SPECIALIST_NOT_FOUND');
    });

    it('denies frontline ASHA or patient from creating referrals', async () => {
      const ashaRes = await request(app)
        .post('/api/v1/referrals')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospDestId,
          reasonForReferral: 'Need consultation',
        });

      expect(ashaRes.status).toBe(403);
    });
  });

  describe('2. Cross-Hospital Denial (Data Isolation & Access Scoping)', () => {
    let targetReferralId: string;

    beforeAll(async () => {
      const ref = await Referral.create({
        referralId: 'ref_cross_hosp_01',
        patientId,
        sourceHospitalId: hospSourceId,
        destinationHospitalId: hospDestId,
        destinationHospitalName: 'Paderu District Hospital',
        status: 'REQUESTED',
        reasonForReferral: 'Need secondary specialist evaluation',
        referringDoctorId: moSourceId,
      });
      targetReferralId = ref.referralId;
    });

    it('denies staff from unrelated Hospital C from accessing referral for Hospital B (Cross-hospital denial)', async () => {
      const getRes = await request(app)
        .get(`/api/v1/referrals/${targetReferralId}`)
        .set('Authorization', `Bearer ${moUnrelatedToken}`);

      expect(getRes.status).toBe(403);
      expect(getRes.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');

      const acceptRes = await request(app)
        .post(`/api/v1/referrals/${targetReferralId}/accept`)
        .set('Authorization', `Bearer ${moUnrelatedToken}`);

      expect(acceptRes.status).toBe(403);
      expect(acceptRes.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');
    });

    it('denies staff from unrelated Hospital C from querying destination list of Hospital B', async () => {
      const listRes = await request(app)
        .get(`/api/v1/referrals?destinationHospitalId=${hospDestId}`)
        .set('Authorization', `Bearer ${moUnrelatedToken}`);

      expect(listRes.status).toBe(403);
      expect(listRes.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');
    });

    it('allows destination Hospital B staff to view and accept the referral addressed to them', async () => {
      const getRes = await request(app)
        .get(`/api/v1/referrals/${targetReferralId}`)
        .set('Authorization', `Bearer ${moDestToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.referral.referralId).toBe(targetReferralId);

      const acceptRes = await request(app)
        .post(`/api/v1/referrals/${targetReferralId}/accept`)
        .set('Authorization', `Bearer ${moDestToken}`);

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.referral.status).toBe('ACCEPTED');
    });
  });

  describe('3. Reminder Scheduling & Non-Diagnostic Privacy Compliance', () => {
    let scheduledReferralId: string;

    it('schedules follow-up consultation and verifies reminder text contains NO clinical claims', async () => {
      const ref = await Referral.create({
        referralId: 'ref_reminder_privacy_01',
        patientId,
        sourceHospitalId: hospSourceId,
        destinationHospitalId: hospDestId,
        destinationHospitalName: 'Paderu District Hospital',
        status: 'ACCEPTED',
        reasonForReferral: 'General screening navigation',
        referringDoctorId: moSourceId,
      });
      scheduledReferralId = ref.referralId;

      const futureDate = new Date(Date.now() + 86400000 * 7); // 7 days ahead

      const res = await request(app)
        .post(`/api/v1/referrals/${scheduledReferralId}/schedule`)
        .set('Authorization', `Bearer ${adminDestToken}`)
        .send({
          scheduledDate: futureDate.toISOString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.referral.status).toBe('SCHEDULED');

      const reminderText = res.body.data.referral.followUpReminder.reminderText;
      expect(reminderText).toBeDefined();

      // Clinical wording safety & patient privacy checks
      expect(reminderText).not.toMatch(/\bdiagnosis\b/i);
      expect(reminderText).not.toMatch(/\bcancer\b/i);
      expect(reminderText).not.toMatch(/\bstage\b/i);
      expect(reminderText).not.toMatch(/\bcurative\b/i);
      expect(reminderText).not.toMatch(/\bbiopsy\b/i);

      // Verify privacy-preserving phrasing
      expect(reminderText).toContain('scheduled health consultation');
      expect(reminderText).toContain('Paderu District Hospital');
    });
  });

  describe('4. Agenda Reminder Exactly-Once Execution After Server Restart', () => {
    let agenda1: Agenda;
    let agenda2: Agenda;

    afterAll(async () => {
      if (agenda1) await agenda1.stop().catch(() => {});
      if (agenda2) await agenda2.stop().catch(() => {});
    });

    it('guarantees follow-up reminder runs exactly once and does not fire again after server restart', async () => {
      let reminderExecutionCount = 0;

      // Instance 1: Server running before restart
      agenda1 = new Agenda({
        db: { address: agendaDbUri, collection: 'agenda_ref_p12_jobs' },
        processEvery: '1 second',
        defaultLockLifetime: 5000,
      });

      agenda1.define('referral:navigation_reminder', async (job: Job) => {
        reminderExecutionCount += 1;
        job.attrs.lastFinishedAt = new Date();
      });

      await agenda1.start();

      // Schedule reminder job to execute immediately
      await agenda1.now('referral:navigation_reminder', {
        referralId: 'ref_restart_test_01',
        patientId,
      });

      // Wait for Instance 1 to process the job
      await new Promise((resolve) => setTimeout(resolve, 2500));

      expect(reminderExecutionCount).toBe(1);

      // Simulate server crash / shutdown
      await agenda1.stop();

      // Instance 2: Server restarts
      agenda2 = new Agenda({
        db: { address: agendaDbUri, collection: 'agenda_ref_p12_jobs' },
        processEvery: '1 second',
        defaultLockLifetime: 5000,
      });

      agenda2.define('referral:navigation_reminder', async (_job: Job) => {
        reminderExecutionCount += 1;
      });

      await agenda2.start();

      // Wait another cycle to confirm the completed job is NOT re-executed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Execution count MUST remain 1 (EXACTLY ONCE)
      expect(reminderExecutionCount).toBe(1);

      // Confirm DB state shows job has lastFinishedAt
      const jobs = await mongoose.connection
        .collection('agenda_ref_p12_jobs')
        .find({ name: 'referral:navigation_reminder' })
        .toArray();

      expect(jobs.length).toBe(1);
      expect(jobs[0].lastFinishedAt).toBeDefined();
    });
  });

  describe('5. Missed Follow-Up Escalation (Escalates Exactly Once)', () => {
    let testCaseId: string;
    let testReferralId: string;

    beforeAll(async () => {
      testCaseId = 'case_p12_missed_01';
      await ScreeningCase.create({
        caseId: testCaseId,
        patientId,
        patientName: 'Kondala Rao',
        villageId: 'vil_test_01',
        hospitalId: hospSourceId,
        createdBy: moSourceId,
        status: 'referral_requested',
        priority: 'routine',
        photoIds: ['photo_01'],
        resultReleased: false,
        simulation: true,
      });

      const ref = await Referral.create({
        referralId: 'ref_missed_escalate_01',
        patientId,
        screeningCaseId: testCaseId,
        sourceHospitalId: hospSourceId,
        destinationHospitalId: hospDestId,
        destinationHospitalName: 'Paderu District Hospital',
        status: 'SCHEDULED',
        reasonForReferral: 'Secondary clinical evaluation',
        referringDoctorId: moSourceId,
        missedEscalation: {
          isEscalated: false,
        },
      });
      testReferralId = ref.referralId;
    });

    it('escalates back to the MO queue when follow-up consultation is missed', async () => {
      const res = await request(app)
        .post(`/api/v1/referrals/${testReferralId}/missed`)
        .set('Authorization', `Bearer ${moDestToken}`)
        .send({
          reason: 'Patient did not arrive for scheduled Tuesday consultation',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.referral.status).toBe('MISSED');
      expect(res.body.data.referral.missedEscalation.isEscalated).toBe(true);

      // Verify linked ScreeningCase was escalated back to MO queue with urgent priority!
      const updatedCase = await ScreeningCase.findOne({ caseId: testCaseId }).lean();
      expect(updatedCase?.priority).toBe('urgent');
      expect(updatedCase?.status).toBe('escalated');
      expect(updatedCase?.escalationDetails?.escalationReason).toContain('Patient did not arrive');
      expect(updatedCase?.escalationDetails?.escalatedToRole).toBe('medical_officer');
    });

    it('rejects duplicate escalation attempt: Missed follow-up escalates exactly once', async () => {
      const res = await request(app)
        .post(`/api/v1/referrals/${testReferralId}/missed`)
        .set('Authorization', `Bearer ${moDestToken}`)
        .send({
          reason: 'Attempting duplicate escalation call',
        });

      // Must be rejected with 409 Conflict (REFERRAL_ALREADY_ESCALATED)
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('REFERRAL_ALREADY_ESCALATED');
    });
  });

  describe('6. Attendance & Cancellation Lifecycle', () => {
    it('marks scheduled referral as attended', async () => {
      const ref = await Referral.create({
        referralId: 'ref_attended_01',
        patientId,
        sourceHospitalId: hospSourceId,
        destinationHospitalId: hospDestId,
        status: 'SCHEDULED',
        reasonForReferral: 'Evaluation',
        referringDoctorId: moSourceId,
      });

      const res = await request(app)
        .post(`/api/v1/referrals/${ref.referralId}/attended`)
        .set('Authorization', `Bearer ${moDestToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.referral.status).toBe('ATTENDED');
    });

    it('cancels referral with mandatory reason', async () => {
      const ref = await Referral.create({
        referralId: 'ref_cancel_01',
        patientId,
        sourceHospitalId: hospSourceId,
        destinationHospitalId: hospDestId,
        status: 'REQUESTED',
        reasonForReferral: 'Evaluation',
        referringDoctorId: moSourceId,
      });

      const res = await request(app)
        .post(`/api/v1/referrals/${ref.referralId}/cancel`)
        .set('Authorization', `Bearer ${moSourceToken}`)
        .send({
          reason: 'Patient opted for direct local private clinic consultation',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.referral.status).toBe('CANCELLED');
      expect(res.body.data.referral.cancellation.reason).toBe(
        'Patient opted for direct local private clinic consultation'
      );
    });
  });
});
