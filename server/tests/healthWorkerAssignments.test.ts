import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Village } from '../src/modules/reference/villageModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 3 Administration: Health Worker Village Assignments & Scoping', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let adminToken: string;
  let ashaToken: string;
  let unassignedAshaToken: string;

  const ashaUserId = 'usr_asha_assigned_01';
  const unassignedAshaId = 'usr_asha_unassigned_02';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsWorkerAssignments');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('Pass@2026');

    // Admin user
    await User.create({
      userId: 'usr_admin_asgn',
      username: 'admin.assignment',
      role: 'admin',
      fullName: 'PHC Medical Officer / Admin',
      hospitalId: 'hosp_hukumpeta_phc',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    adminToken = signAccessToken({
      userId: 'usr_admin_asgn',
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_adm_asgn',
      deviceId: 'dev_adm_asgn',
    });

    // ASHA Worker 1 (Will be assigned to Village 1 and Village 2)
    await User.create({
      userId: ashaUserId,
      username: 'asha.village_lead',
      role: 'asha',
      fullName: 'Lakshmi (ASHA Lead)',
      hospitalId: 'hosp_hukumpeta_phc',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    ashaToken = signAccessToken({
      userId: ashaUserId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_asha_asgn',
      deviceId: 'dev_asha_asgn',
    });

    // ASHA Worker 2 (Unassigned)
    await User.create({
      userId: unassignedAshaId,
      username: 'asha.unassigned',
      role: 'asha',
      fullName: 'Radha (Unassigned ASHA)',
      hospitalId: 'hosp_hukumpeta_phc',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    unassignedAshaToken = signAccessToken({
      userId: unassignedAshaId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_asha_unasgn',
      deviceId: 'dev_asha_unasgn',
    });

    // Seed 4 Villages in Tribal Mandal
    await Village.create([
      {
        villageId: 'VIL-HUK-001',
        villageName: 'Kondapalli',
        mandal: 'Hukumpeta',
        panchayat: 'Kondapalli GP',
        tribalHabitation: 'Kondapalli Colony',
        hospitalId: 'hosp_hukumpeta_phc',
        censusCode: '584910',
        populationEstimated: 640,
        simulation: true,
      },
      {
        villageId: 'VIL-HUK-002',
        villageName: 'Ganthaguda',
        mandal: 'Hukumpeta',
        panchayat: 'Ganthaguda GP',
        tribalHabitation: 'Ganthaguda Old',
        hospitalId: 'hosp_hukumpeta_phc',
        censusCode: '584911',
        populationEstimated: 480,
        simulation: true,
      },
      {
        villageId: 'VIL-HUK-003',
        villageName: 'Pedda Garuvu',
        mandal: 'Hukumpeta',
        panchayat: 'Pedda Garuvu GP',
        tribalHabitation: 'Upper Garuvu',
        hospitalId: 'hosp_hukumpeta_phc',
        censusCode: '584912',
        populationEstimated: 820,
        simulation: true,
      },
      {
        villageId: 'VIL-ARA-001',
        villageName: 'Padmapuram',
        mandal: 'Araku Valley',
        panchayat: 'Padmapuram GP',
        tribalHabitation: 'Valley View',
        hospitalId: 'hosp_araku_area',
        censusCode: '584920',
        populationEstimated: 1100,
        simulation: true,
      },
    ]);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('HEALTH WORKER SCOPE IS EMPTY WITHOUT EXPLICIT ASSIGNMENT', async () => {
    // Unassigned ASHA requests village reference data: scope comes ONLY from explicit assignments!
    const res = await request(app)
      .get('/api/v1/reference/villages')
      .set('Authorization', `Bearer ${unassignedAshaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignedScopeOnly).toBe(true);
    expect(res.body.data.villages).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('allows Admin to explicitly assign villages to Health Worker', async () => {
    const res = await request(app)
      .post('/api/v1/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        workerId: ashaUserId,
        workerName: 'Lakshmi Devi',
        workerRole: 'asha',
        hospitalId: 'hosp_hukumpeta_phc',
        assignedMandal: 'Hukumpeta',
        assignedVillages: ['VIL-HUK-001', 'VIL-HUK-002'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignment.assignedVillages).toEqual(['VIL-HUK-001', 'VIL-HUK-002']);
  });

  it('SELF-APPROVAL BLOCKED: Admin cannot assign villages to themselves', async () => {
    const res = await request(app)
      .post('/api/v1/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        workerId: 'usr_admin_asgn', // Self assignment
        workerName: 'Admin Self',
        workerRole: 'anm',
        hospitalId: 'hosp_hukumpeta_phc',
        assignedMandal: 'Hukumpeta',
        assignedVillages: ['VIL-HUK-001'],
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_APPROVAL_BLOCKED');
  });

  it('HEALTH WORKER SEES ONLY ASSIGNED VILLAGES: strictly restricted to VIL-HUK-001 and VIL-HUK-002', async () => {
    const res = await request(app)
      .get('/api/v1/reference/villages')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assignedScopeOnly).toBe(true);
    expect(res.body.data.total).toBe(2);

    const villageIds = res.body.data.villages.map((v: any) => v.villageId);
    expect(villageIds).toContain('VIL-HUK-001');
    expect(villageIds).toContain('VIL-HUK-002');

    // Unassigned villages MUST NOT be visible to this ASHA worker!
    expect(villageIds).not.toContain('VIL-HUK-003');
    expect(villageIds).not.toContain('VIL-ARA-001');
  });

  it('allows Health Worker to view their own active assignment', async () => {
    const res = await request(app)
      .get(`/api/v1/assignments/worker/${ashaUserId}`)
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.assignment.assignedVillages).toEqual(['VIL-HUK-001', 'VIL-HUK-002']);
  });

  it('strictly blocks Health Worker from inspecting another worker assignments (403)', async () => {
    const res = await request(app)
      .get(`/api/v1/assignments/worker/${unassignedAshaId}`)
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
