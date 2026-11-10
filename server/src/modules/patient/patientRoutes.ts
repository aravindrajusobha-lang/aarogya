import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { Patient } from './patientModel.js';
import { DuplicateReview } from './duplicateReviewModel.js';
import { SyncLedger } from './syncLedgerModel.js';
import { evaluateDuplicateCandidate } from './duplicateDetector.js';
import { patientEvents } from './patientEvents.js';
import { HealthWorkerAssignment } from '../assignment/assignmentModel.js';
import { Village } from '../reference/villageModel.js';

const router = Router();

const CreatePatientSchema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  gender: z.enum(['male', 'female', 'other']),
  ageEstimated: z.number().int().min(1).max(120),
  phone: z.string().optional(),
  guardianName: z.string().optional(),
  villageId: z.string().optional(),
  villageName: z.string().min(1, 'Village Name required'),
  mandal: z.string().min(1, 'Mandal required'),
  district: z.string().default('Alluri Sitharama Raju'),
  originalAddressText: z.string().min(1, 'Original submitted address text is required'),
  emergencyContact: z.string().optional(),
  caregiverDetails: z.string().optional(),
  maskedAadhaar: z.string().optional(),
  registrationMethod: z.enum(['aadhaar_assisted', 'manual', 'health_worker_assisted']).optional(),
  consentObtained: z.boolean().optional(),
  hospitalId: z.string().min(1, 'Hospital ID required'),
  clientMutationId: z.string().optional(),
});

/**
 * Resolves villageId internally from reference data, health-worker assignment, or regional slug.
 * Rural patients and frontline health workers do NOT enter synthetic village IDs in the UI.
 */
export async function resolveInternalVillageId(
  providedVillageId: string | undefined,
  villageName: string,
  mandal: string,
  userId?: string,
  userRole?: string
): Promise<string> {
  const trimmed = providedVillageId?.trim();
  if (trimmed) {
    return trimmed;
  }

  // 1. Try finding an existing village in the master reference database by villageName and mandal
  if (villageName) {
    const escapedVillageName = villageName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedMandal = mandal?.trim()?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let matched: any = await Village.findOne({
      villageName: { $regex: new RegExp(`^${escapedVillageName}$`, 'i') },
      ...(escapedMandal ? { mandal: { $regex: new RegExp(`^${escapedMandal}$`, 'i') } } : {}),
    });

    if (!matched) {
      matched = await Village.findOne({
        villageName: { $regex: new RegExp(`^${escapedVillageName}$`, 'i') },
      });
    }

    if (matched && matched.villageId) {
      return matched.villageId;
    }
  }

  // 2. Health worker explicit jurisdiction assignment fallback (ASHA/ANM worker)
  if (userId && (userRole === 'asha' || userRole === 'anm')) {
    const assignment: any = await HealthWorkerAssignment.findOne({
      workerId: userId,
      status: 'active',
    });

    if (assignment?.assignedVillages && assignment.assignedVillages.length > 0) {
      return assignment.assignedVillages[0];
    }
  }

  // 3. Fallback: Lookup any village in the mandal, or create a normalized village slug
  if (mandal) {
    const escapedMandal = mandal.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mandalVillage: any = await Village.findOne({
      mandal: { $regex: new RegExp(`^${escapedMandal}$`, 'i') },
    });

    if (mandalVillage && mandalVillage.villageId) {
      return mandalVillage.villageId;
    }
  }

  const cleanMandal = (mandal || 'general').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cleanVillage = (villageName || 'habitation').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `vil_${cleanMandal}_${cleanVillage}`;
}

const ResolveReviewSchema = z.object({
  resolution: z.enum(['resolved_distinct', 'resolved_merged']),
  resolutionNotes: z.string().min(3, 'Resolution notes required'),
});

const SyncBatchSchema = z.object({
  items: z.array(
    z.object({
      clientMutationId: z.string().min(1, 'clientMutationId required for sync idempotency'),
      patientData: CreatePatientSchema,
    })
  ).min(1, 'At least one sync item required'),
});

