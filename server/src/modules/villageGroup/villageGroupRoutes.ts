import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { VillageGroupService, normalizeAddress } from './villageGroupService.js';

export const villageGroupRouter = Router();

const TriggerDetectionSchema = z.object({
  villageId: z.string().min(1, 'Village ID required'),
});

const RejectGroupSchema = z.object({
  rejectionReason: z.string().min(3, 'Rejection reason required'),
});

// 1. Create Village Group / Trigger Clustering Detection
villageGroupRouter.post(
  '/',
  requireAuth,
  authorizeCapability('village_group:manage'),
  validate({ body: TriggerDetectionSchema }),
  auditTag('VILLAGE_GROUP_TRIGGERED', 'village_group'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await VillageGroupService.triggerClusteringForVillage(
        req.body.villageId,
        req.user!.id
      );
      res.envelope(result, 'Clustering detection triggered');
    } catch (err) {
      next(err);
    }
  }
);

// 2. List Village Groups with Optional Filter
villageGroupRouter.get(
  '/',
  requireAuth,
  authorizeCapability('village_group:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, mandal, villageId } = req.query;
      const filter: any = {};
      if (status) filter.status = status;
      if (mandal) filter.mandal = mandal;
      if (villageId) filter.villageId = villageId;

      const groups = await VillageGroupService.listVillageGroups(filter);
      res.envelope({ groups, total: groups.length });
    } catch (err) {
      next(err);
    }
  }
);

// 3. Small-Count Suppressed Aggregates
villageGroupRouter.get(
  '/aggregates',
  requireAuth,
  authorizeCapability('village_group:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mandal } = req.query;
      const aggregates = await VillageGroupService.getSuppressedAggregates(
        typeof mandal === 'string' ? mandal : undefined
      );
      res.envelope(aggregates);
    } catch (err) {
      next(err);
    }
  }
);

// 4. Get by ID
villageGroupRouter.get(
  '/:id',
  requireAuth,
  authorizeCapability('village_group:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await VillageGroupService.getVillageGroupById(req.params.id as string);
      if (!group) {
        res.envelopeError('NOT_FOUND', 'Village group not found', undefined, 404);
        return;
      }
      res.envelope(group);
    } catch (err) {
      next(err);
    }
  }
);

// 5. Admin Approve Village Group
villageGroupRouter.post(
  '/:id/approve',
  requireAuth,
  authorizeCapability('village_group:manage'),
  auditTag('VILLAGE_GROUP_APPROVED', 'village_group'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await VillageGroupService.approveVillageGroup(
        req.params.id as string,
        req.user!.id
      );
      res.envelope(group, 'Village group approved');
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.envelopeError('NOT_FOUND', err.message, undefined, 404);
        return;
      }
      next(err);
    }
  }
);

// 6. Admin Reject Village Group
villageGroupRouter.post(
  '/:id/reject',
  requireAuth,
  authorizeCapability('village_group:manage'),
  validate({ body: RejectGroupSchema }),
  auditTag('VILLAGE_GROUP_REJECTED', 'village_group'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await VillageGroupService.rejectVillageGroup(
        req.params.id as string,
        req.user!.id,
        req.body?.rejectionReason
      );
      res.envelope(group, 'Village group rejected');
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.envelopeError('NOT_FOUND', err.message, undefined, 404);
        return;
      }
      next(err);
    }
  }
);

// 7. Admin Unblock Village Auto-Trigger
villageGroupRouter.post(
  '/:id/unblock-auto',
  requireAuth,
  authorizeCapability('village_group:manage'),
  auditTag('VILLAGE_GROUP_AUTO_TRIGGER_UNBLOCKED', 'village_group'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await VillageGroupService.unblockVillageAutoTrigger(
        req.params.id as string,
        req.user!.id
      );
      res.envelope(group, 'Village auto-trigger unblocked');
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        res.envelopeError('NOT_FOUND', err.message, undefined, 404);
        return;
      }
      next(err);
    }
  }
);
