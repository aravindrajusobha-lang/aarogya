import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { Prescription } from '../prescription/prescriptionModel.js';
import { SyncLedger } from '../patient/syncLedgerModel.js';
import { TreatmentPlan } from './treatmentPlanModel.js';
import { TreatmentLog } from './treatmentLogModel.js';
import { ScreeningPhoto } from '../screening/screeningPhotoModel.js';
import { ScreeningService } from '../screening/screeningService.js';
import { Consent } from '../consent/consentModel.js';
import { validateMagicBytes } from '../storage/magicBytes.js';
import { runInTransaction } from '../../utils/transaction.js';

export const patientTreatmentRouter = Router();

const treatmentPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) callback(null, true);
    else callback(new Error('Use a JPEG, PNG, or WEBP photo.'));
  },
});

const IdParams = z.object({ treatmentPlanId: z.string().trim().min(1).max(100) });
const StartPlanSchema = z.object({
  mutationId: z.string().uuid(),
  prescriptionId: z.string().trim().min(1).max(100),
});
const TreatmentPhotoSchema = z.object({ mutationId: z.string().uuid(), consentGiven: z.literal('true') });
const SaveLogSchema = z.object({
  mutationId: z.string().uuid(),
  treatmentPlanId: z.string().trim().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  medicineLogs: z.array(z.object({
    medicineId: z.string().trim().min(1).max(100),
    taken: z.boolean(),
    scheduledTime: z.string().trim().max(32).optional().default(''),
    takenTime: z.string().trim().max(32).optional(),
  })).max(100),
  symptomLog: z.object({
    symptoms: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    severity: z.enum(['none', 'mild', 'moderate', 'severe']).default('none'),
    notes: z.string().trim().max(500).optional(),
  }).optional(),
  painLog: z.object({
    score: z.number().int().min(0).max(10),
    location: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
  }).optional(),
  photoProgress: z.object({
    photoId: z.string().trim().min(1).max(100),
    fileId: z.string().uuid().optional(),
    description: z.string().trim().max(160).optional(),
    anatomicalSite: z.string().trim().max(80).optional(),
  }).optional(),
  notes: z.string().trim().max(500).optional(),
});

function patientIdOr403(req: Request, res: Response): string | null {
  if (req.user?.role !== 'patient' || !req.user.patientId) {
    if (req.user?.role === 'system_admin' || (req.user?.role === 'patient' && !req.user.patientId)) {
      res.status(404).envelopeError('PATIENT_NOT_FOUND', 'Patient treatment records were not found.', undefined, 404);
      return null;
    }
    res.status(403).envelopeError('PATIENT_REQUIRED', 'Patient access is required.', undefined, 403);
    return null;
  }
  return req.user.patientId;
}

patientTreatmentRouter.get(
  '/treatment-plans', requireAuth, authorizeCapability('patient:read_own'),
  auditTag('patient.treatment_plans.read', 'treatment_plan'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = patientIdOr403(req, res);
      if (!patientId) return;
      const plans = await TreatmentPlan.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean();
      res.envelope({ plans, simulation: true });
    } catch (error) { next(error); }
  }
);

patientTreatmentRouter.post(
  '/treatment-plans/from-prescription', requireAuth, authorizeCapability('patient:treatment_own'),
  validate({ body: StartPlanSchema }), auditTag('patient.treatment_plan.create', 'treatment_plan'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const patientId = patientIdOr403(req, res);
    if (!patientId) return;
    const { mutationId, prescriptionId } = req.body as z.infer<typeof StartPlanSchema>;
    try {
      let result: Record<string, unknown> = {};
      await runInTransaction(async (session) => {
        const replay = await SyncLedger.findOne({ clientMutationId: mutationId, entityType: 'patient-treatment-plan', entityId: patientId }).session(session).lean();
        if (replay) {
          result = { ...(replay.responsePayload as Record<string, unknown>), idempotentReplay: true };
          return;
        }
        const prescription: any = await Prescription.findOne({ prescriptionId, patientId }).session(session).lean();
        if (!prescription || prescription.status === 'discontinued') {
          throw Object.assign(new Error('An active prescription for this account was not found.'), { statusCode: 404, code: 'PRESCRIPTION_NOT_FOUND' });
        }
        let plan: any = await TreatmentPlan.findOne({ patientId, prescriptionId }).session(session).lean();
        if (!plan) {
          const startDate = new Date();
          startDate.setUTCHours(0, 0, 0, 0);
          const [created] = await TreatmentPlan.create([{
            treatmentPlanId: `TPL-${uuidv4()}`,
            patientId,
            patientName: prescription.patientName,
            doctorId: prescription.doctorId,
            doctorName: prescription.doctorName,
            hospitalId: prescription.hospitalId,
            prescriptionId: prescription.prescriptionId,
            clinicianAssessment: prescription.diagnosisImpression,
            status: 'active',
            startDate,
            medicines: (prescription.medicines || []).map((medicine: any) => ({
              medicineId: `MED-${uuidv4()}`,
              medicineName: medicine.medicineName,
              dosage: medicine.dosage,
              frequency: medicine.frequency,
              timing: [],
              durationDays: medicine.durationDays,
              instructions: medicine.instructions || '',
              startDate,
            })),
            simulation: true,
          }], { session });
          plan = created.toObject();
        }
        const responsePayload = { plan, idempotentReplay: false, simulation: true };
        await SyncLedger.create([{
          clientMutationId: mutationId,
          entityType: 'patient-treatment-plan',
          entityId: patientId,
          responsePayload,
          simulation: true,
        }], { session });
        result = responsePayload;
      });
      res.status(201).envelope(result);
    } catch (error) { next(error); }
    finally { /* session ended by runInTransaction */ }
  }
);

