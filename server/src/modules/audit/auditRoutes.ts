import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/authGuard.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { AuditLog } from './auditModel.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';

const router = Router();

const AuditQuerySchema = z.object({
  action: z.string().optional(),
  actorId: z.string().optional(),
  resourceType: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// GET /api/v1/audit/logs
router.get(
  '/logs',
  requireAuth,
  authorizeCapability('audit:read'),
  validate({ query: AuditQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { action, actorId, resourceType, limit, offset } = req.query as unknown as {
        action?: string;
        actorId?: string;
        resourceType?: string;
        limit: number;
        offset: number;
      };

      const filter: Record<string, unknown> = {};
      if (action) filter.action = action;
      if (actorId) filter.actorId = actorId;
      if (resourceType) filter.resourceType = resourceType;

      const [logs, total] = await Promise.all([
        AuditLog.find(filter).sort({ timestamp: -1 }).skip(offset).limit(limit).lean(),
        AuditLog.countDocuments(filter),
      ]);

      res.envelope({
        logs,
        total,
        limit,
        offset,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const auditRouter = router;
