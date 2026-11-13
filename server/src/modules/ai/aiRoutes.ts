import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../../middleware/authGuard.js';
import { savePrivateFile, getAuthorizedFile } from '../storage/storageService.js';
import { analyzeOralPhotoWithGemini, isGeminiConfigured } from '../assistant/geminiService.js';
import { AuditLog } from '../audit/auditModel.js';
import { Patient } from '../patient/patientModel.js';
import { canTreatPatient } from '../consultation/patientCareService.js';
import {
  AiScreening,
  IAiScreening,
  IDentalFinding,
  ICombinedRecommendation,
} from './aiScreeningModel.js';
import { calculateRiskScore, IRiskQuestionnaireAnswers } from './riskScore.js';
import { logger } from '../../config/logger.js';
import { Consent } from '../consent/consentModel.js';
import { analyzeOralScreeningImage, AiProviderUnavailableError, InvalidScreeningImageError } from './aiAnalysisService.js';
import { getModelCard } from './modelEvaluation.js';
import { buildPatientScreeningSummary } from './patientScreeningSummary.js';

export const aiRouter = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

// Multer memory storage configured strictly for 8 MB, JPEG/PNG only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid image format: ${file.mimetype}. Only JPEG and PNG are permitted.`));
    }
  },
});

// Role Guard for Oral Screening: Health Worker, Medical Officer, Specialist, Super Admin, Patient (Self-Check Support)
function requireScreeningRole(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.envelopeError('UNAUTHORIZED', 'Authentication session required', undefined, 401);
    return;
  }

  const role = req.user.role;
  const allowedRoles = ['asha', 'anm', 'medical_officer', 'admin', 'system_admin', 'patient'];

  if (!allowedRoles.includes(role)) {
    res.envelopeError(
      'FORBIDDEN_ROLE',
      `Access denied. Role '${role}' is not authorized to perform clinical AI oral screening.`,
      { allowedRoles },
      403
    );
    return;
  }

  next();
}

// Role Guard for Clinician Review: Medical Officer, Specialist Doctor, Super Admin
function requireClinicianRole(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.envelopeError('UNAUTHORIZED', 'Authentication session required', undefined, 401);
    return;
  }

  const role = req.user.role;
  const clinicianRoles = ['medical_officer', 'admin', 'system_admin'];

  if (!clinicianRoles.includes(role)) {
    res.envelopeError(
      'FORBIDDEN_CLINICIAN',
      `Access denied. Only qualified Medical Officers or Dental Specialists can review and confirm AI triage results.`,
      { allowedRoles: clinicianRoles },
      403
    );
    return;
  }

  next();
}

async function validatePatientScreeningAccess(
  req: Request,
  res: Response,
  patientId: string,
  requestedHospitalId?: string
): Promise<string | undefined> {
  const actor = req.user!;
  let hospitalId: string | undefined;

  if (actor.role === 'patient') {
    if (!actor.patientId || actor.patientId !== patientId) {
      res.envelopeError('FORBIDDEN', 'Patients may only analyze and view their own health records.', undefined, 403);
      return undefined;
    }
    hospitalId = actor.hospitalId;
  } else if (['medical_officer', 'specialist_doctor'].includes(actor.role)) {
    if (!(await canTreatPatient(actor.id, patientId))) {
      res.envelopeError('TRANSFER_REQUIRED', 'The current treating doctor must approve access before screening.', undefined, 403);
      return undefined;
    }
    hospitalId = actor.hospitalId;
  } else if (actor.role !== 'system_admin') {
    if (!actor.hospitalId) {
      res.envelopeError('HOSPITAL_REQUIRED', 'Your account must be assigned to a facility before screening.', undefined, 403);
      return undefined;
    }
    if (requestedHospitalId && requestedHospitalId !== actor.hospitalId) {
      res.envelopeError('FORBIDDEN', 'Screening records outside your assigned facility are not accessible.', undefined, 403);
      return undefined;
    }
    hospitalId = actor.hospitalId;
  } else {
    hospitalId = requestedHospitalId || actor.hospitalId;
  }

  let activeConsent: any = await Consent.findOne({
    patientId,
    purpose: 'screening_ai_analysis',
    status: 'granted',
    validUntil: { $gt: new Date() },
  }).lean();
  // A patient may grant consent for their OWN record by explicitly agreeing on the screening screen
  // (consentGiven=true). It is stored as a normal, revocable, audited consent record valid for one year.
  // Staff screening someone else still require consent captured beforehand.
  const selfAgreed = req.body?.consentGiven === true || req.body?.consentGiven === 'true';
  if (!activeConsent && actor.role === 'patient' && actor.patientId === patientId && selfAgreed) {
    activeConsent = await Consent.create({
      consentId: `cns_self_${uuidv4()}`,
      patientId,
      purpose: 'screening_ai_analysis',
      status: 'granted',
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      grantedAt: new Date(),
      actorId: actor.id,
      actorRole: 'patient',
      language: typeof req.body?.language === 'string' ? req.body.language.slice(0, 5) : 'en',
      simulation: true,
    });
    if (AuditLog.db.readyState === 1) {
      await AuditLog.create({ action: 'CONSENT_SELF_GRANTED', actorId: actor.id, actorRole: 'patient', resourceType: 'consent', resourceId: activeConsent.consentId, ip: req.ip || '127.0.0.1', statusCode: 201, metadata: { purpose: 'screening_ai_analysis' }, simulation: true });
    }
  }
  if (!activeConsent) {
    res.envelopeError('CONSENT_REQUIRED', 'Current patient consent for oral photo analysis is required.', undefined, 403);
    return undefined;
  }

  return hospitalId;
}

