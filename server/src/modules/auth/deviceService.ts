import { v4 as uuidv4 } from 'uuid';
import { DeviceSession, IDeviceSession } from './deviceSessionModel.js';
import { User, IUser, UserRole } from './userModel.js';
import {
  generateRawRefreshToken,
  hashToken,
  signAccessToken,
} from './tokenService.js';
import { getRoleCapabilities } from './authorizationEngine.js';
import { logger } from '../../config/logger.js';

const REFRESH_TTL_DAYS = 30;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  deviceSessionId: string;
}

export async function createDeviceSession(params: {
  user: IUser;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ip: string;
}): Promise<TokenPair> {
  const sessionId = `ses_${uuidv4()}`;
  const rawRefreshToken = generateRawRefreshToken();
  const refreshTokenHash = hashToken(rawRefreshToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  // If a session already exists for this exact deviceId and userId, mark old as revoked or replace
  await DeviceSession.updateMany(
    { userId: params.user.userId, deviceId: params.deviceId, status: 'active' },
    { $set: { status: 'revoked', revokedAt: now, revocationReason: 're_authenticated' } }
  );

  const session = await DeviceSession.create({
    sessionId,
    userId: params.user.userId,
    deviceId: params.deviceId,
    deviceName: params.deviceName || 'Personal Device',
    userAgent: params.userAgent || 'Unknown',
    ip: params.ip,
    refreshTokenHash,
    status: 'active',
    lastActiveAt: now,
    expiresAt,
    simulation: true,
  });

  const scopes = getRoleCapabilities(params.user.role);
  const accessToken = signAccessToken({
    userId: params.user.userId,
    role: params.user.role,
    scopes,
    deviceSessionId: session.sessionId,
    deviceId: params.deviceId,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresInSec: 15 * 60,
    deviceSessionId: session.sessionId,
  };
}

export async function refreshDeviceSession(params: {
  refreshToken: string;
  deviceId?: string;
  ip: string;
}): Promise<TokenPair> {
  const incomingHash = hashToken(params.refreshToken);

  // 1. Check for token reuse / replay attack against previousRefreshTokenHash
  const reusedSession = await DeviceSession.findOne({
    previousRefreshTokenHash: incomingHash,
  });

  if (reusedSession) {
    // SECURITY ALARM: An already rotated refresh token was reused!
    // Revoke the session immediately to protect user account
    reusedSession.status = 'revoked';
    reusedSession.revokedAt = new Date();
    reusedSession.revocationReason = 'refresh_token_reuse_detected';
    await reusedSession.save();

    logger.warn({
      event: 'security_refresh_reuse_detected',
      userId: reusedSession.userId,
      sessionId: reusedSession.sessionId,
      deviceId: reusedSession.deviceId,
      ip: params.ip,
    });

    const err = new Error('Refresh token reuse detected. Device session revoked for security.');
    (err as any).code = 'REFRESH_TOKEN_REUSE_DETECTED';
    (err as any).statusCode = 401;
    throw err;
  }

  // 2. Locate active session by current refreshTokenHash
  const session = await DeviceSession.findOne({ refreshTokenHash: incomingHash });
  if (!session) {
    const err = new Error('Invalid or unrecognized refresh token');
    (err as any).code = 'INVALID_REFRESH_TOKEN';
    (err as any).statusCode = 401;
    throw err;
  }

  // 3. Check if session was revoked
  if (session.status === 'revoked') {
    const err = new Error('Device session has been revoked');
    (err as any).code = 'DEVICE_REVOKED';
    (err as any).statusCode = 401;
    throw err;
  }

  // 4. Check if session expired
  if (session.expiresAt.getTime() < Date.now()) {
    session.status = 'revoked';
    session.revocationReason = 'expired';
    await session.save();

    const err = new Error('Device session has expired');
    (err as any).code = 'SESSION_EXPIRED';
    (err as any).statusCode = 401;
    throw err;
  }

  // 5. Check if user is still active
  const user = await User.findOne({ userId: session.userId });
  if (!user || user.status !== 'active') {
    const err = new Error('User account is inactive or locked');
    (err as any).code = 'USER_INACTIVE';
    (err as any).statusCode = 403;
    throw err;
  }

  // 6. Token Rotation: Rotate refresh token & advance previousRefreshTokenHash
  const newRawRefreshToken = generateRawRefreshToken();
  const newHash = hashToken(newRawRefreshToken);

  session.previousRefreshTokenHash = session.refreshTokenHash;
  session.refreshTokenHash = newHash;
  session.lastActiveAt = new Date();
  session.ip = params.ip;
  await session.save();

  const scopes = getRoleCapabilities(user.role);
  const accessToken = signAccessToken({
    userId: user.userId,
    role: user.role,
    scopes,
    deviceSessionId: session.sessionId,
    deviceId: session.deviceId,
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    expiresInSec: 15 * 60,
    deviceSessionId: session.sessionId,
  };
}

export async function listUserDevices(userId: string, currentSessionId?: string) {
  const sessions = await DeviceSession.find({ userId }).sort({ lastActiveAt: -1 }).lean();

  return sessions.map((s) => ({
    sessionId: s.sessionId,
    deviceId: s.deviceId,
    deviceName: s.deviceName,
    userAgent: s.userAgent,
    ip: s.ip,
    status: s.status,
    lastActiveAt: s.lastActiveAt,
    isCurrentDevice: s.sessionId === currentSessionId,
    createdAt: s.createdAt,
  }));
}

export async function revokeDevice(userId: string, deviceIdOrSessionId: string): Promise<boolean> {
  const res = await DeviceSession.updateOne(
    {
      userId,
      $or: [{ deviceId: deviceIdOrSessionId }, { sessionId: deviceIdOrSessionId }],
      status: 'active',
    },
    {
      $set: {
        status: 'revoked',
        revokedAt: new Date(),
        revocationReason: 'user_requested_revocation',
      },
    }
  );

  return res.modifiedCount > 0;
}

export async function revokeAllOtherDevices(userId: string, currentSessionId: string): Promise<number> {
  const res = await DeviceSession.updateMany(
    {
      userId,
      sessionId: { $ne: currentSessionId },
      status: 'active',
    },
    {
      $set: {
        status: 'revoked',
        revokedAt: new Date(),
        revocationReason: 'revoked_all_other_devices',
      },
    }
  );

  return res.modifiedCount;
}

export async function isDeviceSessionActive(sessionId: string): Promise<boolean> {
  const session = await DeviceSession.findOne({ sessionId });
  if (!session) return true;
  return session.status === 'active' && session.expiresAt.getTime() > Date.now();
}
