import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { Village } from './villageModel.js';
import { HealthWorkerAssignment } from '../assignment/assignmentModel.js';
import { User } from '../auth/userModel.js';
import { Hospital } from '../hospital/hospitalModel.js';
import {
  ASR_MANDALS,
  ASR_GRAM_PANCHAYATS,
  ASR_HEALTHCARE_FACILITIES,
} from './asrGeographyData.js';

const router = Router();

const VillageQuerySchema = z.object({
  mandal: z.string().optional(),
  hospitalId: z.string().optional(),
});

const CreateVillageSchema = z.object({
  villageId: z.string().min(2, 'Village ID required'),
  villageName: z.string().min(2, 'Village name required'),
  mandal: z.string().min(2, 'Mandal required'),
  panchayat: z.string().min(2, 'Panchayat required'),
  tribalHabitation: z.string().min(2, 'Habitation required'),
  hospitalId: z.string().min(1, 'Hospital ID required'),
  censusCode: z.string().min(1, 'Census code required'),
  populationEstimated: z.number().min(1).default(500),
});

// GET /api/v1/reference/villages
// Enforces: Health Worker sees ONLY assigned villages (scope comes only from explicit assignments)
router.get(
  '/villages',
  requireAuth,
  authorizeCapability('reference:villages'),
  validate({ query: VillageQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mandal, hospitalId } = req.query as { mandal?: string; hospitalId?: string };
      const filter: Record<string, unknown> = {};

      if (mandal) filter.mandal = mandal;
      if (hospitalId) filter.hospitalId = hospitalId;

      // 1. HEALTH WORKER STRICT ASSIGNMENT SCOPE
      if (req.user!.role === 'asha' || req.user!.role === 'anm') {
        const assignment = await HealthWorkerAssignment.findOne({
          workerId: req.user!.id,
          status: 'active',
        });

        if (!assignment || !assignment.assignedVillages || assignment.assignedVillages.length === 0) {
          // Scope comes only from explicit assignments. Without assignment, worker sees no villages.
          res.envelope({
            villages: [],
            total: 0,
            assignedScopeOnly: true,
            workerId: req.user!.id,
            simulation: true,
          });
          return;
        }

        // Restrict filter strictly to assigned villages
        filter.villageId = { $in: assignment.assignedVillages };

        const villages = await Village.find(filter).sort({ villageName: 1 }).lean();

        res.envelope({
          villages,
          total: villages.length,
          assignedScopeOnly: true,
          assignedCount: assignment.assignedVillages.length,
          workerId: req.user!.id,
          simulation: true,
        });
        return;
      }

      // 2. HOSPITAL STAFF CATCHMENT SCOPE (Non-system admin)
      if (req.user!.role !== 'system_admin') {
        const user = await User.findOne({ userId: req.user!.id });
        if (user?.hospitalId) {
          filter.hospitalId = user.hospitalId;
        }
      }

      // 3. SYSTEM ADMIN / SUPERUSER (Full agency scope)
      const villages = await Village.find(filter).sort({ villageName: 1 }).lean();

      res.envelope({
        villages,
        total: villages.length,
        assignedScopeOnly: false,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/reference/villages
router.post(
  '/villages',
  requireAuth,
  authorizeCapability('reference:manage'),
  validate({ body: CreateVillageSchema }),
  auditTag('VILLAGE_CREATE', 'reference'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const existing = await Village.findOne({ villageId: req.body.villageId });
      if (existing) {
        res.envelopeError('VILLAGE_EXISTS', 'Village with this ID already exists', undefined, 400);
        return;
      }

      const village = await Village.create({
        ...req.body,
        simulation: true,
      });

      res.status(201).envelope({
        village,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// ASR DISTRICT ADMINISTRATIVE HIERARCHY
// ==========================================

// GET /api/v1/reference/asr/mandals
router.get(
  '/asr/mandals',
  requireAuth,
  authorizeCapability('reference:villages'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.envelope({
        district: 'Alluri Sitharama Raju',
        totalMandals: ASR_MANDALS.length,
        divisions: ['Paderu', 'Rampachodavaram'],
        mandals: ASR_MANDALS.map((m) => ({
          mandalId: m.mandalId,
          mandalName: m.mandalName,
          nameTe: m.nameTe,
          nameHi: m.nameHi,
          revenueDivision: m.revenueDivision,
          headquarters: m.headquarters,
          centroid: m.centroid,
          catchmentHospitalId: m.catchmentHospitalId,
          catchmentHospitalName: m.catchmentHospitalName,
          gramPanchayatCount: m.gramPanchayatCount,
          estimatedPopulation: m.estimatedPopulation,
        })),
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/reference/asr/panchayats
router.get(
  '/asr/panchayats',
  requireAuth,
  authorizeCapability('reference:villages'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mandal } = req.query as { mandal?: string };
      let filtered = ASR_GRAM_PANCHAYATS;
      if (mandal) {
        const lower = mandal.toLowerCase().replace(/[^a-z0-9]/g, '');
        filtered = filtered.filter(
          (p) =>
            p.mandalName.toLowerCase().replace(/[^a-z0-9]/g, '') === lower ||
            p.mandalId.toLowerCase().replace(/[^a-z0-9]/g, '') === lower
        );
      }
      res.envelope({
        total: filtered.length,
        panchayats: filtered,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/reference/asr/villages
router.get(
  '/asr/villages',
  requireAuth,
  authorizeCapability('reference:villages'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mandal, panchayat, accessLevel, search, limit } = req.query as {
        mandal?: string;
        panchayat?: string;
        accessLevel?: string;
        search?: string;
        limit?: string;
      };

      const query: any = {};
      if (mandal) {
        query.mandal = new RegExp(`^${mandal}$`, 'i');
      }
      if (panchayat) {
        query.panchayat = new RegExp(`^${panchayat}$`, 'i');
      }
      if (accessLevel) {
        query.healthcareAccessLevel = accessLevel;
      }
      if (search) {
        query.$or = [
          { villageName: new RegExp(search, 'i') },
          { nameTe: new RegExp(search, 'i') },
          { tribalHabitation: new RegExp(search, 'i') },
          { censusCode: new RegExp(search, 'i') },
        ];
      }

      const maxLimit = limit ? Math.min(parseInt(limit, 10), 1000) : 500;
      const villages = await Village.find(query).limit(maxLimit).sort({ mandal: 1, villageName: 1 }).lean();

      res.envelope({
        total: villages.length,
        villages,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/reference/asr/facilities
router.get(
  '/asr/facilities',
  requireAuth,
  authorizeCapability('reference:villages'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mandal, type } = req.query as { mandal?: string; type?: string };
      let facilities = ASR_HEALTHCARE_FACILITIES;
      if (mandal) {
        facilities = facilities.filter((f) => f.mandal.toLowerCase() === mandal.toLowerCase());
      }
      if (type) {
        facilities = facilities.filter((f) => f.type.toLowerCase() === type.toLowerCase());
      }

      const dbHospitals = await Hospital.find({ status: 'active' }).lean();

      res.envelope({
        total: facilities.length,
        facilities,
        dbHospitals,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/reference/asr/villages/import
router.post(
  '/asr/villages/import',
  requireAuth,
  authorizeCapability('reference:manage'),
  auditTag('VILLAGE_BULK_IMPORT', 'reference'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = req.body.villages;
      if (!Array.isArray(items) || items.length === 0) {
        res.envelopeError('INVALID_PAYLOAD', 'villages array required in request body', undefined, 400);
        return;
      }

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const item of items) {
        if (!item.villageName || !item.mandal) {
          skippedCount++;
          errors.push(`Row missing villageName or mandal: ${JSON.stringify(item)}`);
          continue;
        }

        const villageId = item.villageId || `vil_${item.mandal.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const existing = await Village.findOne({
          $or: [
            { villageId },
            { villageName: item.villageName, mandal: item.mandal },
          ],
        });

        if (existing) {
          await Village.updateOne(
            { _id: existing._id },
            {
              $set: {
                panchayat: item.panchayat || existing.panchayat,
                tribalHabitation: item.tribalHabitation || existing.tribalHabitation,
                gpsCoordinates: item.gpsCoordinates || existing.gpsCoordinates,
                populationEstimated: item.populationEstimated || existing.populationEstimated,
                healthcareAccessLevel: item.healthcareAccessLevel || existing.healthcareAccessLevel,
                nearestFacilityDistanceKm: item.nearestFacilityDistanceKm ?? existing.nearestFacilityDistanceKm,
                verifiedByGovt: item.verifiedByGovt !== undefined ? item.verifiedByGovt : true,
              },
            }
          );
          updatedCount++;
        } else {
          await Village.create({
            villageId,
            villageName: item.villageName,
            nameTe: item.nameTe || '',
            mandal: item.mandal,
            panchayat: item.panchayat || item.villageName,
            tribalHabitation: item.tribalHabitation || 'Tribal Habitation',
            hospitalId: item.hospitalId || 'hosp_paderu_dh',
            censusCode: item.censusCode || `CEN${Math.floor(100000 + Math.random() * 900000)}`,
            populationEstimated: item.populationEstimated || 450,
            gpsCoordinates: item.gpsCoordinates,
            healthcareAccessLevel: item.healthcareAccessLevel || 'moderate',
            nearestFacilityDistanceKm: item.nearestFacilityDistanceKm || 5,
            verifiedByGovt: true,
            simulation: true,
          });
          insertedCount++;
        }
      }

      res.envelope({
        success: true,
        insertedCount,
        updatedCount,
        skippedCount,
        errors: errors.slice(0, 10),
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/v1/reference/asr/villages/:id/coordinates
router.put(
  '/asr/villages/:id/coordinates',
  requireAuth,
  authorizeCapability('reference:manage'),
  auditTag('VILLAGE_COORDINATES_UPDATE', 'reference'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        res.envelopeError('INVALID_COORDINATES', 'Numeric latitude and longitude required', undefined, 400);
        return;
      }

      const village = await Village.findOneAndUpdate(
        { $or: [{ villageId: id }, { _id: id }] },
        { $set: { gpsCoordinates: { latitude, longitude }, verifiedByGovt: true } },
        { new: true }
      );

      if (!village) {
        res.envelopeError('NOT_FOUND', 'Village not found', undefined, 404);
        return;
      }

      res.envelope({
        village,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const referenceRouter = router;