// -----------------------------------------------------------------------------
// Helper: Compute Combined Recommendation (A + B + C)
// -----------------------------------------------------------------------------
export function computeCombinedRecommendation(
  moduleA: { label?: string | null; confidence?: number; referToSpecialist?: boolean } | null | undefined,
  moduleB: { findings?: IDentalFinding[]; seeDentistRecommended?: boolean } | null | undefined,
  moduleC: { level?: string; score?: number; flaggedSymptoms?: string[]; flaggedHabits?: string[] } | null | undefined
): ICombinedRecommendation {
  const triggerModules: string[] = [];

  // Module A rules
  const labelA = moduleA?.label || '';
  const confA = typeof moduleA?.confidence === 'number' ? moduleA.confidence : 1.0;
  const isHighRiskLesion = Boolean(moduleA?.referToSpecialist) || ['opmd', 'suspected_malignant', 'osmf', 'non_healing_ulcer'].includes(labelA);
  const isLowConfidence = labelA ? confA < 0.60 : false;

  if (isHighRiskLesion) {
    triggerModules.push(`Module A: Suspected lesion detected (${labelA})`);
  }
  if (isLowConfidence) {
    triggerModules.push(`Module A: Low confidence screening (${(confA * 100).toFixed(0)}% < 60%) requires specialist evaluation`);
  }

  // Module C rules
  const riskLevel = moduleC?.level || 'LOW';
  const isHighRiskHistory = riskLevel === 'HIGH';
  if (isHighRiskHistory) {
    const symStr = moduleC?.flaggedSymptoms?.length ? moduleC.flaggedSymptoms.join(', ') : 'High-risk history';
    triggerModules.push(`Module C: High risk patient history (${symStr})`);
  }

  // Combined specialist referral rule:
  // refer_to_specialist = (A is opmd/suspected_malignant) OR (risk level is high) OR (A confidence < 0.60)
  const referToSpecialist = isHighRiskLesion || isLowConfidence || isHighRiskHistory;

  // Module B rules (Separate dental advice)
  const hasDentalFindings = Boolean(
    moduleB?.seeDentistRecommended ||
    moduleB?.findings?.some((f) => f.flagged && f.label !== 'discoloration')
  );
  const seeDentist = hasDentalFindings;
  if (hasDentalFindings) {
    const flaggedLabels = moduleB?.findings?.filter((f) => f.flagged).map((f) => f.label) || [];
    triggerModules.push(`Module B: Dental findings flagged (${flaggedLabels.join(', ') || 'dental care needed'})`);
  }

  // Color-coded Triaging:
  // Red = Urgent specialist referral
  // Amber = Dentist visit / clinical monitor
  // Green = Routine
  let triageCategory: 'URGENT_SPECIALIST' | 'DENTAL_MONITOR' | 'ROUTINE' = 'ROUTINE';
  let badgeColor: 'RED' | 'AMBER' | 'GREEN' = 'GREEN';
  let advice = 'Routine oral hygiene care advised. Screening aid, not clinical confirmation.';

  if (referToSpecialist) {
    triageCategory = 'URGENT_SPECIALIST';
    badgeColor = 'RED';
    advice = 'URGENT: Oral medicine / surgical specialist referral recommended. Comprehensive clinical biopsy/examination required.';
  } else if (seeDentist || riskLevel === 'MODERATE') {
    triageCategory = 'DENTAL_MONITOR';
    badgeColor = 'AMBER';
    advice = 'Dentist consultation and regular habit monitoring recommended.';
  }

  return {
    referToSpecialist,
    seeDentist,
    triageCategory,
    badgeColor,
    triggerModules,
    advice,
  };
}