function generateTribalPatientId(): string {
  const year = new Date().getFullYear();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PAD-${year}-${randomSuffix}`;
}

// ==========================================
// 1. Register Patient (OTP-Free, Idempotent, Duplicate Scored)
// ==========================================
router.post(
  '/',
  requireAuth,
  authorizeCapability('patient:create'),
  validate({ body: CreatePatientSchema }),
  auditTag('PATIENT_CREATE', 'patient'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body;
      const clientMutationId = data.clientMutationId;

      // 1. REPLAY PREVENTION / IDEMPOTENT SYNC LEDGER CHECK
      if (clientMutationId) {
        const existingLedger = await SyncLedger.findOne({ clientMutationId });
        if (existingLedger) {
          const existingPatient = await Patient.findOne({ patientId: existingLedger.entityId });
          res.status(200).envelope({
            patient: existingPatient || existingLedger.responsePayload,
            idempotentReplay: true,
            replayedMutationId: clientMutationId,
            message: 'Replayed request creates no second record; returned existing record from idempotency ledger',
            simulation: true,
          });
          return;
        }

        // Secondary check on Patient collection directly
        const directPatient = await Patient.findOne({ clientMutationId });
        if (directPatient) {
          res.status(200).envelope({
            patient: directPatient,
            idempotentReplay: true,
            replayedMutationId: clientMutationId,
            message: 'Replayed request creates no second record; returned existing patient record',
            simulation: true,
          });
          return;
        }
      }

      const patientId = generateTribalPatientId();

      // Resolve village ID internally if not provided by patient intake
      const resolvedVillageId = await resolveInternalVillageId(
        data.villageId,
        data.villageName,
        data.mandal,
        req.user?.id,
        req.user?.role
      );

      // 2. COMPOSITE DUPLICATE DETECTION EVALUATION
      const duplicateResult = await evaluateDuplicateCandidate({
        fullName: data.fullName,
        gender: data.gender,
        ageEstimated: data.ageEstimated,
        phone: data.phone,
        guardianName: data.guardianName,
        villageId: resolvedVillageId,
        mandal: data.mandal,
      });

      let duplicateReviewId: string | null = null;
      let isDuplicateCandidate = false;
      let duplicateReviewStatus: 'none' | 'pending_review' = 'none';

      // 3. DUPLICATE FLAGGING (NEVER AUTO-MERGED)
      if (duplicateResult.isDuplicate && duplicateResult.topCandidate) {
        isDuplicateCandidate = true;
        duplicateReviewStatus = 'pending_review';
        duplicateReviewId = `rev_${uuidv4()}`;

        await DuplicateReview.create({
          reviewId: duplicateReviewId,
          newPatientId: patientId,
          existingPatientId: duplicateResult.topCandidate.patientId,
          matchScore: duplicateResult.matchScore,
          matchReasons: duplicateResult.matchReasons,
          status: 'pending',
          simulation: true,
        });
      }

      // 4. CREATE PATIENT RECORD (PRESERVING originalAddressText VERBATIM)
      const patient = await Patient.create({
        patientId,
        fullName: data.fullName.trim(),
        gender: data.gender,
        ageEstimated: data.ageEstimated,
        phone: data.phone?.trim() || undefined,
        guardianName: data.guardianName?.trim() || undefined,
        villageId: resolvedVillageId,
        villageName: data.villageName,
        mandal: data.mandal,
        district: data.district || 'Alluri Sitharama Raju',
        originalAddressText: data.originalAddressText, // Preserved verbatim
        emergencyContact: data.emergencyContact?.trim() || undefined,
        caregiverDetails: data.caregiverDetails?.trim() || undefined,
        maskedAadhaar: data.maskedAadhaar?.trim() || undefined,
        registrationMethod: data.registrationMethod || 'manual',
        consentObtained: data.consentObtained ?? true,
        hospitalId: data.hospitalId,
        registeredBy: req.user!.id,
        registeredAt: new Date(),
        isDuplicateCandidate,
        duplicateReviewStatus,
        duplicateCandidateOf: duplicateResult.topCandidate?.patientId,
        matchScore: duplicateResult.matchScore,
        matchReasons: duplicateResult.matchReasons,
        clientMutationId: clientMutationId || undefined,
        history: [
          {
            timestamp: new Date(),
            action: 'INITIAL_REGISTRATION',
            performedBy: req.user!.id,
            details: {
              otpFree: true,
              hospitalId: data.hospitalId,
              isDuplicateCandidate,
              duplicateReviewId,
            },
          },
        ],
        simulation: true,
      });

      // 5. RECORD IN IDEMPOTENT SYNC LEDGER
      if (clientMutationId) {
        await SyncLedger.create({
          clientMutationId,
          entityType: 'patient',
          entityId: patient.patientId,
          responsePayload: patient.toObject(),
          simulation: true,
        });
      }

      // 6. EMIT patient.registered DOMAIN EVENT
      await patientEvents.emitAsync('patient.registered', {
        patientId: patient.patientId,
        fullName: patient.fullName,
        villageId: patient.villageId,
        mandal: patient.mandal,
        originalAddressText: patient.originalAddressText,
        registeredBy: req.user!.id,
        isDuplicateCandidate,
        timestamp: new Date(),
        simulation: true,
      });


      res.status(201).envelope({
        patient,
        duplicateReview: isDuplicateCandidate
          ? {
              flagged: true,
              reviewId: duplicateReviewId,
              matchScore: duplicateResult.matchScore,
              matchReasons: duplicateResult.matchReasons,
              candidatePatientId: duplicateResult.topCandidate?.patientId,
              policy: 'Duplicates are flagged for administrative review; never auto-merged.',
            }
          : { flagged: false },
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 2. Query Patients (Role & Assignment Scoped)
// ==========================================
router.get(
  '/',
  requireAuth,
  authorizeCapability('patient:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mandal, villageId, hospitalId, search, duplicateOnly } = req.query as Record<string, string>;
      const filter: Record<string, unknown> = {};

      if (mandal) filter.mandal = mandal;
      if (villageId) filter.villageId = villageId;
      if (hospitalId) filter.hospitalId = hospitalId;
      if (duplicateOnly === 'true') filter.isDuplicateCandidate = true;

      // HEALTH WORKER JURISDICTION SCOPING
      if (req.user!.role === 'asha' || req.user!.role === 'anm') {
        const assignment = await HealthWorkerAssignment.findOne({
          workerId: req.user!.id,
          status: 'active',
        });

        if (!assignment || !assignment.assignedVillages || assignment.assignedVillages.length === 0) {
          res.envelope({
            patients: [],
            total: 0,
            assignedScopeOnly: true,
            workerId: req.user!.id,
            simulation: true,
          });
          return;
        }

        filter.villageId = { $in: assignment.assignedVillages };
      }

      if (search) {
        filter.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { patientId: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ];
      }

      const patients = await Patient.find(filter).sort({ registeredAt: -1 }).limit(100).lean();

      res.envelope({
        patients,
        total: patients.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 3. Duplicate Review Queue
// ==========================================
router.get(
  '/duplicates/review',
  requireAuth,
  authorizeCapability('patient:duplicate_review'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const pendingReviews = await DuplicateReview.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Hydrate with patient summary cards
      const hydrated = await Promise.all(
        pendingReviews.map(async (rev) => {
          const [newPatient, existingPatient] = await Promise.all([
            Patient.findOne({ patientId: rev.newPatientId }).lean(),
            Patient.findOne({ patientId: rev.existingPatientId }).lean(),
          ]);
          return {
            ...rev,
            newPatient,
            existingPatient,
          };
        })
      );

      res.envelope({
        reviews: hydrated,
        total: hydrated.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 4. Resolve Duplicate Review (Manual Merge or Confirmed Distinct)
// ==========================================
router.post(
  '/duplicates/:reviewId/resolve',
  requireAuth,
  authorizeCapability('patient:duplicate_review'),
  validate({ body: ResolveReviewSchema }),
  auditTag('PATIENT_DUPLICATE_RESOLVE', 'patient'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reviewId = req.params.reviewId as string;
      const { resolution, resolutionNotes } = req.body;

      const review = await DuplicateReview.findOne({ reviewId });
      if (!review) {
        res.envelopeError('REVIEW_NOT_FOUND', 'Duplicate review ticket not found', undefined, 404);
        return;
      }

      review.status = resolution;
      review.resolvedBy = req.user!.id;
      review.resolvedAt = new Date();
      review.resolutionNotes = resolutionNotes;
      await review.save();

      const newStatus = resolution === 'resolved_distinct' ? 'confirmed_distinct' : 'merged_manual';

      await Patient.updateOne(
        { patientId: review.newPatientId },
        {
          $set: {
            duplicateReviewStatus: newStatus,
            isDuplicateCandidate: resolution !== 'resolved_distinct',
          },
          $push: {
            history: {
              timestamp: new Date(),
              action: `DUPLICATE_REVIEW_${resolution.toUpperCase()}`,
              performedBy: req.user!.id,
              details: { reviewId, resolutionNotes },
            },
          },
        }
      );

      res.envelope({
        reviewId: review.reviewId,
        status: review.status,
        resolutionNotes,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5. Batch Idempotent Sync Endpoint (Offline Queue Ingestion)
// ==========================================
router.post(
  '/sync',
  requireAuth,
  authorizeCapability('sync:submit'),
  validate({ body: SyncBatchSchema }),
  auditTag('PATIENT_SYNC_BATCH', 'sync'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { items } = req.body;
      const results: Array<Record<string, unknown>> = [];

      for (const item of items) {
        const { clientMutationId, patientData } = item;

        // Idempotency check
        const existing = await SyncLedger.findOne({ clientMutationId });
        if (existing) {
          results.push({
            clientMutationId,
            patientId: existing.entityId,
            idempotentReplay: true,
            status: 'replayed_without_mutation',
          });
          continue;
        }

        const patientId = generateTribalPatientId();

        const resolvedVillageId = await resolveInternalVillageId(
          patientData.villageId,
          patientData.villageName,
          patientData.mandal,
          req.user?.id,
          req.user?.role
        );

        const duplicateResult = await evaluateDuplicateCandidate({
          fullName: patientData.fullName,
          gender: patientData.gender,
          ageEstimated: patientData.ageEstimated,
          phone: patientData.phone,
          guardianName: patientData.guardianName,
          villageId: resolvedVillageId,
          mandal: patientData.mandal,
        });

        let duplicateReviewId: string | null = null;
        let isDuplicateCandidate = false;
        let duplicateReviewStatus: 'none' | 'pending_review' = 'none';

        if (duplicateResult.isDuplicate && duplicateResult.topCandidate) {
          isDuplicateCandidate = true;
          duplicateReviewStatus = 'pending_review';
          duplicateReviewId = `rev_${uuidv4()}`;

          await DuplicateReview.create({
            reviewId: duplicateReviewId,
            newPatientId: patientId,
            existingPatientId: duplicateResult.topCandidate.patientId,
            matchScore: duplicateResult.matchScore,
            matchReasons: duplicateResult.matchReasons,
            status: 'pending',
            simulation: true,
          });
        }

        const patient = await Patient.create({
          patientId,
          fullName: patientData.fullName.trim(),
          gender: patientData.gender,
          ageEstimated: patientData.ageEstimated,
          phone: patientData.phone?.trim() || undefined,
          guardianName: patientData.guardianName?.trim() || undefined,
          villageId: resolvedVillageId,
          villageName: patientData.villageName,
          mandal: patientData.mandal,
          district: patientData.district || 'Alluri Sitharama Raju',
          originalAddressText: patientData.originalAddressText,
          hospitalId: patientData.hospitalId,
          registeredBy: req.user!.id,
          registeredAt: new Date(),
          isDuplicateCandidate,
          duplicateReviewStatus,
          duplicateCandidateOf: duplicateResult.topCandidate?.patientId,
          matchScore: duplicateResult.matchScore,
          matchReasons: duplicateResult.matchReasons,
          clientMutationId,
          history: [
            {
              timestamp: new Date(),
              action: 'OFFLINE_SYNC_REGISTRATION',
              performedBy: req.user!.id,
              details: { clientMutationId, duplicateReviewId },
            },
          ],
          simulation: true,
        });

        await SyncLedger.create({
          clientMutationId,
          entityType: 'patient',
          entityId: patient.patientId,
          responsePayload: patient.toObject(),
          simulation: true,
        });

        patientEvents.emit('patient.registered', {
          patientId: patient.patientId,
          fullName: patient.fullName,
          villageId: patient.villageId,
          mandal: patient.mandal,
          originalAddressText: patient.originalAddressText,
          registeredBy: req.user!.id,
          isDuplicateCandidate,
          timestamp: new Date(),
          simulation: true,
        });

        results.push({
          clientMutationId,
          patientId: patient.patientId,
          idempotentReplay: false,
          isDuplicateCandidate,
          duplicateReviewId,
          status: 'created',
        });
      }

      res.status(200).envelope({
        processedCount: results.length,
        results,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 6. Get Patient by ID with History
// ==========================================
router.get(
  '/:id',
  requireAuth,
  authorizeCapability('patient:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = req.params.id as string;
      const patient = await Patient.findOne({ patientId }).lean();

      if (!patient) {
        res.envelopeError('PATIENT_NOT_FOUND', 'Patient record not found', undefined, 404);
        return;
      }

      res.envelope({
        patient,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const patientRouter = router;
