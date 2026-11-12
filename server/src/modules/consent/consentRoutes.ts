import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { Consent } from './consentModel.js';

const router = Router();

const CreateConsentSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  purpose: z.enum(['screening_ai_analysis', 'telemedicine_share', 'data_storage']),
  validUntil: z.string().datetime().optional().default(() => {
    // Default valid for 1 year
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }),
  witnessName: z.string().optional(),
  language: z.string().default('en'),
  termsVersion: z.string().default('1.0.0'),
});

const PatientConsentParamsSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
});

const RevokeConsentParamsSchema = z.object({
  id: z.string().min(1, 'Consent ID required'),
});

const VerifyConsentQuerySchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  purpose: z.enum(['screening_ai_analysis', 'telemedicine_share', 'data_storage']),
});

// POST /api/v1/consent
router.post(
  '/',
  requireAuth,
  authorizeCapability('consent:grant'),
  validate({ body: CreateConsentSchema }),
  auditTag('CONSENT_GRANTED', 'consent'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId, purpose, validUntil, witnessName, language, termsVersion } = req.body;

      if (req.user!.role === 'patient' && req.user!.patientId !== patientId) {
        res.envelopeError('FORBIDDEN', 'Patients may only grant consent for their own record.', undefined, 403);
        return;
      }

      const activeConsent = await Consent.findOne({
        patientId,
        purpose,
        status: 'granted',
        validUntil: { $gt: new Date() },
      });
      if (activeConsent) {
        res.status(200).envelope({
          consentId: activeConsent.consentId,
          patientId: activeConsent.patientId,
          purpose: activeConsent.purpose,
          status: activeConsent.status,
          validUntil: activeConsent.validUntil,
          grantedAt: activeConsent.grantedAt,
          simulation: true,
        }, 'Existing patient consent remains active');
        return;
      }

      // If existing active consent for this patient & purpose, supersede it
      await Consent.updateMany(
        { patientId, purpose, status: 'granted' },
        { $set: { status: 'revoked', revokedAt: new Date() } }
      );

      const consent = await Consent.create({
        consentId: `con_${uuidv4()}`,
        patientId,
        purpose,
        status: 'granted',
        validUntil: new Date(validUntil),
        grantedAt: new Date(),
        actorId: req.user!.id,
        actorRole: req.user!.role,
        witnessName,
        language,
        termsVersion,
        simulation: true,
      });

      res.status(201).envelope({
        consentId: consent.consentId,
        patientId: consent.patientId,
        purpose: consent.purpose,
        status: consent.status,
        validUntil: consent.validUntil,
        grantedAt: consent.grantedAt,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/consent/patient/:patientId
router.get(
  '/patient/:patientId',
  requireAuth,
  authorizeCapability('consent:read'),
  validate({ params: PatientConsentParamsSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId } = req.params;

      // If caller is patient, ensure they can only query their own consent
      if (req.user!.role === 'patient') {
        const callerPatientId = req.user!.id.replace('user_', '');
        if (callerPatientId !== patientId && req.user!.id !== patientId) {
          res.envelopeError('FORBIDDEN', 'Patients can only access their own consent records', undefined, 403);
          return;
        }
      }

      const consents = await Consent.find({ patientId }).sort({ createdAt: -1 }).lean();

      res.envelope({
        patientId,
        consents,
        total: consents.length,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/consent/:id/revoke
router.post(
  '/:id/revoke',
  requireAuth,
  authorizeCapability('consent:revoke'),
  validate({ params: RevokeConsentParamsSchema }),
  auditTag('CONSENT_REVOKED', 'consent'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consentId = req.params.id as string;
      const consent = await Consent.findOne({
        $or: [{ consentId }, { _id: consentId.length === 24 ? consentId : undefined }],
      });

      if (!consent) {
        res.envelopeError('CONSENT_NOT_FOUND', 'Consent record not found', undefined, 404);
        return;
      }

      // If caller is patient, ensure they can only revoke their own consent
      if (req.user!.role === 'patient') {
        const callerPatientId = req.user!.id.replace('user_', '');
        if (callerPatientId !== consent.patientId && req.user!.id !== consent.patientId) {
          res.envelopeError('FORBIDDEN', 'Patients can only revoke their own consent', undefined, 403);
          return;
        }
      }

      consent.status = 'revoked';
      consent.revokedAt = new Date();
      await consent.save();

      res.envelope({
        consentId: consent.consentId,
        status: consent.status,
        revokedAt: consent.revokedAt,
        message: 'Patient consent revoked successfully',
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/consent/verify
router.get(
  '/verify',
  requireAuth,
  authorizeCapability('consent:verify'),
  validate({ query: VerifyConsentQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { patientId, purpose } = req.query as { patientId: string; purpose: string };
      const now = new Date();

      const activeConsent = await Consent.findOne({
        patientId,
        purpose,
        status: 'granted',
        validUntil: { $gte: now },
      }).lean();

      res.envelope({
        hasValidConsent: Boolean(activeConsent),
        consent: activeConsent || null,
        patientId,
        purpose,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const consentRouter = router;
