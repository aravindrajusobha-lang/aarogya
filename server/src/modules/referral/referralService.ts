import crypto from 'crypto';
import { Referral, IReferralDocument, ReferralStatus } from './referralModel.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { Specialist } from '../specialist/specialistModel.js';
import { ScreeningCase } from '../screening/screeningCaseModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { getAgenda } from '../../config/agenda.js';

export const ALLOWED_REFERRAL_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  REQUESTED: ['ACCEPTED', 'CANCELLED', 'hospital_assigned', 'pending_referral'],
  ACCEPTED: ['SCHEDULED', 'CANCELLED', 'appointment_scheduled'],
  SCHEDULED: ['ATTENDED', 'MISSED', 'SCHEDULED', 'CANCELLED', 'patient_visited'],
  MISSED: ['SCHEDULED', 'CANCELLED', 'appointment_scheduled'],
  ATTENDED: ['doctor_reviewed', 'referral_completed'],
  CANCELLED: [],
  pending_referral: ['hospital_assigned', 'appointment_scheduled', 'CANCELLED'],
  hospital_assigned: ['appointment_scheduled', 'patient_visited', 'CANCELLED'],
  appointment_scheduled: ['patient_visited', 'MISSED', 'doctor_reviewed', 'appointment_scheduled', 'CANCELLED'],
  patient_visited: ['doctor_reviewed', 'further_examination_required', 'referral_completed'],
  doctor_reviewed: ['further_examination_required', 'follow_up_scheduled', 'referral_completed'],
  further_examination_required: ['appointment_scheduled', 'follow_up_scheduled', 'doctor_reviewed', 'referral_completed'],
  follow_up_scheduled: ['patient_visited', 'doctor_reviewed', 'referral_completed'],
  referral_completed: [],
};

