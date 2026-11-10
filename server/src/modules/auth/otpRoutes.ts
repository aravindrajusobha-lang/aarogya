import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Otp, OtpPurpose } from './otpModel.js';
import { sendOtpSms } from './smsService.js';
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

  const otp = String(crypto.randomInt(100000, 1000000));
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

  return res.json({ message: 'OTP sent' });
});

/**
 * POST /api/otp/verify & /api/v1/otp/verify
 * Validates entered OTP code against bcrypt codeHash
 * Enforces max 5 attempts, deletes single-use OTP, and returns 10m phoneToken
 */
otpRouter.post('/verify', limiter, async (req: Request, res: Response) => {
  const { phone, otp, purpose = 'REGISTER' } = req.body || {};
  const key = `${phone}:${purpose}`;

  let rec: any = null;
  const isMongoActive = Boolean(mongoose.connection && mongoose.connection.readyState === 1);

  if (isMongoActive) {
    rec = await Otp.findOne({ phone, purpose }).catch(() => null);
  }
  if (!rec) {
    rec = inMemoryOtpStore.get(key);
  }

  if (!rec || (rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now())) {
    inMemoryOtpStore.delete(key);
    return res.status(400).json({ message: 'OTP expired or not requested' });
  }

  if (rec.attempts >= 5) {
    inMemoryOtpStore.delete(key);
    if (isMongoActive && typeof rec.deleteOne === 'function') {
      await rec.deleteOne().catch(() => null);
    }
    return res.status(429).json({ message: 'Too many attempts' });
  }

  const match = await bcrypt.compare(String(otp || ''), rec.codeHash);
  if (!match) {
    rec.attempts += 1;
    if (isMongoActive && typeof rec.save === 'function') {
      await rec.save().catch(() => null);
    }
    inMemoryOtpStore.set(key, rec);
    return res.status(400).json({ message: 'Wrong OTP' });
  }

  // OTP verified successfully: purge for one-time use
  inMemoryOtpStore.delete(key);
  if (isMongoActive && typeof rec.deleteOne === 'function') {
    await rec.deleteOne().catch(() => null);
  }

  const secret = process.env.JWT_SECRET || 'aarogya-drishti-jwt-secret-phase20';
  const phoneToken = jwt.sign({ phone, purpose }, secret, { expiresIn: '10m' });
  return res.json({ phoneToken });
});

export default otpRouter;
