import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { User } from '../auth/userModel.js';
import { SyncLedger } from './syncLedgerModel.js';

export const patientProfileRouter = Router();

const ProfileSchema = z.object({
  mutationId: z.string().uuid(),
  consentGiven: z.literal(true),
  fullName: z.string().trim().min(2).max(120).optional(),
  yearOfBirth: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
  gender: z.enum(['male', 'female', 'transgender', 'other']).optional(),
  address: z.string().trim().max(500).optional(),
  village: z.string().trim().min(1).max(120).optional(),
  mandal: z.string().trim().min(1).max(120).optional(),
  pincode: z.string().regex(/^[1-9]\d{5}$/).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional(),
  medicalHistory: z.string().trim().max(2000).optional(),
  allergies: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  currentMedications: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  habits: z.object({ tobacco: z.boolean().optional(), alcohol: z.boolean().optional(), arecaNut: z.boolean().optional(), smoking: z.boolean().optional(), other: z.string().trim().max(500).optional() }).optional(),
  emergencyContact: z.object({ name: z.string().trim().max(120).optional(), phone: z.string().trim().max(20).optional(), relationship: z.string().trim().max(80).optional() }).optional(),
  insurance: z.object({ provider: z.string().trim().max(120).optional(), policyNumber: z.string().trim().max(120).optional(), validUntil: z.string().datetime().optional() }).optional(),
  preferredLanguage: z.enum(['en', 'te', 'hi', 'ta', 'kn', 'ml']).optional(),
});

function patientUserOr403(req: Request, res: Response): string | null {
  if (req.user?.role !== 'patient') {
    if (req.user?.role === 'system_admin') {
      res.status(404).envelopeError('PATIENT_NOT_FOUND', 'Patient profile was not found.', undefined, 404);
      return null;
    }
    res.status(403).envelopeError('PATIENT_REQUIRED', 'Patient access is required.', undefined, 403);
    return null;
  }
  return req.user.id;
}

function safeProfile(user: any) {
  return {
    userId: user.userId, patientId: user.patientId, fullName: user.fullName, yearOfBirth: user.yearOfBirth,
    gender: user.gender, address: user.address, village: user.village, mandal: user.mandal,
    pincode: user.pincode, phone: user.phone, medicalHistory: user.medicalHistory,
    allergies: user.allergies, currentMedications: user.currentMedications, habits: user.habits,
    emergencyContact: user.emergencyContact, insurance: user.insurance,
    preferredLanguage: user.preferredLanguage, profileCompleteness: user.profileCompleteness,
  };
}

patientProfileRouter.get(
  '/profile', requireAuth, authorizeCapability('patient:read_own'),
  auditTag('patient.profile.read', 'patient_profile'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = patientUserOr403(req, res);
      if (!userId) return;
      const profile = await User.findOne({ userId, role: 'patient' })
        .select('userId patientId fullName yearOfBirth gender address village mandal pincode phone medicalHistory allergies currentMedications habits emergencyContact insurance preferredLanguage profileCompleteness')
        .lean();
      if (!profile) { res.status(404).envelopeError('PATIENT_NOT_FOUND', 'Patient profile was not found.', undefined, 404); return; }
      res.envelope({ profile, simulation: true });
    } catch (error) { next(error); }
  }
);

patientProfileRouter.put(
  '/profile', requireAuth, authorizeCapability('patient:profile_own'),
  validate({ body: ProfileSchema }), auditTag('patient.profile.update', 'patient_profile'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = patientUserOr403(req, res);
    if (!userId) return;
    const input = req.body as z.infer<typeof ProfileSchema>;
    const session = await mongoose.startSession();
    try {
      let result: Record<string, unknown> = {};
      await session.withTransaction(async () => {
        const replay: any = await SyncLedger.findOne({ clientMutationId: input.mutationId, entityType: 'patient-profile', entityId: req.user!.id }).session(session).lean();
        if (replay) { result = { ...(replay.responsePayload as Record<string, unknown>), idempotentReplay: true }; return; }
        const user: any = await User.findOne({ userId, role: 'patient' }).session(session);
        if (!user) throw Object.assign(new Error('Patient profile was not found.'), { statusCode: 404, code: 'PATIENT_NOT_FOUND' });
        const { mutationId, consentGiven: _consentGiven, ...updates } = input;
        Object.assign(user, updates);
        if (updates.insurance?.validUntil) user.insurance.validUntil = new Date(updates.insurance.validUntil);
        user.profileConsentAt = new Date();
        const completenessFields = [user.fullName, user.yearOfBirth, user.gender, user.phone, user.address, user.village, user.mandal, user.medicalHistory, user.allergies?.length, user.currentMedications?.length, user.emergencyContact?.phone, user.preferredLanguage];
        user.profileCompleteness = Math.round(completenessFields.filter(Boolean).length / completenessFields.length * 100);
        await user.save({ session });
        const profile = safeProfile(user);
        const responsePayload = { profile, simulation: true, idempotentReplay: false };
        await SyncLedger.create([{
          clientMutationId: mutationId,
          entityType: 'patient-profile',
          entityId: userId,
          responsePayload,
          simulation: true,
        }], { session });
        result = responsePayload;
      });
      res.envelope(result);
    } catch (error) { next(error); }
    finally { await session.endSession(); }
  }
);
