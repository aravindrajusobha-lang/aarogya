import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { BiopsyRecord, BiopsyFindings, BiopsyResultRelease } from '../src/modules/biopsy/biopsyModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 11: Biopsy Workflow & Specimen Tracking', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  const hospPaderuId = 'hosp_paderu_bx_01';
  let adminToken: string;
  const adminId = 'usr_admin_bx_01';
  let moToken: string;
  const moId = 'usr_mo_bx_01';
  let ashaToken: string;
  const ashaId = 'usr_asha_bx_01';
  let patientToken: string;
  const patientId = 'usr_pat_bx_01';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsBiopsy');
    await mongoose.connect(replSet.getUri());
    await BiopsyRecord.syncIndexes();

    const pwd = await hashPassword('BiopsySecure@2026');

    await Hospital.create({
      hospitalId: hospPaderuId,
      name: 'Paderu District Hospital',
      district: 'Alluri Sitharama Raju',
      mandal: 'Paderu',
      state: 'Andhra Pradesh',
      type: 'district_hospital',
      isActive: true,
    });

    await User.create([
      {
        userId: adminId,
        username: 'admin_bx_01',
        email: 'admin_bx@paderu.gov.in',
        passwordHash: pwd,
        role: 'admin',
        hospitalId: hospPaderuId,
        fullName: 'Admin Paderu Hospital',
        isActive: true,
      },
      {
        userId: moId,
        username: 'mo_bx_01',
        email: 'mo_bx@paderu.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospPaderuId,
        fullName: 'Dr. Ramesh MO',
        isActive: true,
      },
      {
        userId: ashaId,
        username: 'asha_bx_01',
        email: 'asha_bx@paderu.gov.in',
        passwordHash: pwd,
        role: 'asha',
        hospitalId: hospPaderuId,
        fullName: 'Lakshmi ASHA',
        isActive: true,
      },
      {
        userId: patientId,
        username: 'pat_bx_01',
        email: 'pat_bx@gmail.com',
        passwordHash: pwd,
        role: 'patient',
        fullName: 'Tribal Patient A',
        isActive: true,
      },
    ]);

    adminToken = signAccessToken({
      userId: adminId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_admin_bx',
      deviceId: 'dev_admin_bx',
    });

    moToken = signAccessToken({
      userId: moId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_bx',
      deviceId: 'dev_mo_bx',
    });

    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_asha_bx',
      deviceId: 'dev_asha_bx',
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      scopes: getRoleCapabilities('patient'),
      deviceSessionId: 'ses_pat_bx',
      deviceId: 'dev_pat_bx',
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  describe('1. Full Legal Biopsy Lifecycle (REQUESTED -> SCHEDULED -> COLLECTED -> SENT_TO_LAB -> RESULT_RECEIVED)', () => {
    let biopsyId: string;
    const dummyHash = crypto.createHash('sha256').update('Original Histology Slide 001').digest('hex');

    it('creates a biopsy procedure request in REQUESTED status', async () => {
      const res = await request(app)
        .post('/api/v1/biopsy')
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          patientId,
          patientName: 'Tribal Patient A',
          hospitalId: hospPaderuId,
          anatomicalLocation: 'Right Buccal Mucosa',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.biopsy.status).toBe('REQUESTED');
      expect(res.body.data.biopsy.anatomicalLocation).toBe('Right Buccal Mucosa');
      biopsyId = res.body.data.biopsy.biopsyId;
    });

    it('schedules biopsy procedure (REQUESTED -> SCHEDULED)', async () => {
      const res = await request(app)
        .post(`/api/v1/biopsy/${biopsyId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          procedureDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          scheduledHospitalId: hospPaderuId,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.biopsy.status).toBe('SCHEDULED');
    });

    it('collects specimen with barcode (SCHEDULED -> COLLECTED)', async () => {
      const res = await request(app)
        .post(`/api/v1/biopsy/${biopsyId}/collect`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          specimenBarcode: 'BARCODE-BX-2026-001',
          collectedBy: 'Dr. Ramesh MO',
          tissueType: 'Punch biopsy tissue 3mm',
          fixative: '10% Neutral Buffered Formalin',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.biopsy.status).toBe('COLLECTED');
      expect(res.body.data.biopsy.collectionDetails.specimenBarcode).toBe('BARCODE-BX-2026-001');
    });

    it('dispatches specimen to pathology laboratory (COLLECTED -> SENT_TO_LAB)', async () => {
      const res = await request(app)
        .post(`/api/v1/biopsy/${biopsyId}/send-to-lab`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          destinationLabName: 'Apex Histopathology Lab, Visakhapatnam',
          courierTrackingId: 'TRK-MED-998822',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.biopsy.status).toBe('SENT_TO_LAB');
      expect(res.body.data.biopsy.transitDetails.destinationLabName).toBe('Apex Histopathology Lab, Visakhapatnam');
    });

    it('records microscopic examination findings by qualified pathologist (SENT_TO_LAB -> RESULT_RECEIVED)', async () => {
      const res = await request(app)
        .post(`/api/v1/biopsy/${biopsyId}/findings`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          pathologistName: 'Dr. S. K. Sharma, MD Pathologist',
          specimenAdequacy: 'Satisfactory for microscopic evaluation',
          grossDescription: 'Single punch biopsy measuring 0.4 x 0.3 cm, grayish white.',
          microscopicObservations: 'Sections show stratified squamous epithelium with mild cellular atypia. No stromal invasion.',
          pathologistImpression: 'Epithelial dysplasia, low-grade. Negative for invasive malignancy.',
          labAttachment: {
            fileId: 'file_bx_slide_001',
            sha256: dummyHash,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.biopsy.status).toBe('RESULT_RECEIVED');
      expect(res.body.data.findings.pathologistImpression).toContain('Negative for invasive malignancy');
    });

    it('blocks patient from viewing findings before release authorization', async () => {
      const res = await request(app)
        .get(`/api/v1/biopsy/${biopsyId}/findings`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESULT_NOT_RELEASED');
    });

    it('allows MO to view findings prior to release authorization', async () => {
      const res = await request(app)
        .get(`/api/v1/biopsy/${biopsyId}/findings`)
        .set('Authorization', `Bearer ${moToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.findings.pathologistName).toBe('Dr. S. K. Sharma, MD Pathologist');
    });

    it('authorizes and releases biopsy result for patient access', async () => {
      const res = await request(app)
        .post(`/api/v1/biopsy/${biopsyId}/release-result`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          patientSummaryMessage: 'Your laboratory evaluation has been completed by Dr. Ramesh. Please attend your scheduled follow-up consultation.',
          recommendedAction: 'Schedule follow-up OPD consultation within 14 days.',
          reviewerNotes: 'Verified pathologist report, patient notified.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.release.patientSummaryMessage).toBeDefined();
    });

    it('permits patient to view findings and release summary after authorization', async () => {
      const findingsRes = await request(app)
        .get(`/api/v1/biopsy/${biopsyId}/findings`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(findingsRes.status).toBe(200);
      expect(findingsRes.body.data.findings).toBeDefined();

      const releaseRes = await request(app)
        .get(`/api/v1/biopsy/${biopsyId}/release`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(releaseRes.status).toBe(200);
      expect(releaseRes.body.data.release.patientSummaryMessage).toContain('follow-up consultation');
    });
  });

  describe('2. Transition Table Enforcement: Every Illegal Transition Rejected', () => {
    it('rejects REQUESTED -> COLLECTED directly (skipping SCHEDULED)', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_illegal_01',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'REQUESTED',
        anatomicalLocation: 'Tongue lateral border',
      });

      const res = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/collect`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          specimenBarcode: 'BARCODE-ERR-001',
          tissueType: 'Tissue',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BIOPSY_TRANSITION');
    });

    it('rejects REQUESTED -> RESULT_RECEIVED directly', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_illegal_02',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'REQUESTED',
        anatomicalLocation: 'Lip mucosa',
      });

      const res = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/findings`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          pathologistName: 'Dr. Path',
          specimenAdequacy: 'Adequate',
          grossDescription: 'Gross desc',
          microscopicObservations: 'Microscopic desc',
          pathologistImpression: 'Impression',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BIOPSY_TRANSITION');
    });

    it('rejects SCHEDULED -> SENT_TO_LAB directly (skipping COLLECTED)', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_illegal_03',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'SCHEDULED',
        anatomicalLocation: 'Gingiva',
      });

      const res = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/send-to-lab`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          destinationLabName: 'Lab Central',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BIOPSY_TRANSITION');
    });

    it('rejects COLLECTED -> SCHEDULED backward transition', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_illegal_04',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'COLLECTED',
        anatomicalLocation: 'Palate',
      });

      const res = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          procedureDate: new Date().toISOString(),
          scheduledHospitalId: hospPaderuId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BIOPSY_TRANSITION');
    });

    it('rejects CANCELLED -> any forward transition', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_illegal_05',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'CANCELLED',
        anatomicalLocation: 'Buccal',
      });

      const res = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          procedureDate: new Date().toISOString(),
          scheduledHospitalId: hospPaderuId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_BIOPSY_TRANSITION');
    });
  });

  describe('3. RECOLLECTION_REQUIRED Correct Loop-Back', () => {
    it('flags RECOLLECTION_REQUIRED from COLLECTED and loops back to SCHEDULED', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_recollect_01',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'COLLECTED',
        anatomicalLocation: 'Floor of mouth',
      });

      const flagRes = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/recollection-required`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          reason: 'Specimen container broken in transit prior to accessioning',
        });

      expect(flagRes.status).toBe(200);
      expect(flagRes.body.data.biopsy.status).toBe('RECOLLECTION_REQUIRED');

      // Loop back to SCHEDULED
      const loopRes = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          procedureDate: new Date(Date.now() + 86400000 * 3).toISOString(),
          scheduledHospitalId: hospPaderuId,
        });

      expect(loopRes.status).toBe(200);
      expect(loopRes.body.data.biopsy.status).toBe('SCHEDULED');
    });

    it('flags RECOLLECTION_REQUIRED from SENT_TO_LAB and loops back to COLLECTED directly', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_recollect_02',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'SENT_TO_LAB',
        anatomicalLocation: 'Retromolar trigone',
      });

      const flagRes = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/recollection-required`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          reason: 'Pathologist reported specimen superficial and inadequate for cellular evaluation',
        });

      expect(flagRes.status).toBe(200);
      expect(flagRes.body.data.biopsy.status).toBe('RECOLLECTION_REQUIRED');

      // Loop back to COLLECTED directly
      const loopRes = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/collect`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          specimenBarcode: 'BARCODE-RECOLLECT-002',
          tissueType: 'Deep punch tissue sample 4mm',
        });

      expect(loopRes.status).toBe(200);
      expect(loopRes.body.data.biopsy.status).toBe('COLLECTED');
    });
  });

  describe('4. Attachment Immutability & Provenance (SHA-256 Verified)', () => {
    it('maintains original attachment hash unchanged when amending lab attachment', async () => {
      const hashOriginal = crypto.createHash('sha256').update('Original Slide Micrograph V1').digest('hex');
      const hashNew = crypto.createHash('sha256').update('High Res Re-scanned Slide Micrograph V2').digest('hex');

      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_amend_01',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'RESULT_RECEIVED',
        anatomicalLocation: 'Buccal mucosa',
        labAttachment: {
          originalFileId: 'file_orig_001',
          originalSha256: hashOriginal,
          currentFileId: 'file_orig_001',
          currentSha256: hashOriginal,
          version: 1,
          amendmentHistory: [],
        },
      });

      const amendRes = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/amend-attachment`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          newFileId: 'file_rescanned_002',
          newSha256: hashNew,
          reason: 'High-resolution re-scan requested by reviewer',
        });

      expect(amendRes.status).toBe(200);
      expect(amendRes.body.data.biopsy.labAttachment.version).toBe(2);
      expect(amendRes.body.data.biopsy.labAttachment.originalSha256).toBe(hashOriginal);
      expect(amendRes.body.data.biopsy.labAttachment.currentSha256).toBe(hashNew);

      // Verify DB record: Original attachment hash MUST remain byte-identical and unmutated
      const biopsyInDb = await BiopsyRecord.findOne({ biopsyId: bx.biopsyId }).lean();
      expect(biopsyInDb?.labAttachment?.originalSha256).toBe(hashOriginal);
      expect(biopsyInDb?.labAttachment?.version).toBe(2);
      expect(biopsyInDb?.labAttachment?.amendmentHistory).toHaveLength(1);
      expect(biopsyInDb?.labAttachment?.amendmentHistory[0].amendedSha256).toBe(hashNew);
      expect(biopsyInDb?.labAttachment?.amendmentHistory[0].version).toBe(2);
    });
  });

  describe('5. Role Authorization & Cancellation', () => {
    it('denies ASHA or Patient from creating biopsy requests', async () => {
      const res = await request(app)
        .post('/api/v1/biopsy')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          hospitalId: hospPaderuId,
          anatomicalLocation: 'Cheek',
        });

      expect(res.status).toBe(403);
    });

    it('allows Medical Officer to cancel biopsy with mandatory reason', async () => {
      const bx = await BiopsyRecord.create({
        biopsyId: 'bx_cancel_01',
        patientId,
        hospitalId: hospPaderuId,
        requestingDoctorId: moId,
        status: 'REQUESTED',
        anatomicalLocation: 'Tongue',
      });

      const res = await request(app)
        .post(`/api/v1/biopsy/${bx.biopsyId}/cancel`)
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          reason: 'Patient relocated to different district, care transferred',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.biopsy.status).toBe('CANCELLED');
      expect(res.body.data.biopsy.cancellation.reason).toBe('Patient relocated to different district, care transferred');
    });
  });
});
