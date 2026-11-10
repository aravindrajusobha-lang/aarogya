import { Village, IVillage } from '../reference/villageModel.js';
import { HealthWorkerAssignment } from '../assignment/assignmentModel.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { ScreeningCase } from '../screening/screeningCaseModel.js';
import { Camp } from '../camp/campModel.js';
import { VillageGroup } from '../villageGroup/villageGroupModel.js';
import {
  ITDA_PADERU_MANDALS,
  PADERU_TRANSPORT_CORRIDORS,
  PADERU_CONNECTIVITY_ZONES,
  GeoPoint,
} from './mapModel.js';
import { ASR_MANDAL_FEATURES } from '../reference/asrGeographyData.js';
import { User } from '../auth/userModel.js';
import {
  applySmallCountSuppression,
  calculateSuppressedCoverage,
  SuppressedMetric,
} from '../shared/aggregationUtils.js';

export interface UserScopeContext {
  userId: string;
  role: string;
  hospitalId?: string;
}

export class MapService {
  /**
   * Helper to ensure actor has hospitalId populated from User model if not in token.
   */
  static async ensureActorHospital(actor: UserScopeContext): Promise<string | undefined> {
    if (!actor.hospitalId) {
      const dbUser = await User.findOne({ userId: actor.userId });
      if (dbUser?.hospitalId) {
        actor.hospitalId = dbUser.hospitalId;
      }
    }
    return actor.hospitalId;
  }

  /**
   * Resolve accessible village IDs for the actor.
   * - Health workers (asha/anm): Only assigned villages.
   * - Hospital Staff (admin/medical_officer/specialist): Hospital's catchment villages.
   * - System Admin / DMHO: Universal access (returns null to indicate unconstrained).
   */
  static async resolveAuthorizedVillageScope(
    actor: UserScopeContext
  ): Promise<string[] | null> {
    if (actor.role === 'system_admin' || actor.role === 'dmho') {
      return null; // All villages allowed
    }

    if (actor.role === 'asha' || actor.role === 'anm') {
      const assignments = await HealthWorkerAssignment.find({
        workerId: actor.userId,
        status: 'active',
      });
      const villageSet = new Set<string>();
      assignments.forEach((a) => {
        if (a.assignedVillages) {
          a.assignedVillages.forEach((v: string) => villageSet.add(v));
        }
      });
      return Array.from(villageSet);
    }

    const hospitalId = await this.ensureActorHospital(actor);
    if (hospitalId) {
      const catchmentVillages = await Village.find({ hospitalId });
      return catchmentVillages.map((v) => v.villageId);
    }

    return [];
  }

  /**
   * Validate that the actor is authorized to access a specific village.
   * Throws 403 with specific code if denied.
   */
  static async validateVillageAccess(
    villageId: string,
    actor: UserScopeContext
  ): Promise<IVillage> {
    const village = await Village.findOne({ villageId });
    if (!village) {
      const err = new Error(`Village not found: ${villageId}`);
      (err as any).statusCode = 404;
      (err as any).code = 'VILLAGE_NOT_FOUND';
      throw err;
    }

    if (actor.role === 'system_admin' || actor.role === 'dmho') {
      return village;
    }

    if (actor.role === 'asha' || actor.role === 'anm') {
      const authorizedVillages = await this.resolveAuthorizedVillageScope(actor);
      if (!authorizedVillages || !authorizedVillages.includes(villageId)) {
        const err = new Error(
          'Access denied: Health workers may only access data for their assigned villages.'
        );
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN_VILLAGE_SCOPE';
        throw err;
      }
      return village;
    }

    const hospitalId = await this.ensureActorHospital(actor);
    if (hospitalId && village.hospitalId !== hospitalId) {
      const err = new Error(
        "Access denied: Hospital staff may only access villages within their facility's catchment."
      );
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN_CATCHMENT_SCOPE';
      throw err;
    }

    return village;
  }

  /**
   * Helper to compute deterministic coordinates for villages if none set.
   */
  static getVillageCoordinates(village: IVillage): GeoPoint {
    if (village.gpsCoordinates?.latitude && village.gpsCoordinates?.longitude) {
      return village.gpsCoordinates;
    }
    // Deterministic offset based on villageId string hash near Paderu Agency
    let hash = 0;
    for (let i = 0; i < village.villageId.length; i++) {
      hash = (hash << 5) - hash + village.villageId.charCodeAt(i);
      hash |= 0;
    }
    const latOffset = ((Math.abs(hash) % 1000) / 1000) * 0.2 - 0.1;
    const lngOffset = (((Math.abs(hash) >> 4) % 1000) / 1000) * 0.2 - 0.1;

    return {
      latitude: Math.round((18.08 + latOffset) * 10000) / 10000,
      longitude: Math.round((82.66 + lngOffset) * 10000) / 10000,
    };
  }

