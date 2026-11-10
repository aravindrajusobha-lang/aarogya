import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Village } from '../src/modules/reference/villageModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { HealthWorkerAssignment } from '../src/modules/assignment/assignmentModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { Camp } from '../src/modules/camp/campModel.js';
import { VillageGroup } from '../src/modules/villageGroup/villageGroupModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 14: Village Data Map (13 Endpoints & Privacy Aggregation)', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Hospitals
  const hospPaderuId = 'hosp_paderu_map_01';
  const hospArakuId = 'hosp_araku_map_02';

  // Villages
  const vilMatsyaId = 'vil_matsyapuram_01'; // Hospital Paderu - 3 screenings (suppressed < 5)
  const vilVanabaId = 'vil_vanabarangi_02'; // Hospital Paderu - 7 screenings (unsuppressed 7, filter isolates 2)
  const vilArakuId = 'vil_araku_colony_03'; // Hospital Araku - 0 screenings (empty state)

  // Tokens & Users
  let adminPaderuToken: string;
  const adminPaderuId = 'usr_admin_paderu_m14';

  let moPaderuToken: string;
  const moPaderuId = 'usr_mo_paderu_m14';

  let ashaMatsyaToken: string;
  const ashaMatsyaId = 'usr_asha_matsya_m14';

  let moArakuToken: string;
  const moArakuId = 'usr_mo_araku_m14';

  let patientToken: string;
  const patientId = 'usr_pat_map_m14';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsMapTest');
    await mongoose.connect(replSet.getUri());

    await Village.syncIndexes();
    await Hospital.syncIndexes();
    await User.syncIndexes();
    await HealthWorkerAssignment.syncIndexes();
    await ScreeningCase.syncIndexes();
    await Camp.syncIndexes();
    await VillageGroup.syncIndexes();

    const pwd = await hashPassword('MapPass@2026');

    // 1. Seed Hospitals
    await Hospital.create([
      {
        hospitalId: hospPaderuId,
        name: 'District Hospital Paderu',
        district: 'Alluri Sitharama Raju',
        mandal: 'Paderu',
        state: 'Andhra Pradesh',
        type: 'district_hospital',
        status: 'active',
        simulation: true,
      },
      {
        hospitalId: hospArakuId,
        name: 'Araku Valley CHC',
        district: 'Alluri Sitharama Raju',
        mandal: 'Araku Valley',
        state: 'Andhra Pradesh',
        type: 'community_health_centre',
        status: 'active',
        simulation: true,
      },
    ]);

    // 2. Seed Villages
    await Village.create([
      {
        villageId: vilMatsyaId,
        villageName: 'Matsyapuram',
        mandal: 'Paderu',
        panchayat: 'Matsyapuram GP',
        tribalHabitation: 'Kondhu Tribal Colony',
        hospitalId: hospPaderuId,
        censusCode: '584901',
        populationEstimated: 450,
        gpsCoordinates: { latitude: 18.042, longitude: 82.618 },
        simulation: true,
      },
      {
        villageId: vilVanabaId,
        villageName: 'Vanabarangi',
        mandal: 'Paderu',
        panchayat: 'Vanabarangi GP',
        tribalHabitation: 'Bagata Habitation',
        hospitalId: hospPaderuId,
        censusCode: '584902',
        populationEstimated: 620,
        gpsCoordinates: { latitude: 18.095, longitude: 82.682 },
        simulation: true,
      },
      {
        villageId: vilArakuId,
        villageName: 'Araku Colony',
        mandal: 'Araku Valley',
        panchayat: 'Araku GP',
        tribalHabitation: 'Valmiki Habitation',
        hospitalId: hospArakuId,
        censusCode: '585101',
        populationEstimated: 800,
        gpsCoordinates: { latitude: 18.333, longitude: 82.873 },
        simulation: true,
      },
    ]);

    // 3. Seed Users
    await User.create([
      {
        userId: adminPaderuId,
        username: 'admin_paderu_map',
        email: 'admin@paderu-map.gov.in',
        passwordHash: pwd,
        role: 'admin',
        hospitalId: hospPaderuId,
        fullName: 'Hospital Manager Paderu',
        isActive: true,
      },
      {
        userId: moPaderuId,
        username: 'mo_paderu_map',
        email: 'mo@paderu-map.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospPaderuId,
        fullName: 'Dr. Ramesh MO',
        isActive: true,
      },
      {
        userId: ashaMatsyaId,
        username: 'asha_matsya_map',
        email: 'asha@paderu-map.gov.in',
        passwordHash: pwd,
        role: 'asha',
        hospitalId: hospPaderuId,
        fullName: 'Lakshmi ASHA',
        isActive: true,
      },
      {
        userId: moArakuId,
        username: 'mo_araku_map',
        email: 'mo@araku-map.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospArakuId,
        fullName: 'Dr. Anitha Araku MO',
        isActive: true,
      },
      {
        userId: patientId,
        username: 'pat_map_demo',
        email: 'patient@paderu.com',
        passwordHash: pwd,
        role: 'patient',
        fullName: 'Tribal Patient',
        isActive: true,
      },
    ]);

    // 4. Assign ASHA Lakshmi strictly to Matsyapuram (vilMatsyaId)
    await HealthWorkerAssignment.create({
      assignmentId: 'asg_matsya_01',
      workerId: ashaMatsyaId,
      workerName: 'Lakshmi ASHA',
      workerRole: 'asha',
      hospitalId: hospPaderuId,
      assignedMandal: 'Paderu',
      assignedVillages: [vilMatsyaId],
      assignedBy: adminPaderuId,
      status: 'active',
      simulation: true,
    });

    // 5. Seed Screenings:
    // Village 1: Matsyapuram -> Exactly 3 screenings (small count < 5)
    for (let i = 1; i <= 3; i++) {
      await ScreeningCase.create({
        caseId: `case_matsya_0${i}`,
        patientId: `pat_matsya_0${i}`,
        patientName: `Secret Patient M${i}`,
        villageId: vilMatsyaId,
        villageName: 'Matsyapuram',
        hospitalId: hospPaderuId,
        createdBy: ashaMatsyaId,
        status: 'pending_assignment',
        priority: 'routine',
        photoIds: [`ph_matsya_${i}`],
        demoAiResult: {
          riskSupportLabel: 'low_risk_support',
          confidenceScore: 0.85,
          qualityChecks: { positioning: 'unavailable', obstruction: 'unavailable', missingArea: 'unavailable' },
          disclaimer: 'Demonstration risk support only.',
          simulationBanner: 'SIMULATION',
          analyzedAt: new Date(),
        },
        resultReleased: false,
        simulation: true,
      });
    }

    // Village 2: Vanabarangi -> Exactly 7 screenings (unsuppressed 7, with 2 urgent)
    for (let i = 1; i <= 7; i++) {
      const isUrgent = i <= 2;
      await ScreeningCase.create({
        caseId: `case_vanaba_0${i}`,
        patientId: `pat_vanaba_0${i}`,
        patientName: `Secret Patient V${i}`,
        villageId: vilVanabaId,
        villageName: 'Vanabarangi',
        hospitalId: hospPaderuId,
        createdBy: moPaderuId,
        status: isUrgent ? 'escalated' : 'completed',
        priority: isUrgent ? 'urgent' : 'routine',
        photoIds: [`ph_vanaba_${i}`],
        demoAiResult: {
          riskSupportLabel: isUrgent ? 'high_risk_support' : 'low_risk_support',
          confidenceScore: 0.9,
          qualityChecks: { positioning: 'unavailable', obstruction: 'unavailable', missingArea: 'unavailable' },
          disclaimer: 'Demonstration risk support only.',
          simulationBanner: 'SIMULATION',
          analyzedAt: new Date(),
        },
        resultReleased: true,
        simulation: true,
      });
    }

    // 6. Seed Camp in Vanabarangi
    await Camp.create({
      campId: 'camp_vanaba_01',
      name: 'Vanabarangi Mucosal Screening Camp',
      hospitalId: hospPaderuId,
      villageId: vilVanabaId,
      status: 'completed',
      leadMoId: moPaderuId,
      startDate: new Date('2026-10-10'),
      endDate: new Date('2026-10-12'),
      targetPopulation: 600,
      screeningCount: 7,
      abnormalFindingsCount: 2,
      referralsCount: 2,
      location: { address: 'Vanabarangi Panchayat Community Hall' },
      simulation: true,
    });

    // 7. Seed Village Group
    await VillageGroup.create({
      groupId: 'grp_matsyapuram_01',
      groupName: 'Matsyapuram Health Group',
      villageId: vilMatsyaId,
      villageName: 'Matsyapuram',
      mandal: 'Paderu',
      district: 'Alluri Sitharama Raju',
      normalizedAddress: 'matsyapuram, paderu',
      sampleAddressText: 'Matsyapuram Tribal Hamlet',
      patientCount: 3,
      memberPatientIds: ['pat_matsya_01', 'pat_matsya_02', 'pat_matsya_03'],
      status: 'active',
      simulation: true,
    });

    // Auth tokens
    adminPaderuToken = signAccessToken({
      userId: adminPaderuId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_adm_p14',
      deviceId: 'dev_adm_p14',
    });

    moPaderuToken = signAccessToken({
      userId: moPaderuId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_mo_p14',
      deviceId: 'dev_mo_p14',
    });

    ashaMatsyaToken = signAccessToken({
      userId: ashaMatsyaId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_ash_p14',
      deviceId: 'dev_ash_p14',
    });

    moArakuToken = signAccessToken({
      userId: moArakuId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_ark_p14',
      deviceId: 'dev_ark_p14',
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      scopes: getRoleCapabilities('patient'),
      deviceSessionId: 'ses_pat_p14',
      deviceId: 'dev_pat_p14',
    });
  }, 60000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  describe('1. Endpoint Verification (All 13 Endpoints Exist & Return Data)', () => {
    it('1. GET /api/v1/map/villages returns scoped villages with coordinates', async () => {
      const res = await request(app)
        .get('/api/v1/map/villages')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.villages.length).toBe(2); // Paderu has 2 villages (Matsyapuram & Vanabarangi)
      expect(res.body.data.villages[0].coordinates.latitude).toBeDefined();
      expect(res.body.data.villages[0].coordinates.longitude).toBeDefined();
    });

    it('2. GET /api/v1/map/villages/:id returns village details & census estimates', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.village.villageName).toBe('Matsyapuram');
      expect(res.body.data.village.populationEstimated).toBe(450);
    });

    it('3. GET /api/v1/map/villages/:id/workers returns assigned staff (zero patient data)', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}/workers`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workers.length).toBe(1);
      expect(res.body.data.workers[0].workerName).toBe('Lakshmi ASHA');
      expect(res.body.data.workers[0].workerRole).toBe('asha');
    });

    it('4. GET /api/v1/map/villages/:id/facilities returns catchment healthcare facilities', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}/facilities`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.facilities.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.facilities[0].facilityName).toBe('District Hospital Paderu');
    });

    it('5. GET /api/v1/map/villages/:id/screenings-summary returns suppressed aggregate metrics', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}/screenings-summary`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.metrics.totalScreenings.isSuppressed).toBe(true);
      expect(res.body.data.metrics.totalScreenings.displayValue).toBe('< 5');
    });

    it('6. GET /api/v1/map/villages/:id/risk-metrics returns anonymized risk density (no diagnostic claims)', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}/risk-metrics`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.riskDensity.totalEvaluated.isSuppressed).toBe(true);
      expect(res.body.data.clinicalSafetyNotice).toBeDefined();
    });

    it('7. GET /api/v1/map/villages/:id/camps returns village camp history with suppressed counts', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilVanabaId}/camps`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.camps.length).toBe(1);
      expect(res.body.data.camps[0].name).toBe('Vanabarangi Mucosal Screening Camp');
    });

    it('8. GET /api/v1/map/clusters returns habitation clusters and village health groups', async () => {
      const res = await request(app)
        .get('/api/v1/map/clusters')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.clusters.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.clusters[0].suppressedPatientCount.isSuppressed).toBe(true);
    });

    it('9. GET /api/v1/map/boundaries/mandals returns spatial GeoJSON polygons for ITDA Paderu', async () => {
      const res = await request(app)
        .get('/api/v1/map/boundaries/mandals')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('FeatureCollection');
      expect(res.body.data.features.length).toBeGreaterThanOrEqual(5);
      expect(res.body.data.features[0].geometry.type).toBe('Polygon');
    });

    it('10. GET /api/v1/map/corridors/transport returns tribal transport corridors to District Hospital', async () => {
      const res = await request(app)
        .get('/api/v1/map/corridors/transport')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.corridors.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.hub).toBe('District Hospital Paderu');
    });

    it('11. GET /api/v1/map/connectivity-zones returns offline shadow zones and cellular hubs', async () => {
      const res = await request(app)
        .get('/api/v1/map/connectivity-zones')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.zones.length).toBeGreaterThanOrEqual(4);
      const shadow = res.body.data.zones.find((z: any) => z.zoneType === 'shadow_zone');
      expect(shadow.offlineModeRecommended).toBe(true);
    });

    it('12. GET /api/v1/map/heatmap/screening-coverage returns population coverage with suppression', async () => {
      const res = await request(app)
        .get('/api/v1/map/heatmap/screening-coverage')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.heatmapPoints.length).toBe(2);
      // Matsyapuram has 3 screenings -> suppressed
      const matsya = res.body.data.heatmapPoints.find((p: any) => p.villageId === vilMatsyaId);
      expect(matsya.isSuppressed).toBe(true);
      expect(matsya.screenedMetric.displayValue).toBe('< 5');
    });

    it('13. GET /api/v1/map/geo-export generates suppressed GeoJSON feature collection for offline GIS', async () => {
      const res = await request(app)
        .get('/api/v1/map/geo-export')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.type).toBe('FeatureCollection');
      expect(res.body.data.features.length).toBe(2);
      expect(res.body.data.features[0].geometry.type).toBe('Point');
      expect(res.body.data.features[0].properties.metrics).toBeDefined();
    });
  });

  describe('2. Small-Count Suppression & Filter-Combination Attack Defense', () => {
    it('suppresses cell counts strictly below 5 (3 screenings -> < 5)', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}/screenings-summary`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.metrics.totalScreenings.count).toBeNull();
      expect(res.body.data.metrics.totalScreenings.displayValue).toBe('< 5');
      expect(res.body.data.metrics.totalScreenings.isSuppressed).toBe(true);
    });

    it('reveals exact count when aggregate meets or exceeds threshold of 5 (7 screenings -> 7)', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilVanabaId}/screenings-summary`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.metrics.totalScreenings.count).toBe(7);
      expect(res.body.data.metrics.totalScreenings.displayValue).toBe('7');
      expect(res.body.data.metrics.totalScreenings.isSuppressed).toBe(false);
    });

    it('triggers suppression on filter-combination attacks (Vanabarangi with priority=urgent isolates 2 cases)', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilVanabaId}/screenings-summary?priority=urgent`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      // Filter narrows total matching from 7 down to 2 -> must be suppressed!
      expect(res.body.data.metrics.totalScreenings.count).toBeNull();
      expect(res.body.data.metrics.totalScreenings.displayValue).toBe('< 5');
      expect(res.body.data.metrics.totalScreenings.isSuppressed).toBe(true);
    });

    it('returns empty state with 200 OK (not error) when village has zero screenings', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilArakuId}/screenings-summary`)
        .set('Authorization', `Bearer ${moArakuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.emptyState).toBe(true);
      expect(res.body.data.metrics.totalScreenings.count).toBe(0);
      expect(res.body.data.metrics.totalScreenings.displayValue).toBe('0');
      expect(res.body.data.metrics.totalScreenings.isSuppressed).toBe(false);
    });
  });

  describe('3. Role Scope Enforcement & Scope Denial', () => {
    it('allows Health Worker to view assigned village (Matsyapuram)', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}`)
        .set('Authorization', `Bearer ${ashaMatsyaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.village.villageId).toBe(vilMatsyaId);
    });

    it('denies Health Worker access to unassigned village (Vanabarangi) with 403 FORBIDDEN_VILLAGE_SCOPE', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilVanabaId}`)
        .set('Authorization', `Bearer ${ashaMatsyaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_VILLAGE_SCOPE');
    });

    it('filters village list for Health Worker to strictly assigned villages', async () => {
      const res = await request(app)
        .get('/api/v1/map/villages')
        .set('Authorization', `Bearer ${ashaMatsyaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.villages.length).toBe(1);
      expect(res.body.data.villages[0].villageId).toBe(vilMatsyaId);
    });

    it('denies Medical Officer access to villages outside their hospital catchment with 403 FORBIDDEN_CATCHMENT_SCOPE', async () => {
      // Dr. Anitha (Araku CHC) attempting to access Matsyapuram (District Hospital Paderu)
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}`)
        .set('Authorization', `Bearer ${moArakuToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_CATCHMENT_SCOPE');
    });

    it('denies patient access to all map endpoints with 403', async () => {
      const res = await request(app)
        .get('/api/v1/map/villages')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Log Scan & Zero Patient PII Leakage', () => {
    it('verifies responses and audit metadata contain zero patient names or patient IDs', async () => {
      const res = await request(app)
        .get(`/api/v1/map/villages/${vilMatsyaId}/screenings-summary`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('Secret Patient');
      expect(bodyStr).not.toContain('pat_matsya_');

      // Check audit logs
      const logs = await AuditLog.find({ resourceType: 'map_village_screenings' });
      for (const log of logs) {
        const metaStr = JSON.stringify(log.metadata || {});
        expect(metaStr).not.toContain('Secret Patient');
        expect(metaStr).not.toContain('pat_matsya_');
      }
    });

    it('verifies geo-export response contains zero patient identities', async () => {
      const res = await request(app)
        .get('/api/v1/map/geo-export')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      const geoStr = JSON.stringify(res.body);
      expect(geoStr).not.toContain('Secret Patient');
      expect(geoStr).not.toContain('pat_vanaba_');
      expect(geoStr).not.toContain('pat_matsya_');
    });
  });
});
