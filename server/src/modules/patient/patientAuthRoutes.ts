import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../../middleware/validate.js';
import { auditTag } from '../../middleware/auditTag.js';
import { PatientOtpService } from '../auth/patientOtpService.js';
import { User } from '../auth/userModel.js';
import { Patient } from '../patient/patientModel.js';
import { generateTribalPatientId } from '../patient/patientRoutes.js';
import { resolveInternalVillageId } from '../patient/patientRoutes.js';
import { logger } from '../../config/logger.js';

const router = Router();

const PatientRegisterSchema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit mobile number required'),
  gender: z.enum(['male', 'female', 'other']),
  yearOfBirth: z.number().int().min(1900).max(new Date().getFullYear()),
  village: z.string().min(1, 'Village required'),
  mandal: z.string().min(1, 'Mandal required'),
  pincode: z.string().regex(/^[1-9]\d{5}$/).optional(),
  address: z.string().max(500).optional().default(''),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  hospitalId: z.string().optional().default('hosp_paderu_dh'),
  consentGiven: z.literal(true),
  clientMutationId: z.string().uuid(),
});

const PatientLoginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit mobile number required'),
  otp: z.string().length(6, '6-digit OTP required').optional(),
  password: z.string().min(1).optional(),
  deviceId: z.string().optional().default(() => `dev_${uuidv4()}`),
  deviceName: z.string().optional().default('Patient Portal'),
}).refine(data => data.otp || data.password, {
  message: 'Either OTP or password is required',
  path: ['otp'],
});

const ForgotPasswordSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit mobile number required'),
});

const ResetPasswordSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, 'Valid 10-digit mobile number required'),
  otp: z.string().length(6, '6-digit OTP required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

// POST /api/patient/auth/register - consented patient registration (registration does not require OTP)
router.post(
  '/register',
  validate({ body: PatientRegisterSchema }),
  auditTag('PATIENT_REGISTER', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        fullName,
        phone,
        gender,
        yearOfBirth,
        village,
        mandal,
        pincode,
        address,
        password,
        hospitalId,
        clientMutationId,
      } = req.body;

      // Check for existing patient with this phone
      const existingUser = await User.findOne({ phone: `+91${phone}`, role: 'patient' });
      if (existingUser) {
        // Log in existing user instead
        const tokenPair = await (await import('../auth/deviceService.js')).createDeviceSession({
          user: existingUser,
          deviceId: `dev_${uuidv4()}`,
          deviceName: 'Patient Portal',
          userAgent: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
        });

        res.envelope({
          user: {
            userId: existingUser.userId,
            username: existingUser.username,
            fullName: existingUser.fullName,
            role: existingUser.role,
            hospitalId: existingUser.hospitalId,
            patientId: existingUser.patientId,
            phone: existingUser.phone,
            yearOfBirth: existingUser.yearOfBirth,
            gender: existingUser.gender,
            address: existingUser.address,
            village: existingUser.village,
            mandal: existingUser.mandal,
            pincode: existingUser.pincode,
            medicalHistory: existingUser.medicalHistory,
            allergies: existingUser.allergies,
            currentMedications: existingUser.currentMedications,
            habits: existingUser.habits,
            emergencyContact: existingUser.emergencyContact,
            insurance: existingUser.insurance,
            preferredLanguage: existingUser.preferredLanguage,
            profileCompleteness: existingUser.profileCompleteness,
            verificationStatus: existingUser.verificationStatus,
            capabilities: (await import('../auth/authorizationEngine.js')).getRoleCapabilities(existingUser.role),
          },
          ...tokenPair,
          existingAccount: true,
          simulation: true,
        }, 'Existing patient account found. Logged in successfully.');
        return;
      }

      // Check idempotency
      if (clientMutationId) {
        const { SyncLedger } = await import('../patient/syncLedgerModel.js');
        const existingLedger = await SyncLedger.findOne({ clientMutationId });
        if (existingLedger) {
          const existingPatient = await Patient.findOne({ patientId: existingLedger.entityId });
          const existingUser = existingPatient ? await User.findOne({ patientId: existingPatient.patientId }) : null;
          if (existingUser) {
            const tokenPair = await (await import('../auth/deviceService.js')).createDeviceSession({
              user: existingUser,
              deviceId: `dev_${uuidv4()}`,
              deviceName: 'Patient Portal',
              userAgent: req.headers['user-agent'] || 'Unknown',
              ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
            });
            res.status(200).envelope({
              user: {
                userId: existingUser.userId,
                username: existingUser.username,
                fullName: existingUser.fullName,
                role: existingUser.role,
                hospitalId: existingUser.hospitalId,
                patientId: existingUser.patientId,
                phone: existingUser.phone,
                yearOfBirth: existingUser.yearOfBirth,
                gender: existingUser.gender,
                address: existingUser.address,
                village: existingUser.village,
                mandal: existingUser.mandal,
                pincode: existingUser.pincode,
                capabilities: (await import('../auth/authorizationEngine.js')).getRoleCapabilities(existingUser.role),
              },
              ...tokenPair,
              idempotentReplay: true,
              replayedMutationId: clientMutationId,
              simulation: true,
            });
            return;
          }
        }
      }

      // Generate patient ID
      const patientId = generateTribalPatientId();

      // Resolve village ID
      const resolvedVillageId = await resolveInternalVillageId(undefined, village, mandal, undefined, 'patient');

      // Create User record
      const username = `patient_${patientId.toLowerCase()}`;
      const passwordHash = password
        ? await (await import('../auth/tokenService.js')).hashPassword(password)
        : await (await import('../auth/tokenService.js')).hashPassword(uuidv4());

      const user = await User.create({
        userId: `usr_patient_${uuidv4().substring(0, 8)}`,
        username,
        role: 'patient',
        fullName,
        patientId,
        phone: `+91${phone}`,
        yearOfBirth,
        gender,
        address: address || `Village: ${village}, Mandal: ${mandal}${pincode ? `, Pincode: ${pincode}` : ''}`,
        village,
        mandal,
        pincode,
        hospitalId,
        passwordHash,
        verificationStatus: 'VERIFIED',
        status: 'active',
        preferredLanguage: 'te',
        profileCompleteness: 30, // Base completeness after registration
        simulation: true,
      });

      // Create Patient registry record
      const patient = await Patient.create({
        patientId,
        fullName,
        gender,
        ageEstimated: new Date().getFullYear() - yearOfBirth,
        phone: `+91${phone}`,
        villageId: resolvedVillageId,
        villageName: village,
        mandal,
        district: 'Alluri Sitharama Raju',
        originalAddressText: address || `Village: ${village}, Mandal: ${mandal}${pincode ? `, Pincode: ${pincode}` : ''}`,
        hospitalId,
        registeredBy: user.userId,
        registeredAt: new Date(),
        consentObtained: true,
        clientMutationId,
        simulation: true,
      });

      // Registration consent includes the one-time oral-photo capture consent.
      // Uploads still verify this record server-side before accepting an image.
      const { Consent } = await import('../consent/consentModel.js');
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);
      await Consent.create({
        consentId: `con_${uuidv4()}`,
        patientId,
        purpose: 'screening_ai_analysis',
        status: 'granted',
        validUntil,
        grantedAt: new Date(),
        actorId: user.userId,
        actorRole: 'patient',
        language: user.preferredLanguage || 'en',
        termsVersion: '1.0.0',
        simulation: true,
      });

      // Record in sync ledger
      if (clientMutationId) {
        const { SyncLedger } = await import('../patient/syncLedgerModel.js');
        await SyncLedger.create({
          clientMutationId,
          entityType: 'patient',
          entityId: patient.patientId,
          responsePayload: { user: user.toObject(), patient: patient.toObject() },
          simulation: true,
        });
      }

      // Create device session
      const { createDeviceSession } = await import('../auth/deviceService.js');
      const tokenPair = await createDeviceSession({
        user,
        deviceId: `dev_${uuidv4()}`,
        deviceName: 'Patient Portal',
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });

      res.status(201).envelope({
        user: {
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          hospitalId: user.hospitalId,
          patientId: user.patientId,
          phone: user.phone,
          yearOfBirth: user.yearOfBirth,
          gender: user.gender,
          address: user.address,
          village: user.village,
          mandal: user.mandal,
          pincode: user.pincode,
          medicalHistory: user.medicalHistory,
          allergies: user.allergies,
          currentMedications: user.currentMedications,
          habits: user.habits,
          emergencyContact: user.emergencyContact,
          insurance: user.insurance,
          preferredLanguage: user.preferredLanguage,
          profileCompleteness: user.profileCompleteness,
          verificationStatus: user.verificationStatus,
          capabilities: (await import('../auth/authorizationEngine.js')).getRoleCapabilities(user.role),
        },
        ...tokenPair,
        simulation: true,
      }, 'Patient registered and logged in successfully.');
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/patient/auth/login - Patient login (OTP or password)
router.post(
  '/login',
  validate({ body: PatientLoginSchema }),
  auditTag('PATIENT_LOGIN', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, otp, password, deviceId, deviceName } = req.body;

      const user = await User.findOne({ phone: { $in: [`+91${phone}`, phone] }, role: 'patient' });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'No patient account found with this phone number. Please register first.', undefined, 404);
        return;
      }

      if (user.status !== 'active') {
        res.envelopeError('ACCOUNT_SUSPENDED', 'Account is suspended. Contact support.', undefined, 403);
        return;
      }

      let tokenPair;

      if (otp) {
        // OTP-based login
        const otpResult = await PatientOtpService.verifyOtp({
          phone,
          otp,
          purpose: 'LOGIN',
          deviceId,
          deviceName,
          userAgent: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
        });

        if (!otpResult.verified) {
          res.envelopeError('OTP_VERIFICATION_FAILED', 'Invalid or expired OTP', undefined, 401);
          return;
        }

        const { createDeviceSession } = await import('../auth/deviceService.js');
        tokenPair = await createDeviceSession({
          user,
          deviceId,
          deviceName,
          userAgent: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
        });
      } else if (password) {
        // Password-based login
        const { verifyPassword } = await import('../auth/tokenService.js');
        const { checkLockoutAndBackoff, recordFailedAttempt, resetFailedAttempts } = await import('../auth/lockoutService.js');

        const lockoutState = checkLockoutAndBackoff(user);
        if (lockoutState.isLocked) {
          res.envelopeError('ACCOUNT_LOCKED', lockoutState.message || 'Account is temporarily locked', { retryAfterSeconds: lockoutState.retryAfterSeconds }, 423);
          return;
        }
        if (lockoutState.isBackoffActive) {
          res.envelopeError('BACKOFF_REQUIRED', lockoutState.message || 'Too many attempts. Exponential backoff active.', { retryAfterSeconds: lockoutState.retryAfterSeconds }, 429);
          return;
        }

        const passwordValid = await verifyPassword(user.passwordHash, password);
        if (!passwordValid) {
          const { locked, attempts } = await recordFailedAttempt(user);
          if (locked) {
            res.envelopeError('ACCOUNT_LOCKED', 'Account has been locked due to 5 consecutive failed attempts. Please try again after 15 minutes.', { failedAttempts: attempts, lockoutDurationSec: 900 }, 423);
            return;
          }
          res.envelopeError('INVALID_CREDENTIALS', 'Invalid password', { failedAttempts: attempts }, 401);
          return;
        }

        await resetFailedAttempts(user);

        const { createDeviceSession } = await import('../auth/deviceService.js');
        tokenPair = await createDeviceSession({
          user,
          deviceId,
          deviceName,
          userAgent: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
        });
      } else {
        res.envelopeError('INVALID_REQUEST', 'Either OTP or password required', undefined, 400);
        return;
      }

      res.envelope({
        user: {
          userId: user.userId,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          hospitalId: user.hospitalId,
          patientId: user.patientId,
          phone: user.phone,
          yearOfBirth: user.yearOfBirth,
          gender: user.gender,
          address: user.address,
          village: user.village,
          mandal: user.mandal,
          pincode: user.pincode,
          medicalHistory: user.medicalHistory,
          allergies: user.allergies,
          currentMedications: user.currentMedications,
          habits: user.habits,
          emergencyContact: user.emergencyContact,
          insurance: user.insurance,
          preferredLanguage: user.preferredLanguage,
          profileCompleteness: user.profileCompleteness,
          verificationStatus: user.verificationStatus,
          capabilities: (await import('../auth/authorizationEngine.js')).getRoleCapabilities(user.role),
        },
        ...tokenPair,
        simulation: true,
      }, 'Login successful.');
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/patient/auth/forgot-password - Initiate password reset
router.post(
  '/forgot-password',
  validate({ body: ForgotPasswordSchema }),
  auditTag('PATIENT_FORGOT_PASSWORD', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone } = req.body;

      const user = await User.findOne({ phone: `+91${phone}`, role: 'patient' });
      if (!user) {
        // Don't reveal if user exists
        res.envelope({ message: 'If an account exists, a password reset OTP has been sent.', simulation: true });
        return;
      }

      const result = await PatientOtpService.requestOtp(
        phone,
        req.ip || req.socket.remoteAddress || '127.0.0.1',
        'RESET'
      );

      res.envelope({
        ...result,
        message: 'If an account exists, a password reset OTP has been sent.',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/patient/auth/reset-password - Complete password reset
router.post(
  '/reset-password',
  validate({ body: ResetPasswordSchema }),
  auditTag('PATIENT_RESET_PASSWORD', 'auth'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, otp, newPassword } = req.body;

      const otpResult = await PatientOtpService.verifyOtp({
        phone,
        otp,
        purpose: 'RESET',
        deviceId: `dev_${uuidv4()}`,
        deviceName: 'Password Reset',
        userAgent: req.headers['user-agent'] || 'Unknown',
        ip: req.ip || req.socket.remoteAddress || '127.0.0.1',
      });

      if (!otpResult.verified) {
        res.envelopeError('OTP_VERIFICATION_FAILED', 'Invalid or expired OTP', undefined, 401);
        return;
      }

      const user = await User.findOne({ phone: `+91${phone}`, role: 'patient' });
      if (!user) {
        res.envelopeError('USER_NOT_FOUND', 'No patient account found with this phone number.', undefined, 404);
        return;
      }

      const { hashPassword } = await import('../auth/tokenService.js');
      user.passwordHash = await hashPassword(newPassword);
      user.mustChangePassword = false;
      await user.save();

      res.envelope({
        success: true,
        message: 'Password reset successfully. You can now log in with your new password.',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const patientAuthRouter = router;
