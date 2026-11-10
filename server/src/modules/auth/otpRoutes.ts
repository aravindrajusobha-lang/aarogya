import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Otp, OtpPurpose } from './otpModel.js';
import { sendOtpSms } from './smsService.js';
import { PatientOtpService } from './patientOtpService.js';
import { createRateLimiter } from '../../middleware/rateLimiter.js';
import { logger } from '../../config/logger.js';

export const otpRouter = Router();

const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  skipInTests: true,
});

const validPhone = (p: string): boolean => /^[6-9]\d{9}$/.test(p);

// In-memory fallback store for offline operation and rapid unit tests
interface IMemOtp {
  phone: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}
export const inMemoryOtpStore = new Map<string, IMemOtp>();

/**
 * POST /api/otp/send & /api/v1/otp/send
 * Dispatches a 6-digit OTP via MSG91 SMS Flow API
 * Enforces 30s cooldown and hashes code with bcrypt
 */
otpRouter.post('/send', limiter, async (req: Request, res: Response) => {
  const { phone, purpose = 'REGISTER' } = req.body || {};
  if (!phone || !validPhone(phone)) {
    return res.status(400).json({ message: 'Invalid phone number' });
  }

  const key = `${phone}:${purpose}`;
  let lastCreatedAt: number | null = null;

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    const last = await Otp.findOne({ phone, purpose }).sort({ createdAt: -1 }).catch(() => null);
    if (last && last.createdAt) {
      lastCreatedAt = new Date(last.createdAt).getTime();
    }
  } else {
    const lastMem = inMemoryOtpStore.get(key);
    if (lastMem) {
      lastCreatedAt = lastMem.createdAt.getTime();
    }
  }

  if (lastCreatedAt && Date.now() - lastCreatedAt < 30 * 1000) {
    return res.status(429).json({ message: 'Wait 30 seconds before requesting again' });
  }

  // Demo OTP support: In simulation / development / unset MSG91 key, use standard demo code 123456
  const isLiveSms = Boolean(process.env.MSG91_AUTH_KEY && process.env.NODE_ENV === 'production');
  const otp = isLiveSms ? String(crypto.randomInt(100000, 1000000)) : '123456';
  const codeHash = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const now = new Date();

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    await Otp.deleteMany({ phone, purpose }).catch(() => null);
    await Otp.create({
      phone,
      purpose: purpose as OtpPurpose,
      codeHash,
      expiresAt,
    }).catch(() => null);
  }

  inMemoryOtpStore.set(key, {
    phone,
    purpose,
    codeHash,
    attempts: 0,
    expiresAt,
    createdAt: now,
  });

  try {
    await sendOtpSms(phone, otp);
  } catch (err) {
    logger.error({ err, phone: phone.slice(-4) }, 'Could not dispatch OTP SMS');
    return res.status(502).json({ message: 'Could not send OTP, try again' });
  }

  return res.json({
    message: 'OTP sent',
    demoOtp: !isLiveSms ? '123456' : undefined,
  });
});

/**
 * POST /api/otp/verify & /api/v1/otp/verify
 * Validates entered OTP code against bcrypt codeHash (with Demo 123456 support)
 * Enforces max 5 attempts, deletes single-use OTP, and returns 10m phoneToken
 * If purpose is 'LOGIN', also returns authenticated user session
 */
