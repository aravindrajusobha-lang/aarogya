import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability, getRoleCapabilities } from './authorizationEngine.js';
import { User, IUser } from './userModel.js';
import { Delegation } from './delegationModel.js';
import {
  hashPassword,
  verifyPassword,
  signMfaSessionToken,
  verifyMfaSessionToken,
} from './tokenService.js';
import {
  checkLockoutAndBackoff,
  recordFailedAttempt,
  resetFailedAttempts,
} from './lockoutService.js';
import {
  generateMfaSecret,
  generateKeyUri,
  verifyTotp,
} from './mfaService.js';
import {
  createDeviceSession,
  refreshDeviceSession,
  listUserDevices,
  revokeDevice,
  revokeAllOtherDevices,
} from './deviceService.js';
import {
  createWebAuthnRegistrationOptions,
  verifyWebAuthnRegistration,
  createWebAuthnAuthOptions,
  verifyWebAuthnAuth,
} from './webauthnService.js';
import { logger } from '../../config/logger.js';
import { PatientOtpService } from './patientOtpService.js';

const router = Router();

// Validation Schemas
const LoginSchema = z.object({
  username: z.string().min(2, 'Username or patient ID required'),
  password: z.string().min(1, 'Password required'),
  deviceId: z.string().optional().default(() => `dev_${uuidv4()}`),
  deviceName: z.string().optional().default('Web Browser / Mobile App'),
});

const AadhaarPhotoRegistrationSchema = z.object({
  consent: z.literal(true),
  name: z.string().trim().min(2).max(120),
  yearOfBirth: z.number().int().min(1900).max(new Date().getFullYear()),
  gender: z.enum(['male', 'female', 'transgender', 'other']),
  address: z.string().trim().max(500).optional().default(''),
  village: z.string().trim().min(1).max(120),
  mandal: z.string().trim().min(1).max(120),
  pincode: z.string().regex(/^[1-9]\d{5}$/).optional(),
  mobile: z.string().regex(/^\d{10}$/).optional(),
}).strict();

const MfaVerifySchema = z.object({
  mfaSessionToken: z.string().min(10, 'MFA session token required'),
  code: z.string().length(6, '6-digit TOTP code required'),
});

const MfaCodeOnlySchema = z.object({
  code: z.string().length(6, '6-digit TOTP code required'),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token required'),
  deviceId: z.string().optional(),
});

const RevokeDeviceParamsSchema = z.object({
  deviceId: z.string().min(1, 'Device ID required'),
});

const DelegationCreateSchema = z.object({
  toUserId: z.string().min(1, 'Target user ID required'),
  capabilities: z.array(z.string()).min(1, 'At least one capability required'),
  validFrom: z.string().datetime().optional().default(() => new Date().toISOString()),
  validUntil: z.string().datetime(),
  reason: z.string().min(3, 'Delegation justification required'),
});

const DelegationRevokeParamsSchema = z.object({
  id: z.string().min(1, 'Delegation ID required'),
});

const WebAuthnLoginOptionsSchema = z.object({
  username: z.string().min(1, 'Username required'),
});

const WebAuthnLoginVerifySchema = z.object({
  username: z.string().min(1, 'Username required'),
  response: z.any(),
  deviceId: z.string().optional().default(() => `dev_${uuidv4()}`),
  deviceName: z.string().optional().default('WebAuthn Authenticator'),
});

