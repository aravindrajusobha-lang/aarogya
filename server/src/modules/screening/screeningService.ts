import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ScreeningPhoto, IScreeningPhoto } from './screeningPhotoModel.js';
import { ScreeningCase, IScreeningCase, IDemoAiResult } from './screeningCaseModel.js';
import { ClinicalAssessment, IClinicalAssessment } from './clinicalAssessmentModel.js';
import { ResultRelease, IResultRelease } from './resultReleaseModel.js';
import { Consent } from '../consent/consentModel.js';
import { User } from '../auth/userModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { savePrivateFile } from '../storage/storageService.js';
import { AuthenticatedUser } from '../../middleware/authGuard.js';
import { logger } from '../../config/logger.js';

export interface UploadPhotoInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  patientId: string;
  hospitalId: string;
  isDemo?: boolean;
  user: AuthenticatedUser;
}

export class ScreeningService {
  /**
   * 1. Photo upload (demo or consented images only).
   * Verifies that the patient has an active granted consent OR is tagged as a demo image.
   * Computes SHA-256 hash and records the initial version.
   */
  static async uploadPhoto(input: UploadPhotoInput): Promise<IScreeningPhoto> {
    const isDemo = Boolean(input.isDemo);
    let consentId: string | undefined;

    if (!isDemo) {
      // Must have active, unexpired consent for screening analysis
      const activeConsent = await Consent.findOne({
        patientId: input.patientId,
        purpose: 'screening_ai_analysis',
        status: 'granted',
        validUntil: { $gt: new Date() },
      });

      if (!activeConsent) {
        const error = new Error(
          'Photo upload requires active patient informed consent or demo simulation tag.'
        );
        (error as Error & { statusCode: number }).statusCode = 403;
        throw error;
      }

      consentId = activeConsent.consentId;
    }

    // Save image to private filesystem or Google Cloud Storage
    const savedFile = await savePrivateFile({
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      buffer: input.buffer,
      uploader: input.user,
      accessScopes: ['storage:read_clinical'],
      category: 'patients/oral-images/',
      patientId: input.patientId,
      hospitalId: input.hospitalId,
    });

    const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const photoId = `pho_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    const photo = await ScreeningPhoto.create({
      photoId,
      patientId: input.patientId,
      hospitalId: input.hospitalId,
      isDemo,
      consentId,
      originalFileId: savedFile.fileId,
      currentFileId: savedFile.fileId,
      originalSha256: sha256,
      currentSha256: sha256,
      version: 1,
      amendmentHistory: [],
      simulation: true,
    });

    await AuditLog.create({
      action: 'SCREENING_PHOTO_UPLOADED',
      actorId: input.user.id,
      actorRole: input.user.role,
      resourceType: 'screening_photo',
      resourceId: photo.photoId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 201,
      metadata: {
        patientId: input.patientId,
        isDemo,
        sha256,
        version: 1,
      },
      simulation: true,
    });

    return photo;
  }

  /**
   * 2. Amend Photo:
   * Original images stay byte-identical; amendments create new versions.
   * Stores the new image in amendmentHistory, updates currentSha256, while
   * originalSha256 and originalFileId remain strictly unchanged.
   */
  static async amendPhoto(
    photoId: string,
    newBuffer: Buffer,
    newFilename: string,
    newMimeType: string,
    amendmentReason: string,
    user: AuthenticatedUser
  ): Promise<IScreeningPhoto> {
    const photo = await ScreeningPhoto.findOne({ photoId });
    if (!photo) {
      const error = new Error('Screening photo record not found');
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    const savedFile = await savePrivateFile({
      originalFilename: newFilename,
      mimeType: newMimeType,
      buffer: newBuffer,
      uploader: user,
      accessScopes: ['storage:read_clinical'],
    });

    const newSha256 = crypto.createHash('sha256').update(newBuffer).digest('hex');
    const nextVersion = photo.version + 1;

    // Record new version in amendment history
    photo.amendmentHistory.push({
      version: nextVersion,
      fileId: savedFile.fileId,
      sha256: newSha256,
      amendedBy: user.id,
      amendedAt: new Date(),
      amendmentReason,
    });

    // Update current pointer; originalSha256 and originalFileId remain byte-identical!
    photo.currentFileId = savedFile.fileId;
    photo.currentSha256 = newSha256;
    photo.version = nextVersion;

    await photo.save();

    await AuditLog.create({
      action: 'SCREENING_PHOTO_AMENDED',
      actorId: user.id,
      actorRole: user.role,
      resourceType: 'screening_photo',
      resourceId: photo.photoId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 200,
      metadata: {
        newVersion: nextVersion,
        originalSha256: photo.originalSha256,
        newSha256,
        amendmentReason,
      },
      simulation: true,
    });

    return photo;
  }

  /**
   * 3. DEMO AI:
   * Returns a risk-support label with no clinical assertions or staging.
   * Positioning, obstruction and missing-area checks return "unavailable".
   * Includes SIMULATION banner on every AI output.
   */
  static runDemoAi(photoSha256?: string): IDemoAiResult {
    // Deterministic risk tier mapping for demonstration reproducibility
    const riskTiers: Array<
      'low_risk_support' | 'moderate_risk_support' | 'high_risk_support'
    > = ['low_risk_support', 'moderate_risk_support', 'high_risk_support'];

    let chosenTier: 'low_risk_support' | 'moderate_risk_support' | 'high_risk_support' =
      'moderate_risk_support';

    if (photoSha256) {
      const charCode = photoSha256.charCodeAt(0);
      chosenTier = riskTiers[charCode % riskTiers.length];
    }

    const doctorSpecialties = {
      low_risk_support: {
        specialty: 'Dental Surgeon',
        facility: 'Community Health Centre (CHC) Paderu',
        urgency: 'routine',
        timelineDays: 30,
        consultationReason: 'Routine preventive oral cavity examination and hygiene review.',
      },
      moderate_risk_support: {
        specialty: 'Dental Surgeon / Oral & Maxillofacial Specialist',
        facility: 'Community Health Centre (CHC) Paderu / Area Hospital Araku',
        urgency: 'priority',
        timelineDays: 14,
        consultationReason: 'Evaluation of localized oral mucosal alteration / keratosis.',
      },
      high_risk_support: {
        specialty: 'Oral & Maxillofacial Surgeon / ENT Specialist',
        facility: 'Area Hospital Araku / King George Hospital Visakhapatnam',
        urgency: 'urgent',
        timelineDays: 7,
        consultationReason: 'Priority assessment of persistent non-healing or erythroplakic mucosal patch.',
      },
    };

    return {
      riskSupportLabel: chosenTier,
      confidenceScore: 0.84,
      qualityChecks: {
        positioning: 'unavailable',
        obstruction: 'unavailable',
        missingArea: 'unavailable',
      },
      disclaimer:
        'DEMO AI SCREENING SUPPORT ONLY - CONTAINS NO CONFIRMED FINDINGS OR CLINICAL STAGING. REQUIRES CLINICIAN REVIEW.',
      simulationBanner:
        '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
      analyzedAt: new Date(),
      observedCondition:
        chosenTier === 'high_risk_support'
          ? 'Erythroplakic / Ulcerative Area'
          : chosenTier === 'moderate_risk_support'
          ? 'Keratotic White Patch / Plaque'
          : 'Benign Mucosa / Low-Risk Variant',
      recommendedDoctor: doctorSpecialties[chosenTier],
    };
  }

  /**
   * 4. Create Screening Case for the MO Queue
   */
  static async createCase(input: {
    patientId: string;
    patientName: string;
    villageId: string;
    villageName?: string;
    hospitalId: string;
    priority?: 'routine' | 'urgent' | 'high_priority';
    photoIds?: string[];
    user: AuthenticatedUser;
  }): Promise<IScreeningCase> {
    const caseId = `sc_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const photoIds = input.photoIds || [];

    // Run Demo AI on the primary photo if attached
    let demoAiResult: IDemoAiResult | undefined;
    if (photoIds.length > 0) {
      const primaryPhoto = await ScreeningPhoto.findOne({ photoId: photoIds[0] });
      demoAiResult = this.runDemoAi(primaryPhoto?.currentSha256);
    } else {
      demoAiResult = this.runDemoAi();
    }

    const newCase = await ScreeningCase.create({
      caseId,
      patientId: input.patientId,
      patientName: input.patientName,
      villageId: input.villageId,
      villageName: input.villageName,
      hospitalId: input.hospitalId,
      createdBy: input.user.id,
      status: 'pending_assignment',
      priority: input.priority || 'routine',
      photoIds,
      demoAiResult,
      resultReleased: false,
      simulation: true,
    });

    await AuditLog.create({
      action: 'SCREENING_CASE_CREATED',
      actorId: input.user.id,
      actorRole: input.user.role,
      resourceType: 'screening_case',
      resourceId: newCase.caseId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 201,
      metadata: {
        patientId: input.patientId,
        hospitalId: input.hospitalId,
        priority: newCase.priority,
      },
      simulation: true,
    });

    return newCase;
  }

