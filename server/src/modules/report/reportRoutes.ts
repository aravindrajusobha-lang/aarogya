import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { ReportService } from './reportService.js';
import { ReportType } from './reportModel.js';

const router = Router();

const ExportQuerySchema = z.object({
  type: z.enum([
    'mo-queue',
    'referral-pipeline',
    'camp-outcomes',
    'follow-up-completion',
    'sync-health',
  ]).default('mo-queue'),
});

function getActorContext(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    hospitalId: req.user!.hospitalId,
    scopes: req.user!.scopes || [],
  };
}

// 1. GET /api/v1/reports/dashboards/mo-queue
router.get(
  '/dashboards/mo-queue',
  requireAuth,
  authorizeCapability('reports:read'),
  auditTag('report.dashboard.mo_queue', 'report_dashboard'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportService.getMoQueueDashboard(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// 2. GET /api/v1/reports/dashboards/referral-pipeline
router.get(
  '/dashboards/referral-pipeline',
  requireAuth,
  authorizeCapability('reports:read'),
  auditTag('report.dashboard.referral_pipeline', 'report_dashboard'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportService.getReferralPipelineDashboard(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// 3. GET /api/v1/reports/dashboards/camp-outcomes
router.get(
  '/dashboards/camp-outcomes',
  requireAuth,
  authorizeCapability('reports:read'),
  auditTag('report.dashboard.camp_outcomes', 'report_dashboard'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportService.getCampOutcomesDashboard(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// 4. GET /api/v1/reports/dashboards/follow-up-completion
router.get(
  '/dashboards/follow-up-completion',
  requireAuth,
  authorizeCapability('reports:read'),
  auditTag('report.dashboard.follow_up', 'report_dashboard'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportService.getFollowUpCompletionDashboard(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// 5. GET /api/v1/reports/dashboards/sync-health
router.get(
  '/dashboards/sync-health',
  requireAuth,
  authorizeCapability('reports:read'),
  auditTag('report.dashboard.sync_health', 'report_dashboard'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await ReportService.getSyncHealthDashboard(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// 6. GET /api/v1/reports/export/csv
router.get(
  '/export/csv',
  requireAuth,
  authorizeCapability('reports:export'),
  validate({ query: ExportQuerySchema }),
  auditTag('report.export.csv', 'report_export'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.query as { type: ReportType };
      const { filename, csvContent } = await ReportService.exportCsv(
        type,
        getActorContext(req),
        req.ip || '127.0.0.1'
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (err) {
      next(err);
    }
  }
);

// 7. GET /api/v1/reports/export/pdf
router.get(
  '/export/pdf',
  requireAuth,
  authorizeCapability('reports:export'),
  validate({ query: ExportQuerySchema }),
  auditTag('report.export.pdf', 'report_export'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.query as { type: ReportType };
      const { filename, pdfBuffer } = await ReportService.exportPdf(
        type,
        getActorContext(req),
        req.ip || '127.0.0.1'
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
);

export const reportRouter = router;
