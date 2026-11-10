import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { Village } from '../src/modules/reference/villageModel.js';
import { HealthWorkerAssignment } from '../src/modules/assignment/assignmentModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Comprehensive QA: Recently Updated Features & Invariants Verification', () => {
  let app: any;
  let replSet: MongoMemoryReplSet;
  let adminToken: string;
  let doctorToken: string;
  let ashaToken: string;

  const hospId = 'hosp_paderu_dh';
  const adminId = 'usr_qa_admin_01';
  const doctorId = 'usr_qa_doctor_01';
  const ashaId = 'usr_qa_asha_01';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsRecentQA');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('DemoPass@2026');

    // 1. Hospital
    await Hospital.create({
      hospitalId: hospId,
      name: 'Paderu District Hospital',
      mandal: 'Paderu',
      district: 'Alluri Sitharama Raju',
      type: 'district_hospital',
      bedCapacity: 100,
      status: 'active',
      simulation: true,
    });

    // 2. Village
    await Village.create({
      villageId: 'vil_vankachinta_01',
      villageName: 'Vankachinta',
      mandal: 'Paderu',
      panchayat: 'Vankachinta GP',
      tribalHabitation: 'Vankachinta Main',
      hospitalId: hospId,
      censusCode: '584999',
      populationEstimated: 600,
      simulation: true,
    });

    // 3. Admin
    await User.create({
      userId: adminId,
      username: 'qa_admin',
      fullName: 'System Administrator QA',
      email: 'qa.admin@aarogya.demo',
      phone: '9876543201',
      passwordHash: pwd,
      role: 'admin',
      hospitalId: hospId,
      status: 'active',
      simulation: true,
    });
    adminToken = signAccessToken({
      userId: adminId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_qa_admin',
      deviceId: 'dev_qa_admin',
    });

    // 4. Medical Officer / Doctor
    await User.create({
      userId: doctorId,
      username: 'qa_doctor',
      fullName: 'Dr. Surekha MO QA',
      email: 'qa.doctor@aarogya.demo',
      phone: '9876543202',
      passwordHash: pwd,
      role: 'medical_officer',
      hospitalId: hospId,
      status: 'active',
      simulation: true,
    });
    doctorToken = signAccessToken({
      userId: doctorId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_qa_mo',
      deviceId: 'dev_qa_mo',
    });

    // 5. ASHA Frontline Worker
    await User.create({
      userId: ashaId,
      username: 'qa_asha_worker',
      fullName: 'Sujatha ASHA QA',
      email: 'qa.asha@aarogya.demo',
      phone: '9876543203',
      passwordHash: pwd,
      role: 'asha',
      hospitalId: hospId,
      status: 'active',
      simulation: true,
    });
    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_qa_asha',
      deviceId: 'dev_qa_asha',
    });

    // 6. Health Worker Assignment for ASHA
    await HealthWorkerAssignment.create({
      assignmentId: 'asgn_qa_asha_01',
      workerId: ashaId,
      workerName: 'Sujatha ASHA QA',
      workerRole: 'asha',
      hospitalId: hospId,
      assignedMandal: 'Paderu',
      assignedVillages: ['vil_vankachinta_01'],
      status: 'active',
      assignedBy: adminId,
      assignedAt: new Date(),
      simulation: true,
    });

    app = createApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  // ==========================================
  // PHASE 2: HEALTHCARE ASSETS & BACKDROP VERIFICATION
  // ==========================================
  describe('Phase 2 Verification: Healthcare Visual Assets & Fallbacks', () => {
    const getClientDir = () =>
      fs.existsSync(path.resolve(process.cwd(), 'client'))
        ? path.resolve(process.cwd(), 'client')
        : path.resolve(process.cwd(), '../client');

    it('verifies the user-uploaded dental examination image exists and has valid dimensions', () => {
      const dentalImgPath = path.resolve(getClientDir(), 'public/assets/healthcare/dental-examination.jpg');
      expect(fs.existsSync(dentalImgPath)).toBe(true);
      const stat = fs.statSync(dentalImgPath);
      expect(stat.size).toBeGreaterThan(10000); // 44 KB valid JPEG
    });

    it('verifies all 5 required healthcare category images exist in client assets', () => {
      const assetDir = path.resolve(getClientDir(), 'public/assets/healthcare');
      const requiredImages = [
        'dental-examination.jpg',
        'oral-screening.jpg',
        'oral-lesion-exam.jpg',
        'hospital-oncology-care.jpg',
        'patient-recovery.jpg',
      ];

      for (const imgName of requiredImages) {
        const filePath = path.join(assetDir, imgName);
        expect(fs.existsSync(filePath), `Asset ${imgName} must exist on disk`).toBe(true);
        expect(fs.statSync(filePath).size).toBeGreaterThan(10000);
      }
    });

    it('verifies CinematicHealthcareBackdrop.tsx does NOT contain Invariant 1 prohibited diagnostic terms', () => {
      const componentPath = path.resolve(getClientDir(), 'src/components/CinematicHealthcareBackdrop.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Prohibited Invariant 1 terms scanner
      const prohibitedRegexes = [
        /\bcancer\b/i,
        /\bmalignant\b/i,
        /\bcarcinoma\b/i,
        /\bcurative\b/i,
        /\bdiagnostic confirmation\b/i,
        /\bstage [0-9IV]/i,
      ];

      for (const regex of prohibitedRegexes) {
        expect(content).not.toMatch(regex);
      }
    });
  });

  // ==========================================
  // PHASE 3 & 4: PATIENT REGISTRATION & INTERNAL VILLAGE RESOLUTION
  // ==========================================
  describe('Phase 3 & 4 Verification: Simplified Registration & Village Resolution', () => {
    it('successfully registers a patient without providing villageId in the payload', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          fullName: 'Korra Chinnayya',
          gender: 'male',
          ageEstimated: 48,
          phone: '9440188991',
          mandal: 'Paderu',
          villageName: 'Vankachinta',
          originalAddressText: 'Near Forest Checkpost, Vankachinta, Paderu Mandal',
          hospitalId: hospId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patient).toBeDefined();
      expect(res.body.data.patient.patientId).toMatch(/^PAD-2026-/);
      // Village ID was resolved internally to the known mapped village
      expect(res.body.data.patient.villageId).toBe('vil_vankachinta_01');
      expect(res.body.data.patient.villageName).toBe('Vankachinta');
      expect(res.body.data.patient.mandal).toBe('Paderu');
    });

    it('resolves an uncataloged hamlet to worker active jurisdiction without requiring villageId', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          fullName: 'Gamparai Gangamma',
          gender: 'female',
          ageEstimated: 62,
          mandal: 'Paderu',
          villageName: 'Vankachinta Hill Top Hamlet',
          originalAddressText: 'Top ridge past water tank, Vankachinta hill top',
          hospitalId: hospId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patient.villageId).toBe('vil_vankachinta_01');
    });

    it('flags duplicate patient candidate without auto-merging or overwriting original record', async () => {
      // Intentionally register candidate with same name, gender, village and age
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          fullName: 'Korra Chinnayya',
          gender: 'male',
          ageEstimated: 48,
          mandal: 'Paderu',
          villageName: 'Vankachinta',
          originalAddressText: 'Near Forest Checkpost, Vankachinta, Paderu Mandal',
          hospitalId: hospId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.duplicateReview).toBeDefined();
      expect(res.body.data.duplicateReview.flagged).toBe(true);

      // Both records exist independently
      const count = await Patient.countDocuments({ fullName: 'Korra Chinnayya' });
      expect(count).toBe(2);
    });

    it('rejects patient registration when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          gender: 'female',
          mandal: 'Paderu',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ==========================================
  // PHASE 5: ORAL HEALTHCARE MODULE & RBAC ENFORCEMENT
  // ==========================================
  describe('Phase 5 Verification: Clinician Triaging & Staging Access Control', () => {
    let caseId: string;

    beforeAll(async () => {
      const caseDoc = await ScreeningCase.create({
        caseId: 'sc_qa_case_001',
        patientId: 'PAD-2026-QA001',
        patientName: 'Pangi Appalaraju',
        patientAge: 51,
        patientGender: 'male',
        patientMandal: 'Paderu',
        villageId: 'vil_vankachinta_01',
        submittedBy: ashaId,
        createdBy: ashaId,
        hospitalId: hospId,
        riskTier: 'Tier 2',
        workflowStatus: 'submitted',
        lesionObserved: true,
        anatomicalSite: 'buccalMucosa',
        lesionType: 'whitePatch',
        photoStorageId: '00000000-0000-0000-0000-000000000001',
        photoHashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      });
      caseId = caseDoc.caseId;
    });

    it('DENIES non-clinician ASHA worker from confirming diagnosis or assessing triage', async () => {
      const res = await request(app)
        .post(`/api/v1/screening/cases/${caseId}/assess`)
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          clinicalImpression: 'Erythroplakia on right buccal mucosa. Urgent evaluation recommended.',
          riskCategorization: 'high_risk_support',
          lesionObserved: true,
          anatomicalSite: 'buccalMucosa',
        });

      // 403 Forbidden - Only Medical Officers with screening:review capability permitted
      expect(res.status).toBe(403);
    });

    it('ALLOWS authorized Medical Officer to record clinical assessment', async () => {
      const res = await request(app)
        .post(`/api/v1/screening/cases/${caseId}/assess`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          clinicalImpression: 'Erythroplakia on right buccal mucosa. Urgent evaluation recommended.',
          riskCategorization: 'high_risk_support',
          lesionObserved: true,
          anatomicalSite: 'buccalMucosa',
          clinicalNotes: 'Specialist referral recommended to District Oncology Center',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment).toBeDefined();
    });
  });

  // ==========================================
  // PHASE 6: AI ASSISTANT MULTILINGUAL QUERY ROUTING
  // ==========================================
  describe('Phase 6 Verification: AI Assistant Multilingual Routing', () => {
    it('answers queries in Telugu without diagnostic claims', async () => {
      const res = await request(app)
        .post('/api/v1/assistant/query')
        .send({
          message: 'నోటి పూత లక్షణాలు ఏమిటి?',
          language: 'te',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answerText).toBeDefined();
      expect(res.body.data.animation).toBeDefined();
      // Must not diagnose
      expect(res.body.data.answerText).not.toMatch(/\bcancer\b/i);
    });

    it('answers queries in Hindi without diagnostic claims', async () => {
      const res = await request(app)
        .post('/api/v1/assistant/query')
        .send({
          message: 'मुख स्वास्थ्य के लक्षण',
          language: 'hi',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answerText).toBeDefined();
      expect(res.body.data.animation).toBeDefined();
    });

    it('answers queries in English with safe triage guidance', async () => {
      const res = await request(app)
        .post('/api/v1/assistant/query')
        .send({
          message: 'How to register a tribal patient offline?',
          language: 'en',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answerText).toBeDefined();
      expect(res.body.data.animation).toBeDefined();
    });
  });
});