  // ==========================================
  // 1. GET /api/v1/map/villages
  // ==========================================
  static async listVillages(
    actor: UserScopeContext,
    filter: { mandal?: string; panchayat?: string } = {}
  ): Promise<any[]> {
    const query: any = {};
    if (filter.mandal) query.mandal = filter.mandal;
    if (filter.panchayat) query.panchayat = filter.panchayat;

    const allowedVillageIds = await this.resolveAuthorizedVillageScope(actor);
    if (allowedVillageIds !== null) {
      if (allowedVillageIds.length === 0) {
        return []; // Empty state for unassigned worker
      }
      query.villageId = { $in: allowedVillageIds };
    }

    const villages = await Village.find(query).sort({ villageName: 1 });
    return villages.map((v) => ({
      villageId: v.villageId,
      villageName: v.villageName,
      mandal: v.mandal,
      panchayat: v.panchayat,
      tribalHabitation: v.tribalHabitation,
      hospitalId: v.hospitalId,
      populationEstimated: v.populationEstimated,
      coordinates: this.getVillageCoordinates(v),
      simulation: true,
    }));
  }

  // ==========================================
  // 2. GET /api/v1/map/villages/:id
  // ==========================================
  static async getVillageDetail(villageId: string, actor: UserScopeContext): Promise<any> {
    const village = await this.validateVillageAccess(villageId, actor);
    return {
      villageId: village.villageId,
      villageName: village.villageName,
      mandal: village.mandal,
      panchayat: village.panchayat,
      tribalHabitation: village.tribalHabitation,
      hospitalId: village.hospitalId,
      censusCode: village.censusCode,
      populationEstimated: village.populationEstimated,
      coordinates: this.getVillageCoordinates(village),
      simulation: true,
    };
  }

  // ==========================================
  // 3. GET /api/v1/map/villages/:id/workers
  // ==========================================
  static async getVillageWorkers(villageId: string, actor: UserScopeContext): Promise<any[]> {
    await this.validateVillageAccess(villageId, actor);

    const assignments = await HealthWorkerAssignment.find({
      assignedVillages: villageId,
      status: 'active',
    });

    // Zero patient data; strictly worker professional details
    return assignments.map((a) => ({
      assignmentId: a.assignmentId,
      workerId: a.workerId,
      workerName: a.workerName,
      workerRole: a.workerRole,
      hospitalId: a.hospitalId,
      assignedMandal: a.assignedMandal,
      assignedAt: a.assignedAt,
      status: a.status,
    }));
  }

  // ==========================================
  // 4. GET /api/v1/map/villages/:id/facilities
  // ==========================================
  static async getVillageFacilities(villageId: string, actor: UserScopeContext): Promise<any> {
    const village = await this.validateVillageAccess(villageId, actor);

    const hospital = await Hospital.findOne({ hospitalId: village.hospitalId });
    const facilities: any[] = [];

    if (hospital) {
      facilities.push({
        facilityId: hospital.hospitalId,
        facilityName: hospital.name,
        type: hospital.type,
        district: hospital.district,
        mandal: hospital.mandal,
        isPrimaryCatchment: true,
        contactPhone: '+91 891 2548844',
      });
    }

    // Always reference District Hospital Paderu as tertiary referral link
    if (hospital?.hospitalId !== 'hosp_paderu_dh') {
      facilities.push({
        facilityId: 'hosp_paderu_dh',
        facilityName: 'District Hospital Paderu',
        type: 'district_hospital',
        district: 'Alluri Sitharama Raju',
        mandal: 'Paderu',
        isTertiaryReferralHub: true,
        contactPhone: '+91 8935 250234',
      });
    }

    return {
      villageId,
      villageName: village.villageName,
      mandal: village.mandal,
      catchmentHospitalId: village.hospitalId,
      facilities,
    };
  }