export class ReferralService {
  /**
   * Validates referral status transitions
   */
  static validateTransition(currentStatus: ReferralStatus, targetStatus: ReferralStatus): void {
    const allowed = ALLOWED_REFERRAL_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      const err: any = new Error(
        `Illegal status transition from ${currentStatus} to ${targetStatus}`
      );
      err.code = 'INVALID_REFERRAL_TRANSITION';
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Asserts caller belongs to the destination hospital (or source hospital/superadmin)
   */
  static assertHospitalAccess(
    referral: IReferralDocument,
    actor: { userId: string; role: string; hospitalId?: string }
  ): void {
    if (actor.role === 'system_admin') return;

    if (
      actor.hospitalId &&
      actor.hospitalId !== referral.destinationHospitalId &&
      actor.hospitalId !== referral.sourceHospitalId
    ) {
      const err: any = new Error(
        'Access denied: Destination hospital staff see only referrals addressed to their facility'
      );
      err.code = 'CROSS_HOSPITAL_FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }
  }

  /**
   * Creates a referral request with destination hospital and specialists directory lookup
   */
  static async createReferral(
    data: {
      patientId: string;
      patientName?: string;
      sourceHospitalId: string;
      destinationHospitalId: string;
      specialistId?: string;
      screeningCaseId?: string;
      reasonForReferral: string;
      referringDoctorId?: string;
      referringDoctorName?: string;
    },
    actor: { userId: string; role: string; hospitalId?: string; name?: string }
  ): Promise<IReferralDocument> {
    // 1. Role verification: Referrals must be initiated by an MO or MO lead (admin)
    const ALLOWED_REFERRAL_ROLES = ['medical_officer', 'admin', 'system_admin'];
    if (!ALLOWED_REFERRAL_ROLES.includes(actor.role)) {
      const err: any = new Error('Referrals must be created by a Medical Officer or MO Lead');
      err.code = 'FORBIDDEN_REFERRAL_CREATION';
      err.statusCode = 403;
      throw err;
    }

    // 2. Destination hospital lookup
    const destHospital = await Hospital.findOne({
      hospitalId: data.destinationHospitalId,
      status: { $ne: 'inactive' },
    });
    if (!destHospital) {
      const err: any = new Error(
        `Destination hospital "${data.destinationHospitalId}" not found or inactive`
      );
      err.code = 'DESTINATION_HOSPITAL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 3. Source hospital lookup (or fallback to actor's hospital)
    const sourceHospitalId = data.sourceHospitalId || actor.hospitalId || destHospital.hospitalId;
    const sourceHospital = await Hospital.findOne({ hospitalId: sourceHospitalId });

    // 4. Specialists directory lookup (Phase 3)
    let specialistName: string | undefined;
    let specialty: string | undefined;
    if (data.specialistId) {
      const specialist = await Specialist.findOne({
        specialistId: data.specialistId,
        status: 'active',
      });
      if (!specialist) {
        const err: any = new Error(
          `Specialist "${data.specialistId}" not found in specialists directory`
        );
        err.code = 'SPECIALIST_NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }
      specialistName = specialist.name;
      specialty = specialist.specialty;
    }

    // 5. If linked to screeningCaseId, update screening case referral details
    if (data.screeningCaseId) {
      const sc = await ScreeningCase.findOne({ caseId: data.screeningCaseId });
      if (sc) {
        sc.status = 'referral_requested';
        sc.referralDetails = {
          referredBy: actor.userId,
          referredAt: new Date(),
          specialistId: data.specialistId,
          specialty: specialty || 'general_consultation',
          facilityName: destHospital.name,
          referralNotes: data.reasonForReferral,
        };
        await sc.save();
      }
    }

    const referralId = `ref_${crypto.randomBytes(6).toString('hex')}`;
    const referringDoctorId = data.referringDoctorId || actor.userId;
    const referringDoctorName = data.referringDoctorName || actor.name || actor.userId;

    const referral = new Referral({
      referralId,
      patientId: data.patientId,
      patientName: data.patientName,
      sourceHospitalId,
      sourceHospitalName: sourceHospital?.name || sourceHospitalId,
      destinationHospitalId: destHospital.hospitalId,
      destinationHospitalName: destHospital.name,
      specialistId: data.specialistId,
      specialistName,
      specialty,
      screeningCaseId: data.screeningCaseId,
      status: 'REQUESTED',
      reasonForReferral: data.reasonForReferral,
      referringDoctorId,
      referringDoctorName,
      followUpReminder: {
        dispatched: false,
      },
      missedEscalation: {
        isEscalated: false,
      },
      simulation: true,
    });

    await referral.save();

    await AuditLog.create({
      action: 'referral.created',
      resourceType: 'referral',
      resourceId: referralId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 201,
      metadata: {
        patientId: data.patientId,
        destinationHospitalId: destHospital.hospitalId,
        specialistId: data.specialistId,
      },
      simulation: true,
    });

    return referral;
  }

  /**
   * Accepts referral by destination hospital staff
   */
  static async acceptReferral(
    referralId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IReferralDocument> {
    const referral = await Referral.findOne({ referralId });
    if (!referral) {
      const err: any = new Error('Referral record not found');
      err.code = 'REFERRAL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Cross-hospital check: Only destination hospital staff can accept
    if (
      actor.hospitalId &&
      actor.hospitalId !== referral.destinationHospitalId &&
      actor.role !== 'system_admin'
    ) {
      const err: any = new Error(
        'Access denied: Referrals can only be accepted by staff of the destination hospital'
      );
      err.code = 'CROSS_HOSPITAL_FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    this.validateTransition(referral.status, 'ACCEPTED');

    referral.status = 'ACCEPTED';
    await referral.save();

    await AuditLog.create({
      action: 'referral.accepted',
      resourceType: 'referral',
      resourceId: referralId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { destinationHospitalId: referral.destinationHospitalId },
      simulation: true,
    });

    return referral;
  }

  /**
   * Schedules follow-up date and registers Agenda reminder (Non-diagnostic, privacy-preserving)
   */
  static async scheduleFollowUp(
    referralId: string,
    scheduleData: {
      scheduledDate: string | Date;
    },
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IReferralDocument> {
    const referral = await Referral.findOne({ referralId });
    if (!referral) {
      const err: any = new Error('Referral record not found');
      err.code = 'REFERRAL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(referral, actor);
    this.validateTransition(referral.status, 'SCHEDULED');

    const scheduledDate = new Date(scheduleData.scheduledDate);
    if (isNaN(scheduledDate.getTime())) {
      const err: any = new Error('Invalid scheduled follow-up date format');
      err.code = 'INVALID_DATE';
      err.statusCode = 400;
      throw err;
    }

    // Strict Non-diagnostic Clinical Privacy Wording Rule:
    // Patient-facing reminders never name the clinical condition or findings!
    const formattedDate = scheduledDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const hospitalName = referral.destinationHospitalName || 'the destination health facility';
    const nonDiagnosticReminderText = `You have a scheduled health consultation on ${formattedDate} at ${hospitalName}. Please bring your identity card and health documents.`;

    referral.status = 'SCHEDULED';
    referral.scheduledFollowUpDate = scheduledDate;

    // Schedule Agenda job if Agenda is active
    let agendaJobId: string | undefined;
    try {
      const agenda = getAgenda();
      if (agenda) {
        // Schedule reminder 24 hours prior to appointment (or immediate if sooner)
        const reminderTime = new Date(scheduledDate.getTime() - 24 * 60 * 60 * 1000);
        const executeAt = reminderTime > new Date() ? reminderTime : new Date(Date.now() + 1000);

        const job = await agenda.schedule(executeAt, 'referral:navigation_reminder', {
          referralId: referral.referralId,
          patientId: referral.patientId,
          destinationHospitalId: referral.destinationHospitalId,
          reminderText: nonDiagnosticReminderText,
          scheduledFor: scheduledDate,
          attempts: 0,
          maxRetries: 3,
        });

        agendaJobId = job.attrs._id ? job.attrs._id.toString() : undefined;
      }
    } catch {
      // Graceful fallback if Agenda is not running in test mode
    }

    referral.followUpReminder = {
      scheduledFor: scheduledDate,
      reminderText: nonDiagnosticReminderText,
      jobId: agendaJobId || `job_sim_${crypto.randomBytes(4).toString('hex')}`,
      dispatched: false,
    };

    await referral.save();

    await AuditLog.create({
      action: 'referral.scheduled',
      resourceType: 'referral',
      resourceId: referralId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        scheduledFollowUpDate: scheduledDate,
        reminderJobId: referral.followUpReminder.jobId,
      },
      simulation: true,
    });

    return referral;
  }

  /**
   * Records a missed follow-up consultation and escalates back to MO queue (Exactly once)
   */
  static async recordMissedFollowUp(
    referralId: string,
    reason: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<{ referral: IReferralDocument; escalatedScreeningCase?: any }> {
    const referral = await Referral.findOne({ referralId });
    if (!referral) {
      const err: any = new Error('Referral record not found');
      err.code = 'REFERRAL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(referral, actor);

    // Rule: Missed follow-up escalates exactly once!
    if (referral.missedEscalation?.isEscalated) {
      const err: any = new Error(
        'Missed follow-up has already been escalated to the Medical Officer queue'
      );
      err.code = 'REFERRAL_ALREADY_ESCALATED';
      err.statusCode = 409;
      throw err;
    }

    this.validateTransition(referral.status, 'MISSED');

    referral.status = 'MISSED';
    referral.missedEscalation = {
      isEscalated: true,
      escalatedAt: new Date(),
      escalatedBy: actor.userId,
      escalationReason: reason || 'Patient missed scheduled hospital follow-up consultation',
    };

    await referral.save();

    // Escalate linked ScreeningCase back to MO queue with urgent priority
    let escalatedScreeningCase = null;
    if (referral.screeningCaseId) {
      const sc = await ScreeningCase.findOne({ caseId: referral.screeningCaseId });
      if (sc) {
        sc.priority = 'urgent';
        sc.status = 'escalated';
        sc.escalationDetails = {
          escalatedBy: actor.userId,
          escalatedAt: new Date(),
          escalationReason:
            reason || 'Patient missed scheduled follow-up consultation at destination hospital',
          escalatedToRole: 'medical_officer',
        };
        await sc.save();
        escalatedScreeningCase = sc;
      }
    }

    await AuditLog.create({
      action: 'referral.missed_followup_escalated',
      resourceType: 'referral',
      resourceId: referralId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        reason,
        screeningCaseId: referral.screeningCaseId,
        escalatedScreeningCase: !!escalatedScreeningCase,
      },
      simulation: true,
    });

    return { referral, escalatedScreeningCase };
  }

  /**
   * Records patient consultation attended
   */
  static async recordAttended(
    referralId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IReferralDocument> {
    const referral = await Referral.findOne({ referralId });
    if (!referral) {
      const err: any = new Error('Referral record not found');
      err.code = 'REFERRAL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(referral, actor);
    this.validateTransition(referral.status, 'ATTENDED');

    referral.status = 'ATTENDED';
    await referral.save();

    await AuditLog.create({
      action: 'referral.attended',
      resourceType: 'referral',
      resourceId: referralId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { destinationHospitalId: referral.destinationHospitalId },
      simulation: true,
    });

    return referral;
  }

  /**
   * Cancels referral with mandatory reason
   */
  static async cancelReferral(
    referralId: string,
    reason: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IReferralDocument> {
    const referral = await Referral.findOne({ referralId });
    if (!referral) {
      const err: any = new Error('Referral record not found');
      err.code = 'REFERRAL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    this.assertHospitalAccess(referral, actor);
    this.validateTransition(referral.status, 'CANCELLED');

    referral.status = 'CANCELLED';
    referral.cancellation = {
      cancelledBy: actor.userId,
      reason,
      cancelledAt: new Date(),
    };

    await referral.save();

    await AuditLog.create({
      action: 'referral.cancelled',
      resourceType: 'referral',
      resourceId: referralId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { reason },
      simulation: true,
    });

    return referral;
  }

  /**
   * Fetches referral by ID with cross-hospital scoping
   */
  static async getReferralById(
    referralId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IReferralDocument | null> {
    const referral = await Referral.findOne({ referralId });
    if (!referral) return null;

    if (actor.role === 'patient') {
      if (referral.patientId !== actor.userId) {
        const err: any = new Error('Access denied: Patients can only view their own referrals');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
      return referral;
    }

    this.assertHospitalAccess(referral, actor);
    return referral;
  }

  /**
   * Lists referrals filtered by destination hospital scoping
   */
  static async listReferrals(
    filters: {
      status?: ReferralStatus;
      patientId?: string;
      destinationHospitalId?: string;
    },
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IReferralDocument[]> {
    const query: any = {};

    if (filters.status) query.status = filters.status;
    if (filters.patientId) query.patientId = filters.patientId;

    if (actor.role === 'patient') {
      query.patientId = actor.userId;
    } else if (actor.role !== 'system_admin' && actor.hospitalId) {
      // Scoped: destination hospital staff see only referrals addressed to them (or source hospital)
      if (filters.destinationHospitalId) {
        if (filters.destinationHospitalId !== actor.hospitalId) {
          const err: any = new Error(
            'Access denied: Destination hospital staff see only referrals addressed to their facility'
          );
          err.code = 'CROSS_HOSPITAL_FORBIDDEN';
          err.statusCode = 403;
          throw err;
        }
        query.destinationHospitalId = filters.destinationHospitalId;
      } else {
        query.$or = [
          { destinationHospitalId: actor.hospitalId },
          { sourceHospitalId: actor.hospitalId },
        ];
      }
    } else if (filters.destinationHospitalId) {
      query.destinationHospitalId = filters.destinationHospitalId;
    }

    return Referral.find(query).sort({ createdAt: -1 });
  }
}
