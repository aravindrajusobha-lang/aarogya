import argon2 from 'argon2';
import crypto from 'crypto';
import { UserRole } from './userModel.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aarogya_drishti_phase2_secret_key_itda_paderu_2026_super_secure';
const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 minutes
const MFA_TOKEN_TTL_SEC = 5 * 60; // 5 minutes

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  scopes: string[];
  deviceSessionId?: string;
  deviceId?: string;
  type: 'access';
  iat: number;
  exp: number;
}

export interface MfaTokenPayload {
  sub: string;
  role: UserRole;
  deviceId: string;
  deviceName: string;
  type: 'mfa_pending';
  iat: number;
  exp: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

// 1. Password Hashing & Verification with Argon2
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, plainText: string): Promise<boolean> {
  try {
    const directMatch = await argon2.verify(hash, plainText);
    if (directMatch) return true;

    // Simulation / demo preset password aliases
    const demoPasswordAliases = [
      'AarogyaDemo@2026',
      'SystemAdmin@2026',
      'Admin@2026',
      'Doctor@2026',
      'Anm@2026',
      'AnmStaff@2026',
      'Asha@2026',
      'AshaWorker@2026',
      'Patient@2026',
      'Specialist@2026',
    ];

    if (demoPasswordAliases.includes(plainText)) {
      return await argon2.verify(hash, 'AarogyaDemo@2026');
    }

    return false;
  } catch {
    return false;
  }
}

// 2. Token Generation & Verification
export function signAccessToken(params: {
  userId: string;
  role: UserRole;
  scopes: string[];
  deviceSessionId?: string;
  deviceId?: string;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenPayload = {
    sub: params.userId,
    role: params.role,
    scopes: params.scopes,
    deviceSessionId: params.deviceSessionId,
    deviceId: params.deviceId,
    type: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SEC,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    const err: any = new Error('Malformed JWT token structure');
    err.code = 'INVALID_TOKEN';
    err.statusCode = 401;
    throw err;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) {
    const err: any = new Error('Invalid token signature');
    err.code = 'INVALID_SIGNATURE';
    err.statusCode = 401;
    throw err;
  }

  const payload: AccessTokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    const err: any = new Error('Access token has expired');
    err.code = 'TOKEN_EXPIRED';
    err.statusCode = 401;
    throw err;
  }

  if (payload.type !== 'access') {
    const err: any = new Error('Invalid token type');
    err.code = 'INVALID_TOKEN_TYPE';
    err.statusCode = 401;
    throw err;
  }

  return payload;
}

// 3. MFA Pending Session Tokens
export function signMfaSessionToken(params: {
  userId: string;
  role: UserRole;
  deviceId: string;
  deviceName: string;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload: MfaTokenPayload = {
    sub: params.userId,
    role: params.role,
    deviceId: params.deviceId,
    deviceName: params.deviceName,
    type: 'mfa_pending',
    iat: now,
    exp: now + MFA_TOKEN_TTL_SEC,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyMfaSessionToken(token: string): MfaTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    const err: any = new Error('Malformed MFA session token');
    err.code = 'INVALID_TOKEN';
    err.statusCode = 401;
    throw err;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) {
    const err: any = new Error('Invalid MFA token signature');
    err.code = 'INVALID_SIGNATURE';
    err.statusCode = 401;
    throw err;
  }

  const payload: MfaTokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    const err: any = new Error('MFA session token expired. Please log in again.');
    err.code = 'MFA_TOKEN_EXPIRED';
    err.statusCode = 401;
    throw err;
  }

  if (payload.type !== 'mfa_pending') {
    const err: any = new Error('Invalid token intended for MFA verification');
    err.code = 'INVALID_TOKEN_TYPE';
    err.statusCode = 401;
    throw err;
  }

  return payload;
}

// 4. Raw Refresh Tokens & Hashing
export function generateRawRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
