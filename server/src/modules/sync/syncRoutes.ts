import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { SyncService } from './syncService.js';

const router = Router();

const SyncBatchItemSchema = z.object({
  clientMutationId: z.string().min(1, 'clientMutationId is required for idempotency'),
  type: z.enum([
    'patient_registration',
    'screening_submission',
    'screening_photo',
    'clinical_notes',
    'appointment_request',
    'referral_request',
  ]),
  payload: z.record(z.any()),
  expectedVersion: z.number().optional(),
  originalSha256: z.string().optional(),
});

const SyncBatchRequestSchema = z.object({
  items: z.array(SyncBatchItemSchema).max(500, 'Batch size cannot exceed 500 actions'),
});

function getActor(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    hospitalId: req.user!.hospitalId,
    ip: req.ip || '127.0.0.1',
  };
}

// 1. POST /api/v1/sync/batch
router.post(
  '/batch',
  requireAuth,
  authorizeCapability('sync:submit'),
  auditTag('sync.batch_process', 'offline_sync'),
  validate({ body: SyncBatchRequestSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items } = req.body;
      const data = await SyncService.processBatch(items, getActor(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// 2. GET /api/v1/sync/encryption-report
router.get(
  '/encryption-report',
  requireAuth,
  auditTag('sync.encryption_report', 'offline_sync'),
  (_req: Request, res: Response): void => {
    const report = SyncService.getEncryptionReport();
    res.envelope(report);
  }
);

export default router;
export { router as syncRouter };
