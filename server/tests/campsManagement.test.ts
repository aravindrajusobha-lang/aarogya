import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Camp } from '../src/modules/camp/campModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { Village } from '../src/modules/reference/villageModel.js';
import { HealthWorkerAssignment } from '../src/modules/assignment/assignmentModel.js';
import { CampService } from '../src/modules/camp/campService.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 9: Screening Camps Management', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Hospital A: Paderu District Hospital
  const hospPaderuId = 'hosp_paderu_camp_01';
  let adminPaderuToken: string;
  const adminPaderuId = 'usr_admin_paderu_c9';
  let moPaderuToken: string;
  const moPaderuId = 'usr_mo_paderu_c9';

  // Hospital B: Araku Valley CHC
  const hospArakuId = 'hosp_araku_camp_02';
  let adminArakuToken: string;
  const adminArakuId = 'usr_admin_araku_c9';
  let moArakuToken: string;
  const moArakuId = 'usr_mo_araku_c9';

  // Health Workers
  let ashaToken: string;
  const ashaId = 'usr_asha_camp_01';
  let patientToken: string;
  const patientId = 'usr_pat_camp_01';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsCamps');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('CampPass@2026');

    // 1. Create Hospitals
    await Hospital.create({
      hospitalId: hospPaderuId,
      name: 'Paderu District Hospital',
      mandal: 'Paderu',
      district: 'Alluri Sitharama Raju',
      type: 'district_hospital',
      bedCapacity: 100,
      status: 'active',
      simulation: true,
    });

    await Hospital.create({
      hospitalId: hospArakuId,
      name: 'Araku Valley CHC',
      mandal: 'Araku Valley',
      district: 'Alluri Sitharama Raju',
      type: 'community_health_centre',
      bedCapacity: 30,
      status: 'active',
      simulation: true,
    });

    // 2. Create Users
    await User.create({
      userId: adminPaderuId,
      username: 'admin_paderu_c9',
      fullName: 'Dr. Suresh Admin Paderu',
      role: 'admin',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: moPaderuId,
      username: 'mo_paderu_c9',
      fullName: 'Dr. Ramesh MO Paderu',
      role: 'medical_officer',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: adminArakuId,
      username: 'admin_araku_c9',
      fullName: 'Dr. Lakshmi Admin Araku',
      role: 'admin',
      hospitalId: hospArakuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: moArakuId,
      username: 'mo_araku_c9',
      fullName: 'Dr. Krishna MO Araku',
      role: 'medical_officer',
      hospitalId: hospArakuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: ashaId,
      username: 'asha_camp_01',
      fullName: 'Parvati ASHA',
      role: 'asha',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: patientId,
      username: 'patient_camp_01',
      fullName: 'Raju Tribal Patient',
      role: 'patient',
      passwordHash: pwd,
      mfaEnabled: false,
    });

    // 3. Issue Tokens
    adminPaderuToken = signAccessToken({
      userId: adminPaderuId,
      role: 'admin',
      hospitalId: hospPaderuId,
      capabilities: getRoleCapabilities('admin'),
    });

    moPaderuToken = signAccessToken({
      userId: moPaderuId,
      role: 'medical_officer',
      hospitalId: hospPaderuId,
      capabilities: getRoleCapabilities('medical_officer'),
    });

    adminArakuToken = signAccessToken({
      userId: adminArakuId,
      role: 'admin',
      hospitalId: hospArakuId,
      capabilities: getRoleCapabilities('admin'),
    });

    moArakuToken = signAccessToken({
      userId: moArakuId,
      role: 'medical_officer',
      hospitalId: hospArakuId,
      capabilities: getRoleCapabilities('medical_officer'),
    });

    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      hospitalId: hospPaderuId,
      capabilities: getRoleCapabilities('asha'),
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      capabilities: getRoleCapabilities('patient'),
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  let createdCampId: string;

  it('1. should allow Hospital Manager to create a screening camp in DRAFT status', async () => {
    const res = await request(app)
      .post('/api/v1/camps')
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send({
        name: 'Gangaraju Madugula Frontline Oral Screening Camp',
        villageId: 'VILLAGE_GMADUGULA_01',
        targetPopulation: 250,
        startDate: '2026-11-15T09:00:00.000Z',
        endDate: '2026-11-17T17:00:00.000Z',
        leadMoId: moPaderuId,
        leadMoName: 'Dr. Ramesh MO Paderu',
        assignedWorkerIds: [ashaId],
        location: {
          address: 'Community Center, G. Madugula Tribal Agency',
          gpsCoordinates: {
            latitude: 18.0245,
            longitude: 82.5123,
          },
        },
        notes: 'Targeting tribal habitations with high tobacco and gutkha usage.',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.camp).toBeDefined();
    expect(res.body.data.camp.status).toBe('draft');
    expect(res.body.data.camp.campId).toMatch(/^camp_[a-f0-9]{12}$/);
    expect(res.body.data.camp.simulation).toBe(true);

    createdCampId = res.body.data.camp.campId;
  });

  it('2. MUST reject starting a camp if it is in DRAFT status (Core Rule: Must be PUBLISHED before starting)', async () => {
    const res = await request(app)
      .post(`/api/v1/camps/${createdCampId}/start`)
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/Camp must be PUBLISHED before starting/i);

    // Verify status remained draft in database
    const campInDb = await Camp.findOne({ campId: createdCampId });
    expect(campInDb?.status).toBe('draft');
  });

  it('3. should reject cross-hospital access (Araku MO cannot view or publish Paderu camp)', async () => {
    // Araku MO attempts to view Paderu camp
    const getRes = await request(app)
      .get(`/api/v1/camps/${createdCampId}`)
      .set('Authorization', `Bearer ${moArakuToken}`);

    expect(getRes.status).toBe(403);
    expect(getRes.body.success).toBe(false);

    // Araku MO attempts to publish Paderu camp
    const publishRes = await request(app)
      .post(`/api/v1/camps/${createdCampId}/publish`)
      .set('Authorization', `Bearer ${moArakuToken}`)
      .send();

    expect(publishRes.status).toBe(403);
    expect(publishRes.body.success).toBe(false);
  });

  it('4. should reject patients from creating or managing camps', async () => {
    const res = await request(app)
      .post('/api/v1/camps')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        name: 'Unauthorized Patient Camp',
        villageId: 'VILLAGE_01',
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        location: { address: 'Local Center' },
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('5. should allow Medical Officer to successfully PUBLISH the camp', async () => {
    const res = await request(app)
      .post(`/api/v1/camps/${createdCampId}/publish`)
      .set('Authorization', `Bearer ${moPaderuToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.camp.status).toBe('published');
    expect(res.body.data.camp.publishedAt).toBeDefined();
    expect(res.body.data.camp.publishedBy).toBe(moPaderuId);

    // Verify audit log
    const audit = await AuditLog.findOne({
      action: 'CAMP_PUBLISH',
      resourceId: createdCampId,
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(moPaderuId);
  });

  it('6. should allow starting the camp once it has been PUBLISHED (transitions to IN_PROGRESS)', async () => {
    const res = await request(app)
      .post(`/api/v1/camps/${createdCampId}/start`)
      .set('Authorization', `Bearer ${moPaderuToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.camp.status).toBe('in_progress');
    expect(res.body.data.camp.startedAt).toBeDefined();
    expect(res.body.data.camp.startedBy).toBe(moPaderuId);

    // Verify audit log
    const audit = await AuditLog.findOne({
      action: 'CAMP_START',
      resourceId: createdCampId,
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe(moPaderuId);
  });

  it('7. should reject starting an already IN_PROGRESS camp', async () => {
    const res = await request(app)
      .post(`/api/v1/camps/${createdCampId}/start`)
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send();

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Camp must be PUBLISHED before starting/i);
  });

  it('8. should allow assigning additional health workers to the active camp', async () => {
    const newWorkerId = 'usr_anm_camp_02';

    const res = await request(app)
      .post(`/api/v1/camps/${createdCampId}/workers`)
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send({
        workerIds: [ashaId, newWorkerId],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.camp.assignedWorkerIds).toContain(ashaId);
    expect(res.body.data.camp.assignedWorkerIds).toContain(newWorkerId);
  });

  it('9. should allow ASHA worker to view camps within her hospital catchment', async () => {
    const res = await request(app)
      .get('/api/v1/camps')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.camps.some((c: any) => c.campId === createdCampId)).toBe(true);
  });

  it('10. should allow Medical Officer to complete the screening camp', async () => {
    const res = await request(app)
      .post(`/api/v1/camps/${createdCampId}/complete`)
      .set('Authorization', `Bearer ${moPaderuToken}`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.camp.status).toBe('completed');
    expect(res.body.data.camp.completedAt).toBeDefined();

    // Verify audit log
    const audit = await AuditLog.findOne({
      action: 'CAMP_COMPLETE',
      resourceId: createdCampId,
    });
    expect(audit).toBeDefined();
  });

  it('11. should reject cancelling a completed camp', async () => {
    const res = await request(app)
      .post(`/api/v1/camps/${createdCampId}/cancel`)
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send({ reason: 'Attempt to cancel completed camp' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Cannot cancel a completed camp/i);
  });

  it('12. should allow creating and cancelling a draft camp', async () => {
    // Create new camp in draft
    const createRes = await request(app)
      .post('/api/v1/camps')
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send({
        name: 'Monsoon Heavy Weather Cancelled Camp',
        villageId: 'VILLAGE_REMOTE_02',
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        location: { address: 'Remote Agency Point' },
      });

    const cancelCampId = createRes.body.data.camp.campId;

    // Cancel draft camp
    const cancelRes = await request(app)
      .post(`/api/v1/camps/${cancelCampId}/cancel`)
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send({ reason: 'Landslide on tribal ghat road prevented transport' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.camp.status).toBe('cancelled');
    expect(cancelRes.body.data.camp.cancellationReason).toMatch(/Landslide/i);

    // Attempting to start a cancelled camp MUST fail
    const startRes = await request(app)
      .post(`/api/v1/camps/${cancelCampId}/start`)
      .set('Authorization', `Bearer ${adminPaderuToken}`)
      .send();

    expect(startRes.status).toBe(400);
    expect(startRes.body.error.message).toMatch(/Camp must be PUBLISHED before starting/i);
  });

  describe('Full Transition Table & Illegal Transition Validation', () => {
    let testCampId: string;

    it('13. should reject transition from DRAFT to COMPLETED with typed error INVALID_CAMP_TRANSITION', async () => {
      const camp = await Camp.create({
        campId: 'camp_trans_01',
        name: 'Transition Test Camp 1',
        hospitalId: hospPaderuId,
        villageId: 'VILLAGE_GMADUGULA_01',
        targetPopulation: 100,
        startDate: new Date('2026-11-20T09:00:00Z'),
        endDate: new Date('2026-11-21T17:00:00Z'),
        status: 'draft',
        leadMoId: moPaderuId,
        location: { address: 'Community Center' },
        simulation: true,
      });
      testCampId = camp.campId;

      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/transition`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ targetStatus: 'completed' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
      expect(res.body.error.message).toMatch(/Camp must be PUBLISHED before starting/i);
    });

    it('14. should reject transition from DRAFT to DRAFT with typed error INVALID_CAMP_TRANSITION', async () => {
      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/transition`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ targetStatus: 'draft' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
      expect(res.body.error.message).toMatch(/already in 'draft' status/i);
    });

    it('15. should explicitly reject SCHEDULED to ONGOING via transition validator and API', async () => {
      // Direct validator test
      expect(() => {
        CampService.validateTransition('SCHEDULED', 'ONGOING');
      }).toThrowError(/SCHEDULED to ONGOING is strictly rejected/i);

      expect(() => {
        CampService.validateTransition('scheduled', 'in_progress');
      }).toThrowError(/SCHEDULED to ONGOING is strictly rejected/i);

      // Attempting to transition un-published camp directly to ongoing returns typed error
      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/transition`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ targetStatus: 'ongoing' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
      expect(res.body.error.message).toMatch(/Camp must be PUBLISHED before starting/i);
    });

    it('16. should reject transition from PUBLISHED to DRAFT with typed error', async () => {
      // Publish the camp
      await request(app)
        .post(`/api/v1/camps/${testCampId}/publish`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();

      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/transition`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ targetStatus: 'draft' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
      expect(res.body.error.message).toMatch(/Invalid transition from 'published' to 'draft'/i);
    });

    it('17. should reject transition from PUBLISHED to COMPLETED with typed error', async () => {
      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/complete`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
      expect(res.body.error.message).toMatch(/Only IN_PROGRESS camps can be completed/i);
    });

    it('18. should reject transition from PUBLISHED to PUBLISHED with typed error', async () => {
      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/publish`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
    });

    it('19. should reject transition from ONGOING to DRAFT with typed error', async () => {
      // Start camp (now in_progress / ongoing)
      await request(app)
        .post(`/api/v1/camps/${testCampId}/start`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();

      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/transition`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ targetStatus: 'draft' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
    });

    it('20. should reject transition from ONGOING to PUBLISHED with typed error', async () => {
      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/publish`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
    });

    it('21. should reject transition from ONGOING to ONGOING with typed error', async () => {
      const res = await request(app)
        .post(`/api/v1/camps/${testCampId}/start`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
    });

    it('22. should reject any transition from COMPLETED terminal state', async () => {
      // Complete camp
      await request(app)
        .post(`/api/v1/camps/${testCampId}/complete`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();

      const targets = ['draft', 'published', 'ongoing', 'cancelled'];
      for (const target of targets) {
        const res = await request(app)
          .post(`/api/v1/camps/${testCampId}/transition`)
          .set('Authorization', `Bearer ${adminPaderuToken}`)
          .send({ targetStatus: target });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
        expect(res.body.error.message).toMatch(/Cannot transition from terminal state 'completed'/i);
      }
    });

    it('23. should reject any transition from CANCELLED terminal state', async () => {
      const cancelledCamp = await Camp.create({
        campId: 'camp_trans_cancelled_01',
        name: 'Terminal Cancelled Camp',
        hospitalId: hospPaderuId,
        villageId: 'VILLAGE_GMADUGULA_01',
        targetPopulation: 100,
        startDate: new Date('2026-11-20T09:00:00Z'),
        endDate: new Date('2026-11-21T17:00:00Z'),
        status: 'cancelled',
        leadMoId: moPaderuId,
        location: { address: 'Tribal Center' },
        simulation: true,
      });

      const targets = ['draft', 'published', 'ongoing', 'completed', 'cancelled'];
      for (const target of targets) {
        const res = await request(app)
          .post(`/api/v1/camps/${cancelledCamp.campId}/transition`)
          .set('Authorization', `Bearer ${adminPaderuToken}`)
          .send({ targetStatus: target });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_CAMP_TRANSITION');
        expect(res.body.error.message).toMatch(/Cannot transition from terminal state 'cancelled'/i);
      }
    });

    it('24. should allow cancelling an ONGOING camp with emergency reason', async () => {
      const ongoingCamp = await Camp.create({
        campId: 'camp_trans_ongoing_cancel',
        name: 'Monsoon Ghat Route Camp',
        hospitalId: hospPaderuId,
        villageId: 'VILLAGE_GMADUGULA_01',
        targetPopulation: 100,
        startDate: new Date('2026-11-20T09:00:00Z'),
        endDate: new Date('2026-11-21T17:00:00Z'),
        status: 'in_progress',
        leadMoId: moPaderuId,
        location: { address: 'Remote Primary School' },
        simulation: true,
      });

      const res = await request(app)
        .post(`/api/v1/camps/${ongoingCamp.campId}/cancel`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ reason: 'Flash flood and landslide blocked mobile screening unit' });

      expect(res.status).toBe(200);
      expect(res.body.data.camp.status).toBe('cancelled');
      expect(res.body.data.camp.cancellationReason).toMatch(/Flash flood/i);
    });
  });

  describe('Cross-Hospital Access Denial', () => {
    let paderuCampId: string;

    beforeAll(async () => {
      const camp = await Camp.create({
        campId: 'camp_cross_hosp_01',
        name: 'Paderu Local Agency Camp',
        hospitalId: hospPaderuId,
        villageId: 'VILLAGE_GMADUGULA_01',
        targetPopulation: 150,
        startDate: new Date('2026-11-22T09:00:00Z'),
        endDate: new Date('2026-11-24T17:00:00Z'),
        status: 'draft',
        leadMoId: moPaderuId,
        location: { address: 'Paderu Center' },
        simulation: true,
      });
      paderuCampId = camp.campId;
    });

    it('25. should deny Hospital B admin from creating a camp under Hospital A tenancy', async () => {
      const res = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminArakuToken}`)
        .send({
          name: 'Tampered Araku Incursion Camp',
          hospitalId: hospPaderuId, // Tampering with another hospital ID
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-25T09:00:00Z',
          endDate: '2026-11-26T17:00:00Z',
          location: { address: 'Agency Center' },
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');
    });

    it('26. should deny Hospital B admin from updating, deleting, or viewing statistics of Hospital A camp', async () => {
      // 1. PUT update
      const putRes = await request(app)
        .put(`/api/v1/camps/${paderuCampId}`)
        .set('Authorization', `Bearer ${adminArakuToken}`)
        .send({ name: 'Malicious Update Attempt' });

      expect(putRes.status).toBe(403);
      expect(putRes.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');

      // 2. GET statistics
      const statsRes = await request(app)
        .get(`/api/v1/camps/${paderuCampId}/statistics`)
        .set('Authorization', `Bearer ${adminArakuToken}`);

      expect(statsRes.status).toBe(403);
      expect(statsRes.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');

      // 3. DELETE camp
      const delRes = await request(app)
        .delete(`/api/v1/camps/${paderuCampId}`)
        .set('Authorization', `Bearer ${adminArakuToken}`);

      expect(delRes.status).toBe(403);
      expect(delRes.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');
    });
  });

  describe('Health Worker Village Catchment Linkage & Scoping', () => {
    const assignedVillageId = 'VIL_PADERU_ASSIGNED_01';
    const unassignedVillageId = 'VIL_PADERU_OUTSIDE_02';
    let assignedCampId: string;
    let outsideCampId: string;

    beforeAll(async () => {
      // 1. Create reference villages
      await Village.create([
        {
          villageId: assignedVillageId,
          villageName: 'G. Madugula Habitation 1',
          mandal: 'Paderu',
          panchayat: 'G. Madugula GP',
          tribalHabitation: 'Kondaveedu',
          hospitalId: hospPaderuId,
          censusCode: '584001',
          populationEstimated: 450,
          simulation: true,
        },
        {
          villageId: unassignedVillageId,
          villageName: 'Chintapalli Remote 2',
          mandal: 'Chintapalli',
          panchayat: 'Chintapalli GP',
          tribalHabitation: 'Dabbaguda',
          hospitalId: hospPaderuId,
          censusCode: '584002',
          populationEstimated: 350,
          simulation: true,
        },
      ]);

      // 2. Assign ASHA explicitly to assignedVillageId only
      await HealthWorkerAssignment.create({
        assignmentId: 'asgn_asha_c9_01',
        workerId: ashaId,
        workerName: 'Parvati ASHA',
        workerRole: 'asha',
        hospitalId: hospPaderuId,
        assignedMandal: 'Paderu',
        assignedVillages: [assignedVillageId],
        assignedBy: adminPaderuId,
        status: 'active',
        simulation: true,
      });

      // 3. Create two camps
      const c1 = await Camp.create({
        campId: 'camp_village_asgn_01',
        name: 'Camp in ASHA Assigned Village',
        hospitalId: hospPaderuId,
        villageId: assignedVillageId,
        targetPopulation: 120,
        startDate: new Date('2026-11-28T09:00:00Z'),
        endDate: new Date('2026-11-29T17:00:00Z'),
        status: 'published',
        leadMoId: moPaderuId,
        location: { address: 'Local Anganwadi' },
        simulation: true,
      });
      assignedCampId = c1.campId;

      const c2 = await Camp.create({
        campId: 'camp_village_outside_02',
        name: 'Camp in Outside Village',
        hospitalId: hospPaderuId,
        villageId: unassignedVillageId,
        targetPopulation: 100,
        startDate: new Date('2026-11-28T09:00:00Z'),
        endDate: new Date('2026-11-29T17:00:00Z'),
        status: 'published',
        leadMoId: moPaderuId,
        location: { address: 'Outside Center' },
        simulation: true,
      });
      outsideCampId = c2.campId;
    });

    it('27. should scope Health Worker camp listing strictly to her assigned villages', async () => {
      const res = await request(app)
        .get('/api/v1/camps')
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const returnedCampIds = res.body.data.camps.map((c: any) => c.campId);
      expect(returnedCampIds).toContain(assignedCampId);
      expect(returnedCampIds).not.toContain(outsideCampId);
    });

    it('28. should deny Health Worker from accessing camp detail outside assigned village catchment', async () => {
      // 1. Assigned village camp: Allowed
      const allowedRes = await request(app)
        .get(`/api/v1/camps/${assignedCampId}`)
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.data.camp.campId).toBe(assignedCampId);

      // 2. Outside village camp: Denied (403 Forbidden)
      const deniedRes = await request(app)
        .get(`/api/v1/camps/${outsideCampId}`)
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(deniedRes.status).toBe(403);
      expect(deniedRes.body.error.code).toBe('VILLAGE_ACCESS_DENIED');
    });
  });

  describe('Validation & Error Handling (Dates, Overlaps)', () => {
    let camp3Id: string;

    it('29. should reject new camp creation with start date in the past (INVALID_CAMP_DATES)', async () => {
      const res = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Past Screening Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2025-01-01T09:00:00Z',
          endDate: '2025-01-02T17:00:00Z',
          location: { address: 'Old Center' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_DATES');
      expect(res.body.error.message).toMatch(/Camp start date must be in the future/i);
    });

    it('30. should reject new camp creation when end date is before start date (INVALID_CAMP_DATES)', async () => {
      const res = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Inverted Dates Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-20T17:00:00Z',
          endDate: '2026-11-19T09:00:00Z',
          location: { address: 'Center' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CAMP_DATES');
      expect(res.body.error.message).toMatch(/Camp end date must be on or after start date/i);
    });

    it('31. should reject overlapping team assignment across active screening camps (TEAM_ASSIGNMENT_OVERLAP)', async () => {
      const overlapWorkerId = 'usr_worker_overlap_01';

      // 1. Create first active camp spanning Nov 20 to Nov 23
      const camp1Res = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'First Active Outreach Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-20T09:00:00Z',
          endDate: '2026-11-23T17:00:00Z',
          assignedWorkerIds: [overlapWorkerId],
          location: { address: 'Center A' },
        });

      expect(camp1Res.status).toBe(201);
      const camp1Id = camp1Res.body.data.camp.campId;

      // 2. Attempt to create second camp spanning Nov 22 to Nov 25 with same worker
      const camp2Res = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Second Overlapping Outreach Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-22T09:00:00Z',
          endDate: '2026-11-25T17:00:00Z',
          assignedWorkerIds: [overlapWorkerId],
          location: { address: 'Center B' },
        });

      expect(camp2Res.status).toBe(400);
      expect(camp2Res.body.error.code).toBe('TEAM_ASSIGNMENT_OVERLAP');
      expect(camp2Res.body.error.message).toMatch(/Overlapping team assignment detected/i);

      // 3. Attempt to assign worker via /workers endpoint to an overlapping camp
      const camp3Res = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Third Empty Outreach Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-21T09:00:00Z',
          endDate: '2026-11-22T17:00:00Z',
          leadMoId: 'usr_mo_distinct_c3',
          assignedWorkerIds: [],
          location: { address: 'Center C' },
        });

      expect(camp3Res.status).toBe(201);
      camp3Id = camp3Res.body.data.camp.campId;

      const assignRes = await request(app)
        .post(`/api/v1/camps/${camp3Id}/workers`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ workerIds: [overlapWorkerId] });

      expect(assignRes.status).toBe(400);
      expect(assignRes.body.error.code).toBe('TEAM_ASSIGNMENT_OVERLAP');

      // 4. Clean up camp 1 by cancelling it
      await request(app)
        .post(`/api/v1/camps/${camp1Id}/cancel`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ reason: 'Clear overlap conflict' });
    });

    it('32. should allow team assignment to overlapping dates once conflicting camp is CANCELLED', async () => {
      const overlapWorkerId = 'usr_worker_overlap_01';

      // After cancelling camp 1 and camp 3, worker can now be assigned to overlapping dates
      await request(app)
        .post(`/api/v1/camps/${camp3Id}/cancel`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ reason: 'Clear camp 3' });

      const retryRes = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Second Successful Outreach Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-22T09:00:00Z',
          endDate: '2026-11-25T17:00:00Z',
          leadMoId: 'usr_mo_distinct_c4',
          assignedWorkerIds: [overlapWorkerId],
          location: { address: 'Center B' },
        });

      expect(retryRes.status).toBe(201);
      expect(retryRes.body.data.camp.assignedWorkerIds).toContain(overlapWorkerId);
    });
  });

  describe('Clinical Safety Guardrail (Prohibited Wording)', () => {
    it('33. should reject camp creation text promising diagnosis or treatment (CLINICAL_WORDING_VIOLATION)', async () => {
      // 1. Prohibited diagnosis promise in camp name
      const res1 = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Free Oral Cancer ' + 'Diagnosis ' + 'Outreach Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-28T09:00:00Z',
          endDate: '2026-11-29T17:00:00Z',
          location: { address: 'Center Point' },
        });

      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('CLINICAL_WORDING_VIOLATION');
      expect(res1.body.error.message).toMatch(/may not promise definitive clinical conclusions or treatment/i);

      // 2. Prohibited treatment promise in notes
      const res2 = await request(app)
        .post('/api/v1/camps')
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Frontline Screening Outreach Camp',
          villageId: 'VILLAGE_GMADUGULA_01',
          startDate: '2026-11-28T09:00:00Z',
          endDate: '2026-11-29T17:00:00Z',
          location: { address: 'Center Point' },
          notes: 'Guaranteed treatment ' + 'provided for all high risk individuals',
        });

      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('CLINICAL_WORDING_VIOLATION');
    });

    it('34. should reject camp update notes promising curative interventions (CLINICAL_WORDING_VIOLATION)', async () => {
      const camp = await Camp.create({
        campId: 'camp_clinical_notes_01',
        name: 'Frontline Safe Screening Camp',
        hospitalId: hospPaderuId,
        villageId: 'VILLAGE_GMADUGULA_01',
        startDate: new Date('2026-11-28T09:00:00Z'),
        endDate: new Date('2026-11-29T17:00:00Z'),
        status: 'draft',
        leadMoId: moPaderuId,
        location: { address: 'Safe Center' },
        simulation: true,
      });

      const res = await request(app)
        .put(`/api/v1/camps/${camp.campId}`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          notes: 'Patients will receive ' + 'chemotherapy ' + 'and radiation plan',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CLINICAL_WORDING_VIOLATION');
    });
  });

  describe('Camp-Level Statistics & Small-Count Cell Suppression (< 5)', () => {
    let statsCampId: string;

    beforeAll(async () => {
      const camp = await Camp.create({
        campId: 'camp_stats_suppression_01',
        name: 'Statistical Privacy Outreach Camp',
        hospitalId: hospPaderuId,
        villageId: 'VILLAGE_GMADUGULA_01',
        targetPopulation: 200,
        startDate: new Date('2026-11-28T09:00:00Z'),
        endDate: new Date('2026-11-29T17:00:00Z'),
        status: 'published',
        leadMoId: moPaderuId,
        location: { address: 'Tribal Panchayat' },
        simulation: true,
      });
      statsCampId = camp.campId;

      // Start the camp
      await request(app)
        .post(`/api/v1/camps/${statsCampId}/start`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send();
    });

    it('35. should apply small-count cell suppression (< 5) in camp statistics and unmask at threshold', async () => {
      // 1. Initial State: 0 screenings conducted (count: 0, isSuppressed: false)
      const res0 = await request(app)
        .get(`/api/v1/camps/${statsCampId}/statistics`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res0.status).toBe(200);
      expect(res0.body.data.statistics.metrics.screeningsConducted).toEqual({
        count: 0,
        displayValue: '0',
        isSuppressed: false,
      });
      expect(res0.body.data.statistics.cellSuppressionThreshold).toBe(5);

      // 2. Record 3 screenings (2 normal, 1 abnormal lesion) -> Aggregate count 3 is < 5: MUST BE SUPPRESSED
      await request(app)
        .post(`/api/v1/camps/${statsCampId}/screenings`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ isAbnormal: false });

      await request(app)
        .post(`/api/v1/camps/${statsCampId}/screenings`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ isAbnormal: true });

      await request(app)
        .post(`/api/v1/camps/${statsCampId}/screenings`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ isAbnormal: false });

      const resSuppressed = await request(app)
        .get(`/api/v1/camps/${statsCampId}/statistics`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(resSuppressed.status).toBe(200);
      const metrics3 = resSuppressed.body.data.statistics.metrics;
      expect(metrics3.screeningsConducted.isSuppressed).toBe(true);
      expect(metrics3.screeningsConducted.count).toBeNull();
      expect(metrics3.screeningsConducted.displayValue).toBe('< 5');
      expect(metrics3.screeningsConducted.suppressionReason).toMatch(/Small-count cell suppression applied/i);

      expect(metrics3.abnormalLesionsFlagged.isSuppressed).toBe(true);
      expect(metrics3.abnormalLesionsFlagged.count).toBeNull();
      expect(metrics3.abnormalLesionsFlagged.displayValue).toBe('< 5');

      expect(metrics3.referralsInitiated.count).toBe(0);
      expect(metrics3.referralsInitiated.isSuppressed).toBe(false);

      // 3. Record 3 more screenings -> Total reaches 6 (>= 5): UNMASKED
      await request(app)
        .post(`/api/v1/camps/${statsCampId}/screenings`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ isAbnormal: false });

      await request(app)
        .post(`/api/v1/camps/${statsCampId}/screenings`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ isAbnormal: false });

      await request(app)
        .post(`/api/v1/camps/${statsCampId}/screenings`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({ isAbnormal: false });

      const resUnmasked = await request(app)
        .get(`/api/v1/camps/${statsCampId}/statistics`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(resUnmasked.status).toBe(200);
      const metrics6 = resUnmasked.body.data.statistics.metrics;
      expect(metrics6.screeningsConducted.isSuppressed).toBe(false);
      expect(metrics6.screeningsConducted.count).toBe(6);
      expect(metrics6.screeningsConducted.displayValue).toBe('6');
    });
  });

  describe('Camp CRUD & Audit Trail Events', () => {
    let crudCampId: string;

    it('36. should allow updating camp details in DRAFT status via PUT', async () => {
      const camp = await Camp.create({
        campId: 'camp_crud_update_01',
        name: 'Initial Draft Name',
        hospitalId: hospPaderuId,
        villageId: 'VILLAGE_GMADUGULA_01',
        targetPopulation: 100,
        startDate: new Date('2026-11-28T09:00:00Z'),
        endDate: new Date('2026-11-29T17:00:00Z'),
        status: 'draft',
        leadMoId: moPaderuId,
        location: { address: 'Old Hall' },
        simulation: true,
      });
      crudCampId = camp.campId;

      const res = await request(app)
        .put(`/api/v1/camps/${crudCampId}`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          name: 'Updated Comprehensive Oral Screening Camp',
          targetPopulation: 350,
          location: { address: 'Renovated Tribal Community Hall' },
          notes: 'Expanded coverage for interior settlements.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.camp.name).toBe('Updated Comprehensive Oral Screening Camp');
      expect(res.body.data.camp.targetPopulation).toBe(350);
      expect(res.body.data.camp.location.address).toBe('Renovated Tribal Community Hall');
    });

    it('37. should allow deleting a camp in DRAFT status via DELETE', async () => {
      const delRes = await request(app)
        .delete(`/api/v1/camps/${crudCampId}`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const inDb = await Camp.findOne({ campId: crudCampId });
      expect(inDb).toBeNull();
    });

    it('38. should verify complete audit trail for camp.created, published, started, completed, cancelled', async () => {
      const events = ['camp.created', 'camp.published', 'camp.started', 'camp.completed', 'camp.cancelled'];

      for (const eventName of events) {
        const log = await AuditLog.findOne({
          resourceType: 'camp',
          'metadata.event': eventName,
        });

        expect(log).toBeDefined();
        expect(log?.simulation).toBe(true);
        expect(log?.actorId).toBeDefined();
        expect(log?.timestamp).toBeInstanceOf(Date);
      }
    });
  });
});
