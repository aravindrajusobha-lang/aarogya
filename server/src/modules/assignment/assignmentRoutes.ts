import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { HealthWorkerAssignment } from './assignmentModel.js';

const router = Router();

const CreateAssignmentSchema = z.object({
  workerId: z.string().min(1, 'Worker ID required'),
  workerName: z.string().min(2, 'Worker name required'),
  workerRole: z.enum(['asha', 'anm']),
  hospitalId: z.string().min(1, 'Hospital ID required'),
  assignedMandal: z.string().min(1, 'Assigned mandal required'),
  assignedVillages: z.array(z.string()).min(1, 'At least one village required'),
});

const WorkerParamsSchema = z.object({
  workerId: z.string().min(1, 'Worker ID required'),
});

const RevokeParamsSchema = z.object({
  id: z.string().min(1, 'Assignment ID required'),
});

// POST /api/v1/assignments
router.post(
  '/',
  requireAuth,
  authorizeCapability('assignment:create'),
  validate({ body: CreateAssignmentSchema }),
  auditTag('ASSIGNMENT_CREATE', 'assignment'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { workerId, workerName, workerRole, hospitalId, assignedMandal, assignedVillages } = req.body;

      // SELF-APPROVAL GUARD: Creator cannot assign to themselves
      if (req.user!.id === workerId) {
        res.envelopeError(
          'SELF_APPROVAL_BLOCKED',
          'Self-assignment and self-approval are strictly prohibited',
          undefined,
          403
        );
        return;
      }

      // Deactivate previous active assignments for this worker
      await HealthWorkerAssignment.updateMany(
        { workerId, status: 'active' },
        { $set: { status: 'revoked' } }
      );

      const assignment = await HealthWorkerAssignment.create({
        assignmentId: `asgn_${uuidv4()}`,
        workerId,
        workerName,
        workerRole,
        hospitalId,
        assignedMandal,
        assignedVillages,
        assignedBy: req.user!.id,
        status: 'active',
        assignedAt: new Date(),
        simulation: true,
      });

      res.status(201).envelope({
        assignment,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/assignments
router.get(
  '/',
  requireAuth,
  authorizeCapability('assignment:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filter: Record<string, unknown> = { status: 'active' };

      // Health Workers can only see their own assignments
      if (req.user!.role === 'asha' || req.user!.role === 'anm') {
        filter.workerId = req.user!.id;
      }

      const assignments = await HealthWorkerAssignment.find(filter).sort({ assignedAt: -1 }).lean();

      res.envelope({
        assignments,
        total: assignments.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/assignments/worker/:workerId
router.get(
  '/worker/:workerId',
  requireAuth,
  authorizeCapability('assignment:read'),
  validate({ params: WorkerParamsSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workerId = req.params.workerId as string;

      // Privacy guard: worker can only inspect their own assignment unless supervisor
      if (req.user!.role === 'asha' || req.user!.role === 'anm') {
        if (req.user!.id !== workerId) {
          res.envelopeError('FORBIDDEN', 'Workers can only access their own assignments', undefined, 403);
          return;
        }
      }

      const assignment = await HealthWorkerAssignment.findOne({
        workerId,
        status: 'active',
      }).lean();

      res.envelope({
        assignment: assignment || null,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/assignments/:id/revoke
router.post(
  '/:id/revoke',
  requireAuth,
  authorizeCapability('assignment:create'),
  validate({ params: RevokeParamsSchema }),
  auditTag('ASSIGNMENT_REVOKE', 'assignment'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const assignment = await HealthWorkerAssignment.findOne({
        $or: [{ assignmentId: id }, { _id: id.length === 24 ? id : undefined }],
      });

      if (!assignment) {
        res.envelopeError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', undefined, 404);
        return;
      }

      assignment.status = 'revoked';
      await assignment.save();

      res.envelope({
        assignmentId: assignment.assignmentId,
        status: 'revoked',
        message: 'Health worker assignment revoked successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const assignmentRouter = router;
