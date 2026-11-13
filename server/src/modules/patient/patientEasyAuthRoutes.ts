import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { auditTag } from '../../middleware/auditTag.js';
import { User } from '../auth/userModel.js';
import { hashPassword } from '../auth/tokenService.js';
import { createDeviceSession } from '../auth/deviceService.js';
import { getRoleCapabilities } from '../auth/authorizationEngine.js';
import { PatientOtpService } from '../auth/patientOtpService.js';
import { SyncLedger } from './syncLedgerModel.js';
import { ASR_MANDALS, ASR_VILLAGES_SEED } from '../reference/asrGeographyData.js';
import { logger } from '../../config/logger.js';

/**
 * Simple patient registration & login for first-time and elderly users.
 *
 * Invariant 5 (Aadhaar minimisation): the Aadhaar route accepts ONLY name, year of birth, gender and
 * address fields — card images, QR payloads and Aadhaar digits are read and validated in the browser
 * and are rejected here by a strict schema. ABHA numbers are stored only as an HMAC plus a masked form.
 * Registration never requires OTP for Aadhaar; a mobile number is linked only after OTP verification.
 */
export const patientEasyAuthRouter = Router();

const jwtSecret = () => process.env.JWT_SECRET || 'aarogya-drishti-jwt-secret-phase20';
const abhaDigits = (value: string) => value.replace(/\D/g, '');
export const hashAbha = (digits: string) => crypto.createHmac('sha256', jwtSecret()).update(`abha:${digits}`).digest('hex');
const maskAbha = (digits: string) => `XX-XXXX-XXXX-${digits.slice(-4)}`;
const maskPhone = (phone: string) => `+91 ••••• ${phone.slice(-4)}`;
const tenDigits = (phone: string) => phone.replace(/\D/g, '').slice(-10);

/** Returns the verified 10-digit phone from a short-lived OTP phoneToken (issued by /api/v1/otp/verify). */
function verifiedPhone(phoneToken?: string): string | null {
  if (!phoneToken) return null;
  try {
    const data: any = jwt.verify(phoneToken, jwtSecret());
    if (data?.purpose !== 'REGISTER' || !/^[6-9]\d{9}$/.test(String(data?.phone))) return null;
    return String(data.phone);
  } catch {
    return null;
  }
}

function sessionUser(user: any) {
  return {
    userId: user.userId,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    patientId: user.patientId,
    phone: user.phone,
    yearOfBirth: user.yearOfBirth,
    gender: user.gender,
    address: user.address,
    village: user.village,
    mandal: user.mandal,
    pincode: user.pincode,
    hospitalId: user.hospitalId,
    abhaMasked: user.abhaMasked || null,
    verificationStatus: user.verificationStatus,
    capabilities: getRoleCapabilities('patient'),
  };
}

/* ---------- Public place list (mandals + villages; no personal data) ---------- */
patientEasyAuthRouter.get('/places', (_req: Request, res: Response) => {
  res.envelope({
    mandals: ASR_MANDALS.map((m) => ({
      mandalId: m.mandalId, name: m.mandalName, nameTe: m.nameTe, nameHi: m.nameHi,
      villages: ASR_VILLAGES_SEED.filter((v) => v.mandal === m.mandalName).map((v) => ({ name: v.villageName, nameTe: v.nameTe })),
    })),
  });
});

/* ---------- Register ---------- */
const RegisterSchema = z.object({
  method: z.enum(['aadhaar', 'abha', 'mobile']),
  fullName: z.string().trim().min(2).max(120),
  yearOfBirth: z.number().int().min(1900).max(new Date().getFullYear()),
  gender: z.enum(['male', 'female', 'transgender', 'other']),
  mandalId: z.string().trim().min(2).max(60),
  village: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500).optional().default(''),
  pincode: z.string().regex(/^[1-9]\d{5}$/).optional(),
  phoneToken: z.string().min(10).max(1000).optional(),
  abhaNumber: z.string().trim().max(20).optional(),
  consent: z.literal(true),
  clientMutationId: z.string().uuid(),
}).strict(); // rejects any Aadhaar number, image or QR payload field