otpRouter.post('/verify', limiter, async (req: Request, res: Response) => {
  const { phone, otp, purpose = 'REGISTER', deviceName, deviceId } = req.body || {};
  const key = `${phone}:${purpose}`;

  const isLiveSms = Boolean(process.env.MSG91_AUTH_KEY && process.env.NODE_ENV === 'production');
  const isDemoCode = !isLiveSms && String(otp || '').trim() === '123456';

  let rec: any = null;
  const isMongoActive = Boolean(mongoose.connection && mongoose.connection.readyState === 1);

  if (isMongoActive) {
    rec = await Otp.findOne({ phone, purpose }).catch(() => null);
  }
  if (!rec) {
    rec = inMemoryOtpStore.get(key);
  }

  if (!rec) {
    return res.status(400).json({ message: 'OTP expired or not requested' });
  }

  if (rec && rec.attempts >= 5 && !isDemoCode) {
    inMemoryOtpStore.delete(key);
    if (isMongoActive && typeof rec.deleteOne === 'function') {
      await rec.deleteOne().catch(() => null);
    }
    return res.status(429).json({ message: 'Too many attempts' });
  }

  const match = isDemoCode || (rec && (await bcrypt.compare(String(otp || ''), rec.codeHash)));
  if (!match) {
    if (rec) {
      rec.attempts += 1;
      if (isMongoActive && typeof rec.save === 'function') {
        await rec.save().catch(() => null);
      }
      inMemoryOtpStore.set(key, rec);
    }
    return res.status(400).json({ message: 'Wrong OTP' });
  }

  // OTP verified successfully: purge for one-time use
  inMemoryOtpStore.delete(key);
  if (isMongoActive && rec && typeof rec.deleteOne === 'function') {
    await rec.deleteOne().catch(() => null);
  }

  const secret = process.env.JWT_SECRET || 'aarogya-drishti-jwt-secret-phase20';
  const phoneToken = jwt.sign({ phone, purpose }, secret, { expiresIn: '10m' });

  // For LOGIN flow: also resolve full authenticated patient session
  let loginData: any = undefined;
  if (purpose === 'LOGIN') {
    try {
      loginData = await PatientOtpService.verifyOtp({
        phone,
        otp: isDemoCode ? '123456' : otp,
        purpose: 'LOGIN',
        deviceName: deviceName || 'Patient Portal (OTP)',
        deviceId,
        ip: req.ip || '127.0.0.1',
      });
    } catch {}
  }

  return res.json({
    phoneToken,
    demoVerified: isDemoCode,
    ...(loginData ? { user: loginData.user, ...loginData } : {}),
  });
});

/**
 * POST /api/otp/login & /api/v1/otp/login
 * 1-Step Demo or Real OTP Login for Patient & Community members
 */
otpRouter.post('/login', limiter, async (req: Request, res: Response) => {
  const { phone, otp = '123456', deviceName, deviceId } = req.body || {};
  if (!phone || !validPhone(phone)) {
    return res.status(400).json({ message: 'Invalid phone number' });
  }

  const isDemo = !process.env.MSG91_AUTH_KEY || process.env.SIMULATION_MODE === 'true' || process.env.NODE_ENV !== 'production';
  const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);

  // If in demo mode and OTP is 123456:
  if (isDemo && String(otp).trim() === '123456') {
    const suffix = cleanPhone.slice(-4);
    const demoUser = {
      userId: `USR-PAT-${suffix}`,
      username: `patient_${cleanPhone}`,
      role: 'patient',
      fullName: `Tribal Beneficiary (${suffix})`,
      patientId: `PAT-PAD-${suffix}`,
      hospitalId: 'HOSP-PAD-01',
      status: 'active',
      simulation: true,
      capabilities: ['screening:view', 'appointment:book', 'teleconsultation:join'],
    };
    const secret = process.env.JWT_SECRET || 'aarogya-drishti-jwt-secret-phase20';
    const accessToken = jwt.sign({ sub: demoUser.userId, role: 'patient', phone: cleanPhone }, secret, { expiresIn: '1d' });
    const refreshToken = jwt.sign({ sub: demoUser.userId, type: 'refresh' }, secret, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful via OTP',
      user: demoUser,
      accessToken,
      refreshToken,
      deviceSessionId: `dev_sess_${Date.now()}`,
      simulation: true,
    });
  }

  try {
    const result = await PatientOtpService.verifyOtp({
      phone,
      otp: String(otp).trim(),
      purpose: 'LOGIN',
      deviceName: deviceName || 'Web Browser / Mobile App',
      deviceId,
      ip: req.ip || '127.0.0.1',
    });

    return res.json({
      message: 'Login successful via OTP',
      ...result,
    });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'OTP Login failed' });
  }
});

export default otpRouter;
