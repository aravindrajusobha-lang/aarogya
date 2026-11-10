import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { RecoveryTicket } from './recoveryModel.js';
import { RecoveryService } from './recoveryService.js';

const router = Router();

const InitiateRecoverySchema = z.object({
  targetPatientId: z.string().optional(),
  claimedDemographics: z.object({
    fullName: z.string().min(2, 'Full name required'),
    gender: z.string().min(1, 'Gender required'),
    ageEstimated: z.number().int().min(1).max(120),
    villageId: z.string().min(1, 'Village ID required'),
    villageName: z.string().min(1, 'Village Name required'),
    guardianName: z.string().optional(),
    phone: z.string().optional(),
    originalAddressText: z.string().optional(),
  }),
});

const VerifyRecoverySchema = z.object({
  verificationNotes: z.string().optional(),
  verificationEvidence: z.string().optional(),
});

const ApproveRecoverySchema = z.object({
  approvalNotes: z.string().optional(),
});

const CompleteRecoverySchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID required'),
  recoveryToken: z.string().min(1, 'Recovery claim token required'),
});

// ==========================================
// 1. Initiate Account Recovery (Enumeration Resistant)
// ==========================================
router.post(
  '/initiate',
  requireAuth,
  authorizeCapability('recovery:initiate'),
  validate({ body: InitiateRecoverySchema }),
  auditTag('RECOVERY_INITIATE', 'recovery_ticket'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { targetPatientId, claimedDemographics } = req.body;

      const result = await RecoveryService.initiateRecovery({
        requesterId: req.user!.id,
        requesterRole: req.user!.role,
        targetPatientId,
        claimedDemographics,
      });

      res.status(201).envelope(result);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 2. List Recovery Tickets
// ==========================================
router.get(
  '/tickets',
  requireAuth,
  authorizeCapability('recovery:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = req.query.status as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      const filter: Record<string, any> = {};
      if (status) {
        filter.status = status;
      }

      const total = await RecoveryTicket.countDocuments(filter);
      const tickets = await RecoveryTicket.find(filter)
        .select('-recoveryTokenHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      res.status(200).envelope({
        tickets,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 3. Get Specific Recovery Ticket
// ==========================================
router.get(
  '/tickets/:id',
  requireAuth,
  authorizeCapability('recovery:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const query = mongoose.isValidObjectId(id)
        ? { $or: [{ _id: id }, { ticketId: id }] }
        : { ticketId: id };

      const ticket = await RecoveryTicket.findOne(query).select('-recoveryTokenHash');
      if (!ticket) {
        res.envelopeError('NOT_FOUND', 'Recovery ticket not found', undefined, 404);
        return;
      }

      res.status(200).envelope({
        ticket,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 4. Verify Recovery Ticket (Verifier != Requester)
// ==========================================
router.post(
  '/tickets/:id/verify',
  requireAuth,
  authorizeCapability('recovery:verify'),
  validate({ body: VerifyRecoverySchema }),
  auditTag('RECOVERY_VERIFY', 'recovery_ticket'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { verificationNotes, verificationEvidence } = req.body;

      const ticket = await RecoveryService.verifyRecovery(
        id,
        { id: req.user!.id, role: req.user!.role },
        verificationNotes,
        verificationEvidence
      );

      res.status(200).envelope({
        ticket,
        message: 'Claimant identity verified by frontline verifier.',
      });
    } catch (err: any) {
      if (err.code === 'SELF_VERIFICATION_BLOCKED') {
        res.envelopeError('FORBIDDEN', err.message, undefined, 403);
        return;
      }
      next(err);
    }
  }
);

// ==========================================
// 5. Approve Recovery Ticket (Approver != Requester && Approver != Verifier)
// ==========================================
router.post(
  '/tickets/:id/approve',
  requireAuth,
  authorizeCapability('recovery:approve'),
  validate({ body: ApproveRecoverySchema }),
  auditTag('RECOVERY_APPROVE', 'recovery_ticket'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { approvalNotes } = req.body;

      const result = await RecoveryService.approveRecovery(
        id,
        { id: req.user!.id, role: req.user!.role },
        approvalNotes
      );

      res.status(200).envelope({
        ticket: result.ticket,
        recoveryToken: result.recoveryToken,
        message:
          result.ticket.status === 'approved'
            ? 'Account recovery approved by designated administrative authority.'
            : 'Account recovery rejected during administrative audit.',
      });
    } catch (err: any) {
      if (err.code === 'SELF_APPROVAL_BLOCKED' || err.code === 'DUAL_ROLE_APPROVAL_BLOCKED') {
        res.envelopeError('FORBIDDEN', err.message, undefined, 403);
        return;
      }
      if (err.code === 'UNVERIFIED_APPROVAL_ATTEMPT') {
        res.envelopeError('BAD_REQUEST', err.message, undefined, 400);
        return;
      }
      next(err);
    }
  }
);

// ==========================================
// 6. Complete Recovery
// ==========================================
router.post(
  '/complete',
  requireAuth,
  authorizeCapability('recovery:complete'),
  validate({ body: CompleteRecoverySchema }),
  auditTag('RECOVERY_COMPLETE', 'recovery_ticket'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ticketId, recoveryToken } = req.body;

      const ticket = await RecoveryService.completeRecovery(ticketId, recoveryToken);

      res.status(200).envelope({
        ticket,
        message: 'Account recovery successfully completed. Access restored.',
      });
    } catch (err) {
      next(err);
    }
  }
);

export const recoveryRouter = router;
