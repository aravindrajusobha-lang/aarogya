import crypto from 'crypto';
import {
  Teleconsultation,
  ITeleconsultationDocument,
  TeleconsultationStatus,
  ConsultationNote,
  IConsultationNoteDocument,
  ConsultationMessage,
  IConsultationMessageDocument,
} from './teleconsultationModel.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { videoAdapter, IVideoAdapterResponse } from './teleconsultationAdapter.js';

export const ALLOWED_TELECONSULT_TRANSITIONS: Record<
  TeleconsultationStatus,
  TeleconsultationStatus[]
> = {
  REQUESTED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['IN_PROGRESS', 'SCHEDULED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export class TeleconsultationService {
  /**
   * Validates legal status transitions for teleconsultation
   */
  static validateTransition(
    currentStatus: TeleconsultationStatus,
    targetStatus: TeleconsultationStatus
  ): void {
    const allowed = ALLOWED_TELECONSULT_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      const err: any = new Error(
        `Illegal status transition from ${currentStatus} to ${targetStatus}`
      );
      err.code = 'INVALID_TELECONSULT_TRANSITION';
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Enforces cross-hospital data isolation
   */
  static assertHospitalAccess(
    consultation: ITeleconsultationDocument,
    actor: { userId: string; role: string; hospitalId?: string }
  ): void {
    if (actor.role === 'system_admin') return;

    if (actor.role === 'patient') {
      if (consultation.patientId !== actor.userId) {
        const err: any = new Error('Access denied: Patients can view only their own teleconsultations');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
      return;
    }

    if (actor.hospitalId && actor.hospitalId !== consultation.hospitalId) {
      const err: any = new Error(
        'Access denied: Teleconsultation records are restricted to the designated health facility'
      );
      err.code = 'CROSS_HOSPITAL_FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }
  }

  /**
   * Requests a new teleconsultation session
   */
  static async requestConsultation(
    data: {
      patientId: string;
      patientName?: string;
      hospitalId: string;
      assignedClinicianId: string;
      assignedClinicianName?: string;
      assignedClinicianRole?: string;
      screeningCaseId?: string;
      appointmentId?: string;
    },
    actor: { userId: string; role: string; hospitalId?: string; name?: string }
  ): Promise<ITeleconsultationDocument> {
    const hospital = await Hospital.findOne({
      hospitalId: data.hospitalId,
      status: { $ne: 'inactive' },
    });
    if (!hospital) {
      const err: any = new Error(`Hospital "${data.hospitalId}" not found or inactive`);
      err.code = 'HOSPITAL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const consultationId = `tc_${crypto.randomBytes(6).toString('hex')}`;
    const consultation = new Teleconsultation({
      consultationId,
      patientId: data.patientId,
      patientName: data.patientName,
      requestedBy: actor.userId,
      requesterRole: actor.role,
      hospitalId: data.hospitalId,
      assignedClinicianId: data.assignedClinicianId,
      assignedClinicianName: data.assignedClinicianName || data.assignedClinicianId,
      assignedClinicianRole: data.assignedClinicianRole || 'medical_officer',
      screeningCaseId: data.screeningCaseId,
      appointmentId: data.appointmentId,
      status: 'REQUESTED',
      channelConfig: {
        videoStatus: 'BLOCKED',
        voiceStatus: 'BLOCKED',
        textChatStatus: 'ACTIVE',
      },
      release: {
        isReleased: false,
      },
      simulation: true,
    });

    await consultation.save();

    await AuditLog.create({
      action: 'teleconsultation.requested',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 201,
      metadata: {
        patientId: data.patientId,
        assignedClinicianId: data.assignedClinicianId,
      },
      simulation: true,
    });

    return consultation;
  }

  /**
   * Schedules teleconsultation session
   */
  static async scheduleConsultation(
    consultationId: string,
    scheduledAt: string | Date,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<ITeleconsultationDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);
    this.validateTransition(consultation.status, 'SCHEDULED');

    const scheduleDate = new Date(scheduledAt);
    if (isNaN(scheduleDate.getTime())) {
      const err: any = new Error('Invalid scheduled consultation date format');
      err.code = 'INVALID_DATE';
      err.statusCode = 400;
      throw err;
    }

    consultation.status = 'SCHEDULED';
    consultation.scheduledAt = scheduleDate;
    await consultation.save();

    await AuditLog.create({
      action: 'teleconsultation.scheduled',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { scheduledAt: scheduleDate },
      simulation: true,
    });

    return consultation;
  }

  /**
   * Starts consultation session (transitions to IN_PROGRESS)
   */
  static async startConsultation(
    consultationId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<ITeleconsultationDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);
    this.validateTransition(consultation.status, 'IN_PROGRESS');

    consultation.status = 'IN_PROGRESS';
    consultation.startedAt = new Date();
    await consultation.save();

    await AuditLog.create({
      action: 'teleconsultation.started',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { startedAt: consultation.startedAt },
      simulation: true,
    });

    return consultation;
  }

  /**
   * Video Adapter Invocation: Returns explicit BLOCKED status (No fake call screen)
   */
  static async getVideoSession(
    consultationId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IVideoAdapterResponse> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);
    return videoAdapter.initiateVideoSession(consultationId);
  }

  /**
   * Voice Adapter Invocation: Returns explicit BLOCKED status
   */
  static async getVoiceSession(
    consultationId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IVideoAdapterResponse> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);
    return videoAdapter.initiateVoiceSession(consultationId);
  }

  /**
   * Records Clinical Notes by the assigned clinician (Versioned with SHA-256 hash)
   */
  static async recordClinicianNotes(
    consultationId: string,
    noteText: string,
    actor: { userId: string; role: string; hospitalId?: string; name?: string }
  ): Promise<IConsultationNoteDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);

    // Strict Authorization: Only the assigned clinician writes notes!
    if (consultation.assignedClinicianId !== actor.userId && actor.role !== 'system_admin') {
      const err: any = new Error(
        'Access denied: Only the designated clinician assigned to this teleconsultation may record clinical notes'
      );
      err.code = 'FORBIDDEN_NOT_ASSIGNED_CLINICIAN';
      err.statusCode = 403;
      throw err;
    }

    const noteId = `note_${crypto.randomBytes(6).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(noteText).digest('hex');

    const note = new ConsultationNote({
      noteId,
      consultationId,
      clinicianId: actor.userId,
      clinicianName: actor.name || actor.userId,
      clinicianRole: actor.role,
      currentVersion: 1,
      originalNoteText: noteText,
      originalHash: hash,
      currentNoteText: noteText,
      currentHash: hash,
      notesHistory: [
        {
          version: 1,
          noteText,
          hash,
          amendedBy: actor.userId,
          amendedAt: new Date(),
          amendmentReason: 'Initial clinical observation documentation',
        },
      ],
      recordedAt: new Date(),
    });

    await note.save();

    await AuditLog.create({
      action: 'teleconsultation.notes_recorded',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 201,
      metadata: { noteId, hash },
      simulation: true,
    });

    return note;
  }

  /**
   * Amends Clinical Notes (Original hash remains byte-identical; history tracked)
   */
  static async amendClinicianNotes(
    consultationId: string,
    amendment: {
      newNoteText: string;
      amendmentReason: string;
    },
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IConsultationNoteDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);

    // Strict Authorization: Only the assigned clinician amends notes!
    if (consultation.assignedClinicianId !== actor.userId && actor.role !== 'system_admin') {
      const err: any = new Error(
        'Access denied: Only the designated clinician assigned to this teleconsultation may amend clinical notes'
      );
      err.code = 'FORBIDDEN_NOT_ASSIGNED_CLINICIAN';
      err.statusCode = 403;
      throw err;
    }

    const note = await ConsultationNote.findOne({ consultationId });
    if (!note) {
      const err: any = new Error('No clinical note exists to amend for this consultation');
      err.code = 'NOTE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const nextVersion = note.currentVersion + 1;
    const newHash = crypto.createHash('sha256').update(amendment.newNoteText).digest('hex');

    note.notesHistory.push({
      version: nextVersion,
      noteText: amendment.newNoteText,
      hash: newHash,
      amendedBy: actor.userId,
      amendedAt: new Date(),
      amendmentReason: amendment.amendmentReason,
    });

    note.currentVersion = nextVersion;
    note.currentNoteText = amendment.newNoteText;
    note.currentHash = newHash;

    await note.save();

    await AuditLog.create({
      action: 'teleconsultation.notes_amended',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        noteId: note.noteId,
        version: nextVersion,
        originalHash: note.originalHash,
        newHash,
      },
      simulation: true,
    });

    return note;
  }

  /**
   * Releases Consultation Summary for Patient Access
   */
  static async releaseConsultationResult(
    consultationId: string,
    releaseData: {
      patientSummaryMessage: string;
      recommendedAction: string;
    },
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<ITeleconsultationDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);

    // Role verification: Clinician or Admin reviewer
    const ALLOWED_RELEASE_ROLES = ['medical_officer', 'specialist', 'admin', 'system_admin'];
    if (!ALLOWED_RELEASE_ROLES.includes(actor.role)) {
      const err: any = new Error('Only qualified clinicians or administrators may release teleconsultation summaries');
      err.code = 'FORBIDDEN_RELEASE_ROLE';
      err.statusCode = 403;
      throw err;
    }

    consultation.release = {
      isReleased: true,
      releasedAt: new Date(),
      releasedBy: actor.userId,
      patientSummaryMessage: releaseData.patientSummaryMessage,
      recommendedAction: releaseData.recommendedAction,
    };

    if (consultation.status === 'IN_PROGRESS' || consultation.status === 'SCHEDULED') {
      consultation.status = 'COMPLETED';
      consultation.completedAt = new Date();
    }

    await consultation.save();

    await AuditLog.create({
      action: 'teleconsultation.result_released',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { releasedBy: actor.userId },
      simulation: true,
    });

    return consultation;
  }

  /**
   * Fetches Clinical Notes with Release Gating for Patients
   */
  static async getConsultationNotes(
    consultationId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IConsultationNoteDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);

    // Patient Access Gating Rule: Patients see only released information!
    if (actor.role === 'patient') {
      if (!consultation.release?.isReleased) {
        const err: any = new Error(
          'Clinical consultation notes have not been released for patient viewing yet'
        );
        err.code = 'RESULT_NOT_RELEASED';
        err.statusCode = 403;
        throw err;
      }
    }

    const note = await ConsultationNote.findOne({ consultationId });
    if (!note) {
      const err: any = new Error('No clinical note has been recorded for this consultation yet');
      err.code = 'NOTE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    return note;
  }

  /**
   * Real text-based case discussion between healthcare staff
   */
  static async postCaseDiscussionMessage(
    consultationId: string,
    messageText: string,
    actor: { userId: string; role: string; hospitalId?: string; name?: string }
  ): Promise<IConsultationMessageDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);

    // Staff-only check: Patients cannot participate in clinical case discussion chat
    const STAFF_ROLES = ['medical_officer', 'specialist', 'anm', 'asha', 'admin', 'system_admin'];
    if (!STAFF_ROLES.includes(actor.role)) {
      const err: any = new Error('Case discussion messages are restricted to healthcare staff');
      err.code = 'FORBIDDEN_STAFF_DISCUSSION';
      err.statusCode = 403;
      throw err;
    }

    const messageId = `msg_${crypto.randomBytes(6).toString('hex')}`;
    const message = new ConsultationMessage({
      messageId,
      consultationId,
      senderId: actor.userId,
      senderName: actor.name || actor.userId,
      senderRole: actor.role,
      messageText,
    });

    await message.save();

    await AuditLog.create({
      action: 'teleconsultation.message_posted',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 201,
      metadata: { messageId, senderRole: actor.role },
      simulation: true,
    });

    return message;
  }

  /**
   * Lists staff-only discussion messages
   */
  static async getCaseDiscussionMessages(
    consultationId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IConsultationMessageDocument[]> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);

    const STAFF_ROLES = ['medical_officer', 'specialist', 'anm', 'asha', 'admin', 'system_admin'];
    if (!STAFF_ROLES.includes(actor.role)) {
      const err: any = new Error('Case discussion messages are restricted to healthcare staff');
      err.code = 'FORBIDDEN_STAFF_DISCUSSION';
      err.statusCode = 403;
      throw err;
    }

    return ConsultationMessage.find({ consultationId }).sort({ createdAt: 1 });
  }

  /**
   * Cancels teleconsultation session
   */
  static async cancelConsultation(
    consultationId: string,
    reason: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<ITeleconsultationDocument> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) {
      const err: any = new Error('Teleconsultation record not found');
      err.code = 'TELECONSULT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(consultation, actor);
    this.validateTransition(consultation.status, 'CANCELLED');

    consultation.status = 'CANCELLED';
    consultation.cancellation = {
      cancelledBy: actor.userId,
      reason,
      cancelledAt: new Date(),
    };

    await consultation.save();

    await AuditLog.create({
      action: 'teleconsultation.cancelled',
      resourceType: 'teleconsultation',
      resourceId: consultationId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { reason },
      simulation: true,
    });

    return consultation;
  }

  /**
   * Lists teleconsultations scoped by hospital or patient
   */
  static async listConsultations(
    filters: {
      status?: TeleconsultationStatus;
      patientId?: string;
      hospitalId?: string;
    },
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<ITeleconsultationDocument[]> {
    const query: any = {};

    if (filters.status) query.status = filters.status;

    if (actor.role === 'patient') {
      query.patientId = actor.userId;
    } else if (actor.role !== 'system_admin' && actor.hospitalId) {
      if (filters.hospitalId && filters.hospitalId !== actor.hospitalId) {
        const err: any = new Error(
          'Access denied: Teleconsultation records are restricted to the designated health facility'
        );
        err.code = 'CROSS_HOSPITAL_FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
      query.hospitalId = actor.hospitalId;
    } else if (filters.hospitalId) {
      query.hospitalId = filters.hospitalId;
    }

    if (filters.patientId) query.patientId = filters.patientId;

    return Teleconsultation.find(query).sort({ createdAt: -1 });
  }

  /**
   * Fetches single teleconsultation by ID
   */
  static async getConsultationById(
    consultationId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<ITeleconsultationDocument | null> {
    const consultation = await Teleconsultation.findOne({ consultationId });
    if (!consultation) return null;

    this.assertHospitalAccess(consultation, actor);
    return consultation;
  }
}