  // ==========================================
  // 5. GET /api/v1/map/villages/:id/screenings-summary
  // ==========================================
  static async getVillageScreeningsSummary(
    villageId: string,
    actor: UserScopeContext,
    filters: { startDate?: string; endDate?: string; priority?: string } = {}
  ): Promise<any> {
    const village = await this.validateVillageAccess(villageId, actor);

    const query: any = { villageId };
    if (filters.priority) query.priority = filters.priority;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const cases = await ScreeningCase.find(query);
    const totalCount = cases.length;

    // Small-count suppression applied to every aggregate metric
    const pendingAssignmentCount = cases.filter((c) => c.status === 'pending_assignment').length;
    const underReviewCount = cases.filter(
      (c) => c.status === 'assigned' || c.status === 'under_review'
    ).length;
    const completedCount = cases.filter((c) => c.status === 'completed').length;
    const escalatedCount = cases.filter((c) => c.status === 'escalated').length;
    const referralCount = cases.filter((c) => c.status === 'referral_requested').length;

    return {
      villageId,
      villageName: village.villageName,
      mandal: village.mandal,
      emptyState: totalCount === 0,
      metrics: {
        totalScreenings: applySmallCountSuppression(totalCount),
        pendingAssignment: applySmallCountSuppression(pendingAssignmentCount),
        underReview: applySmallCountSuppression(underReviewCount),
        completed: applySmallCountSuppression(completedCount),
        escalated: applySmallCountSuppression(escalatedCount),
        referralsRequested: applySmallCountSuppression(referralCount),
      },
      filtersApplied: {
        priority: filters.priority || null,
        dateRange: filters.startDate || filters.endDate ? true : false,
      },
      privacyNotice:
        'Small-count cell suppression applied (< 5) to protect tribal patient privacy. Zero patient points or names displayed.',
      simulation: true,
    };
  }

