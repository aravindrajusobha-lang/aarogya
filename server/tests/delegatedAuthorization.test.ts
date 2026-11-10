import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Central Authorization Engine: Live Database Delegated Permissions', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let adminToken: string;
  let ashaToken: string;
  let ashaUserId: string;
  let delegationId: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsDelegation');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('Secret@2026');

    // Admin user (has capability 'delegation:create' and 'audit:read')
    await User.create({
      userId: 'usr_admin_01',
      username: 'admin.paderu',
      role: 'admin',
      fullName: 'District Coordinator',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    // ASHA user (natively does NOT have 'audit:read' or 'delegation:create')
    const asha = await User.create({
      userId: 'usr_asha_delegation',
      username: 'asha.camp_lead',
      role: 'asha',
      fullName: 'Sunita (ASHA Camp Lead)',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });
    ashaUserId = asha.userId;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin.paderu', password: 'Secret@2026' });
    adminToken = adminLogin.body.data.accessToken;

    const ashaLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'asha.camp_lead', password: 'Secret@2026' });
    ashaToken = ashaLogin.body.data.accessToken;
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('verifies ASHA worker is initially forbidden (403) from audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows Admin to delegate audit:read capability to ASHA worker', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await request(app)
      .post('/api/v1/auth/delegations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        toUserId: ashaUserId,
        capabilities: ['audit:read'],
        validUntil: tomorrow.toISOString(),
        reason: 'Authorized for tribal screening outreach camp audit review',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.delegationId).toBeDefined();
    expect(res.body.data.toUserId).toBe(ashaUserId);
    expect(res.body.data.capabilities).toContain('audit:read');

    delegationId = res.body.data.delegationId;
  });

  it('allows ASHA worker to access audit:read LIVE via active delegation in DB', async () => {
    const res = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.logs).toBeDefined();
  });

  it('lists active delegations received on /delegations/my', async () => {
    const res = await request(app)
      .get('/api/v1/auth/delegations/my')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.delegations.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.delegations[0].capabilities).toContain('audit:read');
  });

  it('immediately denies access again when delegation is revoked', async () => {
    const revokeRes = await request(app)
      .post(`/api/v1/auth/delegations/${delegationId}/revoke`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.status).toBe('revoked');

    // Live DB check now finds no active delegation -> returns 403
    const checkRes = await request(app)
      .get('/api/v1/audit/logs')
      .set('Authorization', `Bearer ${ashaToken}`);

    expect(checkRes.status).toBe(403);
    expect(checkRes.body.error.code).toBe('FORBIDDEN');
  });
});
