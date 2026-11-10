import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { BiopsyService } from './biopsyService.js';
import { User } from '../auth/userModel.js';

export const biopsyRouter = Router();

const CreateBiopsySchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().optional(),
  hospitalId: z.string().min(1, 'Hospital ID required'),
  screeningCaseId: z.string().optional(),
  anatomicalLocation: z.string().min(1, 'Anatomical location required'),
  requestingDoctorId: z.string().optional(),
  requestingDoctorName: z.string().optional(),
});

const ScheduleBiopsySchema = z.object({
  procedureDate: z.string().min(1, 'Procedure date required'),
  scheduledHospitalId: z.string().min(1, 'Scheduled hospital ID required'),
});

const CollectSpecimenSchema = z.object({
  specimenBarcode: z.string().min(1, 'Specimen barcode required'),
  collectedBy: z.string().optional(),
  fixative: z.string().optional(),
  tissueType: z.string().min(1, 'Tissue type required'),
});

const SendToLabSchema = z.object({
  destinationLabName: z.string().min(1, 'Destination lab name required'),
  courierTrackingId: z.string().optional(),
});

const RecollectionSchema = z.object({
  reason: z.string().min(1, 'Recollection reason required'),
});

const RecordFindingsSchema = z.object({
  pathologistId: z.string().optional(),
  pathologistName: z.string().min(1, 'Pathologist name required'),
  specimenAdequacy: z.string().min(1, 'Specimen adequacy required'),
  grossDescription: z.string().min(1, 'Gross description required'),
  microscopicObservations: z.string().min(1, 'Microscopic observations required'),
  pathologistImpression: z.string().min(1, 'Pathologist impression required'),
  labAttachment: z
    .object({
      fileId: z.string().min(1),
      sha256: z.string().min(1),
    })
    .optional(),
});

const ReleaseResultSchema = z.object({
  patientSummaryMessage: z.string().min(1, 'Patient summary message required'),
  recommendedAction: z.string().min(1, 'Recommended action required'),
  reviewerNotes: z.string().optional(),
});

const AmendAttachmentSchema = z.object({
  newFileId: z.string().min(1, 'New file ID required'),
  newSha256: z.string().min(1, 'New SHA-256 hash required'),
  reason: z.string().min(1, 'Amendment reason required'),
});

const CancelBiopsySchema = z.object({
  reason: z.string().min(1, 'Cancellation reason required'),
});

async function resolveCaller(req: Request): Promise<{
  hospitalId?: string;
  role: string;
  userId: string;
  name?: string;
}> {
  const user = req.user;
  if (!user) throw new Error('Unauthenticated');

  const userId = user.id || (user as any).userId;
  let hospitalId = (user as any).hospitalId;
  let name = (user as any).name;
  if (!hospitalId || !name) {
    const dbUser = await User.findOne({ userId }).lean();
    if (dbUser) {
      hospitalId = hospitalId || (dbUser as any).hospitalId;
      name = name || (dbUser as any).fullName || (dbUser as any).name;
    }
  }

  return { hospitalId, role: user.role, userId, name: name || userId };
}

/**
 * POST /api/v1/biopsy
 * Requests a new biopsy procedure
 */