  /**
   * 5. MO Case Queue Assignment:
   * Assignment by the Hospital Manager (admin) or MO lead.
   * Cross-Hospital Guard: Assignment is DENIED across hospitals!
   */
  static async assignCase(
    caseId: string,
    targetMoId: string,
    assigner: AuthenticatedUser
  ): Promise<IScreeningCase> {
    const caseRecord = await ScreeningCase.findOne({ caseId });
    if (!caseRecord) {
      const error = new Error('Screening case not found');
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Lookup target Medical Officer
    const targetMo = await User.findOne({ userId: targetMoId });
    if (!targetMo) {
      const error = new Error(`Medical Officer user ${targetMoId} not found`);
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Role check: assigner must be admin or medical_officer
    if (assigner.role !== 'admin' && assigner.role !== 'medical_officer' && assigner.role !== 'system_admin') {
      const error = new Error('Access denied. Only Hospital Managers or MO leads can assign cases.');
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }

    // CROSS-HOSPITAL GUARD:
    // 1. Assigner must belong to the same hospital as the case (unless system_admin)
    if (assigner.role !== 'system_admin' && assigner.hospitalId && assigner.hospitalId !== caseRecord.hospitalId) {
      const error = new Error('Cross-hospital case assignment denied. Assigner and case belong to different hospitals.');
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }

    // 2. Target MO must belong to the same hospital as the case
    if (targetMo.hospitalId !== caseRecord.hospitalId) {
      const error = new Error(
        `Cross-hospital case assignment denied. Target clinician (${targetMo.hospitalId}) belongs to a different hospital than the case (${caseRecord.hospitalId}).`
      );
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }

    caseRecord.assignedMoId = targetMo.userId;
    caseRecord.assignedMoName = targetMo.fullName;
    caseRecord.assignedBy = assigner.id;
    caseRecord.assignedAt = new Date();
    caseRecord.status = 'assigned';
    await caseRecord.save();

    await AuditLog.create({
      action: 'SCREENING_CASE_ASSIGNED',
      actorId: assigner.id,
      actorRole: assigner.role,
      resourceType: 'screening_case',
      resourceId: caseRecord.caseId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 200,
      metadata: {
        assignedMoId: targetMo.userId,
        hospitalId: caseRecord.hospitalId,
      },
      simulation: true,
    });

    return caseRecord;
  }

  /**
   * 6. Clinical Assessment Record (Separate Entity from Result Release):
   * Medical officer records clinical findings.
   * Result is NOT released to the patient yet.
   */
  static async recordClinicalAssessment(
    caseId: string,
    input: {
      clinicalImpression: string;
      lesionObserved?: boolean;
      anatomicalSite?: string;
      riskCategorization: 'low_risk_support' | 'moderate_risk_support' | 'high_risk_support';
      recommendedFollowUpDays?: number;
      clinicalNotes?: string;
    },
    evaluator: AuthenticatedUser
  ): Promise<IClinicalAssessment> {
    const caseRecord = await ScreeningCase.findOne({ caseId });
    if (!caseRecord) {
      const error = new Error('Screening case not found');
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    // Hospital guard
    if (evaluator.role !== 'system_admin' && evaluator.hospitalId && evaluator.hospitalId !== caseRecord.hospitalId) {
      const error = new Error('Cross-hospital access denied. Clinician belongs to a different hospital.');
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }

    const assessmentId = `ca_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    const assessment = await ClinicalAssessment.create({
      assessmentId,
      caseId: caseRecord.caseId,
      patientId: caseRecord.patientId,
      hospitalId: caseRecord.hospitalId,
      evaluatorId: evaluator.id,
      evaluatorName: evaluator.id,
      clinicalImpression: input.clinicalImpression,
      lesionObserved: Boolean(input.lesionObserved),
      anatomicalSite: input.anatomicalSite,
      riskCategorization: input.riskCategorization,
      recommendedFollowUpDays: input.recommendedFollowUpDays || 30,
      clinicalNotes: input.clinicalNotes || '',
      status: 'completed',
      completedAt: new Date(),
      simulation: true,
    });

    caseRecord.clinicalAssessmentId = assessment.assessmentId;
    caseRecord.status = 'under_review';
    caseRecord.resultReleased = false; // Remains separate and unreleased
    await caseRecord.save();

    await AuditLog.create({
      action: 'CLINICAL_ASSESSMENT_RECORDED',
      actorId: evaluator.id,
      actorRole: evaluator.role,
      resourceType: 'clinical_assessment',
      resourceId: assessment.assessmentId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 201,
      metadata: {
        caseId: caseRecord.caseId,
        patientId: caseRecord.patientId,
        riskCategorization: assessment.riskCategorization,
      },
      simulation: true,
    });

    return assessment;
  }

  /**
   * 7. Result Release (Separate Entity):
   * Official clinical release makes results viewable to patients.
   */
  static async releaseResult(
    caseId: string,
    input: {
      patientSummaryMessage: string;
      recommendedAction: string;
    },
    releaser: AuthenticatedUser
  ): Promise<IResultRelease> {
    const caseRecord = await ScreeningCase.findOne({ caseId });
    if (!caseRecord) {
      const error = new Error('Screening case not found');
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    if (!caseRecord.clinicalAssessmentId) {
      const error = new Error(
        'Cannot release results before a clinical evaluation has been recorded.'
      );
      (error as Error & { statusCode: number }).statusCode = 400;
      throw error;
    }

    // Hospital guard
    if (releaser.role !== 'system_admin' && releaser.hospitalId && releaser.hospitalId !== caseRecord.hospitalId) {
      const error = new Error('Cross-hospital access denied.');
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }

    const releaseId = `rel_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

    const release = await ResultRelease.create({
      releaseId,
      caseId: caseRecord.caseId,
      patientId: caseRecord.patientId,
      hospitalId: caseRecord.hospitalId,
      assessmentId: caseRecord.clinicalAssessmentId,
      releasedBy: releaser.id,
      releasedByName: releaser.id,
      releasedAt: new Date(),
      patientSummaryMessage: input.patientSummaryMessage,
      recommendedAction: input.recommendedAction,
      status: 'released',
      simulation: true,
    });

    caseRecord.resultReleased = true;
    caseRecord.resultReleaseId = release.releaseId;
    caseRecord.status = 'completed';
    await caseRecord.save();

    await AuditLog.create({
      action: 'SCREENING_RESULT_RELEASED',
      actorId: releaser.id,
      actorRole: releaser.role,
      resourceType: 'result_release',
      resourceId: release.releaseId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 201,
      metadata: {
        caseId: caseRecord.caseId,
        patientId: caseRecord.patientId,
      },
      simulation: true,
    });

    return release;
  }

  /**
   * 8. Case Escalation
   */
  static async escalateCase(
    caseId: string,
    reason: string,
    user: AuthenticatedUser
  ): Promise<IScreeningCase> {
    const caseRecord = await ScreeningCase.findOne({ caseId });
    if (!caseRecord) {
      const error = new Error('Screening case not found');
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    caseRecord.status = 'escalated';
    caseRecord.escalationDetails = {
      escalatedBy: user.id,
      escalatedAt: new Date(),
      escalationReason: reason,
      escalatedToRole: 'specialist_panel',
    };
    await caseRecord.save();

    await AuditLog.create({
      action: 'SCREENING_CASE_ESCALATED',
      actorId: user.id,
      actorRole: user.role,
      resourceType: 'screening_case',
      resourceId: caseRecord.caseId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 200,
      metadata: { escalationReason: reason },
      simulation: true,
    });

    return caseRecord;
  }

  /**
   * 9. Specialist Referral Request
   */
  static async requestReferral(
    caseId: string,
    input: {
      specialistId?: string;
      specialty: string;
      facilityName: string;
      referralNotes: string;
    },
    user: AuthenticatedUser
  ): Promise<IScreeningCase> {
    const caseRecord = await ScreeningCase.findOne({ caseId });
    if (!caseRecord) {
      const error = new Error('Screening case not found');
      (error as Error & { statusCode: number }).statusCode = 404;
      throw error;
    }

    caseRecord.status = 'referral_requested';
    caseRecord.referralDetails = {
      referredBy: user.id,
      referredAt: new Date(),
      specialistId: input.specialistId,
      specialty: input.specialty,
      facilityName: input.facilityName,
      referralNotes: input.referralNotes,
    };
    await caseRecord.save();

    await AuditLog.create({
      action: 'SCREENING_CASE_REFERRED',
      actorId: user.id,
      actorRole: user.role,
      resourceType: 'screening_case',
      resourceId: caseRecord.caseId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/ScreeningEngine',
      statusCode: 200,
      metadata: {
        specialty: input.specialty,
        facilityName: input.facilityName,
      },
      simulation: true,
    });

    return caseRecord;
  }

  /**
   * 10. Patient Result Access Check:
   * Patients can ONLY see screening results AFTER official release.
   */
  static async getPatientResults(
    patientId: string,
    user: AuthenticatedUser
  ): Promise<any> {
    // Patients can only query their own results
    if (user.role === 'patient' && user.id !== patientId) {
      const error = new Error('Access denied to other patient clinical records.');
      (error as Error & { statusCode: number }).statusCode = 403;
      throw error;
    }

    const cases = await ScreeningCase.find({ patientId });

    const releasedResults: any[] = [];
    let pendingCount = 0;

    for (const c of cases) {
      if (c.resultReleased && c.resultReleaseId) {
        const releaseRecord = await ResultRelease.findOne({ releaseId: c.resultReleaseId });
        const assessmentRecord = c.clinicalAssessmentId
          ? await ClinicalAssessment.findOne({ assessmentId: c.clinicalAssessmentId })
          : null;

        releasedResults.push({
          caseId: c.caseId,
          releasedAt: releaseRecord?.releasedAt,
          releasedBy: releaseRecord?.releasedByName,
          patientSummaryMessage: releaseRecord?.patientSummaryMessage,
          recommendedAction: releaseRecord?.recommendedAction,
          riskCategorization: assessmentRecord?.riskCategorization,
          recommendedFollowUpDays: assessmentRecord?.recommendedFollowUpDays,
          simulationBanner: '⚠️ SIMULATION SYSTEM - DEMO DATA ONLY - NOT FOR CLINICAL USE',
        });
      } else {
        pendingCount += 1;
      }
    }

    return {
      patientId,
      totalCases: cases.length,
      releasedCount: releasedResults.length,
      pendingCount,
      results: releasedResults,
      patientNotice:
        pendingCount > 0
          ? 'Some screening evaluations are currently under medical officer review and will be visible here once officially released.'
          : 'All released screening summaries displayed.',
    };
  }

  /**
   * List screening cases for MO case queue
   */
  static async listCases(filter: {
    hospitalId?: string;
    status?: string;
    assignedMoId?: string;
  } = {}): Promise<IScreeningCase[]> {
    const query: any = {};
    if (filter.hospitalId) query.hospitalId = filter.hospitalId;
    if (filter.status) query.status = filter.status;
    if (filter.assignedMoId) query.assignedMoId = filter.assignedMoId;

    return ScreeningCase.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get single case by ID
   */
  static async getCaseById(caseId: string): Promise<IScreeningCase | null> {
    return ScreeningCase.findOne({ caseId });
  }
}
