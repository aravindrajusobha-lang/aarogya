import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { runMasterSeed } from '../src/modules/seed/masterSeed.js';
import { User } from '../src/modules/auth/userModel.js';
import { createDeviceSession } from '../src/modules/auth/deviceService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 20: Comprehensive System Smoke Test (All Functional Modules)', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();
  let sysadminToken: string;
  let adminToken: string;
  let moToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsSmokeTest');
    const uri = replSet.getUri();
    await mongoose.connect(uri);

    // Bootstrap all demo entities
    await runMasterSeed();

    const sysUser = (await User.findOne({ username: 'sysadmin.itda' }))!;
    const adminUser = (await User.findOne({ username: 'admin.paderu' }))!;
    const moUser = (await User.findOne({ username: 'doctor.paderu' }))!;

    const s1 = await createDeviceSession({
      user: sysUser,
      deviceId: 'dev_smoke_sys',
      deviceName: 'System Smoke Runner',
      userAgent: 'Automated-Test',
      ip: '127.0.0.1',
    });
    sysadminToken = s1.accessToken;

    const s2 = await createDeviceSession({
      user: adminUser,
      deviceId: 'dev_smoke_adm',
      deviceName: 'Hospital Admin Runner',
      userAgent: 'Automated-Test',
      ip: '127.0.0.1',
    });
    adminToken = s2.accessToken;

    const s3 = await createDeviceSession({
      user: moUser,
      deviceId: 'dev_smoke_mo',
      deviceName: 'MO Workstation Runner',
      userAgent: 'Automated-Test',
      ip: '127.0.0.1',
    });
    moToken = s3.accessToken;
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('Module 01: System Health & Simulation Demarcation', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('HEALTHY');
    expect(res.body.data.simulation).toBe(true);
  });

  it('Module 02: Core Authentication & Login', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      username: 'doctor.paderu',
      password: 'AarogyaDemo@2026',
      deviceId: 'dev_smoke_mo_test',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.role).toBe('medical_officer');
  });

  it('Module 03: Security & Audit Logging', async () => {
    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${sysadminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.logs).toBeDefined();
  });

  it('Module 04: Patient Consent Governance', async () => {
    const res = await request(app)
      .post('/api/v1/consent')
      .set('Authorization', `Bearer ${moToken}`)
      .send({
        patientId: 'PAT-PAD-2026-001',
        purpose: 'screening_ai_analysis',
        witnessName: 'ASHA Lakshmi Devi',
        language: 'te',
      });
    expect([200, 201]).toContain(res.status);
  });

  it('Module 05: Hospitals Directory', async () => {
    const res = await request(app)
      .get('/api/v1/hospitals')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.hospitals.length).toBeGreaterThanOrEqual(3);
  });

  it('Module 06: Staff Invitations Management', async () => {
    const res = await request(app)
      .get('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 07: Specialist Directory', async () => {
    const res = await request(app)
      .get('/api/v1/specialists')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.specialists.length).toBeGreaterThanOrEqual(3);
  });

  it('Module 08: Health Worker Assignments', async () => {
    const res = await request(app)
      .get('/api/v1/assignments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.assignments.length).toBeGreaterThanOrEqual(2);
  });

  it('Module 09: Reference Tribal Census & Geography', async () => {
    const res = await request(app)
      .get('/api/v1/reference/villages')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.villages.length).toBeGreaterThanOrEqual(3);
  });

  it('Module 10: Patient Registration & Search', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.patients.length).toBeGreaterThanOrEqual(2);
  });

  it('Module 11: Offline Queue Batch Synchronization', async () => {
    const res = await request(app)
      .post('/api/v1/sync/batch')
      .set('Authorization', `Bearer ${moToken}`)
      .send({ items: [] });
    expect(res.status).toBe(200);
  });

  it('Module 12: Notification Center & Patient Alerts', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 13: Administrative Account Recovery Workflow', async () => {
    const res = await request(app)
      .get('/api/v1/recovery/tickets')
      .set('Authorization', `Bearer ${sysadminToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 14: Village Groups Aggregation Topology', async () => {
    const res = await request(app)
      .get('/api/v1/village-groups')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 15: Oral Screening Cases & MO Review Queue', async () => {
    const res = await request(app)
      .get('/api/v1/screening/cases')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toBeDefined();
  });

  it('Module 16: Community Screening Camps Management', async () => {
    const res = await request(app)
      .get('/api/v1/camps')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 17: Patient Appointments Scheduling & Slots', async () => {
    const res = await request(app)
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 18: Biopsy Specimen & Lab Findings Tracking', async () => {
    const res = await request(app)
      .get('/api/v1/biopsy')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 19: Tertiary Referrals & Navigation Reminders', async () => {
    const res = await request(app)
      .get('/api/v1/referrals')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 20: Teleconsultation Session Management', async () => {
    const res = await request(app)
      .get('/api/v1/teleconsultation')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 21: Spatial Habitation GIS Map (13 Endpoints)', async () => {
    const res = await request(app)
      .get('/api/v1/map/villages')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('Module 22: Reports & Aggregation Dashboards', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dashboards/mo-queue')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.simulationBanner).toContain('SIMULATION');
  });

  it('Module 23: Aadhaar Verification Mock Service', async () => {
    const res = await request(app)
      .get('/api/v1/mock/aadhaar/status')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.mock).toBe(true);
    expect(res.body.data.realIntegration).toBe('BLOCKED');
  });

  it('Module 24: Private Storage Security & Access Control', async () => {
    const res = await request(app)
      .get('/api/v1/storage/files/invalid-uuid')
      .set('Authorization', `Bearer ${moToken}`);
    expect(res.status).toBe(400);
  });
});
