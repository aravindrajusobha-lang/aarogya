import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { CampService } from './campService.js';
import { Camp } from './campModel.js';
import { Village } from '../reference/villageModel.js';
import { User } from '../auth/userModel.js';
import { HealthWorkerAssignment } from '../assignment/assignmentModel.js';

export const campRouter = Router();

const CreateCampSchema = z.object({
  name: z.string().min(2, 'Camp name required'),
  hospitalId: z.string().optional(),
  villageId: z.string().min(1, 'Village ID required'),
  targetPopulation: z.number().int().positive().optional(),
  startDate: z.string().min(1, 'Start date required'),
  endDate: z.string().min(1, 'End date required'),
  leadMoId: z.string().optional(),
  leadMoName: z.string().optional(),
  assignedWorkerIds: z.array(z.string()).optional(),
  location: z.object({
    address: z.string().min(2, 'Location address required'),
    gpsCoordinates: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
      })
      .optional(),
  }),
  notes: z.string().optional(),
});

const UpdateCampSchema = z.object({
  name: z.string().min(2).optional(),
  targetPopulation: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  leadMoId: z.string().optional(),
  leadMoName: z.string().optional(),
  assignedWorkerIds: z.array(z.string()).optional(),
  location: z
    .object({
      address: z.string().min(2),
      gpsCoordinates: z
        .object({
          latitude: z.number(),
          longitude: z.number(),
        })
        .optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

const CancelCampSchema = z.object({
  reason: z.string().optional(),
});

const AssignWorkersSchema = z.object({
  workerIds: z.array(z.string()).min(1, 'At least one worker ID required'),
});

const TransitionCampSchema = z.object({
  targetStatus: z.string().min(1, 'targetStatus required'),
  reason: z.string().optional(),
});

const RecordScreeningSchema = z.object({
  isAbnormal: z.boolean().optional(),
  isReferred: z.boolean().optional(),
});

async function resolveCallerHospital(req: Request): Promise<{
  hospitalId?: string;
  assignedVillages?: string[];
  name?: string;
}> {
  if (!req.user) return {};
  const dbUser = await User.findOne({ userId: req.user.id });
  let assignedVillages: string[] | undefined = (dbUser as any)?.assignedVillages;

  if (
    (!assignedVillages || assignedVillages.length === 0) &&
    (req.user.role === 'asha' || req.user.role === 'anm')
  ) {
    const assignment = await HealthWorkerAssignment.findOne({
      workerId: req.user.id,
      status: 'active',
    });
    if (assignment) {
      assignedVillages = assignment.assignedVillages;
    }
  }

  return {
    hospitalId: dbUser?.hospitalId,
    assignedVillages,
    name: dbUser?.fullName,
  };
}

/**
 * POST /api/v1/camps
 * Create a new screening camp (starts in DRAFT status)
 * Hospital Manager creates for their own hospital. Other hospital access is denied.
 */
campRouter.post(
  '/',
  requireAuth,
  authorizeCapability('camps:create'),
  validate({ body: CreateCampSchema }),
  auditTag('CAMP_CREATE', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      // Hospital Manager creates only for their own hospital
      if (!isSystemAdmin && req.body.hospitalId && caller.hospitalId && req.body.hospitalId !== caller.hospitalId) {
        return res.status(403).envelopeError(
          'CROSS_HOSPITAL_FORBIDDEN',
          'Cross-hospital creation denied: managers may only create camps for their own hospital'
        );
      }

      const hospitalId = isSystemAdmin
        ? req.body.hospitalId || caller.hospitalId || 'hosp_paderu_dh'
        : caller.hospitalId || req.body.hospitalId;

      if (!hospitalId) {
        return res.status(400).envelopeError('INVALID_HOSPITAL', 'Hospital ID is required');
      }

      const camp = await CampService.createCamp(
        {
          ...req.body,
          hospitalId,
          leadMoId: req.body.leadMoId || user.id,
          leadMoName: req.body.leadMoName || caller.name || 'Medical Officer',
        },
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.status(201).envelope({
        camp,
        message: 'Screening camp created in DRAFT status',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/camps
 * List screening camps scoped by hospital / assigned villages
 * Health Workers see ONLY camps for their assigned villages.
 */
campRouter.get(
  '/',
  requireAuth,
  authorizeCapability('camps:read'),
  auditTag('CAMP_LIST', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const isHealthWorker = user.role === 'asha' || user.role === 'anm';
      const caller = await resolveCallerHospital(req);
      const status = req.query.status as any;
      const villageId = req.query.villageId as string;

      let assignedVillages: string[] | undefined = undefined;
      if (isHealthWorker && caller.assignedVillages && caller.assignedVillages.length > 0) {
        assignedVillages = caller.assignedVillages;
      }

      const camps = await CampService.listCamps({
        hospitalId: isSystemAdmin ? (req.query.hospitalId as string) : caller.hospitalId,
        villageId,
        status,
        isSystemAdmin,
        isHealthWorker,
        assignedVillages,
      });

      return res.envelope({
        camps,
        count: camps.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/camps/planning/dashboard
 * Aggregated medical camp planning metrics across ASR district
 */
campRouter.get(
  '/planning/dashboard',
  requireAuth,
  authorizeCapability('camps:read'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const totalVillages = await Village.countDocuments();
      const allCamps = await Camp.find().lean();
      const totalCampsConducted = allCamps.filter((c) => c.status === 'completed').length;
      const upcomingCamps = allCamps.filter(
        (c) => c.status === 'published' || c.status === 'in_progress' || c.status === 'ongoing'
      ).length;

      const villagesScreened = await Village.countDocuments({ campCount: { $gt: 0 } });
      const villagesPending = Math.max(0, totalVillages - villagesScreened);

      let totalScreened = 0;
      let totalAbnormal = 0;
      let totalReferred = 0;
      for (const c of allCamps) {
        totalScreened += c.screeningCount || 0;
        totalAbnormal += c.abnormalFindingsCount || 0;
        totalReferred += c.referralsCount || 0;
      }

      res.envelope({
        totalMandalsCovered: 22,
        totalVillagesCovered: totalVillages,
        totalCampsConducted,
        upcomingCamps,
        villagesCoveredByScreening: villagesScreened,
        villagesPendingScreening: villagesPending,
        patientsScreened: totalScreened,
        suspectedCasesReferred: totalReferred,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/camps/planning/recommendations
 * Location-based Medical Camp Recommendation System
 * Computes priority scores (0-100) using distance, access level, screening coverage, population & camp recency
 */
campRouter.get(
  '/planning/recommendations',
  requireAuth,
  authorizeCapability('camps:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mandal } = req.query as { mandal?: string };
      const query: any = {};
      if (mandal) {
        query.mandal = new RegExp(`^${mandal}$`, 'i');
      }

      const villages = await Village.find(query).lean();

      const recommendations = villages.map((v) => {
        let score = 0;
        const reasons: string[] = [];

        // 1. Distance to nearest facility (30 pts max)
        const dist = v.nearestFacilityDistanceKm || 5;
        const distPts = Math.min(30, Math.round((dist / 20) * 30));
        score += distPts;
        if (dist >= 12) {
          reasons.push(`Distance to ${v.nearestFacilityName || 'nearest health facility'} is ${dist} km`);
        }

        // 2. Healthcare accessibility level (25 pts max)
        const access = v.healthcareAccessLevel || 'moderate';
        if (access === 'remote_cutoff') {
          score += 25;
          reasons.push('Remote tribal settlement with seasonal/monsoon cutoff or ghat isolation');
        } else if (access === 'difficult') {
          score += 18;
          reasons.push('Difficult terrain with limited transport corridors');
        } else if (access === 'moderate') {
          score += 10;
        } else {
          score += 3;
        }

        // 3. Screening coverage deficit (25 pts max)
        const coverage = v.screeningCoveragePercent || 0;
        const coverageDeficitPts = Math.max(0, Math.round((100 - coverage) * 0.25));
        score += coverageDeficitPts;
        if (coverage < 15) {
          reasons.push(`Low screening coverage of ${coverage}% in target population`);
        }

        // 4. Camp recency / history (15 pts max)
        const campCount = v.campCount || 0;
        if (campCount === 0 || !v.lastCampDate) {
          score += 15;
          reasons.push('No recorded medical screening camp held in this habitation');
        } else {
          const monthsAgo = (Date.now() - new Date(v.lastCampDate).getTime()) / (1000 * 3600 * 24 * 30);
          if (monthsAgo >= 12) {
            score += 12;
            reasons.push(`Last screening camp was over ${Math.floor(monthsAgo)} months ago`);
          } else if (monthsAgo >= 6) {
            score += 6;
          } else {
            score += 1;
          }
        }

        // 5. Population need (5 pts max)
        const pop = v.populationEstimated || 400;
        if (pop >= 800) {
          score += 5;
          reasons.push(`Large tribal population (${pop}) requiring dedicated field screening`);
        } else if (pop >= 400) {
          score += 3;
        } else {
          score += 1;
        }

        score = Math.min(100, Math.max(10, score));

        let urgency: 'critical' | 'high' | 'medium' | 'routine' = 'routine';
        if (score >= 80) urgency = 'critical';
        else if (score >= 65) urgency = 'high';
        else if (score >= 45) urgency = 'medium';

        return {
          villageId: v.villageId,
          villageName: v.villageName,
          nameTe: v.nameTe || '',
          mandal: v.mandal,
          panchayat: v.panchayat,
          tribalHabitation: v.tribalHabitation,
          populationEstimated: v.populationEstimated,
          gpsCoordinates: v.gpsCoordinates,
          nearestFacilityDistanceKm: v.nearestFacilityDistanceKm,
          nearestFacilityName: v.nearestFacilityName,
          nearestFacilityType: v.nearestFacilityType,
          healthcareAccessLevel: v.healthcareAccessLevel,
          screeningCoveragePercent: v.screeningCoveragePercent,
          campCount: v.campCount,
          lastCampDate: v.lastCampDate,
          priorityScore: score,
          urgency,
          reasons,
          verifiedByGovt: v.verifiedByGovt ?? true,
          simulation: true,
        };
      });

      recommendations.sort((a, b) => b.priorityScore - a.priorityScore);

      res.envelope({
        total: recommendations.length,
        recommendations,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/camps/:id
 * Get details of a single screening camp
 */
campRouter.get(
  '/:id',
  requireAuth,
  authorizeCapability('camps:read'),
  auditTag('CAMP_GET', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const isHealthWorker = user.role === 'asha' || user.role === 'anm';
      const caller = await resolveCallerHospital(req);

      let assignedVillages: string[] | undefined = undefined;
      if (isHealthWorker) {
        assignedVillages = caller.assignedVillages || [];
      }

      const camp = await CampService.getCampById(
        req.params.id,
        caller.hospitalId,
        isSystemAdmin,
        isHealthWorker,
        assignedVillages
      );

      return res.envelope({
        camp,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/v1/camps/:id
 * Update screening camp details (DRAFT or PUBLISHED status)
 */
campRouter.put(
  '/:id',
  requireAuth,
  authorizeCapability('camps:manage'),
  validate({ body: UpdateCampSchema }),
  auditTag('CAMP_UPDATE', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.updateCamp(
        req.params.id,
        req.body,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        camp,
        message: 'Screening camp updated successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/camps/:id
 * Delete a screening camp (DRAFT status only)
 */
campRouter.delete(
  '/:id',
  requireAuth,
  authorizeCapability('camps:manage'),
  auditTag('CAMP_DELETE', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      await CampService.deleteCamp(
        req.params.id,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        message: 'Draft screening camp deleted successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/camps/:id/publish
 * Publish a draft camp (transitions DRAFT -> PUBLISHED)
 * Hospital Manager creates and publishes camps for their own hospital.
 */
campRouter.post(
  '/:id/publish',
  requireAuth,
  authorizeCapability('camps:publish'),
  auditTag('CAMP_PUBLISH', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.publishCamp(
        req.params.id,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        camp,
        message: 'Screening camp successfully PUBLISHED',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/camps/:id/start
 * Start a screening camp (transitions PUBLISHED -> IN_PROGRESS / ONGOING).
 * MANDATORY INVARIANT: Camp must be PUBLISHED before starting!
 */
campRouter.post(
  '/:id/start',
  requireAuth,
  authorizeCapability('camps:manage'),
  auditTag('CAMP_START', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.startCamp(
        req.params.id,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        camp,
        message: 'Screening camp is now IN_PROGRESS',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/camps/:id/complete
 * Complete an in-progress screening camp
 */
campRouter.post(
  '/:id/complete',
  requireAuth,
  authorizeCapability('camps:manage'),
  auditTag('CAMP_COMPLETE', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.completeCamp(
        req.params.id,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        camp,
        message: 'Screening camp marked as COMPLETED',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/camps/:id/cancel
 * Cancel a draft, published, or ongoing camp
 */
campRouter.post(
  '/:id/cancel',
  requireAuth,
  authorizeCapability('camps:manage'),
  validate({ body: CancelCampSchema }),
  auditTag('CAMP_CANCEL', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.cancelCamp(
        req.params.id,
        req.body?.reason,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        camp,
        message: 'Screening camp CANCELLED',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/camps/:id/transition
 * Typed state machine transition endpoint
 */
campRouter.post(
  '/:id/transition',
  requireAuth,
  authorizeCapability('camps:manage'),
  validate({ body: TransitionCampSchema }),
  auditTag('CAMP_TRANSITION', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.transitionCamp(
        req.params.id,
        req.body.targetStatus,
        req.body.reason,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        camp,
        message: `Screening camp transitioned to ${camp.status.toUpperCase()}`,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/camps/:id/workers
 * Assign or update health workers for the camp
 */
campRouter.post(
  '/:id/workers',
  requireAuth,
  authorizeCapability('camps:manage'),
  validate({ body: AssignWorkersSchema }),
  auditTag('CAMP_WORKERS_ASSIGN', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.assignWorkers(
        req.params.id,
        req.body.workerIds,
        caller.hospitalId,
        isSystemAdmin,
        {
          actorId: user.id,
          actorRole: user.role,
          ip: req.ip || '127.0.0.1',
          userAgent: req.get('user-agent'),
        }
      );

      return res.envelope({
        camp,
        message: 'Health workers assigned to screening camp',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/camps/:id/statistics and /api/v1/camps/:id/counts
 * Camp-level counts with Small-Count Cell Suppression (< 5) applied
 */
const getStatisticsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const isSystemAdmin = user.role === 'system_admin';
    const isHealthWorker = user.role === 'asha' || user.role === 'anm';
    const caller = await resolveCallerHospital(req);

    let assignedVillages: string[] | undefined = undefined;
    if (isHealthWorker) {
      assignedVillages = caller.assignedVillages || [];
    }

    const statistics = await CampService.getCampStatistics(
      req.params.id,
      caller.hospitalId,
      isSystemAdmin,
      isHealthWorker,
      assignedVillages
    );

    return res.envelope({
      statistics,
      counts: statistics.metrics,
      simulation: true,
    });
  } catch (err) {
    next(err);
  }
};

campRouter.get(
  '/:id/statistics',
  requireAuth,
  authorizeCapability('camps:read'),
  auditTag('CAMP_STATISTICS', 'camp'),
  getStatisticsHandler
);

campRouter.get(
  '/:id/counts',
  requireAuth,
  authorizeCapability('camps:read'),
  auditTag('CAMP_COUNTS', 'camp'),
  getStatisticsHandler
);

/**
 * POST /api/v1/camps/:id/screenings
 * Record a screening event in an active camp
 */
campRouter.post(
  '/:id/screenings',
  requireAuth,
  authorizeCapability('camps:manage'),
  validate({ body: RecordScreeningSchema }),
  auditTag('CAMP_RECORD_SCREENING', 'camp'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const isSystemAdmin = user.role === 'system_admin';
      const caller = await resolveCallerHospital(req);

      const camp = await CampService.recordScreening(
        req.params.id,
        req.body,
        caller.hospitalId,
        isSystemAdmin
      );

      return res.envelope({
        camp,
        message: 'Screening count recorded for active camp',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);
