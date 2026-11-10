import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { authenticator } from 'otplib';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { hashPassword } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('TOTP MFA & WebAuthn Biometrics Lifecycles', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  const userPassword = 'MfaPassword@2026';
  let userToken: string;
  let totpSecret: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsMfaWebAuthn');
    await mongoose.connect(replSet.getUri());

    const passwordHash = await hashPassword(userPassword);
    await User.create({
      userId: 'usr_mo_mfa',
      username: 'doctor.paderu',
      role: 'medical_officer',
      fullName: 'Dr. Suresh Kumar',
      passwordHash,
      mfaEnabled: false,
      status: 'active',
      simulation: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'doctor.paderu',
        password: userPassword,
      });

    userToken = loginRes.body.data.accessToken;
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('generates TOTP setup secret and otpauth URI on /mfa/setup', async () => {
    const res = await request(app)
      .post('/api/v1/auth/mfa/setup')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.secret).toBeDefined();
    expect(res.body.data.otpauthUrl).toContain('otpauth://totp/');
    expect(res.body.data.otpauthUrl).toContain('doctor.paderu');

    totpSecret = res.body.data.secret;
  });

  it('enables MFA after verifying initial 6-digit TOTP code', async () => {
    const validCode = authenticator.generate(totpSecret);

    const res = await request(app)
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: validCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mfaEnabled).toBe(true);

    // Verify DB flag
    const user = await User.findOne({ username: 'doctor.paderu' });
    expect(user?.mfaEnabled).toBe(true);
  });

  it('enforces two-step login when MFA is enabled: Step 1 returns mfaRequired', async () => {
    const step1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'doctor.paderu',
        password: userPassword,
        deviceId: 'dev_mo_tablet_mfa',
      });

    expect(step1Res.status).toBe(200);
    expect(step1Res.body.data.mfaRequired).toBe(true);
    expect(step1Res.body.data.mfaSessionToken).toBeDefined();
    // Full access token should NOT be provided yet
    expect(step1Res.body.data.accessToken).toBeUndefined();

    const mfaSessionToken = step1Res.body.data.mfaSessionToken;

    // Step 2: Test rejection of invalid code
    const invalidStep2 = await request(app)
      .post('/api/v1/auth/mfa/verify')
      .send({
        mfaSessionToken,
        code: '000000',
      });

    expect(invalidStep2.status).toBe(401);
    expect(invalidStep2.body.error.code).toBe('INVALID_MFA_CODE');

    // Step 2: Successful verification with valid code
    const validCode = authenticator.generate(totpSecret);
    const validStep2 = await request(app)
      .post('/api/v1/auth/mfa/verify')
      .send({
        mfaSessionToken,
        code: validCode,
      });

    expect(validStep2.status).toBe(200);
    expect(validStep2.body.data.accessToken).toBeDefined();
    expect(validStep2.body.data.user.username).toBe('doctor.paderu');
  });

  it('disables MFA when current TOTP code is provided', async () => {
    const validCode = authenticator.generate(totpSecret);

    const res = await request(app)
      .post('/api/v1/auth/mfa/disable')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: validCode });

    expect(res.status).toBe(200);
    expect(res.body.data.mfaEnabled).toBe(false);

    // Verify user can now log in directly in 1 step
    const directLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        username: 'doctor.paderu',
        password: userPassword,
      });

    expect(directLogin.status).toBe(200);
    expect(directLogin.body.data.mfaRequired).toBeUndefined();
    expect(directLogin.body.data.accessToken).toBeDefined();
  });

  it('generates WebAuthn registration options for biometric enrollment', async () => {
    const res = await request(app)
      .post('/api/v1/auth/webauthn/register/options')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.challenge).toBeDefined();
    expect(res.body.data.rp.name).toContain('Aarogya');
    expect(res.body.data.user.name).toBe('doctor.paderu');
  });

  it('generates WebAuthn login options challenge for passwordless auth', async () => {
    // Add dummy enrolled credential to test options generation
    const user = await User.findOne({ username: 'doctor.paderu' });
    user!.webauthnCredentials.push({
      credentialId: 'mock_cred_id_123',
      publicKey: Buffer.from('mock_public_key').toString('base64'),
      counter: 1,
      createdAt: new Date(),
    });
    await user!.save();

    const res = await request(app)
      .post('/api/v1/auth/webauthn/login/options')
      .send({ username: 'doctor.paderu' });

    expect(res.status).toBe(200);
    expect(res.body.data.challenge).toBeDefined();
    expect(res.body.data.allowCredentials.length).toBeGreaterThanOrEqual(1);
  });
});
