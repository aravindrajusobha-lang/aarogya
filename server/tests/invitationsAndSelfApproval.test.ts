import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Invitation } from '../src/modules/invitation/invitationModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 3 Administration: 72-Hour Invitations, Token Lifecycle & Self-Approval Prevention', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let adminToken: string;
  let adminUserId = 'usr_admin_paderu_invite';
  let createdInviteToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsInvitations');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('AdminPass@2026');

    await User.create({
      userId: adminUserId,
      username: 'admin.inviter',
      role: 'admin',
      fullName: 'Facility Admin',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    adminToken = signAccessToken({
      userId: adminUserId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_inv_admin',
      deviceId: 'dev_inv_admin',
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('allows Admin to create 72-hour invitation and returns link to copy (delivery is not claimed)', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'new.doctor@paderu.gov.in',
        fullName: 'Dr. Neha Sharma',
        role: 'medical_officer',
        hospitalId: 'hosp_paderu_dh',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.invitationLink).toContain('/invite/accept?token=');
    expect(res.body.data.hoursValid).toBe(72);
    expect(res.body.data.deliveryNote).toContain('Link shown to the admin to copy; delivery is not claimed.');

    createdInviteToken = res.body.data.token;
  });

  it('SELF-APPROVAL BLOCKED: Admin cannot invite themselves or approve their own account', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'admin.inviter@paderu.gov.in', // Same username / self-identity
        fullName: 'Self Admin Attempt',
        role: 'admin',
        hospitalId: 'hosp_paderu_dh',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SELF_APPROVAL_BLOCKED');
  });

  it('SELF-APPROVAL BLOCKED: Inviting admin cannot accept their own invitation token', async () => {
    const res = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        token: createdInviteToken,
        username: 'admin.inviter', // Creating admin attempting self-acceptance
        password: 'Password@2026',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_APPROVAL_BLOCKED');
  });

  it('SELF-APPROVAL BLOCKED: User cannot delegate permissions to themselves', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const res = await request(app)
      .post('/api/v1/auth/delegations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        toUserId: adminUserId, // Self-delegation
        capabilities: ['users:manage'],
        validUntil: tomorrow.toISOString(),
        reason: 'Attempting self-delegation escalation',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELF_APPROVAL_BLOCKED');
  });

  it('verifies valid invitation token on /verify endpoint', async () => {
    const res = await request(app).get(`/api/v1/invitations/verify/${createdInviteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.invitation.fullName).toBe('Dr. Neha Sharma');
  });

  it('accepts invitation and creates new staff account', async () => {
    const res = await request(app)
      .post('/api/v1/invitations/accept')
      .send({
        token: createdInviteToken,
        username: 'dr.neha.sharma',
        password: 'DoctorSecure@2026',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('dr.neha.sharma');
    expect(res.body.data.user.role).toBe('medical_officer');

    // Confirm in DB
    const dbUser = await User.findOne({ username: 'dr.neha.sharma' });
    expect(dbUser).toBeDefined();
    expect(dbUser?.hospitalId).toBe('hosp_paderu_dh');
  });

  it('REUSED INVITATION TOKEN REJECTED: Attempting to accept the same token again is rejected (409)', async () => {
    const res = await request(app)
      .post('/api/v1/invitations/accept')
      .send({
        token: createdInviteToken,
        username: 'dr.neha.duplicate',
        password: 'DuplicatePass@2026',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVITATION_ALREADY_USED');
  });

  it('EXPIRED INVITATION TOKEN REJECTED: Token past 72 hours is rejected (410)', async () => {
    // Create an invitation with expiration in the past
    const expiredInvite = await Invitation.create({
      invitationId: 'inv_expired_test',
      hospitalId: 'hosp_paderu_dh',
      email: 'expired.staff@paderu.gov.in',
      fullName: 'Late Joining Staff',
      role: 'anm',
      token: 'mock_expired_token_hex_99999',
      invitationLink: '/invite/accept?token=mock_expired_token_hex_99999',
      createdBy: adminUserId,
      expiresAt: new Date(Date.now() - 10000), // 10 seconds in the past (> 72 hours ago)
      status: 'pending',
      simulation: true,
    });

    // Verification check rejects expired token
    const verifyRes = await request(app).get(`/api/v1/invitations/verify/${expiredInvite.token}`);
    expect(verifyRes.status).toBe(410);
    expect(verifyRes.body.error.code).toBe('INVITATION_EXPIRED');

    // Acceptance attempt rejects expired token
    const acceptRes = await request(app)
      .post('/api/v1/invitations/accept')
      .send({
        token: expiredInvite.token,
        username: 'anm.late',
        password: 'Password@2026',
      });

    expect(acceptRes.status).toBe(410);
    expect(acceptRes.body.error.code).toBe('INVITATION_EXPIRED');
  });
});