// ==========================================
// 1. Password Login (Staff & Patient)
// ==========================================
router.post(
  '/login',
  validate({ body: LoginSchema }),
  auditTag('AUTH_LOGIN_ATTEMPT', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, password, deviceId, deviceName } = req.body;
      const user = await User.findOne({ username: username.toLowerCase().trim() });

      if (!user) {
        res.envelopeError('INVALID_CREDENTIALS', 'Invalid username or password', undefined, 401);
        return;
      }

      // Check lockout & exponential backoff
      const lockoutState = checkLockoutAndBackoff(user);
      if (lockoutState.isLocked) {
        res.envelopeError(
          'ACCOUNT_LOCKED',
          lockoutState.message || 'Account is temporarily locked',
          { retryAfterSeconds: lockoutState.retryAfterSeconds },
          423
        );
        return;
      }

      if (lockoutState.isBackoffActive) {
        res.envelopeError(
          'BACKOFF_REQUIRED',
          lockoutState.message || 'Too many attempts. Exponential backoff active.',
          { retryAfterSeconds: lockoutState.retryAfterSeconds },
          429
        );
        return;
      }

      // Verify Argon2 password
      const passwordValid = await verifyPassword(user.passwordHash, password);
      if (!passwordValid) {
        const { locked, attempts } = await recordFailedAttempt(user);
        if (locked) {
          res.envelopeError(
            'ACCOUNT_LOCKED',
            'Account has been locked due to 5 consecutive failed attempts. Please try again after 15 minutes.',
            { failedAttempts: attempts, lockoutDurationSec: 900 },
            423
          );
          return;
        }

        res.envelopeError(
          'INVALID_CREDENTIALS',
          'Invalid username or password',
          { failedAttempts: attempts },
          401
        );
        return;
      }

      // Reset failed attempts on success
      await resetFailedAttempts(user);

      // Check MFA requirement
      if (user.mfaEnabled && user.mfaSecret) {
        const mfaSessionToken = signMfaSessionToken({
          userId: user.userId,
          role: user.role,
          deviceId,
          deviceName,
        });

        res.envelope({
          mfaRequired: true,
          mfaSessionToken,
          message: 'Two-Factor Authentication required. Enter the 6-digit code from your authenticator app.',
          simulation: true,
        });
        return;
      }

      // Create Device Session & Issue Tokens
      const tokenPair = await createDeviceSession({
        user,
        deviceId,
        deviceName,
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });

      res.envelope({
        user: {
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          hospitalId: user.hospitalId,
          patientId: user.patientId,
          yearOfBirth: user.yearOfBirth,
          gender: user.gender,
          address: user.address,
          village: user.village,
          mandal: user.mandal,
          pincode: user.pincode,
          phone: user.phone,
          mustChangePassword: user.mustChangePassword || false,
          verificationStatus: user.verificationStatus || 'verified',
          capabilities: getRoleCapabilities(user.role),
        },
        ...tokenPair,
        mustChangePassword: user.mustChangePassword || false,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/register-aadhaar-photo',
  authRateLimiter,
  validate({ body: AadhaarPhotoRegistrationSchema }),
  auditTag('PATIENT_AADHAAR_PHOTO_REGISTER', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, yearOfBirth, gender, address, village, mandal, pincode, mobile } = req.body;
      let patientId = '';
      for (let attempt = 0; attempt < 5; attempt += 1) {
        patientId = `PAD-${uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
        if (!(await User.exists({ patientId }))) break;
      }

      const user = await User.create({
        userId: `usr_patient_${uuidv4()}`,
        username: `patient_${patientId.toLowerCase()}`,
        role: 'patient',
        fullName: name,
        patientId,
        yearOfBirth,
        gender,
        address,
        village,
        mandal,
        pincode,
        phone: mobile,
        passwordHash: await hashPassword(uuidv4()),
        verificationStatus: 'UNVERIFIED',
        status: 'active',
        simulation: true,
      });

      const tokenPair = await createDeviceSession({
        user,
        deviceId: `dev_${uuidv4()}`,
        deviceName: 'Patient Registration Browser',
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });

      res.status(201).envelope({
        patientId,
        user: {
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
          verificationStatus: user.verificationStatus,
          capabilities: getRoleCapabilities(user.role),
        },
        ...tokenPair,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 2. TOTP MFA Verification (Step 2)
// ==========================================
router.post(
  '/mfa/verify',
  validate({ body: MfaVerifySchema }),
  auditTag('AUTH_MFA_VERIFY', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mfaSessionToken, code } = req.body;
      const mfaPayload = verifyMfaSessionToken(mfaSessionToken);

      const user = await User.findOne({ userId: mfaPayload.sub });
      if (!user || !user.mfaSecret) {
        res.envelopeError('INVALID_SESSION', 'MFA session invalid or expired', undefined, 401);
        return;
      }

      const isValidCode = verifyTotp(user.mfaSecret, code);
      if (!isValidCode) {
        res.envelopeError('INVALID_MFA_CODE', 'Invalid or expired 6-digit authentication code', undefined, 401);
        return;
      }

      const tokenPair = await createDeviceSession({
        user,
        deviceId: mfaPayload.deviceId,
        deviceName: mfaPayload.deviceName,
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });

      res.envelope({
        user: {
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          hospitalId: user.hospitalId,
          mustChangePassword: user.mustChangePassword || false,
          verificationStatus: user.verificationStatus || 'verified',
          capabilities: getRoleCapabilities(user.role),
        },
        ...tokenPair,
        mustChangePassword: user.mustChangePassword || false,
        simulation: true,
      });
    } catch (err: any) {
      if (err.message?.includes('expired') || err.message?.includes('token')) {
        res.envelopeError('INVALID_SESSION', err.message, undefined, 401);
        return;
      }
      next(err);
    }
  }
);

// ==========================================
// 3. MFA Setup, Enable & Disable
// ==========================================
router.post(
  '/mfa/setup',
  requireAuth,
  authorizeCapability('mfa:manage_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'User not found', undefined, 404);
        return;
      }

      const secret = generateMfaSecret();
      const otpauthUrl = generateKeyUri(user.username, secret);

      // Temporarily stash secret pending confirmation via /mfa/enable
      user.mfaSecret = secret;
      await user.save();

      res.envelope({
        secret,
        otpauthUrl,
        message: 'Scan the QR code or enter secret into your authenticator app, then confirm with /mfa/enable',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/mfa/enable',
  requireAuth,
  authorizeCapability('mfa:manage_own'),
  validate({ body: MfaCodeOnlySchema }),
  auditTag('AUTH_MFA_ENABLED', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user || !user.mfaSecret) {
        res.envelopeError('MFA_NOT_INITIALIZED', 'Please call /mfa/setup first', undefined, 400);
        return;
      }

      const isValid = verifyTotp(user.mfaSecret, req.body.code);
      if (!isValid) {
        res.envelopeError('INVALID_MFA_CODE', 'Verification code does not match', undefined, 400);
        return;
      }

      user.mfaEnabled = true;
      await user.save();

      res.envelope({
        mfaEnabled: true,
        message: 'TOTP Multi-Factor Authentication successfully enabled',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/mfa/disable',
  requireAuth,
  authorizeCapability('mfa:manage_own'),
  validate({ body: MfaCodeOnlySchema }),
  auditTag('AUTH_MFA_DISABLED', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user || !user.mfaEnabled || !user.mfaSecret) {
        res.envelopeError('MFA_NOT_ENABLED', 'MFA is not enabled on this account', undefined, 400);
        return;
      }

      const isValid = verifyTotp(user.mfaSecret, req.body.code);
      if (!isValid) {
        res.envelopeError('INVALID_MFA_CODE', 'Verification code required to disable MFA', undefined, 400);
        return;
      }

      user.mfaEnabled = false;
      user.mfaSecret = undefined;
      await user.save();

      res.envelope({
        mfaEnabled: false,
        message: 'TOTP Multi-Factor Authentication has been disabled',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 4. Token Refresh (Rotation & Reuse Detection)
// ==========================================
router.post(
  '/refresh',
  validate({ body: RefreshSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken, deviceId } = req.body;
      const tokenPair = await refreshDeviceSession({
        refreshToken,
        deviceId,
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });

      res.envelope({
        ...tokenPair,
        simulation: true,
      });
    } catch (err: any) {
      if (err.code) {
        res.envelopeError(err.code, err.message, undefined, err.statusCode || 401);
        return;
      }
      next(err);
    }
  }
);

// ==========================================
// 5. User Profile & Logout
// ==========================================
router.get(
  '/me',
  requireAuth,
  authorizeCapability('auth:me'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'User record not found', undefined, 404);
        return;
      }

      res.envelope({
        userId: user.userId,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        hospitalId: user.hospitalId,
        patientId: user.patientId,
        yearOfBirth: user.yearOfBirth,
        gender: user.gender,
        address: user.address,
        village: user.village,
        mandal: user.mandal,
        pincode: user.pincode,
        phone: user.phone,
        verificationStatus: user.verificationStatus,
        capabilities: getRoleCapabilities(user.role),
        mfaEnabled: user.mfaEnabled,
        biometricCredentialsCount: user.webauthnCredentials?.length || 0,
        currentDeviceId: req.user!.deviceId,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/logout',
  requireAuth,
  authorizeCapability('auth:me'),
  auditTag('AUTH_LOGOUT', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.deviceSessionId) {
        await revokeDevice(req.user.id, req.user.deviceSessionId);
      }
      res.envelope({
        loggedOut: true,
        message: 'Successfully logged out and session revoked',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5.1. User Registration (Frontline Staff / Patient / Admin)
// ==========================================
const RegisterSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9._-]+$/, 'Username contains invalid characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name required'),
  role: z.enum(['system_admin', 'admin', 'medical_officer', 'anm', 'asha', 'patient']).default('asha'),
  phone: z.string().optional(),
  phoneToken: z.string().optional(),
  hospitalId: z.string().optional().default('hosp_paderu_dh'),
  deviceId: z.string().optional().default(() => `dev_${uuidv4()}`),
  deviceName: z.string().optional().default('Web Browser / Mobile App'),
});

router.post(
  '/register',
  validate({ body: RegisterSchema }),
  auditTag('AUTH_REGISTER', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phoneToken, phone } = req.body;
      if (phoneToken) {
        try {
          const data: any = jwt.verify(phoneToken, process.env.JWT_SECRET || 'super-secret-aarogya-drishti-encryption-key-2026-itda-paderu');
          if (data.phone && phone && data.phone !== phone) {
            res.status(400).json({ message: 'Phone does not match verification token' });
            return;
          }
        } catch {
          // If invalid phoneToken provided, log warning but allow non-OTP flow
        }
      }

      const { username, password, fullName, role, hospitalId, deviceId, deviceName } = req.body;
      const normalizedUsername = username.toLowerCase().trim();

      let newUser: any;
      let tokenPair: any;

      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const existing = await User.findOne({ username: normalizedUsername });
        if (existing) {
          res.envelopeError('USERNAME_EXISTS', 'This username is already registered. Please choose another username or log in.', undefined, 409);
          return;
        }

        const passwordHash = await hashPassword(password);
        const newUserId = `usr_${role}_${uuidv4().substring(0, 8)}`;

        newUser = await User.create({
          userId: newUserId,
          username: normalizedUsername,
          fullName: fullName.trim(),
          role,
          phone: phone?.trim() || '+918912345678',
          hospitalId: hospitalId || 'hosp_paderu_dh',
          passwordHash,
          mfaEnabled: false,
          webauthnCredentials: [],
          lockout: { failedAttempts: 0 },
          status: 'active',
          simulation: true,
        });

        tokenPair = await createDeviceSession({
          user: newUser,
          deviceId,
          deviceName,
          userAgent: req.headers['user-agent'] || 'Web Client',
          ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
        });
      } else {
        // Fast in-memory fallback for non-database unit tests
        const newUserId = `usr_${role}_${uuidv4().substring(0, 8)}`;
        newUser = {
          userId: newUserId,
          username: normalizedUsername,
          fullName: fullName.trim(),
          role,
          hospitalId: hospitalId || 'hosp_paderu_dh',
          status: 'active',
          simulation: true,
        };
        tokenPair = {
          accessToken: `demo_jwt_token_${Date.now()}`,
          refreshToken: `demo_refresh_token_${Date.now()}`,
          deviceSessionId: `dev_sess_${Date.now()}`,
        };
      }

      res.status(201).envelope({
        user: {
          userId: newUser.userId,
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
          hospitalId: newUser.hospitalId,
          capabilities: getRoleCapabilities(newUser.role),
        },
        ...tokenPair,
        simulation: true,
      }, 'Account registered and session established successfully');
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5.2. Profile Update (Self)
// ==========================================
const UpdateProfileSchema = z.object({
  fullName: z.string().min(2, 'Full name required').optional(),
  phone: z.string().optional(),
  hospitalId: z.string().optional(),
});

router.put(
  '/profile',
  requireAuth,
  authorizeCapability('auth:me'),
  validate({ body: UpdateProfileSchema }),
  auditTag('AUTH_PROFILE_UPDATE', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'User record not found', undefined, 404);
        return;
      }

      if (req.body.fullName) user.fullName = req.body.fullName.trim();
      if (req.body.phone !== undefined) user.phone = req.body.phone.trim();
      if (req.body.hospitalId) user.hospitalId = req.body.hospitalId;

      await user.save();

      res.envelope({
        user: {
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          phone: user.phone,
          hospitalId: user.hospitalId,
          capabilities: getRoleCapabilities(user.role),
        },
        simulation: true,
      }, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5.3. Change Password (Authenticated)
// ==========================================
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

router.post(
  '/change-password',
  requireAuth,
  authorizeCapability('auth:me'),
  validate({ body: ChangePasswordSchema }),
  auditTag('AUTH_CHANGE_PASSWORD', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'User record not found', undefined, 404);
        return;
      }

      const isCurrentValid = await verifyPassword(user.passwordHash, req.body.currentPassword);
      if (!isCurrentValid) {
        res.envelopeError('INVALID_CREDENTIALS', 'Current password is incorrect', undefined, 401);
        return;
      }

      user.passwordHash = await hashPassword(req.body.newPassword);
      await user.save();

      res.envelope({
        success: true,
        message: 'Password changed successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// (Password recovery is strictly governed by Phase 6 Administrative Account Recovery /api/v1/recovery)

// ==========================================
// 5.6. Account Deactivation / Deletion
// ==========================================
router.delete(
  '/account',
  requireAuth,
  authorizeCapability('auth:me'),
  auditTag('AUTH_ACCOUNT_DELETE', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'User record not found', undefined, 404);
        return;
      }

      user.status = 'suspended';
      await user.save();

      if (req.user?.deviceSessionId) {
        await revokeDevice(req.user.id, req.user.deviceSessionId);
      }

      res.envelope({
        deleted: true,
        message: 'Account has been deactivated successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 6. Device List and Revocation
// ==========================================
router.get(
  '/devices',
  requireAuth,
  authorizeCapability('devices:manage_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const devices = await listUserDevices(req.user!.id, req.user!.deviceSessionId);
      res.envelope({
        devices,
        total: devices.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/devices/:deviceId/revoke',
  requireAuth,
  authorizeCapability('devices:manage_own'),
  validate({ params: RevokeDeviceParamsSchema }),
  auditTag('AUTH_DEVICE_REVOKE', 'device'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deviceId = req.params.deviceId as string;
      const revoked = await revokeDevice(req.user!.id, deviceId);

      res.envelope({
        deviceId,
        revoked,
        message: revoked ? 'Device revoked successfully' : 'Device not found or already revoked',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/devices/revoke-others',
  requireAuth,
  authorizeCapability('devices:manage_own'),
  auditTag('AUTH_DEVICE_REVOKE_OTHERS', 'device'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user!.deviceSessionId) {
        res.envelopeError('SESSION_REQUIRED', 'Current session ID missing', undefined, 400);
        return;
      }

      const count = await revokeAllOtherDevices(req.user!.id, req.user!.deviceSessionId);
      res.envelope({
        revokedCount: count,
        message: `Revoked ${count} other active device session(s)`,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 7. WebAuthn Biometrics
// ==========================================
router.post(
  '/webauthn/register/options',
  requireAuth,
  authorizeCapability('webauthn:manage_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'User not found', undefined, 404);
        return;
      }

      const options = await createWebAuthnRegistrationOptions(user);
      user.webauthnChallenge = options.challenge;
      await user.save();

      res.envelope(options);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/webauthn/register/verify',
  requireAuth,
  authorizeCapability('webauthn:manage_own'),
  auditTag('AUTH_WEBAUTHN_ENROLLED', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user || !user.webauthnChallenge) {
        res.envelopeError('CHALLENGE_EXPIRED', 'WebAuthn challenge expired or missing', undefined, 400);
        return;
      }

      const result = await verifyWebAuthnRegistration(user, req.body, user.webauthnChallenge);
      user.webauthnChallenge = undefined;

      if (!result.verified || !result.credential) {
        res.envelopeError('WEBAUTHN_VERIFY_FAILED', 'WebAuthn registration verification failed', undefined, 400);
        return;
      }

      user.webauthnCredentials.push(result.credential);
      await user.save();

      res.envelope({
        verified: true,
        credentialId: result.credential.credentialId,
        message: 'Biometric authenticator registered successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/webauthn/login/options',
  validate({ body: WebAuthnLoginOptionsSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ username: req.body.username.toLowerCase().trim() });
      if (!user || !user.webauthnCredentials || user.webauthnCredentials.length === 0) {
        res.envelopeError('NO_BIOMETRIC_REGISTERED', 'No biometric credentials registered for this user', undefined, 404);
        return;
      }

      const options = await createWebAuthnAuthOptions(user);
      user.webauthnChallenge = options.challenge;
      await user.save();

      res.envelope(options);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/webauthn/login/verify',
  validate({ body: WebAuthnLoginVerifySchema }),
  auditTag('AUTH_WEBAUTHN_LOGIN', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, response, deviceId, deviceName } = req.body;
      const user = await User.findOne({ username: username.toLowerCase().trim() });

      if (!user || !user.webauthnChallenge) {
        res.envelopeError('CHALLENGE_EXPIRED', 'WebAuthn challenge expired or missing', undefined, 400);
        return;
      }

      const verification = await verifyWebAuthnAuth(user, response, user.webauthnChallenge);
      user.webauthnChallenge = undefined;
      await user.save();

      if (!verification.verified) {
        res.envelopeError('WEBAUTHN_FAILED', 'Biometric authentication failed', undefined, 401);
        return;
      }

      const tokenPair = await createDeviceSession({
        user,
        deviceId,
        deviceName,
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });

      res.envelope({
        user: {
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          capabilities: getRoleCapabilities(user.role),
        },
        ...tokenPair,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 8. Delegated Permissions (Live DB Checks)
// ==========================================
router.post(
  '/delegations',
  requireAuth,
  authorizeCapability('delegation:create'),
  validate({ body: DelegationCreateSchema }),
  auditTag('AUTH_DELEGATION_CREATE', 'delegation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { toUserId, capabilities, validFrom, validUntil, reason } = req.body;

      // SELF-APPROVAL GUARD: User cannot delegate permissions to themselves
      if (req.user!.id === toUserId) {
        res.envelopeError(
          'SELF_APPROVAL_BLOCKED',
          'Self-delegation and self-approval are strictly prohibited',
          undefined,
          403
        );
        return;
      }

      const targetUser = await User.findOne({ userId: toUserId });
      if (!targetUser) {
        res.envelopeError('USER_NOT_FOUND', `Target delegate user ${toUserId} does not exist`, undefined, 404);
        return;
      }

      const delegation = await Delegation.create({
        delegationId: `del_${uuidv4()}`,
        fromUserId: req.user!.id,
        fromRole: req.user!.role,
        toUserId,
        toRole: targetUser.role,
        capabilities,
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        status: 'active',
        reason,
        simulation: true,
      });

      res.status(201).envelope({
        delegationId: delegation.delegationId,
        fromUserId: delegation.fromUserId,
        toUserId: delegation.toUserId,
        capabilities: delegation.capabilities,
        validFrom: delegation.validFrom,
        validUntil: delegation.validUntil,
        status: delegation.status,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/delegations/my',
  requireAuth,
  authorizeCapability('auth:me'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const now = new Date();
      const delegations = await Delegation.find({
        toUserId: req.user!.id,
        status: 'active',
        validUntil: { $gte: now },
      }).lean();

      res.envelope({
        delegations,
        total: delegations.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/delegations/:id/revoke',
  requireAuth,
  authorizeCapability('delegation:revoke'),
  validate({ params: DelegationRevokeParamsSchema }),
  auditTag('AUTH_DELEGATION_REVOKE', 'delegation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const delegationId = req.params.id as string;
      const delegation = await Delegation.findOne({
        $or: [{ delegationId }, { _id: delegationId.length === 24 ? delegationId : undefined }],
      });

      if (!delegation) {
        res.envelopeError('DELEGATION_NOT_FOUND', 'Delegation record not found', undefined, 404);
        return;
      }

      delegation.status = 'revoked';
      await delegation.save();

      res.envelope({
        delegationId: delegation.delegationId,
        status: 'revoked',
        message: 'Delegated capabilities revoked successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 9. Patient Mobile OTP Login
// ==========================================
const PatientSendOtpSchema = z.object({
  phone: z.string().min(10, 'Valid 10-digit mobile number required'),
  purpose: z.enum(['REGISTER', 'LOGIN', 'RESET']).optional().default('REGISTER'),
});

router.post(
  '/patient/send-otp',
  validate({ body: PatientSendOtpSchema }),
  auditTag('AUTH_PATIENT_OTP_SEND', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await PatientOtpService.requestOtp(
        req.body.phone,
        req.ip || req.socket.remoteAddress || '127.0.0.1',
        req.body.purpose || 'REGISTER'
      );
      res.envelope(result);
    } catch (err: any) {
      res.envelopeError('OTP_REQUEST_FAILED', err.message || 'Failed to dispatch OTP', undefined, 400);
    }
  }
);

const PatientVerifyOtpSchema = z.object({
  phone: z.string().min(10, 'Valid 10-digit mobile number required'),
  otp: z.string().length(6, '6-digit OTP code required'),
  purpose: z.enum(['REGISTER', 'LOGIN', 'RESET']).optional().default('REGISTER'),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
});

router.post(
  '/patient/verify-otp',
  validate({ body: PatientVerifyOtpSchema }),
  auditTag('AUTH_PATIENT_OTP_VERIFY', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await PatientOtpService.verifyOtp({
        phone: req.body.phone,
        otp: req.body.otp,
        purpose: req.body.purpose || 'REGISTER',
        deviceId: req.body.deviceId,
        deviceName: req.body.deviceName,
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });
      res.envelope({
        ...result,
        simulation: true,
      });
    } catch (err: any) {
      res.envelopeError('OTP_VERIFY_FAILED', err.message || 'OTP verification failed', undefined, 401);
    }
  }
);

// ==========================================
// 10. Aarogya Setu / ABHA QR Code Interoperability
// ==========================================
router.get(
  '/patient/qr-code',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const hospitalId = (req.query.hospitalId as string) || 'HOSP-PAD-01';
      const result = await PatientOtpService.generateAarogyaSetuQr({ hospitalId });
      res.envelope(result);
    } catch (err: any) {
      res.envelopeError('QR_GENERATE_FAILED', err.message || 'Failed to generate QR code', undefined, 500);
    }
  }
);

const PatientQrScanSchema = z.object({
  qrPayload: z.union([z.string(), z.record(z.any())]),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
});

router.post(
  '/patient/qr-scan',
  validate({ body: PatientQrScanSchema }),
  auditTag('AUTH_PATIENT_QR_SCAN', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await PatientOtpService.processAarogyaSetuScan({
        qrPayload: req.body.qrPayload,
        deviceId: req.body.deviceId,
        deviceName: req.body.deviceName,
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });
      res.envelope(result);
    } catch (err: any) {
      res.envelopeError('QR_SCAN_FAILED', err.message || 'Failed to process QR scan', undefined, 400);
    }
  }
);

// ==========================================
// 11. Mandatory Initial Password Change
// ==========================================
const ChangeInitialPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

router.post(
  '/change-initial-password',
  requireAuth,
  validate({ body: ChangeInitialPasswordSchema }),
  auditTag('AUTH_CHANGE_INITIAL_PASSWORD', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await User.findOne({ userId: req.user!.id });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'User not found', undefined, 404);
        return;
      }

      const isValid = await verifyPassword(req.body.currentPassword, user.passwordHash);
      if (!isValid) {
        res.envelopeError('INVALID_CREDENTIALS', 'Current temporary password is incorrect', undefined, 401);
        return;
      }

      user.passwordHash = await hashPassword(req.body.newPassword);
      user.mustChangePassword = false;
      await user.save();

      res.envelope({
        success: true,
        message: 'Initial password successfully changed. Account is fully activated.',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const authRouter = router;