// -----------------------------------------------------------------------------
// 1. POST /api/ai/analyze (MODULE A - Mucosal Lesion Screening)
// -----------------------------------------------------------------------------
aiRouter.post(
  '/analyze',
  requireAuth,
  requireScreeningRole,
  upload.single('image'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.envelopeError('IMAGE_REQUIRED', 'Oral screening image is required under field "image"', undefined, 400);
        return;
      }

      if (req.body.consentGiven !== 'true' && req.body.consentGiven !== true) {
        res.envelopeError('CONSENT_REQUIRED', 'Explicit patient consent is required before oral photo analysis.', undefined, 400);
        return;
      }

      const patientId = typeof req.body.patientId === 'string' ? req.body.patientId.trim() : '';
      if (!patientId) {
        res.envelopeError('PATIENT_ID_REQUIRED', 'A saved patient record is required.', undefined, 400);
        return;
      }
      const hospitalId = await validatePatientScreeningAccess(req, res, patientId, req.body.hospitalId);
      if (res.headersSent) return;
      const clientId = req.body.clientId || uuidv4();
      if (typeof clientId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
        res.envelopeError('INVALID_MUTATION_ID', 'clientId must be a UUID v4.', undefined, 400);
        return;
      }

      const existing = await AiScreening.findOne({ clientId });
      if (existing) {
        res.envelope(existing, 'Existing screening record returned (idempotent duplicate request)');
        return;
      }

      const analysis = await analyzeOralScreeningImage({
        buffer: req.file.buffer,
        filename: req.file.originalname || 'oral_screening.jpg',
        mimeType: req.file.mimetype,
        patientNote: req.body.patientNote || req.body.clinicalNote,
        language: req.body.language || 'en',
      });
      const aiResponseData = {
        label: analysis.label,
        confidence: analysis.confidence,
        probabilities: analysis.probabilities,
        refer_to_specialist: analysis.referToSpecialist,
        model_version: analysis.modelVersion,
        image_quality: analysis.imageQuality,
        geminiAnalysis: analysis.geminiAnalysis,
      };

      // 2. Store image in private storage
      let imageRef: string | undefined;
      try {
        const storedFile = await savePrivateFile({
          originalFilename: req.file.originalname || 'oral_screening.jpg',
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
          uploader: req.user!,
          category: 'patients/oral-images',
          patientId,
          hospitalId,
        });
        imageRef = storedFile.fileId;
      } catch (storageErr) {
        logger.error({ err: storageErr }, 'Failed saving private image');
        throw new Error('The screening photo could not be stored securely. No result was saved.');
      }

      // Compute standalone recommendation for Module A
      const combinedRec = computeCombinedRecommendation(
        { label: aiResponseData.label, confidence: aiResponseData.confidence, referToSpecialist: aiResponseData.refer_to_specialist },
        null,
        null
      );

      // 3. Persist AiScreening record
      const screening = await AiScreening.create({
        patientId,
        performedBy: {
          userId: req.user!.id,
          username: (req.user as any).username || req.user!.id,
          role: req.user!.role,
          fullName: (req.user as any).fullName,
        },
        hospitalId,
        label: aiResponseData.label,
        confidence: aiResponseData.confidence || 0.0,
        probabilities: aiResponseData.probabilities || {},
        referToSpecialist: Boolean(aiResponseData.refer_to_specialist),
        modelVersion: aiResponseData.model_version || 'v1.0.0-efficientnet_b0',
        source: 'server',
        imageRef,
        imageQuality: aiResponseData.image_quality,
        moduleA: {
          label: aiResponseData.label,
          confidence: aiResponseData.confidence,
          probabilities: aiResponseData.probabilities || {},
          modelVersion: aiResponseData.model_version,
          source: 'server',
          imageRef,
          ...(aiResponseData.image_quality ? { imageQuality: aiResponseData.image_quality } : {}),
        },
        combinedRecommendation: combinedRec,
        clinicianReview: { status: 'PENDING' },
        consentGiven: true,
        consentTimestamp: new Date(),
        syncStatus: 'SYNCED',
        clientId,
        geminiAnalysis: aiResponseData.geminiAnalysis,
      });

      // Audit Log
      if (AuditLog.db.readyState === 1) {
        await AuditLog.create({
          action: 'AI_SCREENING_ANALYSIS_MODULE_A',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          resourceType: 'ai_screening',
          resourceId: screening.screeningId,
          ip: req.ip || '127.0.0.1',
          statusCode: 200,
          metadata: { patientId, label: screening.label, confidence: screening.confidence },
          simulation: true,
        });
      }

      res.envelope(
        screening,
        'Mucosal screening image analyzed successfully. Preliminary screening support only, not clinical confirmation.'
      );
    } catch (err: any) {
      logger.error({ err }, 'Error in /api/ai/analyze');
      const statusCode = err instanceof AiProviderUnavailableError || err instanceof InvalidScreeningImageError ? err.statusCode : Number(err?.statusCode) || 500;
      res.envelopeError(err?.code || 'AI_ANALYSIS_ERROR', err.message || 'Oral screening could not be completed.', undefined, statusCode);
    }
  }
);

