import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import {
  Teleconsultation,
  ConsultationNote,
  ConsultationMessage,
} from '../src/modules/teleconsultation/teleconsultationModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 13: Teleconsultation Workflow & Adapter Governance', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Hospital A: Paderu District Hospital
  const hospPaderuId = 'hosp_paderu_tc_01';
  let moAssignedToken: string;
  const moAssignedId = 'usr_mo_assigned_p13';
  let moOtherToken: string;
  const moOtherId = 'usr_mo_other_p13';
  let adminToken: string;
  const adminId = 'usr_admin_tc_p13';

  // Hospital B: Araku Valley Hospital (Different facility)
  const hospArakuId = 'hosp_araku_tc_02';
  let moArakuToken: string;
  const moArakuId = 'usr_mo_araku_p13';

  // Frontline Worker (ASHA) & Patient
  let ashaToken: string;
  const ashaId = 'usr_asha_tc_p13';
  let patientToken: string;
  const patientId = 'usr_pat_tc_p13';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsTeleconsult');
    await mongoose.connect(replSet.getUri());
    await Teleconsultation.syncIndexes();
    await ConsultationNote.syncIndexes();
    await ConsultationMessage.syncIndexes();

    const pwd = await hashPassword('TeleconsultPass@2026');

    // 1. Create Hospitals
    await Hospital.create([
      {
        hospitalId: hospPaderuId,
        name: 'Paderu District Hospital',
        district: 'Alluri Sitharama Raju',
        mandal: 'Paderu',
        state: 'Andhra Pradesh',
        type: 'district_hospital',
        status: 'active',
      },
      {
        hospitalId: hospArakuId,
        name: 'Araku Valley Area Hospital',
        district: 'Alluri Sitharama Raju',
        mandal: 'Araku Valley',
        state: 'Andhra Pradesh',
        type: 'area_hospital',
        status: 'active',
      },
    ]);

    // 2. Create Users
    await User.create([
      {
        userId: moAssignedId,
        username: 'mo_assigned_01',
        email: 'dr.ramesh@paderu.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospPaderuId,
        fullName: 'Dr. Ramesh (Assigned MO)',
        isActive: true,
      },
      {
        userId: moOtherId,
        username: 'mo_other_01',
        email: 'dr.suresh@paderu.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospPaderuId,
        fullName: 'Dr. Suresh (Unassigned MO)',
        isActive: true,
      },
      {
        userId: adminId,
        username: 'admin_tc_01',
        email: 'admin@paderu.gov.in',
        passwordHash: pwd,
        role: 'admin',
        hospitalId: hospPaderuId,
        fullName: 'Hospital Manager Paderu',
        isActive: true,
      },
      {
        userId: moArakuId,
        username: 'mo_araku_tc',
        email: 'mo@araku.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospArakuId,
        fullName: 'Dr. Anitha (Araku MO)',
        isActive: true,
      },
      {
        userId: ashaId,
        username: 'asha_tc_01',
        email: 'asha@paderu.gov.in',
        passwordHash: pwd,
        role: 'asha',
        hospitalId: hospPaderuId,
        fullName: 'Lakshmi ASHA',
        isActive: true,
      },
      {
        userId: patientId,
        username: 'pat_tc_01',
        email: 'patient@paderu.com',
        passwordHash: pwd,
        role: 'patient',
        fullName: 'Tribal Patient B',
        isActive: true,
      },
    ]);

    moAssignedToken = signAccessToken({
      userId: moAssignedId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_asg',
      deviceId: 'dev_mo_asg',
    });

    moOtherToken = signAccessToken({
      userId: moOtherId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_oth',
      deviceId: 'dev_mo_oth',
    });

    adminToken = signAccessToken({
      userId: adminId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_adm_tc',
      deviceId: 'dev_adm_tc',
    });

    moArakuToken = signAccessToken({
      userId: moArakuId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_ark',
      deviceId: 'dev_mo_ark',
    });

    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_asha_tc',
      deviceId: 'dev_asha_tc',
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      scopes: getRoleCapabilities('patient'),
      deviceSessionId: 'ses_pat_tc',
      deviceId: 'dev_pat_tc',
    });
  }, 60000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  describe('1. Consultation Request, Scheduling & Status Tracking', () => {
    let consultationId: string;

    it('creates a teleconsultation request in REQUESTED status', async () => {
      const res = await request(app)
        .post('/api/v1/teleconsultation')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          patientName: 'Tribal Patient B',
          hospitalId: hospPaderuId,
          assignedClinicianId: moAssignedId,
          assignedClinicianName: 'Dr. Ramesh',
          assignedClinicianRole: 'medical_officer',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.consultation.status).toBe('REQUESTED');
      expect(res.body.data.consultation.channelConfig.videoStatus).toBe('BLOCKED');
      expect(res.body.data.consultation.channelConfig.voiceStatus).toBe('BLOCKED');
      expect(res.body.data.consultation.channelConfig.textChatStatus).toBe('ACTIVE');
      consultationId = res.body.data.consultation.consultationId;
    });

    it('schedules teleconsultation session (REQUESTED -> SCHEDULED)', async () => {
      const scheduledDate = new Date(Date.now() + 86400000 * 3).toISOString();
      const res = await request(app)
        .post(`/api/v1/teleconsultation/${consultationId}/schedule`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          scheduledAt: scheduledDate,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.consultation.status).toBe('SCHEDULED');
      expect(res.body.data.consultation.scheduledAt).toBeDefined();
    });

    it('starts consultation session (SCHEDULED -> IN_PROGRESS)', async () => {
      const res = await request(app)
        .post(`/api/v1/teleconsultation/${consultationId}/start`)
        .set('Authorization', `Bearer ${moAssignedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.consultation.status).toBe('IN_PROGRESS');
      expect(res.body.data.consultation.startedAt).toBeDefined();
    });
  });

  describe('2. Video & Voice Adapter Interface: Explicit BLOCKED Stub (No Fake Call Screen)', () => {
    let testConsultationId: string;

    beforeAll(async () => {
      const tc = await Teleconsultation.create({
        consultationId: 'tc_adapter_test_01',
        patientId,
        hospitalId: hospPaderuId,
        assignedClinicianId: moAssignedId,
        requestedBy: ashaId,
        requesterRole: 'asha',
        status: 'IN_PROGRESS',
        simulation: true,
      });
      testConsultationId = tc.consultationId;
    });

    it('returns explicit BLOCKED stub for video session with no call controls', async () => {
      const res = await request(app)
        .get(`/api/v1/teleconsultation/${testConsultationId}/video-session`)
        .set('Authorization', `Bearer ${moAssignedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.videoStatus.status).toBe('BLOCKED');
      expect(res.body.data.videoStatus.channelType).toBe('video');
      expect(res.body.data.videoStatus.adapterName).toBe('SIMULATION_BLOCKED_STUB');
      expect(res.body.data.videoStatus.isSimulation).toBe(true);
      expect(res.body.data.videoStatus.uiIndicator.showCallControls).toBe(false);
      expect(res.body.data.videoStatus.uiIndicator.badgeText).toContain('BLOCKED');
      expect(res.body.data.videoStatus.blockedReason).toContain('Live video streaming is BLOCKED');
    });

    it('returns explicit BLOCKED stub for voice session', async () => {
      const res = await request(app)
        .get(`/api/v1/teleconsultation/${testConsultationId}/voice-session`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.voiceStatus.status).toBe('BLOCKED');
      expect(res.body.data.voiceStatus.channelType).toBe('voice');
      expect(res.body.data.voiceStatus.adapterName).toBe('SIMULATION_BLOCKED_STUB');
      expect(res.body.data.voiceStatus.uiIndicator.showCallControls).toBe(false);
    });
  });

  describe('3. Clinical Notes Authorization & SHA-256 Immutability', () => {
    let testConsultationId: string;
    const initialNote = 'Patient examined via clinical photo assessment. Oral mucosa displays localized plaque-like area.';
    const amendedNote = 'Patient examined via clinical photo assessment. Oral mucosa displays localized plaque-like area measuring approximately 1.5 cm with smooth borders.';

    beforeAll(async () => {
      const tc = await Teleconsultation.create({
        consultationId: 'tc_notes_test_01',
        patientId,
        hospitalId: hospPaderuId,
        assignedClinicianId: moAssignedId,
        requestedBy: ashaId,
        requesterRole: 'asha',
        status: 'IN_PROGRESS',
        simulation: true,
      });
      testConsultationId = tc.consultationId;
    });

    it('denies unassigned Medical Officer from recording clinical notes', async () => {
      const res = await request(app)
        .post(`/api/v1/teleconsultation/${testConsultationId}/notes`)
        .set('Authorization', `Bearer ${moOtherToken}`)
        .send({
          noteText: initialNote,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_NOT_ASSIGNED_CLINICIAN');
    });

    it('allows assigned Medical Officer to record clinical notes with SHA-256 hash', async () => {
      const res = await request(app)
        .post(`/api/v1/teleconsultation/${testConsultationId}/notes`)
        .set('Authorization', `Bearer ${moAssignedToken}`)
        .send({
          noteText: initialNote,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.note.currentVersion).toBe(1);
      expect(res.body.data.note.originalHash).toBe(
        crypto.createHash('sha256').update(initialNote).digest('hex')
      );
      expect(res.body.data.note.currentHash).toBe(res.body.data.note.originalHash);
    });

    it('amends clinical notes while keeping the original hash byte-identical', async () => {
      const originalHash = crypto.createHash('sha256').update(initialNote).digest('hex');
      const newHash = crypto.createHash('sha256').update(amendedNote).digest('hex');

      const res = await request(app)
        .post(`/api/v1/teleconsultation/${testConsultationId}/notes/amend`)
        .set('Authorization', `Bearer ${moAssignedToken}`)
        .send({
          newNoteText: amendedNote,
          amendmentReason: 'Added precise dimensions of the observed area',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.note.currentVersion).toBe(2);
      expect(res.body.data.note.originalHash).toBe(originalHash);
      expect(res.body.data.note.currentHash).toBe(newHash);

      // Verify DB entity keeps original hash and version history intact
      const noteInDb = await ConsultationNote.findOne({ consultationId: testConsultationId }).lean();
      expect(noteInDb?.originalHash).toBe(originalHash);
      expect(noteInDb?.notesHistory).toHaveLength(2);
      expect(noteInDb?.notesHistory[0].hash).toBe(originalHash);
      expect(noteInDb?.notesHistory[0].version).toBe(1);
      expect(noteInDb?.notesHistory[1].hash).toBe(newHash);
      expect(noteInDb?.notesHistory[1].version).toBe(2);
    });
  });

  describe('4. Patient Release Gating (DPDP Confidentiality)', () => {
    let testConsultationId: string;

    beforeAll(async () => {
      const tc = await Teleconsultation.create({
        consultationId: 'tc_release_test_01',
        patientId,
        hospitalId: hospPaderuId,
        assignedClinicianId: moAssignedId,
        requestedBy: ashaId,
        requesterRole: 'asha',
        status: 'IN_PROGRESS',
        release: { isReleased: false },
        simulation: true,
      });
      testConsultationId = tc.consultationId;

      await ConsultationNote.create({
        noteId: 'note_rel_01',
        consultationId: testConsultationId,
        clinicianId: moAssignedId,
        clinicianName: 'Dr. Ramesh',
        clinicianRole: 'medical_officer',
        currentVersion: 1,
        originalNoteText: 'Clinical observations recorded for teleconsultation review.',
        originalHash: crypto.createHash('sha256').update('Clinical observations').digest('hex'),
        currentNoteText: 'Clinical observations recorded for teleconsultation review.',
        currentHash: crypto.createHash('sha256').update('Clinical observations').digest('hex'),
        notesHistory: [],
      });
    });

    it('blocks patient from viewing clinical notes before release authorization', async () => {
      const res = await request(app)
        .get(`/api/v1/teleconsultation/${testConsultationId}/notes`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('RESULT_NOT_RELEASED');
    });

    it('allows Medical Officer to release consultation summary', async () => {
      const res = await request(app)
        .post(`/api/v1/teleconsultation/${testConsultationId}/release`)
        .set('Authorization', `Bearer ${moAssignedToken}`)
        .send({
          patientSummaryMessage: 'Your teleconsultation evaluation has been completed by Dr. Ramesh. Please attend your scheduled facility consultation.',
          recommendedAction: 'Schedule outpatient visit within two weeks.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.consultation.release.isReleased).toBe(true);
      expect(res.body.data.consultation.status).toBe('COMPLETED');
    });

    it('permits patient to view clinical notes after formal release', async () => {
      const res = await request(app)
        .get(`/api/v1/teleconsultation/${testConsultationId}/notes`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.note.currentNoteText).toBeDefined();
    });
  });

  describe('5. Real Text-Based Staff Case Discussion', () => {
    let testConsultationId: string;

    beforeAll(async () => {
      const tc = await Teleconsultation.create({
        consultationId: 'tc_chat_test_01',
        patientId,
        hospitalId: hospPaderuId,
        assignedClinicianId: moAssignedId,
        requestedBy: ashaId,
        requesterRole: 'asha',
        status: 'IN_PROGRESS',
        simulation: true,
      });
      testConsultationId = tc.consultationId;
    });

    it('allows MO and ASHA to exchange case discussion messages', async () => {
      const ashaMsgRes = await request(app)
        .post(`/api/v1/teleconsultation/${testConsultationId}/messages`)
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          messageText: 'Patient presented with localized white patch, screening photos uploaded yesterday.',
        });

      expect(ashaMsgRes.status).toBe(201);
      expect(ashaMsgRes.body.data.message.senderRole).toBe('asha');

      const moMsgRes = await request(app)
        .post(`/api/v1/teleconsultation/${testConsultationId}/messages`)
        .set('Authorization', `Bearer ${moAssignedToken}`)
        .send({
          messageText: 'Reviewed photos. Advise patient to schedule clinic consultation for tactile inspection.',
        });

      expect(moMsgRes.status).toBe(201);
      expect(moMsgRes.body.data.message.senderRole).toBe('medical_officer');

      const listRes = await request(app)
        .get(`/api/v1/teleconsultation/${testConsultationId}/messages`)
        .set('Authorization', `Bearer ${moAssignedToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.messages).toHaveLength(2);
    });

    it('denies patient from accessing staff-only case discussion thread', async () => {
      const res = await request(app)
        .get(`/api/v1/teleconsultation/${testConsultationId}/messages`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('6. Cross-Hospital Denial & Cancellation', () => {
    let testConsultationId: string;

    beforeAll(async () => {
      const tc = await Teleconsultation.create({
        consultationId: 'tc_cross_hosp_01',
        patientId,
        hospitalId: hospPaderuId,
        assignedClinicianId: moAssignedId,
        requestedBy: ashaId,
        requesterRole: 'asha',
        status: 'REQUESTED',
        simulation: true,
      });
      testConsultationId = tc.consultationId;
    });

    it('denies staff from Araku Valley Hospital from accessing Paderu teleconsultation', async () => {
      const res = await request(app)
        .get(`/api/v1/teleconsultation/${testConsultationId}`)
        .set('Authorization', `Bearer ${moArakuToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');
    });

    it('allows assigned clinician to cancel teleconsultation with mandatory reason', async () => {
      const res = await request(app)
        .post(`/api/v1/teleconsultation/${testConsultationId}/cancel`)
        .set('Authorization', `Bearer ${moAssignedToken}`)
        .send({
          reason: 'Patient arrived in-person at outpatient clinic, teleconsultation unnecessary',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.consultation.status).toBe('CANCELLED');
      expect(res.body.data.consultation.cancellation.reason).toBe(
        'Patient arrived in-person at outpatient clinic, teleconsultation unnecessary'
      );
    });
  });
});
