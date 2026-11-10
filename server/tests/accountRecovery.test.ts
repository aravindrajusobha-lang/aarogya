import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { createTestReplicaSet } from './setupReplSet.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { RecoveryTicket } from '../src/modules/recovery/recoveryModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';

describe('Phase 6: Verified Account Recovery Flow (Three-Party Role Separation & Enumeration Resistance)', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Three separate actors with distinct IDs
  const requesterId = 'usr_requester_asha_101';
  const verifierId = 'usr_verifier_anm_202';
  const approverId = 'usr_approver_mo_303';
  const adminId = 'usr_system_admin_001';

  let requesterToken: string;
  let verifierToken: string;
  let approverToken: string;
  let adminToken: string;

  // Known patient in DB
  const knownPatientId = 'PAD-2026-77701';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsRecovery');
    await mongoose.connect(replSet.getUri());

    requesterToken = signAccessToken({
      userId: requesterId,
      role: 'asha',
      scopes: ['recovery:initiate', 'recovery:read', 'recovery:verify', 'recovery:complete'],
      deviceSessionId: 'ses_req_1',
      deviceId: 'dev_req_1',
    });

    verifierToken = signAccessToken({
      userId: verifierId,
      role: 'anm',
      scopes: ['recovery:initiate', 'recovery:read', 'recovery:verify', 'recovery:complete'],
      deviceSessionId: 'ses_ver_2',
      deviceId: 'dev_ver_2',
    });

    approverToken = signAccessToken({
      userId: approverId,
      role: 'medical_officer',
      scopes: [
        'recovery:initiate',
        'recovery:read',
        'recovery:verify',
        'recovery:approve',
        'recovery:complete',
      ],
      deviceSessionId: 'ses_app_3',
      deviceId: 'dev_app_3',
    });

    adminToken = signAccessToken({
      userId: adminId,
      role: 'system_admin',
      scopes: ['*'],
      deviceSessionId: 'ses_adm_4',
      deviceId: 'dev_adm_4',
    });

    // Create a known patient in the database
    await Patient.create({
      patientId: knownPatientId,
      fullName: 'Pangi Somulu',
      gender: 'male',
      ageEstimated: 52,
      phone: '9440188990',
      guardianName: 'Pangi Somanna',
      villageId: 'vil_vankachinta_01',
      villageName: 'Vankachinta',
      mandal: 'Paderu',
      district: 'Alluri Sitharama Raju',
      originalAddressText: 'Near Old Water Tank, Vankachinta, Paderu',
      hospitalId: 'hosp_paderu_dh',
      registeredBy: 'usr_asha_creator_01',
      isDuplicateCandidate: false,
      duplicateReviewStatus: 'none',
      registeredAt: new Date(),
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  // ==========================================
  // 1. Identical Responses for Known and Unknown Records
  // ==========================================
  describe('Enumeration Resistance: Known vs Unknown Patient Records', () => {
    it('returns byte-identical response structure and status for a known patient record and an unknown record', async () => {
      // 1. Request for KNOWN patient
      const knownRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPatientId: knownPatientId,
          claimedDemographics: {
            fullName: 'Pangi Somulu',
            gender: 'male',
            ageEstimated: 52,
            villageId: 'vil_vankachinta_01',
            villageName: 'Vankachinta',
            guardianName: 'Pangi Somanna',
            phone: '9440188990',
            originalAddressText: 'Near Old Water Tank, Vankachinta, Paderu',
          },
        });

      // 2. Request for UNKNOWN patient
      const unknownRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPatientId: 'PAD-9999-00000',
          claimedDemographics: {
            fullName: 'Unknown Fictional Claimant',
            gender: 'female',
            ageEstimated: 33,
            villageId: 'vil_non_existent',
            villageName: 'Ghost Habitation',
            phone: '9999999999',
          },
        });

      // Assert identical HTTP Status
      expect(knownRes.status).toBe(201);
      expect(unknownRes.status).toBe(201);

      // Assert identical success flag
      expect(knownRes.body.success).toBe(true);
      expect(unknownRes.body.success).toBe(true);

      // Assert identical response keys
      const knownDataKeys = Object.keys(knownRes.body.data).sort();
      const unknownDataKeys = Object.keys(unknownRes.body.data).sort();
      expect(knownDataKeys).toEqual(unknownDataKeys);
      expect(knownDataKeys).toEqual(['message', 'notice', 'simulation', 'status', 'ticketId']);

      // Assert identical user-facing messages
      expect(knownRes.body.data.status).toBe('pending_verification');
      expect(unknownRes.body.data.status).toBe('pending_verification');

      expect(knownRes.body.data.message).toBe(unknownRes.body.data.message);
      expect(knownRes.body.data.notice).toBe(unknownRes.body.data.notice);
      expect(knownRes.body.data.simulation).toBe(true);
      expect(unknownRes.body.data.simulation).toBe(true);

      // Verify internal DB matching behavior:
      const knownTicket = await RecoveryTicket.findOne({ ticketId: knownRes.body.data.ticketId });
      const unknownTicket = await RecoveryTicket.findOne({ ticketId: unknownRes.body.data.ticketId });

      // Known ticket internally matched the real record
      expect(knownTicket?.matchedPatientId).toBe(knownPatientId);
      expect(knownTicket?.matchScore).toBeGreaterThanOrEqual(80);

      // Unknown ticket internally recorded null match
      expect(unknownTicket?.matchedPatientId).toBeNull();
      expect(unknownTicket?.matchScore).toBe(0);
    });
  });

  // ==========================================
  // 2. Three-Party Role Separation: Each Pairing Tested
  // ==========================================
  describe('Three-Party Role Separation: Requester, Verifier, and Approver', () => {
    it('succeeds when requester, verifier, and approver are three different people', async () => {
      // 1. Person A initiates
      const initRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPatientId: knownPatientId,
          claimedDemographics: {
            fullName: 'Pangi Somulu',
            gender: 'male',
            ageEstimated: 52,
            villageId: 'vil_vankachinta_01',
            villageName: 'Vankachinta',
          },
        });
      const ticketId = initRes.body.data.ticketId;

      // 2. Person B verifies (different person from Person A)
      const verifyRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/verify`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({
          verificationNotes: 'Claimant identity verified in person at primary health sub-center',
          verificationEvidence: 'physical_demographic_crosscheck',
        });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.ticket.status).toBe('verified');
      expect(verifyRes.body.data.ticket.verifierId).toBe(verifierId);

      // 3. Person C approves (different person from both Person A and Person B)
      const approveRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({
          approvalNotes: 'Frontline verification and identity confirmed by medical officer',
        });
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.ticket.status).toBe('approved');
      expect(approveRes.body.data.ticket.approverId).toBe(approverId);
      expect(approveRes.body.data.recoveryToken).toMatch(/^REC-CLAIM-/);

      // 4. Complete recovery using issued claim token
      const completeRes = await request(app)
        .post('/api/v1/recovery/complete')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          ticketId,
          recoveryToken: approveRes.body.data.recoveryToken,
        });
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.ticket.status).toBe('completed');
    });

    it('Pairing 1: REJECTS when Requester attempts to Verify own ticket (Requester == Verifier)', async () => {
      // Person A initiates
      const initRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPatientId: knownPatientId,
          claimedDemographics: {
            fullName: 'Pangi Somulu',
            gender: 'male',
            ageEstimated: 52,
            villageId: 'vil_vankachinta_01',
            villageName: 'Vankachinta',
          },
        });
      const ticketId = initRes.body.data.ticketId;

      // Person A attempts to verify own ticket
      const selfVerifyRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/verify`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          verificationNotes: 'I am verifying my own initiated request',
        });

      expect(selfVerifyRes.status).toBe(403);
      expect(selfVerifyRes.body.error.code).toBe('FORBIDDEN');
      expect(selfVerifyRes.body.error.message).toContain('Self-verification blocked');
      expect(selfVerifyRes.body.error.message).toContain(
        'Verifier must be a different person than the requester'
      );
    });

    it('Pairing 2: REJECTS when Requester attempts to Approve own ticket (Requester == Approver)', async () => {
      // Person A (approver token acting as requester) initiates ticket
      const initRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${approverToken}`)
        .send({
          targetPatientId: knownPatientId,
          claimedDemographics: {
            fullName: 'Pangi Somulu',
            gender: 'male',
            ageEstimated: 52,
            villageId: 'vil_vankachinta_01',
            villageName: 'Vankachinta',
          },
        });
      const ticketId = initRes.body.data.ticketId;

      // Person B verifies
      const verifyRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/verify`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({
          verificationNotes: 'Verified by ANM',
        });
      expect(verifyRes.status).toBe(200);

      // Person A attempts to approve own initiated ticket
      const selfApproveRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({
          approvalNotes: 'Self approval attempt',
        });

      expect(selfApproveRes.status).toBe(403);
      expect(selfApproveRes.body.error.code).toBe('FORBIDDEN');
      expect(selfApproveRes.body.error.message).toContain('Self-approval blocked');
      expect(selfApproveRes.body.error.message).toContain(
        'Approver must be a different person than the requester'
      );
    });

    it('Pairing 3: REJECTS when Verifier attempts to Approve ticket (Verifier == Approver)', async () => {
      // Person A initiates
      const initRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPatientId: knownPatientId,
          claimedDemographics: {
            fullName: 'Pangi Somulu',
            gender: 'male',
            ageEstimated: 52,
            villageId: 'vil_vankachinta_01',
            villageName: 'Vankachinta',
          },
        });
      const ticketId = initRes.body.data.ticketId;

      // Person C (medical officer) verifies
      const verifyRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/verify`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({
          verificationNotes: 'Verified by Medical Officer',
        });
      expect(verifyRes.status).toBe(200);

      // Person C (same Medical Officer) attempts to approve
      const dualApproveRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({
          approvalNotes: 'Dual role approval attempt by verifier',
        });

      expect(dualApproveRes.status).toBe(403);
      expect(dualApproveRes.body.error.code).toBe('FORBIDDEN');
      expect(dualApproveRes.body.error.message).toContain('Dual-role approval blocked');
      expect(dualApproveRes.body.error.message).toContain(
        'Approver must be a different person than the verifier'
      );
    });

    it('REJECTS when one single person attempts to hold all three roles (Requester == Verifier == Approver)', async () => {
      // System Admin attempts to do all 3 steps alone
      const initRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetPatientId: knownPatientId,
          claimedDemographics: {
            fullName: 'Pangi Somulu',
            gender: 'male',
            ageEstimated: 52,
            villageId: 'vil_vankachinta_01',
            villageName: 'Vankachinta',
          },
        });
      const ticketId = initRes.body.data.ticketId;

      // Step 2 self-verification is strictly blocked
      const verifyRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ verificationNotes: 'Admin solo verify' });
      expect(verifyRes.status).toBe(403);
      expect(verifyRes.body.error.message).toContain('Self-verification blocked');

      // Attempting to bypass verification and approve directly is blocked
      const bypassApproveRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvalNotes: 'Admin bypass approve' });
      expect(bypassApproveRes.status).toBe(400);

      // Now Person B verifies the ticket
      const validVerifyRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/verify`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ verificationNotes: 'Verified by Person B' });
      expect(validVerifyRes.status).toBe(200);

      // Now Admin attempts self-approval -> blocked with 403!
      const selfApproveRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ approvalNotes: 'Admin self approve after third party verify' });
      expect(selfApproveRes.status).toBe(403);
      expect(selfApproveRes.body.error.message).toContain('Self-approval blocked');
    });
  });

  // ==========================================
  // 3. No Password Reset Shortcut
  // ==========================================
  describe('No Password Reset Shortcut', () => {
    it('strictly verifies NO forgot-password endpoint exists (returns 404)', async () => {
      const forgotRes = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'test@example.com',
      });
      expect(forgotRes.status).toBe(404);
    });

    it('strictly verifies NO reset-password endpoint exists (returns 404)', async () => {
      const resetRes = await request(app).post('/api/v1/auth/reset-password').send({
        token: 'any-token',
        newPassword: 'NewPassword123!',
      });
      expect(resetRes.status).toBe(404);
    });

    it('blocks attempting to approve a ticket without frontline verification having occurred', async () => {
      // Person A initiates
      const initRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPatientId: knownPatientId,
          claimedDemographics: {
            fullName: 'Pangi Somulu',
            gender: 'male',
            ageEstimated: 52,
            villageId: 'vil_vankachinta_01',
            villageName: 'Vankachinta',
          },
        });
      const ticketId = initRes.body.data.ticketId;

      // Person C attempts to approve directly, skipping verification step
      const directApproveRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({ approvalNotes: 'Skipping verification step' });

      expect(directApproveRes.status).toBe(400);
      expect(directApproveRes.body.error.code).toBe('BAD_REQUEST');
      expect(directApproveRes.body.error.message).toContain(
        'Cannot approve ticket that has not completed verification'
      );
    });
  });

  // ==========================================
  // 4. Unknown Record Rejection on Multi-Party Audit
  // ==========================================
  describe('Multi-Party Audit of Unknown Patient Record', () => {
    it('safely rejects unknown patient ticket during multi-party audit without leaking prior existence', async () => {
      // 1. Person A initiates for unknown record
      const initRes = await request(app)
        .post('/api/v1/recovery/initiate')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({
          targetPatientId: 'PAD-0000-NONEXISTENT',
          claimedDemographics: {
            fullName: 'Completely Unknown Person',
            gender: 'female',
            ageEstimated: 40,
            villageId: 'vil_unknown',
            villageName: 'Unknown',
          },
        });
      const ticketId = initRes.body.data.ticketId;

      // 2. Person B verifies
      const verifyRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/verify`)
        .set('Authorization', `Bearer ${verifierToken}`)
        .send({ verificationNotes: 'Physical documents reviewed' });
      expect(verifyRes.status).toBe(200);

      // 3. Person C attempts approval -> Multi-party audit rejects because matchedPatientId is null
      const approveRes = await request(app)
        .post(`/api/v1/recovery/tickets/${ticketId}/approve`)
        .set('Authorization', `Bearer ${approverToken}`)
        .send({ approvalNotes: 'Auditing against healthcare registry' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.ticket.status).toBe('rejected');
      expect(approveRes.body.data.recoveryToken).toBeUndefined();
      expect(approveRes.body.data.ticket.rejectionReason).toContain(
        'Patient record could not be confirmed'
      );
    });
  });

  // ==========================================
  // 5. Audit Log Immutability
  // ==========================================
  describe('Audit Log Trail for Recovery Actions', () => {
    it('records immutable audit log entries for initiate, verify, and approve events', async () => {
      const logs = await AuditLog.find({
        action: { $in: ['RECOVERY_INITIATE', 'RECOVERY_VERIFY', 'RECOVERY_APPROVE'] },
      });

      expect(logs.length).toBeGreaterThanOrEqual(3);
      const actions = logs.map((l) => l.action);
      expect(actions).toContain('RECOVERY_INITIATE');
      expect(actions).toContain('RECOVERY_VERIFY');
      expect(actions).toContain('RECOVERY_APPROVE');
    });
  });
});
