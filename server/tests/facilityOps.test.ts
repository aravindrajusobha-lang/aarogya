import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { FacilityStockMovement } from '../src/modules/facility/facilityOpsModels.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

const H1 = 'hosp_ops_1';
const H2 = 'hosp_ops_2';

describe('Facility operations: facility admins, beds, medicine stock, equipment', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;
  let sysToken: string;
  let doctorToken: string;
  let facilityAdminToken = '';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsFacilityOps');
    await mongoose.connect(replSet.getUri());
    app = createApp();
    await Hospital.create([
      { hospitalId: H1, name: 'Ops Facility One', type: 'community_health_centre', district: 'ASR', mandal: 'Paderu' },
      { hospitalId: H2, name: 'Ops Facility Two', type: 'primary_health_centre', district: 'ASR', mandal: 'Araku' },
    ]);
    await User.create([
      { userId: 'ops_sys', username: 'ops_sys', fullName: 'System Admin', role: 'system_admin', passwordHash: 'x', status: 'active' },
      { userId: 'ops_doc', username: 'ops_doc', fullName: 'Dr Ops', role: 'medical_officer', hospitalId: H1, passwordHash: 'x', status: 'active', verificationStatus: 'verified' },
    ]);
    sysToken = signAccessToken({ userId: 'ops_sys', role: 'system_admin', scopes: getRoleCapabilities('system_admin') });
    doctorToken = signAccessToken({ userId: 'ops_doc', role: 'medical_officer', hospitalId: H1, scopes: getRoleCapabilities('medical_officer') });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('system admin creates a facility admin who can log in and manage only their facility', async () => {
    const created = await request(app).post(`/api/v1/facility-ops/${H1}/admins`).set('Authorization', `Bearer ${sysToken}`)
      .send({ fullName: 'Facility Admin One', phone: '+919000022233', username: 'fa.one', password: 'FacilityOne@2026' });
    expect(created.status).toBe(201);
    expect(created.body.data.credentials).toEqual({ loginId: 'fa.one', temporaryPassword: 'FacilityOne@2026' });

    const login = await request(app).post('/api/v1/auth/login').send({ username: 'fa.one', password: 'FacilityOne@2026' });
    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({ role: 'admin', hospitalId: H1 });
    facilityAdminToken = login.body.data.accessToken;

    expect((await request(app).get(`/api/v1/facility-ops/${H1}/overview`).set('Authorization', `Bearer ${facilityAdminToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/facility-ops/${H2}/overview`).set('Authorization', `Bearer ${facilityAdminToken}`)).status).toBe(403);
    // Facility admins cannot create other admins; doctors cannot manage facilities at all.
    expect((await request(app).post(`/api/v1/facility-ops/${H1}/admins`).set('Authorization', `Bearer ${facilityAdminToken}`).send({ fullName: 'Another Admin', phone: '+919000022234' })).status).toBe(403);
    expect((await request(app).get(`/api/v1/facility-ops/${H1}/wards`).set('Authorization', `Bearer ${doctorToken}`)).status).toBe(403);

    const reset = await request(app).post(`/api/v1/facility-ops/${H1}/admins/${created.body.data.admin.userId}/reset-password`).set('Authorization', `Bearer ${sysToken}`);
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/login').send({ username: 'fa.one', password: reset.body.data.credentials.temporaryPassword })).status).toBe(200);
  });

  it('tracks wards and beds with validation', async () => {
    const auth = { Authorization: `Bearer ${facilityAdminToken}` };
    const bad = await request(app).post(`/api/v1/facility-ops/${H1}/wards`).set(auth).send({ name: 'General Ward', totalBeds: 10, occupiedBeds: 12 });
    expect(bad.status).toBe(400);
    const ward = await request(app).post(`/api/v1/facility-ops/${H1}/wards`).set(auth).send({ name: 'General Ward', wardType: 'general', totalBeds: 20, occupiedBeds: 5 });
    expect(ward.status).toBe(201);
    const dup = await request(app).post(`/api/v1/facility-ops/${H1}/wards`).set(auth).send({ name: 'General Ward', totalBeds: 4 });
    expect(dup.status).toBe(409);
    const patched = await request(app).patch(`/api/v1/facility-ops/${H1}/wards/${ward.body.data.ward.wardId}`).set(auth).send({ occupiedBeds: 18 });
    expect(patched.body.data.ward.occupiedBeds).toBe(18);
    expect((await request(app).patch(`/api/v1/facility-ops/${H1}/wards/${ward.body.data.ward.wardId}`).set(auth).send({ occupiedBeds: 25 })).status).toBe(400);
  });

  it('keeps an audited medicine stock register that never goes negative', async () => {
    const auth = { Authorization: `Bearer ${facilityAdminToken}` };
    const med = await request(app).post(`/api/v1/facility-ops/${H1}/medicines`).set(auth).send({ name: 'Chlorhexidine mouthwash', form: 'mouthwash', strength: '0.2%', unit: 'bottles', stock: 30, reorderLevel: 10, expiryDate: '2027-06-30' });
    expect(med.status).toBe(201);
    const itemId = med.body.data.medicine.itemId;
    const out = await request(app).post(`/api/v1/facility-ops/${H1}/medicines/${itemId}/stock`).set(auth).send({ quantity: 25, direction: 'out', reason: 'dispensed', note: 'OPD issue' });
    expect(out.body.data.medicine.stock).toBe(5);
    const tooMuch = await request(app).post(`/api/v1/facility-ops/${H1}/medicines/${itemId}/stock`).set(auth).send({ quantity: 6, direction: 'out', reason: 'dispensed' });
    expect(tooMuch.status).toBe(409);
    expect((await request(app).post(`/api/v1/facility-ops/${H1}/medicines/${itemId}/stock`).set(auth).send({ quantity: 6, direction: 'in', reason: 'dispensed' })).status).toBe(400);
    await request(app).post(`/api/v1/facility-ops/${H1}/medicines/${itemId}/stock`).set(auth).send({ quantity: 50, direction: 'in', reason: 'received' });
    const movements = await request(app).get(`/api/v1/facility-ops/${H1}/medicines/${itemId}/movements`).set(auth);
    expect(movements.body.data.movements.map((m: any) => m.balanceAfter)).toEqual([55, 5, 30]);
    expect(await FacilityStockMovement.countDocuments({ itemId })).toBe(3);
  });

  it('tracks equipment and summarises the facility', async () => {
    const auth = { Authorization: `Bearer ${facilityAdminToken}` };
    expect((await request(app).post(`/api/v1/facility-ops/${H1}/equipment`).set(auth).send({ name: 'Dental chair', category: 'dental', quantity: 2, functionalCount: 3 })).status).toBe(400);
    expect((await request(app).post(`/api/v1/facility-ops/${H1}/equipment`).set(auth).send({ name: 'Dental chair', category: 'dental', quantity: 3, functionalCount: 2 })).status).toBe(201);
    const overview = await request(app).get(`/api/v1/facility-ops/${H1}/overview`).set(auth);
    expect(overview.body.data).toMatchObject({
      beds: { total: 20, occupied: 18, wards: 1 },
      medicines: { items: 1, lowStock: 0 },
      equipment: { items: 1, units: 3, needsRepair: 1 },
      staff: { doctorsVerified: 1, facilityAdmins: 1 },
    });
  });
});