// -----------------------------------------------------------------------------
// 2. POST /api/ai/analyze-dental (MODULE B - Dental Multi-Label Screening)
// -----------------------------------------------------------------------------
aiRouter.post(
  '/analyze-dental',
  requireAuth,
  requireScreeningRole,
  upload.single('image'),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.envelopeError('IMAGE_REQUIRED', 'Dental screening image is required under field "image"', undefined, 400);
        return;
      }

      if (req.body.consentGiven !== 'true' && req.body.consentGiven !== true) {
        res.envelopeError('CONSENT_REQUIRED', 'Explicit patient consent is required before dental photo analysis.', undefined, 400);
        return;
      }
      const patientId = typeof req.body.patientId === 'string' ? req.body.patientId.trim() : '';
      if (!patientId) {
        res.envelopeError('PATIENT_ID_REQUIRED', 'A saved patient record is required.', undefined, 400);
        return;
      }
      const hospitalId = await validatePatientScreeningAccess(req, res, patientId, req.body.hospitalId);
      if (res.headersSent) return;

      // 1. Forward to FastAPI Module B
      let dentalData: any;
      try {
        const formData = new FormData();
        formData.append('image', req.file.buffer, {
          filename: req.file.originalname || 'dental.jpg',
          contentType: req.file.mimetype,
        });

        const fastApiResponse = await axios.post(`${AI_SERVICE_URL}/predict/dental`, formData, {
          headers: formData.getHeaders(),
          timeout: 12000,
        });

        dentalData = fastApiResponse.data;
      } catch (axiosErr: any) {
        logger.error({ err: axiosErr.message }, 'Configured dental screening model is unavailable');
        throw new AiProviderUnavailableError('Dental screening is temporarily unavailable. No result was saved; please try again when the screening service is online.');
      }

      if (dentalData?.is_placeholder === true) throw new AiProviderUnavailableError('The configured dental screening model is not trained and cannot analyze this image.');
      if (dentalData?.image_quality?.ok === false) throw new InvalidScreeningImageError(dentalData.image_quality.reason || 'The image is not clear enough. Please capture it again.');
      if (!Array.isArray(dentalData?.findings)) throw new AiProviderUnavailableError('The dental screening model did not return usable findings.');

      // 2. Store image in private storage
      let imageRef: string | undefined;
      try {
        const storedFile = await savePrivateFile({
          originalFilename: req.file.originalname || 'dental_screening.jpg',
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
          uploader: req.user!,
          category: 'patients/oral-images',
          patientId,
          hospitalId,
        });
        imageRef = storedFile.fileId;
      } catch (storageErr) {
        logger.error({ err: storageErr }, 'Failed saving private dental image');
        throw new Error('The dental photo could not be stored securely. No result was saved.');
      }

      // Audit Log
      if (AuditLog.db.readyState === 1) {
        await AuditLog.create({
          action: 'AI_SCREENING_ANALYSIS_MODULE_B',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          resourceType: 'ai_screening',
          ip: req.ip || '127.0.0.1',
          statusCode: 200,
          metadata: { patientId, findingsCount: dentalData.findings?.length },
          simulation: true,
        });
      }

      res.envelope(
        {
          findings: dentalData.findings,
          seeDentistRecommended: dentalData.see_dentist_recommended,
          modelVersion: dentalData.model_version,
          isPlaceholder: dentalData.is_placeholder,
          imageQuality: dentalData.image_quality,
          imageRef,
          disclaimer: 'This AI result is a screening aid, not clinical confirmation. Please consult a dentist.',
        },
        'Dental examination analyzed successfully.'
      );
    } catch (err: any) {
      logger.error({ err }, 'Error in /api/ai/analyze-dental');
      const statusCode = err instanceof AiProviderUnavailableError || err instanceof InvalidScreeningImageError ? err.statusCode : Number(err?.statusCode) || 500;
      res.envelopeError(err?.code || 'DENTAL_ANALYSIS_ERROR', err.message || 'Dental screening could not be completed.', undefined, statusCode);
    }
  }
);

// -----------------------------------------------------------------------------
// 3. POST /api/ai/risk-assessment (MODULE C - Questionnaire & Scoring)
// -----------------------------------------------------------------------------
aiRouter.post(
  '/risk-assessment',
  requireAuth,
  requireScreeningRole,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId, answers } = req.body;

      if (!patientId) {
        res.envelopeError('PATIENT_ID_REQUIRED', 'patientId is required for risk assessment.', undefined, 400);
        return;
      }

      const questionnaireAnswers: IRiskQuestionnaireAnswers = answers || req.body;
      await validatePatientScreeningAccess(req, res, String(patientId), req.body.hospitalId);
      if (res.headersSent) return;
      const riskResult = calculateRiskScore(questionnaireAnswers);

      // Save answers on patient record history
      try {
        const patient = await Patient.findOne({ patientId });
        if (patient) {
          patient.history.push({
            timestamp: new Date(),
            action: 'AI_ORAL_HEALTH_SCREENING_RISK_ASSESSMENT',
            performedBy: req.user!.id,
            details: {
              score: riskResult.score,
              level: riskResult.level,
              flaggedSymptoms: riskResult.flaggedSymptoms,
              flaggedHabits: riskResult.flaggedHabits,
              reportedByPatient: true,
              disclaimer: riskResult.disclaimer,
            },
          });
          await patient.save();
        }
      } catch (patErr) {
        logger.warn({ err: patErr }, 'Could not append risk assessment to patient history');
      }

      // Audit Log
      if (AuditLog.db.readyState === 1) {
        await AuditLog.create({
          action: 'AI_RISK_ASSESSMENT_COMPLETED',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          resourceType: 'patient',
          resourceId: patientId,
          ip: req.ip || '127.0.0.1',
          statusCode: 200,
          metadata: { patientId, riskLevel: riskResult.level, score: riskResult.score },
          simulation: true,
        });
      }

      res.envelope(
        {
          patientId,
          ...riskResult,
        },
        'Risk assessment evaluated successfully. Flagged to be validated by a clinician.'
      );
    } catch (err: any) {
      logger.error({ err }, 'Error in /api/ai/risk-assessment');
      res.envelopeError('RISK_ASSESSMENT_ERROR', err.message, undefined, 500);
    }
  }
);

