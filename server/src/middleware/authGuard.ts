import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedUser {
  id: string;
  role: 'asha' | 'anm' | 'medical_officer' | 'admin' | 'patient';
  scopes: string[];
  deviceSessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // For testing / simulated dev tokens in Phase 1:
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.envelopeError('UNAUTHORIZED', 'Authentication token required', undefined, 401);
    return;
  }

  const token = authHeader.substring(7);

  // Simulation token decoder (to be wired to full Argon2 / JWT verification in Auth Phase)
  try {
    if (token.startsWith('sim_user_')) {
      let role: AuthenticatedUser['role'] = 'asha';
      if (token.includes('medical_officer')) {
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

      let scopes: string[] = [];
      if (role === 'admin' || role === 'medical_officer') {
        scopes = [
          'screening:create',
          'screening:read',
          'referral:review',
          'storage:read_clinical',
          'telemedicine:consult',
        ];
      } else if (role === 'asha' || role === 'anm') {
        scopes = ['screening:create', 'screening:read', 'storage:read_clinical'];
      } else if (role === 'patient') {
        scopes = ['patient:read_own'];
      } else {
        scopes = [];
      }

      req.user = {
        id: `user_${token.replace('sim_user_', '')}`,
        role,
        scopes,
      };
      next();
      return;
    }

    res.envelopeError('INVALID_TOKEN', 'Session token invalid or expired', undefined, 401);
  } catch {
    res.envelopeError('AUTH_ERROR', 'Authentication verification failed', undefined, 401);
  }
}

export function requireScope(...requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.envelopeError('UNAUTHORIZED', 'Authentication required', undefined, 401);
      return;
    }

    const hasScope = requiredScopes.every((scope) => req.user?.scopes?.includes(scope));
    if (!hasScope) {
      res.envelopeError(
        'FORBIDDEN',
        `Access denied. Required scope(s): ${requiredScopes.join(', ')}`,
        { userScopes: req.user.scopes },
        403
      );
      return;
    }

    next();
  };
}
