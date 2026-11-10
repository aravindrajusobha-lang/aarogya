import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { DeviceSession } from '../src/modules/auth/deviceSessionModel.js';
import { hashPassword } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Auth Security: Login, Lockout, Backoff, Token Rotation, Reuse Detection, Device Revocation', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  const testUserPassword = 'SecurePassword@2026';
  let ashaUserId: string;
  let activeRefreshToken: string;
  let activeAccessToken: string;
  let activeDeviceId = 'dev_asha_tab_01';
  let activeSessionId: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAuthSecurity');
    await mongoose.connect(replSet.getUri());

    // Seed test users
    const passwordHash = await hashPassword(testUserPassword);

    const ashaUser = await User.create({
      userId: 'usr_asha_9821',
      username: 'asha.paderu',
      role: 'asha',
      fullName: 'Lakshmi Devi (ASHA)',
      phone: '+919876543210',
      passwordHash,
      status: 'active',
      simulation: true,
    });
    ashaUserId = ashaUser.userId;

    await User.create({
      userId: 'usr_pat_4412',
      username: 'patient.pad01',
      role: 'patient',
      fullName: 'Kondala Rao',
      patientId: 'PAT-PAD-4412',
      phone: '+919876543211',
      passwordHash,
      status: 'active',
      simulation: true,
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('allows staff login with valid Argon2 credentials and returns token pair', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: testUserPassword,
        deviceId: activeDeviceId,
        deviceName: 'ASHA Tribal Tablet 01',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.username).toBe('asha.paderu');
    expect(res.body.data.user.role).toBe('asha');
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.deviceSessionId).toBeDefined();

    activeAccessToken = res.body.data.accessToken;
    activeRefreshToken = res.body.data.refreshToken;
    activeSessionId = res.body.data.deviceSessionId;
  });

  it('allows patient login with patient credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'patient.pad01',
        password: testUserPassword,
        deviceId: 'dev_patient_phone_01',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('patient');
    expect(res.body.data.accessToken).toBeDefined();
  });

  it('rejects invalid password and increments failed attempts', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: 'WrongPassword123',
        deviceId: activeDeviceId,
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.details.failedAttempts).toBe(1);
  });

  it('enforces lockout after 5 consecutive failed attempts', async () => {
    // Attempt 2 (may trigger backoff)
    // Wait briefly or simulate failed attempts directly on model to test lockout trigger
    const user = await User.findOne({ username: 'asha.paderu' });
    expect(user).toBeDefined();

    // Set attempts to 4 so next failed attempt triggers lockout
    user!.lockout.failedAttempts = 4;
    user!.lockout.lastFailedAt = new Date(Date.now() - 60000); // 1 minute ago so no backoff block
    await user!.save();

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: 'WrongPasswordAgain',
        deviceId: activeDeviceId,
      });

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(res.body.error.details.failedAttempts).toBe(5);

    // Verify subsequent login even with correct password is locked
    const lockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: testUserPassword,
        deviceId: activeDeviceId,
      });

    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');

    // Unlock user for remaining tests
    await User.updateOne(
      { username: 'asha.paderu' },
      {
        $set: {
          status: 'active',
          'lockout.failedAttempts': 0,
          'lockout.lockedUntil': null,
          'lockout.lastFailedAt': null,
        },
      }
    );
  });

  it('rotates refresh token on /refresh and provides new token pair', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: activeRefreshToken,
        deviceId: activeDeviceId,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    // New refresh token must differ from old one
    expect(res.body.data.refreshToken).not.toBe(activeRefreshToken);

    const oldRefreshToken = activeRefreshToken;
    const newRefreshToken = res.body.data.refreshToken;
    const newAccessToken = res.body.data.accessToken;

    // REFRESH-REUSE DETECTION TEST:
    // Attacker tries to replay the old already-consumed refresh token!
    const replayRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: oldRefreshToken,
        deviceId: activeDeviceId,
      });

    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe('REFRESH_TOKEN_REUSE_DETECTED');

    // Verify that the device session was immediately revoked in the database!
    const session = await DeviceSession.findOne({ sessionId: activeSessionId });
    expect(session?.status).toBe('revoked');
    expect(session?.revocationReason).toBe('refresh_token_reuse_detected');

    // Subsequent refresh attempts even with the newest refresh token are rejected because device is revoked!
    const subsequentRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: newRefreshToken,
        deviceId: activeDeviceId,
      });

    expect(subsequentRes.status).toBe(401);
    expect(subsequentRes.body.error.code).toBe('DEVICE_REVOKED');
  });

  it('strictly rejects access token from a revoked device', async () => {
    // Re-login to get fresh active session
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: testUserPassword,
        deviceId: 'dev_asha_test_device',
        deviceName: 'Test Device For Revocation',
      });

    const testToken = loginRes.body.data.accessToken;
    const testSessionId = loginRes.body.data.deviceSessionId;

    // Verify token works
    const checkRes1 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(checkRes1.status).toBe(200);
    expect(checkRes1.body.data.username).toBe('asha.paderu');

    // Now revoke this device
    const revokeRes = await request(app)
      .post(`/api/v1/auth/devices/dev_asha_test_device/revoke`)
      .set('Authorization', `Bearer ${testToken}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.revoked).toBe(true);

    // Next request with same access token must be REJECTED with DEVICE_REVOKED
    const checkRes2 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(checkRes2.status).toBe(401);
    expect(checkRes2.body.error.code).toBe('DEVICE_REVOKED');
  });

  it('lists active and revoked devices on /devices endpoint', async () => {
    // Login with fresh device
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: testUserPassword,
        deviceId: 'dev_asha_current_tab',
        deviceName: 'Primary Tablet',
      });

    const token = loginRes.body.data.accessToken;

    const listRes = await request(app)
      .get('/api/v1/auth/devices')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data.devices.length).toBeGreaterThanOrEqual(1);
    const current = listRes.body.data.devices.find((d: any) => d.isCurrentDevice);
    expect(current).toBeDefined();
    expect(current.deviceId).toBe('dev_asha_current_tab');
  });

  it('revokes all other devices on /devices/revoke-others', async () => {
    // Login on device A
    const loginA = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: testUserPassword,
        deviceId: 'dev_temp_a',
        deviceName: 'Temp Device A',
      });

    // Login on device B (current)
    const loginB = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'asha.paderu',
        password: testUserPassword,
        deviceId: 'dev_temp_b',
        deviceName: 'Current Device B',
      });

    const tokenB = loginB.body.data.accessToken;

    // Call revoke-others from device B
    const revokeRes = await request(app)
      .post('/api/v1/auth/devices/revoke-others')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.revokedCount).toBeGreaterThanOrEqual(1);

    // Verify device A is now rejected
    const checkA = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginA.body.data.accessToken}`);

    expect(checkA.status).toBe(401);
    expect(checkA.body.error.code).toBe('DEVICE_REVOKED');

    // Current device B still works
    const checkB = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(checkB.status).toBe(200);
  });
});
