import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { hashPassword } from '../auth/tokenService.js';
import { User } from '../auth/userModel.js';
import { Hospital } from '../hospital/hospitalModel.js';

export const ashaRegistrationRouter = Router();

const RegistrationSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(10).max(72),
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ]{10,15}$/),
  hospitalId: z.string().trim().min(1).max(100),
  mandal: z.string().trim().min(2).max(100),
  village: z.string().trim().min(2).max(100),
});

const UserParams = z.object({ userId: z.string().min(1).max(100) });
const RejectSchema = z.object({ reason: z.string().trim().min(5).max(500) });

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['admin', 'system_admin'].includes(req.user.role)) {
    res.status(403).envelopeError('ADMIN_REQUIRED', 'Only administrators can review ASHA applications.', undefined, 403);
    return;
  }
  next();
}

function facilityScope(req: Request): Record<string, unknown> {
  return req.user?.role === 'system_admin' ? {} : { hospitalId: req.user?.hospitalId || '__none__' };
}

ashaRegistrationRouter.get('/facilities', async (_req, res, next) => {
  try {
    const facilities = await Hospital.find({ status: 'active' }).select('hospitalId name mandal').sort({ name: 1 }).lean();
    return res.envelope({ facilities });
  } catch (err) {
    return next(err);
  }
});

ashaRegistrationRouter.post('/register', validate({ body: RegistrationSchema }), auditTag('ASHA_SELF_REGISTRATION', 'user'), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof RegistrationSchema>;
    const username = body.username.toLowerCase();
    const hospital = await Hospital.findOne({ hospitalId: body.hospitalId, status: 'active' })
      .select('hospitalId mandal')
      .lean<{ hospitalId: string; mandal: string }>();
    if (!hospital) return res.status(400).envelopeError('FACILITY_NOT_FOUND', 'Choose an active health facility.', undefined, 400);
    if (hospital.mandal.toLowerCase() !== body.mandal.toLowerCase()) {
      return res.status(400).envelopeError('FACILITY_MANDAL_MISMATCH', 'Choose the mandal associated with this facility.', undefined, 400);
    }
    if (await User.exists({ username })) {
      return res.status(409).envelopeError('USERNAME_EXISTS', 'That username is already in use. Choose another.', undefined, 409);
    }

    const applicationReference = `ASHA-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    await User.create({
      userId: `usr_asha_worker_${crypto.randomUUID().slice(0, 8)}`,
      username,
      fullName: body.fullName,
      role: 'asha_worker',
      phone: body.phone,
      hospitalId: hospital.hospitalId,
      mandal: body.mandal,
      village: body.village,
      passwordHash: await hashPassword(body.password),
      status: 'suspended',
      verificationStatus: 'pending_verification',
      approvalStatus: 'PENDING_ADMIN_APPROVAL',
      registrationReference: applicationReference,
      mfaEnabled: false,
      webauthnCredentials: [],
      lockout: { failedAttempts: 0 },
      simulation: true,
    });

    return res.status(201).envelope({ applicationReference }, 'Application submitted for administrator review.');
  } catch (err) {
    return next(err);
  }
});

ashaRegistrationRouter.get('/applications', requireAuth, authorizeCapability('hospital:manage'), requireAdmin, async (req, res, next) => {
  try {
    const applications = await User.find({
      ...facilityScope(req),
      role: 'asha_worker',
      approvalStatus: { $in: ['PENDING_ADMIN_APPROVAL', 'REJECTED'] },
    }).select('userId username fullName phone hospitalId mandal village registrationReference approvalStatus verificationStatus createdAt').sort({ createdAt: -1 }).lean();
    return res.envelope({ applications });
  } catch (err) {
    return next(err);
  }
});

ashaRegistrationRouter.post('/:userId/approve', requireAuth, authorizeCapability('hospital:manage'), requireAdmin, validate({ params: UserParams }), auditTag('ASHA_APPLICATION_APPROVED', 'user'), async (req, res, next) => {
  try {
    const application = await User.findOne({
      userId: req.params.userId,
      role: 'asha_worker',
      approvalStatus: 'PENDING_ADMIN_APPROVAL',
      ...facilityScope(req),
    });
    if (!application) return res.status(404).envelopeError('APPLICATION_NOT_FOUND', 'Pending ASHA application not found in your facility.', undefined, 404);
    application.status = 'active';
    application.verificationStatus = 'verified';
    application.approvalStatus = 'ACTIVE';
    await application.save();
    return res.envelope({ approved: true, userId: application.userId }, 'ASHA account approved. Assign the worker to their villages before field work.');
  } catch (err) {
    return next(err);
  }
});

ashaRegistrationRouter.post('/:userId/reject', requireAuth, authorizeCapability('hospital:manage'), requireAdmin, validate({ params: UserParams, body: RejectSchema }), auditTag('ASHA_APPLICATION_REJECTED', 'user'), async (req, res, next) => {
  try {
    const application = await User.findOne({
      userId: req.params.userId,
      role: 'asha_worker',
      approvalStatus: 'PENDING_ADMIN_APPROVAL',
      ...facilityScope(req),
    });
    if (!application) return res.status(404).envelopeError('APPLICATION_NOT_FOUND', 'Pending ASHA application not found in your facility.', undefined, 404);
    application.status = 'suspended';
    application.verificationStatus = 'rejected';
    application.approvalStatus = 'REJECTED';
    application.verificationDetails = {
      ...application.verificationDetails,
      rejectionReason: req.body.reason,
      rejectedBy: req.user!.id,
      rejectedAt: new Date(),
    };
    await application.save();
    return res.envelope({ rejected: true, userId: application.userId });
  } catch (err) {
    return next(err);
  }
});