// -----------------------------------------------------------------------------
// 4. POST /api/ai/screenings/combined (Consolidated Oral Health Report: A + B + C)
// -----------------------------------------------------------------------------
aiRouter.post(
  '/screenings/combined',
  requireAuth,
  requireScreeningRole,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId, moduleA, moduleB, moduleC } = req.body;

      if (!patientId) {
        res.envelopeError('PATIENT_ID_REQUIRED', 'patientId is required.', undefined, 400);
        return;
      }
      if (req.body.consentGiven !== true) {
        res.envelopeError('CONSENT_REQUIRED', 'Explicit patient consent is required before saving a screening report.', undefined, 400);
        return;
      }
      const hospitalId = await validatePatientScreeningAccess(req, res, String(patientId), req.body.hospitalId);
      if (res.headersSent) return;
      const clientId = req.body.clientId;
      if (typeof clientId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
        res.envelopeError('INVALID_MUTATION_ID', 'clientId must be a UUID v4.', undefined, 400);
        return;
      }

      // Idempotency check
      const existing = await AiScreening.findOne({ clientId });
      if (existing) {
        res.envelope(existing, 'Existing combined screening record returned (idempotent duplicate request)');
        return;
      }

      // Compute multi-factor recommendation
      const combinedRec = computeCombinedRecommendation(moduleA, moduleB, moduleC);

      const screening = await AiScreening.create({
        patientId,
        performedBy: {
          userId: req.user!.id,
          username: (req.user as any).username || req.user!.id,
          role: req.user!.role,
          fullName: (req.user as any).fullName,
        },
        hospitalId,
        label: moduleA?.label || null,
        confidence: moduleA?.confidence || 0.0,
        probabilities: moduleA?.probabilities || {},
        referToSpecialist: combinedRec.referToSpecialist,
        modelVersion: moduleA?.modelVersion || 'v1.0.0-combined-engine',
        source: moduleA?.source || 'server',
        imageRef: moduleA?.imageRef || moduleB?.imageRef,
        imageQuality: moduleA?.imageQuality || { ok: true, reason: null },
        moduleA: moduleA
          ? {
              label: moduleA.label,
              confidence: moduleA.confidence,
              probabilities: moduleA.probabilities || {},
              modelVersion: moduleA.modelVersion || 'v1.0.0-efficientnet_b0',
              source: moduleA.source || 'server',
              imageRef: moduleA.imageRef,
              imageQuality: moduleA.imageQuality,
            }
          : undefined,
        moduleB: moduleB
          ? {
              findings: moduleB.findings || [],
              seeDentistRecommended: combinedRec.seeDentist,
              modelVersion: moduleB.modelVersion || 'v1.0.0-dental-efficientnet_b0',
              source: moduleB.source || 'server',
              imageRef: moduleB.imageRef,
              imageQuality: moduleB.imageQuality,
            }
          : undefined,
        moduleC: moduleC
          ? {
              answers: moduleC.answers || {},
              score: moduleC.score || 0,
              level: moduleC.level || 'LOW',
              flaggedSymptoms: moduleC.flaggedSymptoms || [],
              flaggedHabits: moduleC.flaggedHabits || [],
              reportedByPatient: true,
              rationale: moduleC.rationale || '',
              clinicalValidationRequired: true,
            }
          : undefined,
        combinedRecommendation: combinedRec,
        clinicianReview: { status: 'PENDING' },
        consentGiven: true,
        consentTimestamp: new Date(),
        syncStatus: 'SYNCED',
        clientId,
        geminiAnalysis: req.body.geminiAnalysis || moduleA?.geminiAnalysis,
      });

      // Also append to patient history
      try {
        const patient = await Patient.findOne({ patientId });
        if (patient) {
          patient.history.push({
            timestamp: new Date(),
            action: 'COMBINED_ORAL_HEALTH_SCREENING_REPORT',
            performedBy: req.user!.id,
            details: {
              screeningId: screening.screeningId,
              badgeColor: combinedRec.badgeColor,
              triageCategory: combinedRec.triageCategory,
              referToSpecialist: combinedRec.referToSpecialist,
              seeDentist: combinedRec.seeDentist,
              triggerModules: combinedRec.triggerModules,
              reportedByPatient: true,
            },
          });
          await patient.save();
        }
      } catch (err) {
        logger.warn({ err }, 'Failed saving combined report summary to patient history');
      }

      // Audit Log
      if (AuditLog.db.readyState === 1) {
        await AuditLog.create({
          action: 'AI_COMBINED_ORAL_HEALTH_REPORT',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          resourceType: 'ai_screening',
          resourceId: screening.screeningId,
          ip: req.ip || '127.0.0.1',
          statusCode: 200,
          metadata: {
            patientId,
            badgeColor: combinedRec.badgeColor,
            referToSpecialist: combinedRec.referToSpecialist,
            seeDentist: combinedRec.seeDentist,
            triggerModules: combinedRec.triggerModules,
          },
          simulation: true,
        });
      }

      res.envelope(
        screening,
        'Combined Oral Health Screening Report generated successfully. Screening assessment aid only, not clinical confirmation.'
      );
    } catch (err: any) {
      logger.error({ err }, 'Error in /api/ai/screenings/combined');
      res.envelopeError('COMBINED_REPORT_ERROR', err.message, undefined, 500);
    }
  }
);

// -----------------------------------------------------------------------------
// 5. GET /api/ai/screenings?patientId=
// -----------------------------------------------------------------------------
// GET /api/ai/model-card — evaluation metrics only when real metrics are configured (never fabricated).
aiRouter.get('/model-card', requireAuth, (_req: Request, res: Response): void => {
  res.envelope(getModelCard(), 'DEMO AI model card retrieved');
});

