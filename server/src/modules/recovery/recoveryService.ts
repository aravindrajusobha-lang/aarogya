import crypto from 'crypto';
import { RecoveryTicket, IRecoveryTicket, IClaimedDemographics } from './recoveryModel.js';
import { Patient } from '../patient/patientModel.js';
import { evaluateDuplicateCandidate } from '../patient/duplicateDetector.js';
import { AuditLog } from '../audit/auditModel.js';
import { logger } from '../../config/logger.js';

export interface InitiateRecoveryInput {
  requesterId: string;
  requesterRole: string;
  targetPatientId?: string;
  claimedDemographics: IClaimedDemographics;
}

export interface InitiateRecoveryResponse {
  ticketId: string;
  status: 'pending_verification';
  message: string;
  notice: string;
  simulation: true;
}

export class RecoveryService {
  /**
   * Initiates account recovery.
   * SAFETY & ENUMERATION RESISTANCE:
   * Returns identical responses whether the claimed patient record exists or not.
   */
  static async initiateRecovery(
    input: InitiateRecoveryInput
  ): Promise<InitiateRecoveryResponse> {
    const { requesterId, requesterRole, targetPatientId, claimedDemographics } = input;

    // 1. Run matching against existing patient records
    let matchedPatientId: string | null = null;
    let matchScore = 0;
    const matchReasons: string[] = [];

    // Check direct targetPatientId if provided
    if (targetPatientId) {
      const directPatient = await Patient.findOne({ patientId: targetPatientId });
      if (directPatient) {
        matchedPatientId = directPatient.patientId;
        matchScore = 80;
        matchReasons.push('Direct Patient ID matched in active registry');

        // Check demographic congruence
        const scoreResult = await evaluateDuplicateCandidate({
          fullName: claimedDemographics.fullName,
          gender: claimedDemographics.gender as any,
          ageEstimated: claimedDemographics.ageEstimated,
          villageId: claimedDemographics.villageId,
          mandal: directPatient.mandal || 'Paderu',
          guardianName: claimedDemographics.guardianName,
          phone: claimedDemographics.phone,
        });

        if (scoreResult.matchScore >= 50) {
          matchScore = Math.max(matchScore, scoreResult.matchScore);
          matchReasons.push(...scoreResult.matchReasons);
        }
      }
    }

    // If no direct ID match, search by demographic candidate pool
    if (!matchedPatientId) {
      const scoreResult = await evaluateDuplicateCandidate({
        fullName: claimedDemographics.fullName,
        gender: claimedDemographics.gender as any,
        ageEstimated: claimedDemographics.ageEstimated,
        villageId: claimedDemographics.villageId,
        mandal: 'Paderu',
        guardianName: claimedDemographics.guardianName,
        phone: claimedDemographics.phone,
      });

      if (scoreResult.topCandidate?.patientId && scoreResult.matchScore >= 60) {
        matchedPatientId = scoreResult.topCandidate.patientId;
        matchScore = scoreResult.matchScore;
        matchReasons.push(...scoreResult.matchReasons);
      }
    }

    if (!matchedPatientId) {
      matchReasons.push('No corresponding demographic record identified in registry');
    }

    // 2. Generate unique Ticket ID
    const ticketId = `REC-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 3. Persist Ticket (stores matchedPatientId internally for multi-party verification)
    await RecoveryTicket.create({
      ticketId,
      targetPatientId,
      claimedDemographics,
      matchedPatientId,
      matchScore,
      matchReasons,
      status: 'pending_verification',
      requesterId,
      requesterRole,
      requestedAt: new Date(),
    });

    // 4. Audit Log
    try {
      await AuditLog.create({
        actorId: requesterId,
        actorRole: requesterRole,
        action: 'RECOVERY_INITIATE',
        resourceType: 'recovery_ticket',
        resourceId: ticketId,
        ip: '127.0.0.1',
        statusCode: 201,
        simulation: true,
        metadata: {
          hasMatch: matchedPatientId !== null,
          matchScore,
        },
      });
    } catch (auditErr: any) {
      logger.warn({ error: auditErr.message }, 'Audit write for recovery initiate failed');
    }

    // 5. ENUMERATION RESISTANT IDENTICAL RESPONSE
    // Identical status, structure, and message returned for both known and unknown records.
    return {
      ticketId,
      status: 'pending_verification',
      message:
        'Account recovery ticket initiated. Three-party identity verification required before credentials can be reissued.',
      notice:
        'Verification must be completed by an independent healthcare worker, followed by designated administrative approval.',
      simulation: true,
    };
  }

  /**
   * Verifies identity of claimant.
   * Verifier MUST be a different person than the Requester.
   */
  static async verifyRecovery(
    ticketId: string,
    verifier: { id: string; role: string },
    verificationNotes: string,
    verificationEvidence: string
  ): Promise<IRecoveryTicket> {
    const ticket = await RecoveryTicket.findOne({ ticketId });
    if (!ticket) {
      const err = new Error('Recovery ticket not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (ticket.status !== 'pending_verification') {
      const err = new Error(
        `Ticket is not awaiting verification (current status: ${ticket.status})`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    // RULE: Requester and Verifier must be different people!
    if (verifier.id === ticket.requesterId) {
      const err = new Error(
        'Self-verification blocked. Verifier must be a different person than the requester.'
      );
      (err as any).statusCode = 403;
      (err as any).code = 'SELF_VERIFICATION_BLOCKED';
      throw err;
    }

    ticket.verifierId = verifier.id;
    ticket.verifierRole = verifier.role;
    ticket.verifiedAt = new Date();
    ticket.verificationNotes = verificationNotes || 'Identity attested via frontline crosscheck';
    ticket.verificationEvidence = verificationEvidence || 'physical_demographic_crosscheck';
    ticket.status = 'verified';

    await ticket.save();

    try {
      await AuditLog.create({
        actorId: verifier.id,
        actorRole: verifier.role,
        action: 'RECOVERY_VERIFY',
        resourceType: 'recovery_ticket',
        resourceId: ticketId,
        ip: '127.0.0.1',
        statusCode: 200,
        simulation: true,
        metadata: {
          requesterId: ticket.requesterId,
          verifierId: verifier.id,
          verificationEvidence: ticket.verificationEvidence,
        },
      });
    } catch (auditErr: any) {
      logger.warn({ error: auditErr.message }, 'Audit write for recovery verify failed');
    }

    return ticket;
  }

  /**
   * Approves verified ticket and issues single-use recovery claim token.
   * Approver MUST be a different person than both the Requester AND the Verifier.
   */
  static async approveRecovery(
    ticketId: string,
    approver: { id: string; role: string },
    approvalNotes: string
  ): Promise<{ ticket: IRecoveryTicket; recoveryToken?: string }> {
    const ticket = await RecoveryTicket.findOne({ ticketId });
    if (!ticket) {
      const err = new Error('Recovery ticket not found');
      (err as any).statusCode = 404;
      throw err;
    }

    // Must be verified first! No shortcuts directly from pending_verification!
    if (ticket.status !== 'verified') {
      const err = new Error(
        `Cannot approve ticket that has not completed verification (current status: ${ticket.status})`
      );
      (err as any).statusCode = 400;
      (err as any).code = 'UNVERIFIED_APPROVAL_ATTEMPT';
      throw err;
    }

    // RULE 1: Approver must be different from Requester
    if (approver.id === ticket.requesterId) {
      const err = new Error(
        'Self-approval blocked. Approver must be a different person than the requester.'
      );
      (err as any).statusCode = 403;
      (err as any).code = 'SELF_APPROVAL_BLOCKED';
      throw err;
    }

    // RULE 2: Approver must be different from Verifier
    if (approver.id === ticket.verifierId) {
      const err = new Error(
        'Dual-role approval blocked. Approver must be a different person than the verifier.'
      );
      (err as any).statusCode = 403;
      (err as any).code = 'DUAL_ROLE_APPROVAL_BLOCKED';
      throw err;
    }

    // If matching found no patient, reject on multi-party audit
    if (!ticket.matchedPatientId) {
      ticket.status = 'rejected';
      ticket.approverId = approver.id;
      ticket.approverRole = approver.role;
      ticket.approvedAt = new Date();
      ticket.rejectionReason =
        'Patient record could not be confirmed against active healthcare registry during multi-party audit.';
      await ticket.save();

      return { ticket };
    }

    // Matched record confirmed by 3 distinct parties: generate single-use claim token
    const rawToken = `REC-CLAIM-${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    ticket.status = 'approved';
    ticket.approverId = approver.id;
    ticket.approverRole = approver.role;
    ticket.approvedAt = new Date();
    ticket.approvalNotes = approvalNotes || 'Three-party identity verification approved for credential reissue';
    ticket.recoveryTokenHash = tokenHash;
    ticket.recoveryTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await ticket.save();

    try {
      await AuditLog.create({
        actorId: approver.id,
        actorRole: approver.role,
        action: 'RECOVERY_APPROVE',
        resourceType: 'recovery_ticket',
        resourceId: ticketId,
        ip: '127.0.0.1',
        statusCode: 200,
        simulation: true,
        metadata: {
          requesterId: ticket.requesterId,
          verifierId: ticket.verifierId,
          approverId: approver.id,
          matchedPatientId: ticket.matchedPatientId,
        },
      });
    } catch (auditErr: any) {
      logger.warn({ error: auditErr.message }, 'Audit write for recovery approve failed');
    }

    return {
      ticket,
      recoveryToken: rawToken,
    };
  }

  /**
   * Finalizes recovery using single-use claim token.
   */
  static async completeRecovery(
    ticketId: string,
    recoveryToken: string
  ): Promise<IRecoveryTicket> {
    const ticket = await RecoveryTicket.findOne({ ticketId });
    if (!ticket) {
      const err = new Error('Recovery ticket not found');
      (err as any).statusCode = 404;
      throw err;
    }

    if (ticket.status !== 'approved') {
      const err = new Error(
        `Ticket is not in approved state (current status: ${ticket.status})`
      );
      (err as any).statusCode = 400;
      throw err;
    }

    if (!ticket.recoveryTokenHash || !ticket.recoveryTokenExpiresAt) {
      const err = new Error('No valid recovery token associated with ticket');
      (err as any).statusCode = 400;
      throw err;
    }

    if (new Date() > ticket.recoveryTokenExpiresAt) {
      ticket.status = 'rejected';
      ticket.rejectionReason = 'Recovery token has expired';
      await ticket.save();
      const err = new Error('Recovery token expired. Please initiate a new recovery request.');
      (err as any).statusCode = 400;
      throw err;
    }

    const providedHash = crypto.createHash('sha256').update(recoveryToken).digest('hex');
    if (providedHash !== ticket.recoveryTokenHash) {
      const err = new Error('Invalid recovery claim token');
      (err as any).statusCode = 400;
      throw err;
    }

    ticket.status = 'completed';
    ticket.completedAt = new Date();
    // Invalidate token hash after single use
    ticket.recoveryTokenHash = undefined;

    await ticket.save();

    try {
      await AuditLog.create({
        actorId: ticket.requesterId,
        actorRole: ticket.requesterRole,
        action: 'RECOVERY_COMPLETE',
        resourceType: 'recovery_ticket',
        resourceId: ticketId,
        ip: '127.0.0.1',
        statusCode: 200,
        simulation: true,
        metadata: {
          matchedPatientId: ticket.matchedPatientId,
        },
      });
    } catch (auditErr: any) {
      logger.warn({ error: auditErr.message }, 'Audit write for recovery complete failed');
    }

    return ticket;
  }
}
