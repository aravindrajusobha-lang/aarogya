import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { ScreeningPhoto } from '../src/modules/screening/screeningPhotoModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { ClinicalAssessment } from '../src/modules/screening/clinicalAssessmentModel.js';
import { ResultRelease } from '../src/modules/screening/resultReleaseModel.js';
import { Consent } from '../src/modules/consent/consentModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 8: Screening, Demo AI, MO Case Queue & Clinical Governance', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Hospital A: Paderu District Hospital
  const hospPaderuId = 'hosp_paderu_test_8';
  let adminPaderuToken: string;
  let adminPaderuId = 'usr_admin_paderu_8';
  let moPaderuToken: string;
  let moPaderuId = 'usr_mo_paderu_8';

  // Hospital B: Araku Valley CHC
  const hospArakuId = 'hosp_araku_test_8';
  let adminArakuToken: string;
  let adminArakuId = 'usr_admin_araku_8';
  let moArakuToken: string;
  let moArakuId = 'usr_mo_araku_8';

  // Frontline worker (ASHA) and Patient
  let ashaToken: string;
  let ashaId = 'usr_asha_screening_8';
  const testPatientId = 'PAT-TRI-2026-8801';
  let patientToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsScreening');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('PassScreen@2026');

    // 1. Create Hospitals
    await Hospital.create({
      hospitalId: hospPaderuId,
      name: 'Paderu District Hospital',
      mandal: 'Paderu',
      district: 'Alluri Sitharama Raju',
      type: 'district_hospital',
      bedCapacity: 100,
      status: 'active',
      simulation: true,
    });

    await Hospital.create({
      hospitalId: hospArakuId,
      name: 'Araku Community Health Centre',
      mandal: 'Araku Valley',
      district: 'Alluri Sitharama Raju',
      type: 'community_health_centre',
      bedCapacity: 30,

      status: 'active',
      simulation: true,
    });

    // 2. Create Users for Hospital A (Paderu)
    await User.create({
      userId: adminPaderuId,
      username: 'admin.paderu8',
      role: 'admin',
      fullName: 'Hospital Manager Paderu',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    const adminCaps = await getRoleCapabilities('admin');
    adminPaderuToken = signAccessToken({
      userId: adminPaderuId,
      role: 'admin',
      scopes: adminCaps,
      deviceSessionId: 'ses_admin_p8',
      deviceId: 'dev_admin_p8',
    });

    await User.create({
      userId: moPaderuId,
      username: 'mo.paderu8',
      role: 'medical_officer',
      fullName: 'Dr. Suresh MO Paderu',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    const moCaps = await getRoleCapabilities('medical_officer');
    moPaderuToken = signAccessToken({
      userId: moPaderuId,
      role: 'medical_officer',
      scopes: moCaps,
      deviceSessionId: 'ses_mo_p8',
      deviceId: 'dev_mo_p8',
    });

    // 3. Create Users for Hospital B (Araku)
    await User.create({
      userId: adminArakuId,
      username: 'admin.araku8',
      role: 'admin',
      fullName: 'Hospital Manager Araku',
      hospitalId: hospArakuId,
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    adminArakuToken = signAccessToken({
      userId: adminArakuId,
      role: 'admin',
      scopes: adminCaps,
      deviceSessionId: 'ses_admin_a8',
      deviceId: 'dev_admin_a8',
    });

    await User.create({
      userId: moArakuId,
      username: 'mo.araku8',
      role: 'medical_officer',
      fullName: 'Dr. Anita MO Araku',
      hospitalId: hospArakuId,
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    moArakuToken = signAccessToken({
      userId: moArakuId,
      role: 'medical_officer',
      scopes: moCaps,
      deviceSessionId: 'ses_mo_a8',
      deviceId: 'dev_mo_a8',
    });

    // 4. Create ASHA User
    await User.create({
      userId: ashaId,
      username: 'asha.screening8',
      role: 'asha',
      fullName: 'ASHA Tribal Worker',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    const ashaCaps = await getRoleCapabilities('asha');
    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      scopes: ashaCaps,
      deviceSessionId: 'ses_asha_s8',
      deviceId: 'dev_asha_s8',
    });

    // 5. Create Patient User Token
    const patientCaps = await getRoleCapabilities('patient');
    patientToken = signAccessToken({
      userId: testPatientId,
      role: 'patient',
      scopes: patientCaps,
      deviceSessionId: 'ses_patient_8',
      deviceId: 'dev_patient_8',
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  describe('1. Photo upload (demo or consented images only)', () => {
    const originalImageBuffer = Buffer.from('FAKE_JPEG_IMAGE_PIXELS_FOR_SCREENING_SAMPLE_ORIGINAL_01');
    const originalSha256 = crypto.createHash('sha256').update(originalImageBuffer).digest('hex');
    let uploadedPhotoId: string;

    it('rejects photo upload if not demo and patient has no active consent (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/v1/screening/photos/upload')
        .set('Authorization', `Bearer ${ashaToken}`)
        .field('patientId', testPatientId)
        .field('hospitalId', hospPaderuId)
        .field('isDemo', 'false')
        .attach('photo', originalImageBuffer, 'oral_mucosa_front.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('active patient informed consent');
    });

    it('allows photo upload when tagged with isDemo: true (simulation bypass)', async () => {
      const res = await request(app)
        .post('/api/v1/screening/photos/upload')
        .set('Authorization', `Bearer ${ashaToken}`)
        .field('patientId', 'PAT_DEMO_NON_CONSENTED')
        .field('hospitalId', hospPaderuId)
        .field('isDemo', 'true')
        .attach('photo', originalImageBuffer, 'demo_lesion.jpg');

      expect(res.status).toBe(201);
      expect(res.body.data.photo.isDemo).toBe(true);
      expect(res.body.data.photo.originalSha256).toBe(originalSha256);
      expect(res.body.data.simulationBanner).toBeDefined();
    });

    it('allows photo upload when active informed consent is granted for the patient', async () => {
      // Grant active consent for screening
      await Consent.create({
        consentId: 'cns_screening_test_01',
        patientId: testPatientId,
        purpose: 'screening_ai_analysis',
        status: 'granted',
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        actorId: ashaId,
        actorRole: 'asha',
        language: 'te',
        simulation: true,
      });

      const res = await request(app)
        .post('/api/v1/screening/photos/upload')
        .set('Authorization', `Bearer ${ashaToken}`)
        .field('patientId', testPatientId)
        .field('hospitalId', hospPaderuId)
        .field('isDemo', 'false')
        .attach('photo', originalImageBuffer, 'consented_oral_photo.jpg');

      expect(res.status).toBe(201);
      uploadedPhotoId = res.body.data.photo.photoId;
      expect(uploadedPhotoId).toBeTruthy();
      expect(res.body.data.photo.version).toBe(1);
      expect(res.body.data.photo.originalSha256).toBe(originalSha256);
      expect(res.body.data.photo.currentSha256).toBe(originalSha256);
    });

    it('verifies hash of original remains completely unchanged after amendment (Byte-Identical Invariant)', async () => {
      const amendedImageBuffer = Buffer.from('AMENDED_ENHANCED_JPEG_PIXELS_FOR_VERSION_2_SAMPLE');
      const amendedSha256 = crypto.createHash('sha256').update(amendedImageBuffer).digest('hex');

      expect(amendedSha256).not.toBe(originalSha256);

      // Perform photo amendment
      const amendRes = await request(app)
        .post(`/api/v1/screening/photos/${uploadedPhotoId}/amend`)
        .set('Authorization', `Bearer ${ashaToken}`)
        .field('amendmentReason', 'Corrected focal plane and increased illumination')
        .attach('photo', amendedImageBuffer, 'oral_photo_v2_enhanced.jpg');

      expect(amendRes.status).toBe(200);
      const amendedPhoto = amendRes.body.data.photo;

      expect(amendedPhoto.version).toBe(2);
      expect(amendedPhoto.currentSha256).toBe(amendedSha256);

      // CRITICAL ASSERTION: The original SHA-256 hash must remain exactly unchanged!
      expect(amendedPhoto.originalSha256).toBe(originalSha256);

      // Query database record directly to verify database immutability
      const dbPhoto = await ScreeningPhoto.findOne({ photoId: uploadedPhotoId });
      expect(dbPhoto).toBeTruthy();
      expect(dbPhoto!.originalSha256).toBe(originalSha256);
      expect(dbPhoto!.currentSha256).toBe(amendedSha256);
      expect(dbPhoto!.version).toBe(2);
      expect(dbPhoto!.amendmentHistory.length).toBe(1);
      expect(dbPhoto!.amendmentHistory[0].sha256).toBe(amendedSha256);
      expect(dbPhoto!.amendmentHistory[0].version).toBe(2);
    });
  });

  describe('2. DEMO AI that returns a risk-support label with no diagnosis or stage, and quality checks "unavailable"', () => {
    it('returns risk-support label, quality checks as "unavailable", and SIMULATION banner', async () => {
      const res = await request(app)
        .post('/api/v1/screening/ai/analyze')
        .set('Authorization', `Bearer ${moPaderuToken}`)
        .send({ photoSha256: 'abcd1234ef5678' });

      expect(res.status).toBe(200);
      const aiData = res.body.data;

      // 1. Risk-support label present
      expect([
        'low_risk_support',
        'moderate_risk_support',
        'high_risk_support',
        'indeterminate_risk_support',
      ]).toContain(aiData.riskSupportLabel);

      // 2. Positioning, obstruction and missing-area checks return strictly "unavailable"
      expect(aiData.qualityChecks).toBeDefined();
      expect(aiData.qualityChecks.positioning).toBe('unavailable');
      expect(aiData.qualityChecks.obstruction).toBe('unavailable');
      expect(aiData.qualityChecks.missingArea).toBe('unavailable');

      // 3. SIMULATION banner present on AI output
      expect(aiData.simulationBanner).toContain('SIMULATION');
      expect(aiData.disclaimer).toBeDefined();

      // 4. Clinical wording guard: Zero staging assertions or diagnostic terms in AI output
      const jsonString = JSON.stringify(aiData).toLowerCase();
      expect(jsonString).not.toMatch(/\bstage\s+[1-4ivx]+\b/);
      expect(jsonString).not.toMatch(/\bcancer[- ]free\b/);
      expect(jsonString).not.toMatch(/\bcurative\b/);
    });
  });

  describe('3. MO case queue: assignment denied across hospitals', () => {
    let paderuCaseId: string;

    it('creates a screening case under Hospital A (Paderu)', async () => {
      const res = await request(app)
        .post('/api/v1/screening/cases')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId: testPatientId,
          patientName: 'Kondamma S',
          villageId: 'VILLAGE_PADERU_01',
          hospitalId: hospPaderuId,
          priority: 'routine',
        });

      expect(res.status).toBe(201);
      paderuCaseId = res.body.data.case.caseId;
      expect(paderuCaseId).toBeTruthy();
      expect(res.body.data.case.status).toBe('pending_assignment');
      expect(res.body.data.case.hospitalId).toBe(hospPaderuId);
    });

    it('DENIES case assignment when Hospital B Manager attempts to assign Hospital A case (403 Forbidden)', async () => {
      // Admin from Hospital B (Araku) attempts to assign case from Hospital A (Paderu)
      const res = await request(app)
        .post(`/api/v1/screening/cases/${paderuCaseId}/assign`)
        .set('Authorization', `Bearer ${adminArakuToken}`)
        .send({ targetMoId: moArakuId });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Cross-hospital case assignment denied');
    });

    it('DENIES case assignment when Hospital A Manager attempts to assign to a clinician from Hospital B (403 Forbidden)', async () => {
      // Admin from Hospital A (Paderu) attempts to assign Hospital A case to MO in Hospital B (Araku)
      const res = await request(app)
        .post(`/api/v1/screening/cases/${paderuCaseId}/assign`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ targetMoId: moArakuId });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Cross-hospital case assignment denied');
    });

    it('PERMITS case assignment when assigner, case, and clinician belong to the same hospital (200 OK)', async () => {
      // Admin from Hospital A assigns case to MO in Hospital A
      const res = await request(app)
        .post(`/api/v1/screening/cases/${paderuCaseId}/assign`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ targetMoId: moPaderuId });

      expect(res.status).toBe(200);
      expect(res.body.data.assignedMoId).toBe(moPaderuId);
      expect(res.body.data.status).toBe('assigned');

      // Verify audit trail logged
      const auditLog = await AuditLog.findOne({
        action: 'SCREENING_CASE_ASSIGNED',
        resourceId: paderuCaseId,
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog!.metadata.assignedMoId).toBe(moPaderuId);
    });
  });

  describe('4. Assessment and Result Release are separate entities; patients see results only after release', () => {
    let reviewCaseId: string;

    beforeAll(async () => {
      // Create fresh case for assessment & release flow
      const caseRes = await request(app)
        .post('/api/v1/screening/cases')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          patientId: testPatientId,
          patientName: 'Kondamma S',
          villageId: 'VILLAGE_PADERU_01',
          hospitalId: hospPaderuId,
          priority: 'urgent',
        });
      reviewCaseId = caseRes.body.data.case.caseId;
    });

    it('records clinical assessment as a separate entity and leaves results unreleased', async () => {
      const assessRes = await request(app)
        .post(`/api/v1/screening/cases/${reviewCaseId}/assess`)
        .set('Authorization', `Bearer ${moPaderuToken}`)
        .send({
          clinicalImpression: 'Erythematous mucosal change observed on left lateral border of tongue.',
          lesionObserved: true,
          anatomicalSite: 'tongue_lateral',
          riskCategorization: 'high_risk_support',
          recommendedFollowUpDays: 14,
          clinicalNotes: 'Referral to specialist recommended for biopsy consultation.',
        });

      expect(assessRes.status).toBe(201);
      const assessment = assessRes.body.data.assessment;
      expect(assessment.assessmentId).toBeTruthy();

      // Verify stored in separate ClinicalAssessment collection
      const dbAssessment = await ClinicalAssessment.findOne({ assessmentId: assessment.assessmentId });
      expect(dbAssessment).toBeTruthy();
      expect(dbAssessment!.clinicalImpression).toContain('Erythematous');

      // Verify case status is under_review and resultReleased is false
      const dbCase = await ScreeningCase.findOne({ caseId: reviewCaseId });
      expect(dbCase!.resultReleased).toBe(false);
      expect(dbCase!.clinicalAssessmentId).toBe(assessment.assessmentId);
    });

    it('withholds results from patient when results have NOT been officially released', async () => {
      // Patient queries their results
      const res = await request(app)
        .get(`/api/v1/screening/patient/${testPatientId}/results`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      // Results list should be empty or releasedCount 0
      expect(res.body.data.releasedCount).toBe(0);
      expect(res.body.data.results).toEqual([]);
      expect(res.body.data.patientNotice).toContain('under medical officer review');
    });

    it('officially releases result creating a separate ResultRelease entity', async () => {
      const releaseRes = await request(app)
        .post(`/api/v1/screening/cases/${reviewCaseId}/release-result`)
        .set('Authorization', `Bearer ${moPaderuToken}`)
        .send({
          patientSummaryMessage: 'Oral health visual screening evaluation completed. Please consult your PHC medical officer within 14 days for specialist referral evaluation.',
          recommendedAction: 'Schedule priority referral consultation at District Hospital Paderu.',
        });

      expect(releaseRes.status).toBe(201);
      const release = releaseRes.body.data.release;
      expect(release.releaseId).toBeTruthy();

      // Verify stored in separate ResultRelease collection
      const dbRelease = await ResultRelease.findOne({ releaseId: release.releaseId });
      expect(dbRelease).toBeTruthy();
      expect(dbRelease!.caseId).toBe(reviewCaseId);
      expect(dbRelease!.status).toBe('released');

      // Verify case reflects release
      const dbCase = await ScreeningCase.findOne({ caseId: reviewCaseId });
      expect(dbCase!.resultReleased).toBe(true);
      expect(dbCase!.resultReleaseId).toBe(release.releaseId);
      expect(dbCase!.status).toBe('completed');
    });

    it('allows patient to view results once officially released', async () => {
      const res = await request(app)
        .get(`/api/v1/screening/patient/${testPatientId}/results`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.releasedCount).toBeGreaterThanOrEqual(1);

      const patientResult = res.body.data.results.find((r: any) => r.caseId === reviewCaseId);
      expect(patientResult).toBeTruthy();
      expect(patientResult.patientSummaryMessage).toContain('Oral health visual screening evaluation completed');
      expect(patientResult.recommendedAction).toContain('District Hospital Paderu');
      expect(patientResult.simulationBanner).toContain('SIMULATION');
    });
  });

  describe('5. MO case queue: escalation and referral requests', () => {
    let actionCaseId: string;

    beforeAll(async () => {
      const caseRes = await request(app)
        .post('/api/v1/screening/cases')
        .set('Authorization', `Bearer ${moPaderuToken}`)
        .send({
          patientId: 'PAT-ESC-01',
          patientName: 'Devudu G',
          villageId: 'VILLAGE_PADERU_01',
          hospitalId: hospPaderuId,
          priority: 'urgent',
        });
      actionCaseId = caseRes.body.data.case.caseId;
    });

    it('escalates case for specialist review', async () => {
      const res = await request(app)
        .post(`/api/v1/screening/cases/${actionCaseId}/escalate`)
        .set('Authorization', `Bearer ${moPaderuToken}`)
        .send({ reason: 'Persistent oral ulceration requiring senior specialist review' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('escalated');
      expect(res.body.data.escalationDetails.escalationReason).toBe(
        'Persistent oral ulceration requiring senior specialist review'
      );
    });

    it('requests specialist referral linking to facility and specialty', async () => {
      const res = await request(app)
        .post(`/api/v1/screening/cases/${actionCaseId}/referral`)
        .set('Authorization', `Bearer ${moPaderuToken}`)
        .send({
          specialistId: 'spec_dr_kavitha_01',
          specialty: 'oral_oncology',
          facilityName: 'Visakhapatnam Regional Referral Centre',
          referralNotes: 'Urgent teleconsultation and clinical biopsy evaluation requested.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('referral_requested');
      expect(res.body.data.referralDetails.specialty).toBe('oral_oncology');
      expect(res.body.data.referralDetails.facilityName).toBe(
        'Visakhapatnam Regional Referral Centre'
      );
    });
  });
});
