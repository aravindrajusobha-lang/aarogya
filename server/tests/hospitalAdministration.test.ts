import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 3 Administration: Hospital Boundaries & Cross-Hospital Access Control', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let sysAdminToken: string;
  let hospAAdminToken: string;
  let hospBAdminToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsHospitalAdmin');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('AdminPass@2026');

    // System Admin (Universal scope)
    await User.create({
      userId: 'usr_sysadmin_hosp',
      username: 'sysadmin.hosp',
      role: 'system_admin',
      fullName: 'Regional System Admin',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    sysAdminToken = signAccessToken({
      userId: 'usr_sysadmin_hosp',
      role: 'system_admin',
      scopes: ['*'],
      deviceSessionId: 'ses_hosp_sys',
      deviceId: 'dev_hosp_sys',
    });

    // Hospital A (Paderu District Hospital)
    await Hospital.create({
      hospitalId: 'hosp_paderu_dh',
      name: 'Paderu District Hospital',
      type: 'district_hospital',
      district: 'Alluri Sitharama Raju',
      mandal: 'Paderu',
      jurisdictionVillages: ['VIL-PAD-001', 'VIL-PAD-002'],
      adminUserIds: ['usr_admin_hosp_a'],
      status: 'active',
      simulation: true,
    });

    await User.create({
      userId: 'usr_admin_hosp_a',
      username: 'admin.hosp_a',
      role: 'admin',
      fullName: 'Hospital A Administrator',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    hospAAdminToken = signAccessToken({
      userId: 'usr_admin_hosp_a',
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_hosp_a',
      deviceId: 'dev_hosp_a',
    });

    // Hospital B (Chintapalli Community Health Centre)
    await Hospital.create({
      hospitalId: 'hosp_chintapalli_chc',
      name: 'Chintapalli Community Health Centre',
      type: 'community_health_centre',
      district: 'Alluri Sitharama Raju',
      mandal: 'Chintapalli',
      jurisdictionVillages: ['VIL-CHIN-001'],
      adminUserIds: ['usr_admin_hosp_b'],
      status: 'active',
      simulation: true,
    });

    await User.create({
      userId: 'usr_admin_hosp_b',
      username: 'admin.hosp_b',
      role: 'admin',
      fullName: 'Hospital B Administrator',
      hospitalId: 'hosp_chintapalli_chc',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    hospBAdminToken = signAccessToken({
      userId: 'usr_admin_hosp_b',
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_hosp_b',
      deviceId: 'dev_hosp_b',
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('allows Hospital A Admin to manage Hospital A', async () => {
    const res = await request(app)
      .put('/api/v1/hospitals/hosp_paderu_dh')
      .set('Authorization', `Bearer ${hospAAdminToken}`)
      .send({
        name: 'Paderu District Hospital (Updated)',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hospital.name).toBe('Paderu District Hospital (Updated)');
  });

  it('CROSS-HOSPITAL ACCESS DENIED: Hospital A Admin attempting to modify Hospital B is blocked (403)', async () => {
    const res = await request(app)
      .put('/api/v1/hospitals/hosp_chintapalli_chc')
      .set('Authorization', `Bearer ${hospAAdminToken}`)
      .send({
        name: 'Malicious Cross-Hospital Overwrite',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');
  });

  it('CROSS-HOSPITAL ACCESS DENIED: Hospital B Admin attempting to inspect Hospital A details is blocked (403)', async () => {
    const res = await request(app)
      .get('/api/v1/hospitals/hosp_paderu_dh')
      .set('Authorization', `Bearer ${hospBAdminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CROSS_HOSPITAL_FORBIDDEN');
  });

  it('allows System Admin to update and inspect any hospital across the agency', async () => {
    const resA = await request(app)
      .get('/api/v1/hospitals/hosp_paderu_dh')
      .set('Authorization', `Bearer ${sysAdminToken}`);

    expect(resA.status).toBe(200);
    expect(resA.body.data.hospital.hospitalId).toBe('hosp_paderu_dh');

    const resB = await request(app)
      .get('/api/v1/hospitals/hosp_chintapalli_chc')
      .set('Authorization', `Bearer ${sysAdminToken}`);

    expect(resB.status).toBe(200);
    expect(resB.body.data.hospital.hospitalId).toBe('hosp_chintapalli_chc');
  });

  it('allows creating a new hospital with jurisdiction villages', async () => {
    const res = await request(app)
      .post('/api/v1/hospitals')
      .set('Authorization', `Bearer ${sysAdminToken}`)
      .send({
        hospitalId: 'hosp_araku_area',
        name: 'Araku Valley Area Hospital',
        type: 'area_hospital',
        mandal: 'Araku Valley',
        jurisdictionVillages: ['VIL-ARA-001', 'VIL-ARA-002'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hospital.hospitalId).toBe('hosp_araku_area');
  });
});
