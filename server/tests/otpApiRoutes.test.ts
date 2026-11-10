import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { otpRouter, inMemoryOtpStore } from '../src/modules/auth/otpRoutes.js';
import { authRouter } from '../src/modules/auth/authRoutes.js';

describe('OTP API Routes Suite (/api/otp)', () => {
  let app: Express;
  const mockPhone = '9848099887';
  const testSecret = 'test-jwt-secret-key-123';

  beforeEach(() => {
    process.env.JWT_SECRET = testSecret;
    delete process.env.MSG91_AUTH_KEY;
    inMemoryOtpStore.clear();

    app = express();
    app.use(express.json());
    app.use('/api/otp', otpRouter);
    app.use('/api/v1/auth', authRouter);
  });

  describe('POST /api/otp/send', () => {
    it('rejects invalid phone number with 400', async () => {
      const res = await request(app)
        .post('/api/otp/send')
        .send({ phone: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid phone number');
    });

    it('rejects numbers starting with digits < 6', async () => {
      const res = await request(app)
        .post('/api/otp/send')
        .send({ phone: '5987654321' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid phone number');
    });

    it('generates, hashes, stores, and dispatches OTP for valid 10-digit phone', async () => {
      const res = await request(app)
        .post('/api/otp/send')
        .send({ phone: mockPhone, purpose: 'REGISTER' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('OTP sent');

      const saved = inMemoryOtpStore.get(`${mockPhone}:REGISTER`);
      expect(saved).toBeTruthy();
      expect(saved?.codeHash).toBeTruthy();
      expect(saved?.attempts).toBe(0);
      expect(saved?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('enforces 30-second cooldown on repeated requests', async () => {
      // First request
      const res1 = await request(app)
        .post('/api/otp/send')
        .send({ phone: mockPhone, purpose: 'REGISTER' });
      expect(res1.status).toBe(200);

      // Immediate second request
      const res2 = await request(app)
        .post('/api/otp/send')
        .send({ phone: mockPhone, purpose: 'REGISTER' });

      expect(res2.status).toBe(429);
      expect(res2.body.message).toBe('Wait 30 seconds before requesting again');
    });
  });

  describe('POST /api/otp/verify', () => {
    it('returns 400 when no active OTP challenge exists', async () => {
      const res = await request(app)
        .post('/api/otp/verify')
        .send({ phone: '9988776655', otp: '123456', purpose: 'REGISTER' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('OTP expired or not requested');
    });

    it('returns 400 on wrong OTP and increments attempts counter', async () => {
      const plainOtp = '654321';
      const codeHash = await bcrypt.hash(plainOtp, 8);
      inMemoryOtpStore.set(`${mockPhone}:REGISTER`, {
        phone: mockPhone,
        purpose: 'REGISTER',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/otp/verify')
        .send({ phone: mockPhone, otp: '111111', purpose: 'REGISTER' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Wrong OTP');

      const updated = inMemoryOtpStore.get(`${mockPhone}:REGISTER`);
      expect(updated?.attempts).toBe(1);
    });

    it('returns 429 when max attempts (5) are reached and purges OTP', async () => {
      const plainOtp = '654321';
      const codeHash = await bcrypt.hash(plainOtp, 8);
      inMemoryOtpStore.set(`${mockPhone}:REGISTER`, {
        phone: mockPhone,
        purpose: 'REGISTER',
        codeHash,
        attempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/otp/verify')
        .send({ phone: mockPhone, otp: '111111', purpose: 'REGISTER' });

      expect(res.status).toBe(429);
      expect(res.body.message).toBe('Too many attempts');

      const deleted = inMemoryOtpStore.get(`${mockPhone}:REGISTER`);
      expect(deleted).toBeUndefined();
    });

    it('successfully verifies correct OTP, deletes record, and returns 10m phoneToken', async () => {
      const plainOtp = '849201';
      const codeHash = await bcrypt.hash(plainOtp, 8);
      inMemoryOtpStore.set(`${mockPhone}:LOGIN`, {
        phone: mockPhone,
        purpose: 'LOGIN',
        codeHash,
        attempts: 0,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/otp/verify')
        .send({ phone: mockPhone, otp: plainOtp, purpose: 'LOGIN' });

      expect(res.status).toBe(200);
      expect(res.body.phoneToken).toBeTruthy();

      // Verify JWT payload
      const decoded = jwt.verify(res.body.phoneToken, testSecret) as { phone: string; purpose: string; exp: number };
      expect(decoded.phone).toBe(mockPhone);
      expect(decoded.purpose).toBe('LOGIN');

      // Record must be deleted after single use
      const consumed = inMemoryOtpStore.get(`${mockPhone}:LOGIN`);
      expect(consumed).toBeUndefined();
    });
  });

  describe('Registration PhoneToken Gate (POST /api/v1/auth/register)', () => {
    const validRegisterBody = {
      username: 'test_raju_99',
      fullName: 'Raju Test',
      password: 'StrongPassword@2026',
      role: 'patient',
      phone: mockPhone,
    };

    it('rejects registration without phoneToken with 400 "Verify your phone first"', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(validRegisterBody);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Verify your phone first');
    });

    it('rejects registration with invalid or expired phoneToken with 400 "Verify your phone first"', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterBody,
          phoneToken: 'malformed.fake.jwt-token',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Verify your phone first');
    });

    it('rejects registration when phoneToken phone does not match submitted phone with 400 "Phone not verified"', async () => {
      const attackerPhoneToken = jwt.sign(
        { phone: '9988776655', purpose: 'REGISTER' },
        testSecret,
        { expiresIn: '10m' }
      );

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterBody,
          phone: mockPhone, // 9848099887 does not match token phone 9988776655
          phoneToken: attackerPhoneToken,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Phone not verified');
    });

    it('rejects registration when phoneToken purpose is not REGISTER with 400 "Phone not verified"', async () => {
      const loginToken = jwt.sign(
        { phone: mockPhone, purpose: 'LOGIN' },
        testSecret,
        { expiresIn: '10m' }
      );

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...validRegisterBody,
          phone: mockPhone,
          phoneToken: loginToken,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Phone not verified');
    });
  });
});