patientEasyAuthRouter.post('/register', authRateLimiter, validate({ body: RegisterSchema }), auditTag('PATIENT_EASY_REGISTER', 'auth'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof RegisterSchema>;
    const replay: any = await SyncLedger.findOne({ clientMutationId: body.clientMutationId }).lean();
    if (replay) {
      if (replay.entityType !== 'patient-easy-register') { res.status(409).envelopeError('MUTATION_ID_REUSED', 'This request ID was already used.', undefined, 409); return; }
      const existing: any = await User.findOne({ userId: replay.entityId });
      if (!existing) { res.status(409).envelopeError('MUTATION_ID_REUSED', 'This request ID was already used.', undefined, 409); return; }
      const tokens = await createDeviceSession({ user: existing, deviceId: `dev_${uuidv4()}`, deviceName: 'Patient Registration', userAgent: req.headers['user-agent'] || 'Unknown', ip: req.ip || '127.0.0.1' });
      res.envelope({ patientId: existing.patientId, user: sessionUser(existing), ...tokens, idempotentReplay: true });
      return;
    }

    const phone = verifiedPhone(body.phoneToken);
    if (body.phoneToken && !phone) { res.status(400).envelopeError('PHONE_NOT_VERIFIED', 'The mobile OTP has expired. Please verify your mobile number again.', undefined, 400); return; }
    if ((body.method === 'mobile' || body.method === 'abha') && !phone) { res.status(400).envelopeError('PHONE_REQUIRED', 'Please verify your mobile number with OTP.', undefined, 400); return; }

    let abhaHash: string | undefined;
    let abhaMasked: string | undefined;
    if (body.method === 'abha') {
      const digits = abhaDigits(body.abhaNumber || '');
      if (!/^\d{14}$/.test(digits)) { res.status(400).envelopeError('INVALID_ABHA', 'ABHA number must have 14 digits.', undefined, 400); return; }
      abhaHash = hashAbha(digits); abhaMasked = maskAbha(digits);
      if (await User.exists({ abhaHash })) { res.status(409).envelopeError('ALREADY_REGISTERED', 'This ABHA number is already registered. Please log in.', undefined, 409); return; }
    } else if (body.abhaNumber) {
      res.status(400).envelopeError('UNEXPECTED_FIELD', 'ABHA number is only used with ABHA registration.', undefined, 400); return;
    }
    if (phone && await User.exists({ role: 'patient', phone: { $in: [`+91${phone}`, phone] } })) {
      res.status(409).envelopeError('ALREADY_REGISTERED', 'This mobile number is already registered. Please log in.', undefined, 409); return;
    }

    const mandal = ASR_MANDALS.find((m) => m.mandalId === body.mandalId);
    if (!mandal) { res.status(400).envelopeError('INVALID_MANDAL', 'Please choose your mandal from the list.', undefined, 400); return; }

    let patientId = '';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      patientId = `PAD-${uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
      if (!(await User.exists({ patientId }))) break;
    }
    const user = await User.create({
      userId: `usr_patient_${uuidv4()}`,
      username: `patient_${patientId.toLowerCase()}`,
      role: 'patient',
      fullName: body.fullName,
      patientId,
      yearOfBirth: body.yearOfBirth,
      gender: body.gender,
      address: body.address,
      village: body.village,
      mandal: mandal.mandalName,
      pincode: body.pincode,
      hospitalId: mandal.catchmentHospitalId,
      ...(phone ? { phone: `+91${phone}`, phoneVerified: true } : {}),
      ...(abhaHash ? { abhaHash, abhaMasked } : {}),
      registrationMethod: body.method,
      passwordHash: await hashPassword(uuidv4()),
      verificationStatus: 'UNVERIFIED',
      status: 'active',
      simulation: true,
    });
    await SyncLedger.create({ clientMutationId: body.clientMutationId, entityType: 'patient-easy-register', entityId: user.userId, responsePayload: { patientId }, simulation: true });
    const tokens = await createDeviceSession({ user, deviceId: `dev_${uuidv4()}`, deviceName: 'Patient Registration', userAgent: req.headers['user-agent'] || 'Unknown', ip: req.ip || '127.0.0.1' });
    res.status(201).envelope({ patientId, user: sessionUser(user), ...tokens }, 'Registration complete.');
  } catch (err) { next(err); }
});

/* ---------- Login with mobile or ABHA + OTP ---------- */
const LoginTarget = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  abhaNumber: z.string().trim().max(20).optional(),
}).refine((v) => Boolean(v.phone) !== Boolean(v.abhaNumber), 'Enter either a mobile number or an ABHA number.');

async function findPatient(target: { phone?: string; abhaNumber?: string }) {
  if (target.phone) return User.findOne({ role: 'patient', status: 'active', phone: { $in: [`+91${target.phone}`, target.phone] } });
  const digits = abhaDigits(target.abhaNumber || '');
  if (!/^\d{14}$/.test(digits)) return null;
  return User.findOne({ role: 'patient', status: 'active', abhaHash: hashAbha(digits) });
}

patientEasyAuthRouter.post('/login/send-otp', authRateLimiter, validate({ body: LoginTarget }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user: any = await findPatient(req.body);
    if (!user?.phone) { res.status(404).envelopeError('NOT_REGISTERED', 'No account found. Please register first.', undefined, 404); return; }
    const phone = tenDigits(user.phone);
    const result = await PatientOtpService.requestOtp(phone, req.ip || '127.0.0.1', 'LOGIN');
    res.envelope({ sentTo: maskPhone(phone), expiresInSeconds: result.expiresInSeconds, demoOtpHint: result.demoOtpHint });
  } catch (err: any) {
    if (err?.message && /wait|cooldown/i.test(err.message)) { res.status(429).envelopeError('OTP_COOLDOWN', err.message, undefined, 429); return; }
    next(err);
  }
});

patientEasyAuthRouter.post('/login', authRateLimiter, validate({ body: z.object({ phone: z.string().regex(/^[6-9]\d{9}$/).optional(), abhaNumber: z.string().trim().max(20).optional(), otp: z.string().regex(/^\d{6}$/) }) }), auditTag('PATIENT_EASY_LOGIN', 'auth'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user: any = await findPatient(req.body);
    if (!user?.phone) { res.status(404).envelopeError('NOT_REGISTERED', 'No account found. Please register first.', undefined, 404); return; }
    let result: any;
    try {
      result = await PatientOtpService.verifyOtp({ phone: tenDigits(user.phone), otp: req.body.otp, purpose: 'LOGIN', deviceName: 'Patient Portal', userAgent: req.headers['user-agent'] || 'Unknown', ip: req.ip || '127.0.0.1' });
    } catch (otpError: any) {
      res.status(401).envelopeError('OTP_INVALID', otpError?.message || 'Wrong or expired OTP.', undefined, 401); return;
    }
    if (!result?.verified || result.user?.userId !== user.userId) { res.status(401).envelopeError('OTP_INVALID', 'Wrong or expired OTP.', undefined, 401); return; }
    logger.info({ event: 'patient_easy_login', method: req.body.abhaNumber ? 'abha' : 'mobile' }, 'Patient signed in');
    res.envelope({ user: { ...result.user, abhaMasked: user.abhaMasked || null, hospitalId: user.hospitalId }, accessToken: result.accessToken, refreshToken: result.refreshToken, deviceSessionId: result.deviceSessionId });
  } catch (err) { next(err); }
});
