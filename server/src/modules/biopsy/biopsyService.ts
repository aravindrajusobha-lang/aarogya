import crypto from 'crypto';
import {
  Biopsy,
  BiopsyFindings,
  BiopsyResultRelease,
  IBiopsyDocument,
  IBiopsyFindingsDocument,
  IBiopsyResultReleaseDocument,
  BiopsyStatus,
} from './biopsyModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { logger } from '../../config/logger.js';

export const ALLOWED_BIOPSY_TRANSITIONS: Record<BiopsyStatus, BiopsyStatus[]> = {
  REQUESTED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['COLLECTED', 'CANCELLED', 'REQUESTED'],
  COLLECTED: ['SENT_TO_LAB', 'RECOLLECTION_REQUIRED', 'CANCELLED'],
  SENT_TO_LAB: ['RESULT_RECEIVED', 'RECOLLECTION_REQUIRED', 'CANCELLED'],
  RECOLLECTION_REQUIRED: ['SCHEDULED', 'COLLECTED', 'CANCELLED'],
  RESULT_RECEIVED: ['CANCELLED'],
  CANCELLED: [],
};

export class BiopsyService {
  /**
   * Validates state transition according to the explicit transition table
   */
  static validateTransition(currentStatus: BiopsyStatus, targetStatus: BiopsyStatus): void {
    const allowed = ALLOWED_BIOPSY_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      const err: any = new Error(
        `Invalid biopsy status transition from ${currentStatus} to ${targetStatus}`
      );
      err.code = 'INVALID_BIOPSY_TRANSITION';
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Creates a new biopsy request
   */
  static async createBiopsyRequest(
    data: {
      patientId: string;
      patientName?: string;
      hospitalId: string;
      screeningCaseId?: string;
      anatomicalLocation: string;
      requestingDoctorId: string;
      requestingDoctorName?: string;
    },
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IBiopsyDocument> {
    const biopsyId = `bx_${crypto.randomBytes(6).toString('hex')}`;

    const biopsy = new Biopsy({
      biopsyId,
      patientId: data.patientId,
      patientName: data.patientName,
      hospitalId: data.hospitalId,
      screeningCaseId: data.screeningCaseId,
      status: 'REQUESTED',
      anatomicalLocation: data.anatomicalLocation,
      requestingDoctorId: data.requestingDoctorId,
      requestingDoctorName: data.requestingDoctorName || actor.userId,
    });

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.requested',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 201,
      metadata: {
        patientId: data.patientId,
        hospitalId: data.hospitalId,
        anatomicalLocation: data.anatomicalLocation,
      },
      simulation: true,
    });

    return biopsy;
  }

  /**
   * Schedules a biopsy procedure
   */
  static async scheduleBiopsy(
    biopsyId: string,
    procedureDate: Date | string,
    scheduledHospitalId: string,
    actor: { userId: string; role: string }
  ): Promise<IBiopsyDocument> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.validateTransition(biopsy.status, 'SCHEDULED');

