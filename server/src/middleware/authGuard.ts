import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../modules/auth/userModel.js';
import { verifyAccessToken } from '../modules/auth/tokenService.js';
import { isDeviceSessionActive } from '../modules/auth/deviceService.js';
import { getRoleCapabilities, hasCapability } from '../modules/auth/authorizationEngine.js';
import { User } from '../modules/auth/userModel.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  scopes: string[];
  deviceSessionId?: string;
  deviceId?: string;
  hospitalId?: string;
  userId?: string;
  fullName?: string;
  username?: string;
  patientId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.envelopeError('UNAUTHORIZED', 'Authentication token required', undefined, 401);
    return;
  }

  const token = authHeader.substring(7);

  try {
    // 1. Backward-compatible Phase 1 Simulation Tokens
    if (token.startsWith('sim_user_')) {
      let role: UserRole = 'asha';
      if (token.includes('system_admin')) {
        role = 'system_admin';
      } else if (token.includes('medical_officer')) {
        role = 'medical_officer';
      } else if (token.includes('admin')) {
        role = 'admin';
      } else if (token.includes('anm')) {
        role = 'anm';
      } else if (token.includes('patient')) {
        role = 'patient';
      } else if (token.includes('asha')) {
        role = 'asha';
      }

      const scopes = getRoleCapabilities(role);
      req.user = {
        id: `user_${token.replace('sim_user_', '')}`,
        role,
        scopes,
      };
      next();
      return;
    }

    // 2. Cryptographic Signed JWT Tokens
    const payload = verifyAccessToken(token);

    // 3. Live check: Verify device session has not been revoked
    if (payload.deviceSessionId) {
      const active = await isDeviceSessionActive(payload.deviceSessionId);
      if (!active) {
        res.envelopeError(
          'DEVICE_REVOKED',
          'Device session has been revoked. Please log in again.',
          undefined,
          401
        );
        return;
      }
    }

    const dbUser: any = await User.findOne({ userId: payload.sub })
      .select('userId fullName username role hospitalId patientId')
      .lean();

    req.user = {
      id: payload.sub,
      userId: dbUser?.userId || payload.sub,
      role: payload.role,
      scopes: payload.scopes || getRoleCapabilities(payload.role),
      deviceSessionId: payload.deviceSessionId,
      deviceId: payload.deviceId,
      hospitalId: dbUser?.hospitalId,
      fullName: dbUser?.fullName,
      username: dbUser?.username,
      patientId: dbUser?.patientId,
    };

    next();
  } catch (err: any) {
    if (err.message === 'Token has expired') {
      res.envelopeError('TOKEN_EXPIRED', 'Access token has expired', undefined, 401);
      return;
    }
    res.envelopeError('INVALID_TOKEN', 'Session token invalid or expired', undefined, 401);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    if (token.startsWith('sim_user_')) {
      let role: UserRole = 'asha';
      if (token.includes('system_admin')) role = 'system_admin';
      else if (token.includes('medical_officer')) role = 'medical_officer';
      else if (token.includes('admin')) role = 'admin';
      else if (token.includes('anm')) role = 'anm';
      else if (token.includes('patient')) role = 'patient';
      else if (token.includes('asha')) role = 'asha';

      req.user = {
        id: `user_${token.replace('sim_user_', '')}`,
        role,
        scopes: getRoleCapabilities(role),
      };
      return next();
    }

    const payload = verifyAccessToken(token);
    if (payload.deviceSessionId) {
      const active = await isDeviceSessionActive(payload.deviceSessionId);
      if (!active) {
        return next();
      }
    }

    const dbUser: any = await User.findOne({ userId: payload.sub })
      .select('userId fullName username role hospitalId patientId')
      .lean();
    req.user = {
      id: payload.sub,
      userId: dbUser?.userId || payload.sub,
      role: payload.role,
      scopes: payload.scopes || getRoleCapabilities(payload.role),
      deviceSessionId: payload.deviceSessionId,
      deviceId: payload.deviceId,
      hospitalId: dbUser?.hospitalId,
      fullName: dbUser?.fullName,
      username: dbUser?.username,
      patientId: dbUser?.patientId,
    };
    return next();
  } catch {
    return next();
  }
}

export function requireScope(...requiredScopes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.envelopeError('UNAUTHORIZED', 'Authentication required', undefined, 401);
      return;
    }

    // System admin has universal access
    if (req.user.role === 'system_admin') {
      next();
      return;
    }

    for (const scope of requiredScopes) {
      const allowed = await hasCapability(req.user, scope);
      if (!allowed) {
        res.envelopeError(
          'FORBIDDEN',
          `Access denied. Required scope(s): ${requiredScopes.join(', ')}`,
          { userScopes: req.user.scopes },
          403
        );
        return;
      }
    }

    next();
  };
}