// GET /api/ai/screenings/:screeningId/summary — patient-safe screening result (no disease names).
aiRouter.get('/screenings/:screeningId/summary', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const screeningId = String(req.params.screeningId || '').trim();
    if (!screeningId || screeningId.length > 100) {
      res.envelopeError('SCREENING_ID_REQUIRED', 'A valid screening ID is required.', undefined, 400);
      return;
    }
    const screening: any = await AiScreening.findOne({ screeningId }).lean();
    if (!screening) {
      res.envelopeError('SCREENING_NOT_FOUND', 'Screening record not found.', undefined, 404);
      return;
    }
    const role = req.user!.role;
    if (role === 'patient') {
      const selfPatientId = (req.user as any).patientId || req.user!.id;
      if (screening.patientId !== selfPatientId && screening.patientId !== req.user!.id) {
        res.envelopeError('FORBIDDEN', 'Patients may only access their own screening records.', undefined, 403);
        return;
      }
    } else if (role !== 'system_admin' && (!req.user!.hospitalId || screening.hospitalId !== req.user!.hospitalId)) {
      res.envelopeError('HOSPITAL_SCOPE_DENIED', 'This screening belongs to another facility.', undefined, 403);
      return;
    }
    res.envelope({ ...buildPatientScreeningSummary(screening), modelCard: getModelCard() }, 'Screening summary retrieved');
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/ai/screenings/:screeningId/summary');
    res.envelopeError('SCREENING_SUMMARY_ERROR', 'Screening summary could not be loaded.', undefined, 500);
  }
});

// POST /api/ai/screenings/:screeningId/reanalyze — run the detailed Gemini analysis again on the stored photo.
// Creates a NEW screening record (reanalysisOf → original); the original record is never modified.
aiRouter.post('/screenings/:screeningId/reanalyze', requireAuth, requireScreeningRole, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
      res.envelopeError('INVALID_MUTATION_ID', 'clientId must be a UUID v4.', undefined, 400);
      return;
    }
    const replay: any = await AiScreening.findOne({ clientId }).lean();
    if (replay) {
      if (replay.reanalysisOf !== req.params.screeningId) {
        res.envelopeError('MUTATION_ID_REUSED', 'This request ID was already used for another screening.', undefined, 409);
        return;
      }
      res.envelope({ screeningId: replay.screeningId, idempotentReplay: true }, 'Existing re-analysis returned.');
      return;
    }
    const original: any = await AiScreening.findOne({ screeningId: String(req.params.screeningId) }).lean();
    if (!original) {
      res.envelopeError('SCREENING_NOT_FOUND', 'Screening record not found.', undefined, 404);
      return;
    }
    const hospitalId = await validatePatientScreeningAccess(req, res, original.patientId, original.hospitalId);
    if (res.headersSent) return;
    if (!original.imageRef) {
      res.envelopeError('IMAGE_UNAVAILABLE', 'The original photo is not available. Please take a new photo.', undefined, 409);
      return;
    }
    if (!isGeminiConfigured()) {
      res.envelopeError('AI_PROVIDER_UNAVAILABLE', 'Detailed AI analysis is not configured on this server.', undefined, 503);
      return;
    }

    const { fileRecord, stream } = await getAuthorizedFile(original.imageRef, req.user as any);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer | string>) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);

    let gemini;
    try {
      gemini = await analyzeOralPhotoWithGemini({
        imageBase64: Buffer.concat(chunks).toString('base64'),
        mimeType: (fileRecord as any).mimeType || 'image/jpeg',
        language: ['en', 'te', 'hi'].includes(req.body?.language) ? req.body.language : 'en',
      });
    } catch (geminiError) {
      logger.warn({ err: geminiError instanceof Error ? geminiError.message.slice(0, 200) : 'unknown' }, 'Gemini re-analysis failed');
      res.envelopeError('AI_PROVIDER_BUSY', 'The detailed AI service is busy right now. Please try again in a few minutes.', undefined, 503);
      return;
    }

    const referToSpecialist = gemini.recommendedDoctor.urgency === 'urgent' || gemini.riskTier === 'high_risk_support';
    const combinedRec = computeCombinedRecommendation({ label: gemini.riskTier, confidence: gemini.confidenceScore, referToSpecialist }, null, null);
    const screening = await AiScreening.create({
      patientId: original.patientId,
      performedBy: { userId: req.user!.id, username: (req.user as any).username || req.user!.id, role: req.user!.role, fullName: (req.user as any).fullName },
      hospitalId: hospitalId || original.hospitalId,
      label: gemini.riskTier,
      confidence: gemini.confidenceScore,
      probabilities: {},
      referToSpecialist,
      modelVersion: `gemini-vision-${gemini.analyzedByModel}`,
      source: 'server',
      imageRef: original.imageRef,
      imageQuality: original.imageQuality,
      moduleA: { label: gemini.riskTier, confidence: gemini.confidenceScore, probabilities: {}, modelVersion: `gemini-vision-${gemini.analyzedByModel}`, source: 'server', imageRef: original.imageRef },
      combinedRecommendation: combinedRec,
      clinicianReview: { status: 'PENDING' },
      consentGiven: true,
      consentTimestamp: new Date(),
      syncStatus: 'SYNCED',
      clientId,
      geminiAnalysis: gemini,
      reanalysisOf: original.screeningId,
    });
    await AuditLog.create({ action: 'AI_SCREENING_REANALYSIS', actorId: req.user!.id, actorRole: req.user!.role, resourceType: 'ai_screening', resourceId: screening.screeningId, ip: req.ip || '127.0.0.1', statusCode: 200, metadata: { reanalysisOf: original.screeningId, model: gemini.analyzedByModel }, simulation: true });
    res.envelope({ screeningId: screening.screeningId, reanalysisOf: original.screeningId }, 'Detailed analysis completed. The original result is kept unchanged.');
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/ai/screenings/:screeningId/reanalyze');
    res.envelopeError(err?.code || 'REANALYSIS_ERROR', err?.message || 'Re-analysis failed.', undefined, Number(err?.statusCode) || 500);
  }
});