  // ==========================================
  // 6. GET /api/v1/map/villages/:id/risk-metrics
  // ==========================================
  static async getVillageRiskMetrics(
    villageId: string,
    actor: UserScopeContext,
    filters: { startDate?: string; endDate?: string; riskLevel?: string } = {}
  ): Promise<any> {
    const village = await this.validateVillageAccess(villageId, actor);

    const query: any = { villageId };
    if (filters.riskLevel) {
      query['demoAiResult.riskSupportLabel'] = filters.riskLevel;
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const cases = await ScreeningCase.find(query);
    const totalWithAi = cases.filter((c) => c.demoAiResult).length;

    const lowRiskCount = cases.filter(
      (c) => c.demoAiResult?.riskSupportLabel === 'low_risk_support'
    ).length;
    const moderateRiskCount = cases.filter(
      (c) => c.demoAiResult?.riskSupportLabel === 'moderate_risk_support'
    ).length;
    const highRiskCount = cases.filter(
      (c) => c.demoAiResult?.riskSupportLabel === 'high_risk_support'
    ).length;
    const indeterminateCount = cases.filter(
      (c) => c.demoAiResult?.riskSupportLabel === 'indeterminate_risk_support'
    ).length;

    return {
      villageId,
      villageName: village.villageName,
      mandal: village.mandal,
      emptyState: cases.length === 0,
      riskDensity: {
        totalEvaluated: applySmallCountSuppression(totalWithAi),
        lowRiskSupport: applySmallCountSuppression(lowRiskCount),
        moderateRiskSupport: applySmallCountSuppression(moderateRiskCount),
        highRiskSupport: applySmallCountSuppression(highRiskCount),
        indeterminateRiskSupport: applySmallCountSuppression(indeterminateCount),
      },
      clinicalSafetyNotice:
        'Aarogya-Drishti evaluates mucosal risk support patterns only. The system never makes clinical diagnostic conclusions or staging determinations.',
      simulation: true,
    };
  }

  // ==========================================
  // 7. GET /api/v1/map/villages/:id/camps
  // ==========================================
  static async getVillageCamps(villageId: string, actor: UserScopeContext): Promise<any> {
    const village = await this.validateVillageAccess(villageId, actor);

    const camps = await Camp.find({ villageId }).sort({ startDate: -1 });

    return {
      villageId,
      villageName: village.villageName,
      mandal: village.mandal,
      totalCamps: camps.length,
      emptyState: camps.length === 0,
      camps: camps.map((c) => ({
        campId: c.campId,
        name: c.name,
        status: c.status,
        startDate: c.startDate,
        endDate: c.endDate,
        targetPopulation: c.targetPopulation,
        screeningsConducted: applySmallCountSuppression(c.screeningCount || 0),
        abnormalFindingsFlagged: applySmallCountSuppression(c.abnormalFindingsCount || 0),
        referralsInitiated: applySmallCountSuppression(c.referralsCount || 0),
      })),
      simulation: true,
    };
  }

  // ==========================================
  // 8. GET /api/v1/map/clusters
  // ==========================================
  static async getHabitationClusters(actor: UserScopeContext): Promise<any> {
    const allowedVillageIds = await this.resolveAuthorizedVillageScope(actor);
    const query: any = {};
    if (allowedVillageIds !== null) {
      if (allowedVillageIds.length === 0) {
        return { clusters: [], totalClusters: 0, emptyState: true };
      }
      query.villageId = { $in: allowedVillageIds };
    }

    const groups = await VillageGroup.find(query);
    const clusters = groups.map((g) => ({
      clusterId: g.groupId,
      clusterName: `${g.villageName} Cluster`,
      villageId: g.villageId,
      villageName: g.villageName,
      mandal: g.mandal,
      status: g.status,
      suppressedPatientCount: applySmallCountSuppression(g.patientCount || 0),
      autoTriggerBlocked: g.autoTriggerBlocked,
    }));

    return {
      clusters,
      totalClusters: clusters.length,
      emptyState: clusters.length === 0,
      simulation: true,
    };
  }

  // ==========================================
  // 9. GET /api/v1/map/boundaries/mandals
  // ==========================================
  static async getMandalBoundaries(): Promise<any> {
    const features = ASR_MANDAL_FEATURES && ASR_MANDAL_FEATURES.length > 0 ? ASR_MANDAL_FEATURES : ITDA_PADERU_MANDALS;
    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        district: 'Alluri Sitharama Raju',
        agency: 'ITDA Paderu & Rampachodavaram',
        count: features.length,
        projection: 'EPSG:4326',
        simulation: true,
      },
    };
  }

  // ==========================================
  // 10. GET /api/v1/map/corridors/transport
  // ==========================================
  static async getTransportCorridors(): Promise<any> {
    return {
      corridors: PADERU_TRANSPORT_CORRIDORS,
      totalCorridors: PADERU_TRANSPORT_CORRIDORS.length,
      hub: 'District Hospital Paderu',
      simulation: true,
    };
  }

  // ==========================================
  // 11. GET /api/v1/map/connectivity-zones
  // ==========================================
  static async getConnectivityZones(): Promise<any> {
    return {
      zones: PADERU_CONNECTIVITY_ZONES,
      totalZones: PADERU_CONNECTIVITY_ZONES.length,
      agencyNotes:
        'Shadow zones require offline PWA caching with background replay when cellular connectivity resumes.',
      simulation: true,
    };
  }

  // ==========================================
  // 12. GET /api/v1/map/heatmap/screening-coverage
  // ==========================================
  static async getScreeningCoverageHeatmap(actor: UserScopeContext): Promise<any> {
    const villages = await this.listVillages(actor);
    if (villages.length === 0) {
      return { heatmapPoints: [], emptyState: true, simulation: true };
    }

    const villageIds = villages.map((v) => v.villageId);
    const caseCounts = await ScreeningCase.aggregate([
      { $match: { villageId: { $in: villageIds } } },
      { $group: { _id: '$villageId', count: { $sum: 1 } } },
    ]);
    const caseCountMap = new Map<string, number>();
    caseCounts.forEach((c) => caseCountMap.set(c._id, c.count));

    const heatmapPoints = villages.map((v) => {
      const rawCount = caseCountMap.get(v.villageId) || 0;
      const coverage = calculateSuppressedCoverage(rawCount, v.populationEstimated || 500);

      return {
        villageId: v.villageId,
        villageName: v.villageName,
        mandal: v.mandal,
        coordinates: v.coordinates,
        targetPopulation: v.populationEstimated || 500,
        screenedMetric: coverage.screened,
        coverageDisplay: coverage.displayPercentage,
        isSuppressed: coverage.screened.isSuppressed,
      };
    });

    return {
      heatmapPoints,
      totalVillages: heatmapPoints.length,
      cellSuppressionThreshold: 5,
      simulation: true,
    };
  }

  // ==========================================
  // 13. GET /api/v1/map/geo-export
  // ==========================================
  static async exportGeoJson(actor: UserScopeContext): Promise<any> {
    const villages = await this.listVillages(actor);
    const villageIds = villages.map((v) => v.villageId);

    const caseCounts = await ScreeningCase.aggregate([
      { $match: { villageId: { $in: villageIds } } },
      { $group: { _id: '$villageId', count: { $sum: 1 } } },
    ]);
    const caseCountMap = new Map<string, number>();
    caseCounts.forEach((c) => caseCountMap.set(c._id, c.count));

    const features = villages.map((v) => {
      const rawCount = caseCountMap.get(v.villageId) || 0;
      const coverage = calculateSuppressedCoverage(rawCount, v.populationEstimated || 500);

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [v.coordinates.longitude, v.coordinates.latitude],
        },
        properties: {
          villageId: v.villageId,
          villageName: v.villageName,
          mandal: v.mandal,
          hospitalId: v.hospitalId,
          populationEstimated: v.populationEstimated,
          metrics: {
            screeningsConducted: coverage.screened.displayValue,
            coveragePercentage: coverage.displayPercentage,
            isSuppressed: coverage.screened.isSuppressed,
          },
          privacyNotice:
            'Small-count suppression (< 5) applied. Zero patient identities or coordinates included.',
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedByRole: actor.role,
        district: 'Alluri Sitharama Raju',
        agency: 'ITDA Paderu',
        featureCount: features.length,
        simulation: true,
      },
    };
  }
}
