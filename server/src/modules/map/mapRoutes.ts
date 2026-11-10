import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { MapService } from './mapService.js';

const router = Router();

const VillageFilterSchema = z.object({
  mandal: z.string().optional(),
  panchayat: z.string().optional(),
});

const ScreeningsFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  priority: z.enum(['routine', 'urgent', 'high_priority']).optional(),
});

const RiskFilterSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  riskLevel: z
    .enum([
      'low_risk_support',
      'moderate_risk_support',
      'high_risk_support',
      'indeterminate_risk_support',
    ])
    .optional(),
});

// Helper for extracting actor context
function getActorContext(req: Request) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    hospitalId: req.user!.hospitalId,
  };
}

// ==========================================
// 8. GET /api/v1/map/clusters
// ==========================================
router.get(
  '/clusters',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.clusters.read', 'map_clusters'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getHabitationClusters(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 9. GET /api/v1/map/boundaries/mandals
// ==========================================
router.get(
  '/boundaries/mandals',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.boundaries.read', 'map_boundaries'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getMandalBoundaries();
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 10. GET /api/v1/map/corridors/transport
// ==========================================
router.get(
  '/corridors/transport',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.corridors.read', 'map_corridors'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getTransportCorridors();
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 11. GET /api/v1/map/connectivity-zones
// ==========================================
router.get(
  '/connectivity-zones',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.connectivity.read', 'map_connectivity'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getConnectivityZones();
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 12. GET /api/v1/map/heatmap/screening-coverage
// ==========================================
router.get(
  '/heatmap/screening-coverage',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.coverage.read', 'map_heatmap'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getScreeningCoverageHeatmap(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 13. GET /api/v1/map/geo-export
// ==========================================
router.get(
  '/geo-export',
  requireAuth,
  authorizeCapability('map:export'),
  auditTag('map.geo_export.download', 'map_export'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.exportGeoJson(getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 1. GET /api/v1/map/villages
// ==========================================
router.get(
  '/villages',
  requireAuth,
  authorizeCapability('map:read'),
  validate({ query: VillageFilterSchema }),
  auditTag('map.villages.list', 'map_villages'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const villages = await MapService.listVillages(getActorContext(req), req.query as any);
      res.envelope({
        villages,
        total: villages.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 2. GET /api/v1/map/villages/:id
// ==========================================
router.get(
  '/villages/:id',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.village.detail', 'map_village'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const village = await MapService.getVillageDetail(req.params.id, getActorContext(req));
      res.envelope({ village });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 3. GET /api/v1/map/villages/:id/workers
// ==========================================
router.get(
  '/villages/:id/workers',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.village.workers', 'map_village_workers'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const workers = await MapService.getVillageWorkers(req.params.id, getActorContext(req));
      res.envelope({
        villageId: req.params.id,
        workers,
        total: workers.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 4. GET /api/v1/map/villages/:id/facilities
// ==========================================
router.get(
  '/villages/:id/facilities',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.village.facilities', 'map_village_facilities'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getVillageFacilities(req.params.id, getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5. GET /api/v1/map/villages/:id/screenings-summary
// ==========================================
router.get(
  '/villages/:id/screenings-summary',
  requireAuth,
  authorizeCapability('map:read'),
  validate({ query: ScreeningsFilterSchema }),
  auditTag('map.village.screenings_summary', 'map_village_screenings'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getVillageScreeningsSummary(
        req.params.id,
        getActorContext(req),
        req.query as any
      );
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 6. GET /api/v1/map/villages/:id/risk-metrics
// ==========================================
router.get(
  '/villages/:id/risk-metrics',
  requireAuth,
  authorizeCapability('map:read'),
  validate({ query: RiskFilterSchema }),
  auditTag('map.village.risk_metrics', 'map_village_risk'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getVillageRiskMetrics(
        req.params.id,
        getActorContext(req),
        req.query as any
      );
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 7. GET /api/v1/map/villages/:id/camps
// ==========================================
router.get(
  '/villages/:id/camps',
  requireAuth,
  authorizeCapability('map:read'),
  auditTag('map.village.camps', 'map_village_camps'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await MapService.getVillageCamps(req.params.id, getActorContext(req));
      res.envelope(data);
    } catch (err) {
      next(err);
    }
  }
);

export const mapRouter = router;