aiRouter.get('/screenings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { patientId } = req.query;

    if (!patientId || typeof patientId !== 'string') {
      res.envelopeError('PATIENT_ID_REQUIRED', 'Query parameter ?patientId= is required', undefined, 400);
      return;
    }

    if (req.user!.role === 'patient') {
      const selfPatientId = (req.user as any).patientId || req.user!.id;
      if (selfPatientId !== patientId) {
        res.envelopeError('FORBIDDEN', 'Patients may only access their own clinical screening records.', undefined, 403);
        return;
      }
    }

    const query: any = { patientId };
    if (req.user!.role !== 'system_admin' && req.user!.role !== 'patient' && req.user!.hospitalId) {
      query.hospitalId = req.user!.hospitalId;
    }

    const screenings = await AiScreening.find(query).sort({ createdAt: -1 });

    // Patients see safe summary without raw probabilities (Invariant 1 & Privacy)
    if (req.user!.role === 'patient') {
      const safePatientView = screenings.map((s) => ({
        screeningId: s.screeningId,
        createdAt: s.createdAt,
        label: s.label,
        referToSpecialist: s.referToSpecialist,
        triageCategory: s.combinedRecommendation?.triageCategory || (s.referToSpecialist ? 'URGENT_SPECIALIST' : 'ROUTINE'),
        badgeColor: s.combinedRecommendation?.badgeColor || (s.referToSpecialist ? 'RED' : 'GREEN'),
        advice: s.combinedRecommendation?.advice || 'Please consult your healthcare provider.',
        source: s.source,
        clinicianReviewStatus: s.clinicianReview.status,
        finalImpression: s.clinicianReview.finalImpression,
        riskLevel: buildPatientScreeningSummary(s).riskLevel,
        disclaimer: 'This AI result is a screening aid, not clinical confirmation. Please consult a qualified doctor.',
      }));
      res.envelope(safePatientView, 'Patient screening history retrieved safely');
      return;
    }

    res.envelope(screenings, 'AI screening records retrieved successfully');
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/ai/screenings');
    res.envelopeError('SCREENINGS_FETCH_ERROR', err.message, undefined, 500);
  }
});

// -----------------------------------------------------------------------------
// 6. POST /api/ai/screenings/sync (Idempotent Bulk Upload of Offline Results)
// -----------------------------------------------------------------------------
aiRouter.post(
  '/screenings/sync',
  requireAuth,
  requireScreeningRole,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const items: any[] = Array.isArray(req.body) ? req.body : req.body.screenings || [];

      if (!items || items.length === 0) {
        res.envelopeError('EMPTY_SYNC_PAYLOAD', 'Expected an array of offline screening objects to sync', undefined, 400);
        return;
      }

      let syncedCount = 0;
      let duplicateCount = 0;
      const results: IAiScreening[] = [];

      for (const item of items) {
        if (typeof item.clientId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.clientId)) {
          res.envelopeError('INVALID_MUTATION_ID', 'Each offline screening requires a UUID v4 clientId.', undefined, 400);
          return;
        }
        if (typeof item.patientId !== 'string' || !item.patientId.trim()) {
          res.envelopeError('PATIENT_ID_REQUIRED', 'Each offline screening must reference a saved patient record.', undefined, 400);
          return;
        }
        if (item.consentGiven !== true) {
          res.envelopeError('CONSENT_REQUIRED', 'Each offline screening must include explicit patient consent.', undefined, 400);
          return;
        }

        const hospitalId = await validatePatientScreeningAccess(req, res, item.patientId, item.hospitalId);
        if (res.headersSent) return;

        const existing = await AiScreening.findOne({ clientId: item.clientId });
        if (existing) {
          duplicateCount++;
          results.push(existing);
          continue;
        }

        // Recompute combined recommendation if modules provided
        const combinedRec = item.combinedRecommendation || computeCombinedRecommendation(item.moduleA || item, item.moduleB, item.moduleC);

        const newScreening = await AiScreening.create({
          patientId: item.patientId,
          performedBy: {
            userId: req.user!.id,
            username: (req.user as any).username || req.user!.id,
            role: req.user!.role,
            fullName: (req.user as any).fullName,
          },
          hospitalId,
          label: item.label || item.moduleA?.label || null,
          confidence: item.confidence || item.moduleA?.confidence || 0.0,
          probabilities: item.probabilities || item.moduleA?.probabilities || {},
          referToSpecialist: Boolean(combinedRec.referToSpecialist),
          modelVersion: item.modelVersion || item.moduleA?.modelVersion || item.moduleB?.modelVersion || 'offline-screening-model',
          source: 'on-device',
          imageRef: item.imageRef,
          imageQuality: item.imageQuality,
          moduleA: item.moduleA,
          moduleB: item.moduleB,
          moduleC: item.moduleC,
          combinedRecommendation: combinedRec,
          clinicianReview: { status: 'PENDING' },
          consentGiven: true,
          consentTimestamp: item.consentTimestamp ? new Date(item.consentTimestamp) : new Date(),
          syncStatus: 'SYNCED',
          clientId: item.clientId,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });

        syncedCount++;
        results.push(newScreening);
      }

      if (AuditLog.db.readyState === 1 && syncedCount > 0) {
        await AuditLog.create({
          action: 'AI_SCREENING_OFFLINE_SYNC',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          resourceType: 'ai_screening',
          ip: req.ip || '127.0.0.1',
          statusCode: 200,
          metadata: { syncedCount, duplicateCount, totalBatchSize: items.length },
          simulation: true,
        });
      }

      res.envelope(
        { syncedCount, duplicateCount, screenings: results },
        `Offline screening sync completed: ${syncedCount} imported, ${duplicateCount} duplicates skipped.`
      );
    } catch (err: any) {
      logger.error({ err }, 'Error in POST /api/ai/screenings/sync');
      res.envelopeError('SYNC_ERROR', err.message, undefined, 500);
    }
  }
);