patientTreatmentRouter.get(
  '/treatment-plans/:treatmentPlanId', requireAuth, authorizeCapability('patient:read_own'),
  validate({ params: IdParams }), auditTag('patient.treatment_plan.read', 'treatment_plan'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = patientIdOr403(req, res);
      if (!patientId) return;
      const plan = await TreatmentPlan.findOne({ treatmentPlanId: req.params.treatmentPlanId, patientId }).lean();
      if (!plan) { res.status(404).envelopeError('TREATMENT_PLAN_NOT_FOUND', 'Treatment plan was not found.', undefined, 404); return; }
      res.envelope({ plan, simulation: true });
    } catch (error) { next(error); }
  }
);

patientTreatmentRouter.get(
  '/treatment-plans/:treatmentPlanId/logs', requireAuth, authorizeCapability('patient:read_own'),
  validate({ params: IdParams }), auditTag('patient.treatment_logs.read', 'treatment_log'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = patientIdOr403(req, res);
      if (!patientId) return;
      const plan: any = await TreatmentPlan.findOne({ treatmentPlanId: req.params.treatmentPlanId, patientId }).select('treatmentPlanId').lean();
      if (!plan) { res.status(404).envelopeError('TREATMENT_PLAN_NOT_FOUND', 'Treatment plan was not found.', undefined, 404); return; }
      const logs = await TreatmentLog.find({ treatmentPlanId: plan.treatmentPlanId, patientId }).sort({ date: -1 }).limit(90).lean();
      res.envelope({ logs, simulation: true });
    } catch (error) { next(error); }
  }
);

patientTreatmentRouter.post(
  '/treatment-plans/:treatmentPlanId/photos',
  requireAuth,
  authorizeCapability('patient:treatment_own'),
  auditTag('patient.treatment_photo.upload', 'screening_photo'),
  treatmentPhotoUpload.single('photo'),
  validate({ params: IdParams, body: TreatmentPhotoSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const patientId = patientIdOr403(req, res);
      if (!patientId) return;
      if (!req.file) { res.status(400).envelopeError('PHOTO_REQUIRED', 'Choose a progress photo to upload.', undefined, 400); return; }
      const magic = validateMagicBytes(req.file.buffer, req.file.mimetype);
      if (!magic.valid) { res.status(400).envelopeError('INVALID_FILE_SIGNATURE', magic.error || 'Photo file signature is invalid.', undefined, 400); return; }

      const { mutationId } = req.body as z.infer<typeof TreatmentPhotoSchema>;
      const replay = await SyncLedger.findOne({ clientMutationId: mutationId, entityType: 'patient-treatment-photo', entityId: patientId }).lean();
      if (replay) { res.status(200).envelope({ ...(replay.responsePayload as Record<string, unknown>), idempotentReplay: true }); return; }

      const plan: any = await TreatmentPlan.findOne({ treatmentPlanId: req.params.treatmentPlanId, patientId }).lean();
      if (!plan) { res.status(404).envelopeError('TREATMENT_PLAN_NOT_FOUND', 'Treatment plan was not found.', undefined, 404); return; }
      let storageConsent = await Consent.findOne({
        patientId,
        purpose: 'data_storage',
        status: 'granted',
        validUntil: { $gt: new Date() },
      }).lean();
      if (!storageConsent) {
        const [createdConsent] = await Consent.create([{
          consentId: `cns_${uuidv4()}`,
          patientId,
          purpose: 'data_storage',
          status: 'granted',
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          actorId: req.user!.id,
          actorRole: req.user!.role,
          language: 'en',
          termsVersion: '1.0.0',
          simulation: true,
        }]);
        storageConsent = createdConsent.toObject() as any;
      }
      const photo: any = await ScreeningService.uploadPhoto({
        buffer: req.file.buffer,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        patientId,
        hospitalId: plan.hospitalId,
        isDemo: false,
        consentPurpose: 'data_storage',
        user: req.user!,
      });
      const responsePayload = {
        photoProgress: { photoId: photo.photoId, fileId: photo.currentFileId, description: 'Patient-consented treatment progress photo', anatomicalSite: 'Oral cavity' },
        sha256Hash: photo.currentSha256,
        simulation: true,
      };
      await SyncLedger.create({
        clientMutationId: mutationId,
        entityType: 'patient-treatment-photo',
        entityId: patientId,
        responsePayload,
        simulation: true,
      });
      res.status(201).envelope(responsePayload);
    } catch (error) { next(error); }
  }
);