biopsyRouter.post(
  '/',
  requireAuth,
  authorizeCapability('biopsy:create'),
  auditTag('biopsy.requested', 'biopsy'),
  validate(CreateBiopsySchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.createBiopsyRequest(
        {
          ...req.body,
          requestingDoctorId: req.body.requestingDoctorId || caller.userId,
          requestingDoctorName: req.body.requestingDoctorName || caller.name,
        },
        caller
      );
      return res.status(201).envelope({ biopsy }, 'Biopsy procedure requested');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_CREATE_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * GET /api/v1/biopsy
 * Lists biopsies with scoping
 */
biopsyRouter.get(
  '/',
  requireAuth,
  authorizeCapability('biopsy:read'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const hospitalId =
        (req.query.hospitalId as string) || (caller.role !== 'system_admin' ? caller.hospitalId : undefined);
      const patientId = req.query.patientId as string | undefined;
      const status = req.query.status as any;

      const biopsies = await BiopsyService.listBiopsies({
        hospitalId,
        patientId,
        status,
      });

      return res.envelope({ biopsies, count: biopsies.length });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_LIST_FAILED', err.message);
    }
  }
);

/**
 * GET /api/v1/biopsy/:id
 * Fetches biopsy details
 */
biopsyRouter.get(
  '/:id',
  requireAuth,
  authorizeCapability('biopsy:read'),
  async (req: Request, res: Response) => {
    try {
      const biopsy = await BiopsyService.getBiopsyById(req.params.id);
      if (!biopsy) {
        return res.status(404).envelopeError('BIOPSY_NOT_FOUND', 'Biopsy record not found');
      }

      return res.envelope({ biopsy });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_READ_FAILED', err.message);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/schedule
 * Schedules procedure
 */
biopsyRouter.post(
  '/:id/schedule',
  requireAuth,
  authorizeCapability('biopsy:manage'),
  auditTag('biopsy.scheduled', 'biopsy'),
  validate(ScheduleBiopsySchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.scheduleBiopsy(
        req.params.id,
        req.body.procedureDate,
        req.body.scheduledHospitalId,
        caller
      );
      return res.envelope({ biopsy }, 'Biopsy procedure successfully scheduled');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_SCHEDULE_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/collect
 * Logs physical specimen collection
 */
biopsyRouter.post(
  '/:id/collect',
  requireAuth,
  authorizeCapability('biopsy:manage'),
  auditTag('biopsy.collected', 'biopsy'),
  validate(CollectSpecimenSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.collectSpecimen(req.params.id, req.body, caller);
      return res.envelope({ biopsy }, 'Specimen collection logged');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_COLLECT_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/send-to-lab
 * Dispatches specimen to pathology lab
 */
biopsyRouter.post(
  '/:id/send-to-lab',
  requireAuth,
  authorizeCapability('biopsy:manage'),
  auditTag('biopsy.sent_to_lab', 'biopsy'),
  validate(SendToLabSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.sendToLab(req.params.id, req.body, caller);
      return res.envelope({ biopsy }, 'Specimen dispatched to pathology laboratory');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_DISPATCH_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/recollection-required
 * Flags specimen as requiring recollection (loops back)
 */
biopsyRouter.post(
  '/:id/recollection-required',
  requireAuth,
  authorizeCapability('biopsy:manage'),
  auditTag('biopsy.recollection_required', 'biopsy'),
  validate(RecollectionSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.flagRecollectionRequired(
        req.params.id,
        req.body.reason,
        caller
      );
      return res.envelope({ biopsy }, 'Biopsy flagged for recollection');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_RECOLLECTION_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/findings
 * Enters histopathology findings (Qualified clinical staff only; separate entity)
 */
biopsyRouter.post(
  '/:id/findings',
  requireAuth,
  authorizeCapability('biopsy:findings'),
  auditTag('biopsy.result_received', 'biopsy'),
  validate(RecordFindingsSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const result = await BiopsyService.recordFindings(req.params.id, req.body, caller);
      return res.envelope(
        {
          biopsy: result.biopsy,
          findings: result.findings,
        },
        'Histopathology findings successfully recorded'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_FINDINGS_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/release-result
 * Releases results for patient viewing (Qualified reviewer only; separate entity)
 */
biopsyRouter.post(
  '/:id/release-result',
  requireAuth,
  authorizeCapability('biopsy:release'),
  auditTag('biopsy.result_released', 'biopsy'),
  validate(ReleaseResultSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const result = await BiopsyService.releaseResult(req.params.id, req.body, caller);
      return res.envelope(
        {
          biopsy: result.biopsy,
          release: result.release,
        },
        'Biopsy results officially released for patient disclosure'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_RELEASE_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/amend-attachment
 * Amends report attachment while keeping original byte-identical
 */
biopsyRouter.post(
  '/:id/amend-attachment',
  requireAuth,
  authorizeCapability('biopsy:manage'),
  auditTag('biopsy.attachment_amended', 'biopsy'),
  validate(AmendAttachmentSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.amendAttachment(req.params.id, req.body, caller);
      return res.envelope({ biopsy }, 'Lab report attachment amended with version increment');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'AMENDMENT_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/biopsy/:id/cancel
 * Cancels biopsy with mandatory reason
 */
biopsyRouter.post(
  '/:id/cancel',
  requireAuth,
  authorizeCapability('biopsy:manage'),
  auditTag('biopsy.cancelled', 'biopsy'),
  validate(CancelBiopsySchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.cancelBiopsy(req.params.id, req.body.reason, caller);
      return res.envelope({ biopsy }, 'Biopsy case cancelled');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'BIOPSY_CANCEL_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * GET /api/v1/biopsy/:id/findings
 * Fetches findings. Patients are blocked until release entity is created!
 */
biopsyRouter.get(
  '/:id/findings',
  requireAuth,
  authorizeCapability('biopsy:read'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const biopsy = await BiopsyService.getBiopsyById(req.params.id);
      if (!biopsy) {
        return res.status(404).envelopeError('BIOPSY_NOT_FOUND', 'Biopsy record not found');
      }

      // Patient gate: Patient cannot see findings unless released!
      if (caller.role === 'patient') {
        const release = await BiopsyService.getReleaseByBiopsyId(req.params.id);
        if (!release) {
          return res.status(403).envelopeError(
            'RESULT_NOT_RELEASED',
            'Biopsy findings have not been released for patient viewing yet',
            undefined,
            403
          );
        }
      }

      const findings = await BiopsyService.getFindingsByBiopsyId(req.params.id);
      if (!findings) {
        return res.status(404).envelopeError('FINDINGS_NOT_FOUND', 'Findings not yet available');
      }

      return res.envelope({ findings });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'FINDINGS_READ_FAILED', err.message);
    }
  }
);

/**
 * GET /api/v1/biopsy/:id/release
 * Patient-accessible release view
 */
biopsyRouter.get(
  '/:id/release',
  requireAuth,
  authorizeCapability('biopsy:read'),
  async (req: Request, res: Response) => {
    try {
      const release = await BiopsyService.getReleaseByBiopsyId(req.params.id);
      if (!release) {
        return res
          .status(404)
          .envelopeError('RELEASE_NOT_FOUND', 'Result has not been released yet');
      }

      return res.envelope({ release });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'RELEASE_READ_FAILED', err.message);
    }
  }
);