// -----------------------------------------------------------------------------
// 7. PATCH /api/ai/screenings/:id/review (Doctor Review Confirmation / Override)
// -----------------------------------------------------------------------------
aiRouter.patch(
  '/screenings/:id/review',
  requireAuth,
  requireClinicianRole,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status: reviewStatus, finalImpression, notes } = req.body;

      if (!['CONFIRMED', 'OVERRIDDEN'].includes(reviewStatus)) {
        res.envelopeError('INVALID_REVIEW_STATUS', 'Review status must be either "CONFIRMED" or "OVERRIDDEN".', undefined, 400);
        return;
      }

      if (!finalImpression || typeof finalImpression !== 'string' || finalImpression.trim().length === 0) {
        res.envelopeError('FINAL_IMPRESSION_REQUIRED', 'Doctor final clinical impression is mandatory.', undefined, 400);
        return;
      }

      const screening = await AiScreening.findOne({
        $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { screeningId: id }, { clientId: id }],
      });

      if (!screening) {
        res.envelopeError('SCREENING_NOT_FOUND', `No screening record found matching ID '${id}'.`, undefined, 404);
        return;
      }

      if (['medical_officer', 'specialist_doctor'].includes(req.user!.role) && !(await canTreatPatient(req.user!.id, screening.patientId))) {
        res.envelopeError('TRANSFER_REQUIRED', 'Only the current treating doctor can review this patient.', undefined, 403); return;
      }
      screening.clinicianReview = {
        status: reviewStatus,
        reviewedBy: req.user!.id,
        reviewerName: (req.user as any).fullName || (req.user as any).username || 'Attending Medical Officer',
        finalImpression: finalImpression.trim(),
        notes: notes ? notes.trim() : '',
        reviewedAt: new Date(),
      };

      await screening.save();

      if (AuditLog.db.readyState === 1) {
        await AuditLog.create({
          action: 'AI_SCREENING_CLINICIAN_REVIEW',
          actorId: req.user!.id,
          actorRole: req.user!.role,
          resourceType: 'ai_screening',
          resourceId: screening.screeningId,
          ip: req.ip || '127.0.0.1',
          statusCode: 200,
          metadata: { reviewStatus, finalImpression, patientId: screening.patientId },
          simulation: true,
        });
      }

      res.envelope(
        screening,
        `Doctor clinical review recorded successfully (${reviewStatus}). Human clinician assessment is authoritative.`
      );
    } catch (err: any) {
      logger.error({ err }, 'Error in PATCH /api/ai/screenings/:id/review');
      res.envelopeError('REVIEW_UPDATE_ERROR', err.message, undefined, 500);
    }
  }
);

import { suggestDoctors } from './suggestDoctorsService.js';

/**
 * POST /api/ai/suggest-doctors
 * Rule-based doctor suggestions help patients find the right clinician; care decisions remain with qualified staff.
 * Configurable provider hook point; falls back to specialization/district matching.
 */
aiRouter.post('/suggest-doctors', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { symptomText, conditionCategory, riskLevel, location, limit } = req.body || {};
    const result = await suggestDoctors({ symptomText, conditionCategory, riskLevel, location, limit });
    if (AuditLog.db.readyState === 1) {
      await AuditLog.create({
        action: 'AI_SUGGEST_DOCTORS',
        actorId: req.user!.id,
        actorRole: req.user!.role,
        resourceType: 'ai_suggestion',
        resourceId: 'doctor_suggestions',
        ip: req.ip || '127.0.0.1',
        statusCode: 200,
        metadata: { category: result.category, urgent: result.urgent, count: result.suggestions.length },
        simulation: true,
      });
    }
    res.envelope(result, 'Doctor suggestions generated for screening support and care navigation.');
  } catch (err: any) {
    logger.error({ err }, 'Error in /api/ai/suggest-doctors');
    // Never block booking: deterministic fallback
    res.envelope({
      category: 'general check',
      doctorType: 'Dentist / Medical Officer',
      suggestions: [{ doctorId: 'LET_ADMIN_DECIDE', name: 'Let admin decide', specialization: 'Dentist', hospital: 'Nearest facility', distance: 'To be assigned', nextAvailability: 'Pending assignment' }],
      urgent: false,
      redFlags: [],
      disclaimer: 'This is a care navigation suggestion. A qualified clinician makes personal care decisions.',
      fallbackUsed: true,
    }, 'Fallback doctor suggestions returned.');
  }
});