patientTreatmentRouter.post(
  '/treatment-logs', requireAuth, authorizeCapability('patient:treatment_own'),
  validate({ body: SaveLogSchema }), auditTag('patient.treatment_log.save', 'treatment_log'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const patientId = patientIdOr403(req, res);
    if (!patientId) return;
    const body = req.body as z.infer<typeof SaveLogSchema>;
    try {
      let result: Record<string, unknown> = {};
      await runInTransaction(async (session) => {
        const replay = await SyncLedger.findOne({ clientMutationId: body.mutationId, entityType: 'patient-treatment-log', entityId: patientId }).session(session).lean();
        if (replay) {
          result = { ...(replay.responsePayload as Record<string, unknown>), idempotentReplay: true };
          return;
        }
        const plan: any = await TreatmentPlan.findOne({ treatmentPlanId: body.treatmentPlanId, patientId }).session(session).lean();
        if (!plan) throw Object.assign(new Error('Treatment plan was not found for this account.'), { statusCode: 404, code: 'TREATMENT_PLAN_NOT_FOUND' });
        const prescribed = new Map((plan.medicines || []).map((medicine: any) => [medicine.medicineId, medicine]));
        if (body.medicineLogs.some((item) => !prescribed.has(item.medicineId))) {
          throw Object.assign(new Error('Check-in includes a medicine that is not on this plan.'), { statusCode: 400, code: 'INVALID_MEDICINE' });
        }
        if (body.photoProgress) {
          const photo: any = await ScreeningPhoto.findOne({ photoId: body.photoProgress.photoId, patientId }).session(session).lean();
          if (!photo) throw Object.assign(new Error('Progress photo was not found for this account.'), { statusCode: 404, code: 'PHOTO_NOT_FOUND' });
          if (body.photoProgress.fileId && photo.currentFileId !== body.photoProgress.fileId) {
            throw Object.assign(new Error('Progress photo file does not match this account record.'), { statusCode: 404, code: 'PHOTO_NOT_FOUND' });
          }
        }
        const medicineLogs = (plan.medicines || []).map((medicine: any) => {
          const submitted = body.medicineLogs.find((item) => item.medicineId === medicine.medicineId);
          return {
            medicineId: medicine.medicineId,
            medicineName: medicine.medicineName,
            ...(submitted?.scheduledTime || medicine.timing?.[0] ? { scheduledTime: submitted?.scheduledTime || medicine.timing[0] } : {}),
            taken: submitted?.taken || false,
            skipped: false,
            ...(submitted?.takenTime ? { takenTime: submitted.takenTime } : {}),
          };
        });
        const adherencePercentage = medicineLogs.length
          ? Math.round((medicineLogs.filter((item: any) => item.taken).length / medicineLogs.length) * 100)
          : 0;
        const date = new Date(`${body.date}T00:00:00.000Z`);
        let log: any = await TreatmentLog.findOneAndUpdate(
          { treatmentPlanId: plan.treatmentPlanId, patientId, date },
          { $set: {
            medicineLogs,
            adherencePercentage,
            ...(body.symptomLog ? { symptomLog: body.symptomLog } : {}),
            ...(body.painLog ? { painLog: body.painLog } : {}),
            ...(body.photoProgress ? { photoProgress: body.photoProgress } : {}),
            ...(body.notes !== undefined ? { notes: body.notes } : {}),
          }, $setOnInsert: { logId: `TL-${uuidv4()}`, treatmentPlanId: plan.treatmentPlanId, patientId, date, simulation: true } },
          { new: true, upsert: true, runValidators: true, session }
        ).lean();
        const responsePayload = { log, simulation: true };
        await SyncLedger.create([{
          clientMutationId: body.mutationId,
          entityType: 'patient-treatment-log',
          entityId: patientId,
          responsePayload,
          simulation: true,
        }], { session });
        result = responsePayload;
      });
      res.status(200).envelope(result);
    } catch (error) { next(error); }
    finally { /* session ended by runInTransaction */ }
  }
);