    biopsy.status = 'SCHEDULED';
    biopsy.procedureDate = new Date(procedureDate);
    biopsy.scheduledHospitalId = scheduledHospitalId;

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.scheduled',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        procedureDate: biopsy.procedureDate.toISOString(),
        scheduledHospitalId,
      },
      simulation: true,
    });

    return biopsy;
  }

  /**
   * Logs physical collection of specimen
   */
  static async collectSpecimen(
    biopsyId: string,
    details: {
      collectedBy: string;
      specimenBarcode: string;
      fixative?: string;
      tissueType: string;
    },
    actor: { userId: string; role: string }
  ): Promise<IBiopsyDocument> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.validateTransition(biopsy.status, 'COLLECTED');

    biopsy.status = 'COLLECTED';
    biopsy.collectionDetails = {
      collectedAt: new Date(),
      collectedBy: details.collectedBy || actor.userId,
      specimenBarcode: details.specimenBarcode,
      fixative: details.fixative || '10% Neutral Buffered Formalin',
      tissueType: details.tissueType,
    };

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.collected',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        specimenBarcode: details.specimenBarcode,
        tissueType: details.tissueType,
      },
      simulation: true,
    });

    return biopsy;
  }

  /**
   * Dispatches specimen to pathology laboratory
   */
  static async sendToLab(
    biopsyId: string,
    transit: {
      destinationLabName: string;
      courierTrackingId?: string;
    },
    actor: { userId: string; role: string }
  ): Promise<IBiopsyDocument> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.validateTransition(biopsy.status, 'SENT_TO_LAB');

    biopsy.status = 'SENT_TO_LAB';
    biopsy.transitDetails = {
      dispatchedAt: new Date(),
      dispatchedBy: actor.userId,
      destinationLabName: transit.destinationLabName,
      courierTrackingId: transit.courierTrackingId,
    };

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.sent_to_lab',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        destinationLabName: transit.destinationLabName,
        courierTrackingId: transit.courierTrackingId,
      },
      simulation: true,
    });

    return biopsy;
  }

  /**
   * Flags specimen as requiring recollection (Loops back to SCHEDULED or COLLECTED)
   */
  static async flagRecollectionRequired(
    biopsyId: string,
    reason: string,
    actor: { userId: string; role: string }
  ): Promise<IBiopsyDocument> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.validateTransition(biopsy.status, 'RECOLLECTION_REQUIRED');

    const previousCycles = biopsy.recollectionDetails?.cycleCount || 0;
    biopsy.status = 'RECOLLECTION_REQUIRED';
    biopsy.recollectionDetails = {
      flaggedAt: new Date(),
      flaggedBy: actor.userId,
      reason,
      cycleCount: previousCycles + 1,
    };

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.recollection_required',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        reason,
        cycleCount: previousCycles + 1,
      },
      simulation: true,
    });

    return biopsy;
  }

  /**
   * Records histopathology findings (Qualified staff only; separate entity)
   */
  static async recordFindings(
    biopsyId: string,
    findingsData: {
      pathologistId: string;
      pathologistName: string;
      specimenAdequacy: string;
      grossDescription: string;
      microscopicObservations: string;
      pathologistImpression: string;
      labAttachment?: {
        fileId: string;
        sha256: string;
      };
    },
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<{ biopsy: IBiopsyDocument; findings: IBiopsyFindingsDocument }> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Role check: Only qualified clinician / pathologist
    const qualifiedRoles = ['pathologist', 'specialist', 'medical_officer', 'admin', 'system_admin'];
    if (!qualifiedRoles.includes(actor.role)) {
      const err: any = new Error(
        'Histopathology findings records must be authored by qualified clinical staff only'
      );
      err.code = 'FORBIDDEN_FINDINGS_ROLE';
      err.statusCode = 403;
      throw err;
    }

    this.validateTransition(biopsy.status, 'RESULT_RECEIVED');

    const findingsId = `bf_${crypto.randomBytes(6).toString('hex')}`;

    // Create Separate Entity 2: BiopsyFindings
    const findings = new BiopsyFindings({
      findingsId,
      biopsyId,
      patientId: biopsy.patientId,
      hospitalId: biopsy.hospitalId,
      pathologistId: findingsData.pathologistId || actor.userId,
      pathologistName: findingsData.pathologistName,
      specimenAdequacy: findingsData.specimenAdequacy,
      grossDescription: findingsData.grossDescription,
      microscopicObservations: findingsData.microscopicObservations,
      pathologistImpression: findingsData.pathologistImpression,
      recordedAt: new Date(),
    });

    await findings.save();

    biopsy.status = 'RESULT_RECEIVED';
    biopsy.findingsId = findingsId;

    if (findingsData.labAttachment) {
      biopsy.labAttachment = {
        originalFileId: findingsData.labAttachment.fileId,
        originalSha256: findingsData.labAttachment.sha256,
        currentFileId: findingsData.labAttachment.fileId,
        currentSha256: findingsData.labAttachment.sha256,
        version: 1,
        amendmentHistory: [],
      };
    }

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.result_received',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        findingsId,
        specimenAdequacy: findingsData.specimenAdequacy,
      },
      simulation: true,
    });

    return { biopsy, findings };
  }

  /**
   * Releases results to patient (Separate Entity 3; blocked until qualified reviewer approves)
   */
  static async releaseResult(
    biopsyId: string,
    releaseData: {
      patientSummaryMessage: string;
      recommendedAction: string;
      reviewerNotes?: string;
    },
    actor: { userId: string; role: string; hospitalId?: string; name?: string }
  ): Promise<{ biopsy: IBiopsyDocument; release: IBiopsyResultReleaseDocument }> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (biopsy.status !== 'RESULT_RECEIVED') {
      const err: any = new Error(
        `Cannot release results for biopsy with status ${biopsy.status}; results must be received first`
      );
      err.code = 'BIOPSY_NOT_READY_FOR_RELEASE';
      err.statusCode = 400;
      throw err;
    }

    if (!biopsy.findingsId) {
      const err: any = new Error('Cannot release biopsy without attached findings record');
      err.code = 'MISSING_FINDINGS_RECORD';
      err.statusCode = 400;
      throw err;
    }

    // Role check: Only qualified medical reviewer
    const reviewerRoles = ['medical_officer', 'specialist', 'admin', 'system_admin'];
    if (!reviewerRoles.includes(actor.role)) {
      const err: any = new Error(
        'Release approval is restricted to qualified medical reviewers only'
      );
      err.code = 'FORBIDDEN_RELEASE_ROLE';
      err.statusCode = 403;
      throw err;
    }

    const releaseId = `br_${crypto.randomBytes(6).toString('hex')}`;

    // Create Separate Entity 3: BiopsyResultRelease
    const release = new BiopsyResultRelease({
      releaseId,
      biopsyId,
      findingsId: biopsy.findingsId,
      patientId: biopsy.patientId,
      hospitalId: biopsy.hospitalId,
      releasedBy: actor.userId,
      releasedByName: actor.name || actor.userId,
      reviewerNotes: releaseData.reviewerNotes || '',
      patientSummaryMessage: releaseData.patientSummaryMessage,
      recommendedAction: releaseData.recommendedAction,
      status: 'released',
      releasedAt: new Date(),
    });

    await release.save();

    biopsy.releaseId = releaseId;
    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.result_released',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        releaseId,
        findingsId: biopsy.findingsId,
      },
      simulation: true,
    });

    return { biopsy, release };
  }

  /**
   * Amends a lab report attachment while leaving the original file byte-identical and hash intact
   */
  static async amendAttachment(
    biopsyId: string,
    amendment: {
      newFileId: string;
      newSha256: string;
      reason: string;
    },
    actor: { userId: string; role: string }
  ): Promise<IBiopsyDocument> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (!biopsy.labAttachment) {
      const err: any = new Error('No original attachment exists to amend');
      err.code = 'ATTACHMENT_NOT_FOUND';
      err.statusCode = 400;
      throw err;
    }

    const originalSha = biopsy.labAttachment.originalSha256;
    const newVersion = biopsy.labAttachment.version + 1;

    biopsy.labAttachment.amendmentHistory.push({
      version: newVersion,
      amendedFileId: amendment.newFileId,
      amendedSha256: amendment.newSha256,
      amendedBy: actor.userId,
      amendedAt: new Date(),
      reason: amendment.reason,
    });

    biopsy.labAttachment.currentFileId = amendment.newFileId;
    biopsy.labAttachment.currentSha256 = amendment.newSha256;
    biopsy.labAttachment.version = newVersion;

    // Safety assertion: Ensure originalSha256 was not mutated
    if (biopsy.labAttachment.originalSha256 !== originalSha) {
      throw new Error('Cryptographic invariant violated: original SHA-256 hash was mutated');
    }

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.attachment_amended',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        version: newVersion,
        originalSha256: originalSha,
        amendedSha256: amendment.newSha256,
        reason: amendment.reason,
      },
      simulation: true,
    });

    return biopsy;
  }

  /**
   * Cancels a biopsy
   */
  static async cancelBiopsy(
    biopsyId: string,
    reason: string,
    actor: { userId: string; role: string }
  ): Promise<IBiopsyDocument> {
    const biopsy = await Biopsy.findOne({ biopsyId });
    if (!biopsy) {
      const err: any = new Error('Biopsy record not found');
      err.code = 'BIOPSY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.validateTransition(biopsy.status, 'CANCELLED');

    biopsy.status = 'CANCELLED';
    biopsy.cancellation = {
      cancelledBy: actor.userId,
      reason,
      cancelledAt: new Date(),
    };

    await biopsy.save();

    await AuditLog.create({
      action: 'biopsy.cancelled',
      resourceType: 'biopsy',
      resourceId: biopsyId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { reason },
      simulation: true,
    });

    return biopsy;
  }

  static async getBiopsyById(biopsyId: string): Promise<IBiopsyDocument | null> {
    return Biopsy.findOne({ biopsyId });
  }

  static async getFindingsByBiopsyId(biopsyId: string): Promise<IBiopsyFindingsDocument | null> {
    return BiopsyFindings.findOne({ biopsyId });
  }

  static async getReleaseByBiopsyId(biopsyId: string): Promise<IBiopsyResultReleaseDocument | null> {
    return BiopsyResultRelease.findOne({ biopsyId });
  }

  static async listBiopsies(filters: {
    hospitalId?: string;
    patientId?: string;
    status?: BiopsyStatus;
  }): Promise<IBiopsyDocument[]> {
    const query: any = {};
    if (filters.hospitalId) query.hospitalId = filters.hospitalId;
    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.status) query.status = filters.status;
    return Biopsy.find(query).sort({ createdAt: -1 });
  }
}
