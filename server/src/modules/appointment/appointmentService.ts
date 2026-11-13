import { DoctorSlot } from '../consultation/doctorSlotModel.js';
import { User as BookingDoctor } from '../auth/userModel.js';
import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  Appointment,
  IAppointmentDocument,
  AppointmentStatus,
  AppointmentType,
} from './appointmentModel.js';
import { NotificationQueue } from '../notification/notificationQueue.js';
import { AuditLog } from '../audit/auditModel.js';
import { User } from '../auth/userModel.js';
import { logger } from '../../config/logger.js';

async function notifyAppointmentPatient(appointment: IAppointmentDocument, title: string, body: string) {
  const patient: any = await User.findOne({ role: 'patient', $or: [{ patientId: appointment.patientId }, { userId: appointment.patientId }] }).select('userId').lean();
  await NotificationQueue.enqueue({ recipientId: patient?.userId || appointment.patientId, recipientRole: 'patient', customTitle: title, customBody: body, category: 'referral', priority: 'normal', channels: ['in_app'], metadata: { appointmentId: appointment.appointmentId, status: appointment.status } });
}

export const WORKING_HOURS = {
  startHour: 9,
  startMinute: 0,
  endHour: 16,
  endMinute: 0,
  lunchStartHour: 13,
  lunchEndHour: 14,
  slotDurationMinutes: 20,
};

export interface CreateAppointmentDTO {
  patientId: string;
  patientName?: string;
  destinationHospitalId: string;
  destinationHospitalName?: string;
  department?: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  slotStartTime: string | Date;
  slotEndTime?: string | Date;
  type?: AppointmentType;
  reason?: string;
  idempotencyKey?: string;
  clientRequestId?: string;
  offlineQueued?: boolean;
  notes?: string;
}

export interface AppointmentSlotView {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  existingAppointmentId?: string;
}

export class AppointmentService {
  /**
   * Validates appointment slot constraints:
   * - Must be in the future
   * - Monday through Saturday only (Sundays closed)
   * - Between 09:00 and 16:00
   * - Outside lunch recess (13:00 to 14:00)
   */
  static validateSlot(slotStartTime: Date, slotEndTime: Date): void {
    const now = new Date();
    if (slotStartTime.getTime() <= now.getTime()) {
      const err: any = new Error('Appointment time slot must be scheduled in the future');
      err.code = 'INVALID_APPOINTMENT_SLOT';
      err.statusCode = 400;
      throw err;
    }

    if (slotEndTime.getTime() <= slotStartTime.getTime()) {
      const err: any = new Error('Slot end time must follow slot start time');
      err.code = 'INVALID_APPOINTMENT_SLOT';
      err.statusCode = 400;
      throw err;
    }

    // Day of week check: 0 is Sunday
    if (slotStartTime.getDay() === 0) {
      const err: any = new Error('Outpatient consultation slots are unavailable on Sundays');
      err.code = 'CLINIC_CLOSED_SUNDAY';
      err.statusCode = 400;
      throw err;
    }

    // Working hours check (09:00 to 16:00)
    const startHour = slotStartTime.getHours();
    const startMinute = slotStartTime.getMinutes();
    const endHour = slotEndTime.getHours();
    const endMinute = slotEndTime.getMinutes();

    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    const opdOpenMinutes = WORKING_HOURS.startHour * 60 + WORKING_HOURS.startMinute; // 540
    const opdCloseMinutes = WORKING_HOURS.endHour * 60 + WORKING_HOURS.endMinute; // 960

    if (startTotalMinutes < opdOpenMinutes || endTotalMinutes > opdCloseMinutes) {
      const err: any = new Error(
        'Appointment slot must fall within facility working hours (09:00 to 16:00, Monday to Saturday)'
      );
      err.code = 'OUTSIDE_WORKING_HOURS';
      err.statusCode = 400;
      throw err;
    }

    // Lunch recess check (13:00 to 14:00)
    const lunchStartMinutes = WORKING_HOURS.lunchStartHour * 60; // 780
    const lunchEndMinutes = WORKING_HOURS.lunchEndHour * 60; // 840

    if (
      (startTotalMinutes >= lunchStartMinutes && startTotalMinutes < lunchEndMinutes) ||
      (endTotalMinutes > lunchStartMinutes && endTotalMinutes <= lunchEndMinutes) ||
      (startTotalMinutes < lunchStartMinutes && endTotalMinutes > lunchEndMinutes)
    ) {
      const err: any = new Error(
        'Appointment slot overlaps with midday lunch recess (13:00 to 14:00)'
      );
      err.code = 'LUNCH_RECESS_CONFLICT';
      err.statusCode = 400;
      throw err;
    }

    // OPD bookings use fixed 20-minute slots. Keeping these on the published
    // grid lets MongoDB's unique facility/start/end index act as the atomic
    // conflict guard when the database is a standalone server without transactions.
    const slotDurationMs = WORKING_HOURS.slotDurationMinutes * 60_000;
    const minutesFromOpening =
      slotStartTime.getHours() * 60 + slotStartTime.getMinutes() -
      (WORKING_HOURS.startHour * 60 + WORKING_HOURS.startMinute);
    if (
      slotEndTime.getTime() - slotStartTime.getTime() !== slotDurationMs ||
      minutesFromOpening < 0 ||
      minutesFromOpening % WORKING_HOURS.slotDurationMinutes !== 0
    ) {
      const err: any = new Error('Appointment must use an available 20-minute OPD slot');
      err.code = 'INVALID_APPOINTMENT_SLOT';
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Generates standard daily slots for a given date and checks availability
   */
  static async getAvailableSlots(
    dateStr: string,
    destinationHospitalId: string
  ): Promise<AppointmentSlotView[]> {
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      const err: any = new Error('Invalid date string provided');
      err.code = 'INVALID_DATE';
      err.statusCode = 400;
      throw err;
    }

    if (targetDate.getDay() === 0) {
      return []; // Closed on Sundays
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const date = targetDate.getDate();

    // Query all active booked appointments on this day
    const dayStart = new Date(year, month, date, 0, 0, 0, 0);
    const dayEnd = new Date(year, month, date, 23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      destinationHospitalId,
      status: { $in: ['requested', 'confirmed', 'checked_in'] },
      slotStartTime: { $gte: dayStart, $lte: dayEnd },
    }).lean();

    const slots: AppointmentSlotView[] = [];

    // Slot generation: Morning session 09:00 - 13:00, Afternoon session 14:00 - 16:00
    const sessions = [
      { startHour: 9, startMin: 0, endHour: 13, endMin: 0 },
      { startHour: 14, startMin: 0, endHour: 16, endMin: 0 },
    ];

    for (const session of sessions) {
      let currentMinutes = session.startHour * 60 + session.startMin;
      const endMinutes = session.endHour * 60 + session.endMin;

      while (currentMinutes + WORKING_HOURS.slotDurationMinutes <= endMinutes) {
        const slotStartHour = Math.floor(currentMinutes / 60);
        const slotStartMin = currentMinutes % 60;
        const slotEndMinutes = currentMinutes + WORKING_HOURS.slotDurationMinutes;
        const slotEndHour = Math.floor(slotEndMinutes / 60);
        const slotEndMin = slotEndMinutes % 60;

        const slotStartDate = new Date(year, month, date, slotStartHour, slotStartMin, 0, 0);
        const slotEndDate = new Date(year, month, date, slotEndHour, slotEndMin, 0, 0);

        // Check if any booked appointment overlaps with this slot
        const conflicting = bookedAppointments.find((apt) => {
          const aptStart = new Date(apt.slotStartTime).getTime();
          const aptEnd = new Date(apt.slotEndTime).getTime();
          return aptStart < slotEndDate.getTime() && aptEnd > slotStartDate.getTime();
        });

        slots.push({
          startTime: slotStartDate.toISOString(),
          endTime: slotEndDate.toISOString(),
          isAvailable: !conflicting,
          existingAppointmentId: conflicting ? conflicting.appointmentId : undefined,
        });

        currentMinutes += WORKING_HOURS.slotDurationMinutes;
      }
    }

    return slots;
  }

  /**
   * Requests an appointment idempotently, verifying slot conflicts within an ACID transaction
   */
  static async requestAppointment(
    data: CreateAppointmentDTO & any,
    requester: { userId: string; role: string; name?: string }
  ): Promise<{
    appointment: IAppointmentDocument;
    idempotentReplay: boolean;
    notification?: any;
  }> {
    const slotStart = new Date(data.slotStartTime);
    const durationMinutes = WORKING_HOURS.slotDurationMinutes;
    const slotEnd = data.slotEndTime
      ? new Date(data.slotEndTime)
      : new Date(slotStart.getTime() + durationMinutes * 60000);

    // 1. Slot validation
    if (data.assignedDoctorId) {
      const doctor = await BookingDoctor.findOne({ userId: data.assignedDoctorId, hospitalId: data.destinationHospitalId, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] }, role: { $in: ['medical_officer', 'specialist_doctor'] } });
      const published = await DoctorSlot.findOne({ doctorId: data.assignedDoctorId, hospitalId: data.destinationHospitalId, startTime: slotStart, endTime: slotEnd });
      if (!doctor || !published || slotStart.getTime() <= Date.now()) throw Object.assign(new Error('Choose a future slot published by an approved doctor.'), { statusCode: 400, code: 'DOCTOR_SLOT_UNAVAILABLE' });
      data.assignedDoctorName = doctor.fullName;
    } else this.validateSlot(slotStart, slotEnd);

    // 2. Check for idempotent replay if idempotencyKey is supplied
    if (data.idempotencyKey) {
      const existing = await Appointment.findOne({ idempotencyKey: data.idempotencyKey });
      if (existing) {
        logger.info(
          { idempotencyKey: data.idempotencyKey, appointmentId: existing.appointmentId },
          'Idempotent appointment request replayed; returning existing booking'
        );
        return {
          appointment: existing,
          idempotentReplay: true,
        };
      }
    }

    // 3. Use transactions on replica sets/sharded MongoDB. Standalone MongoDB
    // does not support them, so use the atomic appointment indexes instead.
    // The fixed slot validation above ensures same-slot requests collide on
    // the unique active-slot index even when two requests arrive together.
    let session: mongoose.ClientSession | null = null;
    let inTransaction = false;

    const topologyType = (mongoose.connection as any).client?.topology?.description?.type;
    const supportsTransactions =
      typeof topologyType === 'string' &&
      (topologyType.startsWith('ReplicaSet') || topologyType === 'Sharded' || topologyType === 'LoadBalanced');
    if (supportsTransactions) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        inTransaction = true;
      } catch (sessionError: any) {
        if (session) await session.endSession().catch(() => undefined);
        session = null;
        logger.warn(
          { error: sessionError?.message, topologyType },
          'MongoDB transaction unavailable; using atomic single-document appointment booking'
        );
      }
    }

    try {
      // Query active appointments overlapping the slot for the destination hospital
      const query = {
        destinationHospitalId: data.destinationHospitalId,
        // Conflicts are per doctor; OPD bookings without a doctor conflict facility-wide.
        assignedDoctorId: data.assignedDoctorId ? data.assignedDoctorId : { $in: [null] },
        status: { $in: ['requested', 'confirmed', 'checked_in'] },
        slotStartTime: { $lt: slotEnd },
        slotEndTime: { $gt: slotStart },
      };

      const conflict = await Appointment.findOne(query, null, session ? { session } : {});
      if (conflict) {
        if (inTransaction && session) {
          await session.abortTransaction();
        }
        const err: any = new Error(
          'The selected consultation slot is already booked for this facility'
        );
        err.code = 'SLOT_CONFLICT';
        err.statusCode = 409;
        throw err;
      }

      const appointmentId = `apt_${crypto.randomBytes(6).toString('hex')}`;
      const count = await Appointment.countDocuments();
      const appointmentCode = data.appointmentCode || `APT-${String(count + 1).padStart(4, '0')}`;

      const appointmentRecord = new Appointment({
        appointmentId,
        appointmentCode,
        consultationMode: data.consultationMode,
        screeningId: data.screeningId,
        riskLevel: data.riskLevel,
        conditionCategory: data.conditionCategory,
        suggestedDoctorType: data.suggestedDoctorType,
        preferredDoctorId: data.preferredDoctorId,
        hospitalId: data.hospitalId || (data.consultationMode === 'offline' ? data.destinationHospitalId : undefined),
        scheduledAt: slotStart,
        patientId: data.patientId,
        patientName: data.patientName,
        destinationHospitalId: data.destinationHospitalId,
        destinationHospitalName: data.destinationHospitalName || data.destinationHospitalId,
        department: data.department || 'Oral Health OPD',
        assignedDoctorId: data.assignedDoctorId,
        assignedDoctorName: data.assignedDoctorName,
        slotStartTime: slotStart,
        slotEndTime: slotEnd,
        durationMinutes,
        status: 'requested',
        type: data.type || 'clinical_consultation',
        reason: data.reason,
        patientNote: data.patientNote,
        requestedBy: {
          userId: requester.userId,
          role: requester.role,
          name: requester.name || requester.userId,
        },
        reschedulingHistory: [],
        statusHistory: [{ status: 'requested', changedBy: requester.userId, time: new Date(), note: 'Appointment requested' }],
        idempotencyKey: data.idempotencyKey,
        clientRequestId: data.clientRequestId || data.idempotencyKey,
        offlineQueued: Boolean(data.offlineQueued),
        notes: data.notes,
        visitDetails: data.visitDetails,
      } as any);

      if (session) {
        await appointmentRecord.save({ session });
        if (inTransaction) {
          await session.commitTransaction();
        }
      } else {
        await appointmentRecord.save();
      }

      // 4. Audit Log Recording
      await AuditLog.create({
        action: 'appointment.requested',
        resourceType: 'appointment',
        resourceId: appointmentId,
        actorId: requester.userId,
        actorRole: requester.role,
        ip: '127.0.0.1',
        statusCode: 201,
        metadata: {
          destinationHospitalId: data.destinationHospitalId,
          patientId: data.patientId,
          slotStartTime: slotStart.toISOString(),
          slotEndTime: slotEnd.toISOString(),
          idempotencyKey: data.idempotencyKey,
          offlineQueued: data.offlineQueued,
        },
        simulation: true,
      });

      // 5. Enqueue Notification with Phase 5 core (SMS and email BLOCKED)
      let notificationRecord: any = null;
      try {
        notificationRecord = await NotificationQueue.enqueue({
          recipientId: data.patientUserId || data.patientId,
          recipientRole: 'patient',
          customTitle: 'Consultation Appointment Requested',
          customBody: `A consultation appointment has been requested at ${data.destinationHospitalName || data.destinationHospitalId} for ${slotStart.toLocaleString()}. Confirmation pending review by hospital staff.`,
          category: 'referral',
          priority: 'normal',
          channels: ['in_app', 'sms', 'email'],
          metadata: {
            appointmentId,
            destinationHospitalId: data.destinationHospitalId,
            slotStartTime: slotStart.toISOString(),
          },
        });
        if (requester.role === 'patient' && data.assignedDoctorId) {
          await NotificationQueue.enqueue({
            recipientId: data.assignedDoctorId,
            recipientRole: 'medical_officer',
            customTitle: 'New appointment request',
            customBody: `A patient requested an appointment for ${slotStart.toLocaleString()}. Review the request in your doctor portal.`,
            category: 'referral',
            priority: 'normal',
            channels: ['in_app'],
            metadata: { appointmentId, destinationHospitalId: data.destinationHospitalId, slotStartTime: slotStart.toISOString() },
          });
        }
      } catch (notifErr: any) {
        logger.warn(
          { error: notifErr.message, appointmentId },
          'Notification enqueue deferred or failed'
        );
      }

      return {
        appointment: appointmentRecord,
        idempotentReplay: false,
        notification: notificationRecord
          ? {
              notificationId: notificationRecord.notificationId,
              channels: notificationRecord.channels,
              deliveryStatus: notificationRecord.deliveryStatus,
              smsBlocked: true,
              emailBlocked: true,
            }
          : undefined,
      };
    } catch (err: any) {
      if (inTransaction && session) {
        try {
          await session.abortTransaction();
        } catch (_) {}
      }
      if (
        err.code === 11000 ||
        err.code === 112 ||
        err.code === 'SLOT_CONFLICT' ||
        err.message?.includes('duplicate key') ||
        err.message?.includes('WriteConflict') ||
        (typeof err.hasErrorLabel === 'function' && err.hasErrorLabel('TransientTransactionError'))
      ) {
        if (err.keyPattern?.idempotencyKey && data.idempotencyKey) {
          const existing = await Appointment.findOne({ idempotencyKey: data.idempotencyKey });
          if (existing) return { appointment: existing, idempotentReplay: true };
        }
        const conflictErr: any = new Error(
          'The selected consultation slot is already booked for this facility'
        );
        conflictErr.code = 'SLOT_CONFLICT';
        conflictErr.statusCode = 409;
        throw conflictErr;
      }
      throw err;
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  /**
   * Confirms appointment:
   * - Must be Hospital Manager (admin) or Medical Officer of the destination hospital
   * - Requester cannot confirm their own appointment (Self-confirmation blocked)
   * - Wrong-hospital managers/MOs denied (403)
   */
  static async confirmAppointment(
    appointmentId: string,
    actor: { userId: string; role: string; hospitalId?: string; name?: string }
  ): Promise<{ appointment: IAppointmentDocument; notification?: any }> {
    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      const err: any = new Error('Appointment not found');
      err.code = 'APPOINTMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Role check: Only admin or medical_officer
    if (actor.role !== 'admin' && actor.role !== 'medical_officer' && actor.role !== 'specialist_doctor' && actor.role !== 'system_admin') {
      const err: any = new Error(
        'Confirmation permitted by Hospital Manager or Medical Officer only'
      );
      err.code = 'FORBIDDEN_CONFIRMATION_ROLE';
      err.statusCode = 403;
      throw err;
    }

    // Destination hospital check
    if (actor.role !== 'system_admin' && actor.hospitalId !== appointment.destinationHospitalId) {
      const err: any = new Error(
        'Confirmation permitted by staff of the destination hospital only'
      );
      err.code = 'FORBIDDEN_HOSPITAL_MISMATCH';
      err.statusCode = 403;
      throw err;
    }

    // Self-confirmation blocked check
    if (appointment.requestedBy.userId === actor.userId) {
      const err: any = new Error('A requester cannot confirm their own appointment');
      err.code = 'SELF_CONFIRMATION_BLOCKED';
      err.statusCode = 403;
      throw err;
    }

    // Status transition validity check
    if (appointment.status !== 'requested' && appointment.status !== 'rescheduled') {
      const err: any = new Error(
        `Invalid appointment status transition from ${appointment.status} to confirmed`
      );
      err.code = 'INVALID_APPOINTMENT_TRANSITION';
      err.statusCode = 400;
      throw err;
    }

    appointment.status = 'confirmed';
    appointment.confirmedBy = {
      userId: actor.userId,
      role: actor.role,
      name: actor.name || actor.userId,
      confirmedAt: new Date(),
    };
    (appointment as any).statusHistory = (appointment as any).statusHistory || [];
    (appointment as any).statusHistory.push({ status: 'confirmed', changedBy: actor.userId, time: new Date(), note: 'Appointment confirmed' });

    await appointment.save();

    // Audit Log Recording
    await AuditLog.create({
      action: 'appointment.confirmed',
      resourceType: 'appointment',
      resourceId: appointmentId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        destinationHospitalId: appointment.destinationHospitalId,
        patientId: appointment.patientId,
        slotStartTime: appointment.slotStartTime.toISOString(),
      },
      simulation: true,
    });

    // Enqueue confirmation notification
    let notificationRecord: any = null;
    try {
      notificationRecord = await NotificationQueue.enqueue({
            recipientId: (await User.findOne({ role: 'patient', $or: [{ patientId: appointment.patientId }, { userId: appointment.patientId }] }).select('userId').lean() as any)?.userId || appointment.patientId,
        recipientRole: 'patient',
        customTitle: 'Appointment Confirmed',
        customBody: `Your consultation appointment at ${appointment.destinationHospitalName || appointment.destinationHospitalId} is confirmed for ${appointment.slotStartTime.toLocaleString()}.`,
        category: 'referral',
        priority: 'high',
        channels: ['in_app', 'sms', 'email'],
        metadata: {
          appointmentId,
          destinationHospitalId: appointment.destinationHospitalId,
          slotStartTime: appointment.slotStartTime.toISOString(),
        },
      });
    } catch (notifErr: any) {
      logger.warn(
        { error: notifErr.message, appointmentId },
        'Notification enqueue deferred or failed'
      );
    }

    return {
      appointment,
      notification: notificationRecord
        ? {
            notificationId: notificationRecord.notificationId,
            channels: notificationRecord.channels,
            deliveryStatus: notificationRecord.deliveryStatus,
            smsBlocked: true,
            emailBlocked: true,
          }
        : undefined,
    };
  }

  /**
   * Reschedules appointment to a new slot with conflict check
   */
  static async rescheduleAppointment(
    appointmentId: string,
    newSlotStartTime: string | Date,
    newSlotEndTime: string | Date | undefined,
    reason: string,
    actor: { userId: string; role: string; hospitalId?: string; name?: string }
  ): Promise<{ appointment: IAppointmentDocument; notification?: any }> {
    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      const err: any = new Error('Appointment not found');
      err.code = 'APPOINTMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      const err: any = new Error(
        `Cannot reschedule appointment with terminal status ${appointment.status}`
      );
      err.code = 'INVALID_APPOINTMENT_TRANSITION';
      err.statusCode = 400;
      throw err;
    }

    const newStart = new Date(newSlotStartTime);
    const newEnd = newSlotEndTime
      ? new Date(newSlotEndTime)
      : new Date(newStart.getTime() + appointment.durationMinutes * 60000);

    // Validate new slot
    if (appointment.assignedDoctorId) {
      const published = await DoctorSlot.exists({ doctorId: appointment.assignedDoctorId, hospitalId: appointment.destinationHospitalId, startTime: newStart, endTime: newEnd });
      if (!published || newStart.getTime() <= Date.now()) throw Object.assign(new Error('Choose a future slot published by the assigned doctor.'), { code: 'DOCTOR_SLOT_UNAVAILABLE', statusCode: 400 });
    } else this.validateSlot(newStart, newEnd);

    // Check slot conflict
    const conflict = await Appointment.findOne({
      destinationHospitalId: appointment.destinationHospitalId,
      status: { $in: ['requested', 'confirmed', 'checked_in'] },
      slotStartTime: { $lt: newEnd },
      slotEndTime: { $gt: newStart },
      appointmentId: { $ne: appointmentId },
    });

    if (conflict) {
      const err: any = new Error(
        'The selected consultation slot is already booked for this facility'
      );
      err.code = 'SLOT_CONFLICT';
      err.statusCode = 409;
      throw err;
    }

    appointment.reschedulingHistory.push({
      previousSlotStart: appointment.slotStartTime,
      previousSlotEnd: appointment.slotEndTime,
      newSlotStart: newStart,
      newSlotEnd: newEnd,
      rescheduledBy: actor.userId,
      rescheduledAt: new Date(),
      reason,
    });

    appointment.slotStartTime = newStart;
    appointment.slotEndTime = newEnd;
    (appointment as any).scheduledAt = newStart;
    appointment.status = 'rescheduled';
    if ((appointment as any).proposedReschedule) (appointment as any).proposedReschedule.status = 'accepted';
    (appointment as any).statusHistory = (appointment as any).statusHistory || [];
    (appointment as any).statusHistory.push({ status: 'rescheduled', changedBy: actor.userId, time: new Date(), note: reason || 'Rescheduled' });
    if (appointment.videoInvite) appointment.videoInvite.revokedAt = new Date();

    await appointment.save();

    // Audit Log Recording
    await AuditLog.create({
      action: 'appointment.rescheduled',
      resourceType: 'appointment',
      resourceId: appointmentId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        newSlotStart: newStart.toISOString(),
        newSlotEnd: newEnd.toISOString(),
        reason,
      },
      simulation: true,
    });

    // Enqueue rescheduling notification
    let notificationRecord: any = null;
    try {
      notificationRecord = await NotificationQueue.enqueue({
        recipientId: appointment.patientId,
        recipientRole: 'patient',
        customTitle: 'Appointment Rescheduled',
        customBody: `Your consultation appointment at ${appointment.destinationHospitalName || appointment.destinationHospitalId} has been rescheduled to ${newStart.toLocaleString()}. Reason: ${reason || 'Schedule update'}.`,
        category: 'referral',
        priority: 'normal',
        channels: ['in_app', 'sms', 'email'],
        metadata: {
          appointmentId,
          newSlotStartTime: newStart.toISOString(),
        },
      });
    } catch (notifErr: any) {
      logger.warn(
        { error: notifErr.message, appointmentId },
        'Notification enqueue deferred or failed'
      );
    }

    return {
      appointment,
      notification: notificationRecord
        ? {
            notificationId: notificationRecord.notificationId,
            channels: notificationRecord.channels,
            deliveryStatus: notificationRecord.deliveryStatus,
            smsBlocked: true,
            emailBlocked: true,
          }
        : undefined,
    };
  }

  /**
   * Cancels appointment with mandatory reason
   */
  static async cancelAppointment(
    appointmentId: string,
    reason: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<{ appointment: IAppointmentDocument; notification?: any }> {
    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      const err: any = new Error('Appointment not found');
      err.code = 'APPOINTMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      const err: any = new Error(
        `Cannot cancel appointment with terminal status ${appointment.status}`
      );
      err.code = 'INVALID_APPOINTMENT_TRANSITION';
      err.statusCode = 400;
      throw err;
    }

    appointment.status = 'cancelled';
    if (appointment.videoInvite) appointment.videoInvite.revokedAt = new Date();
    appointment.cancellation = {
      cancelledBy: actor.userId,
      reason: reason || 'Patient or facility request',
      cancelledAt: new Date(),
    };
    (appointment as any).statusHistory = (appointment as any).statusHistory || [];
    (appointment as any).statusHistory.push({ status: 'cancelled', changedBy: actor.userId, time: new Date(), note: reason || 'Cancelled' });

    await appointment.save();

    // Audit Log Recording
    await AuditLog.create({
      action: 'appointment.cancelled',
      resourceType: 'appointment',
      resourceId: appointmentId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        reason: appointment.cancellation.reason,
      },
      simulation: true,
    });

    // Enqueue cancellation notification
    let notificationRecord: any = null;
    try {
      notificationRecord = await NotificationQueue.enqueue({
        recipientId: appointment.patientId,
        recipientRole: 'patient',
        customTitle: 'Appointment Cancelled',
        customBody: `Your consultation appointment at ${appointment.destinationHospitalName || appointment.destinationHospitalId} scheduled for ${appointment.slotStartTime.toLocaleString()} has been cancelled. Reason: ${appointment.cancellation.reason}.`,
        category: 'referral',
        priority: 'normal',
        channels: ['in_app', 'sms', 'email'],
        metadata: {
          appointmentId,
          reason: appointment.cancellation.reason,
        },
      });
    } catch (notifErr: any) {
      logger.warn(
        { error: notifErr.message, appointmentId },
        'Notification enqueue deferred or failed'
      );
    }

    return {
      appointment,
      notification: notificationRecord
        ? {
            notificationId: notificationRecord.notificationId,
            channels: notificationRecord.channels,
            deliveryStatus: notificationRecord.deliveryStatus,
            smsBlocked: true,
            emailBlocked: true,
          }
        : undefined,
    };
  }

  /**
   * Checks in a patient for their confirmed appointment
   */
  static async checkInAppointment(
    appointmentId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IAppointmentDocument> {
    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      const err: any = new Error('Appointment not found');
      err.code = 'APPOINTMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (!['admin', 'system_admin', 'medical_officer', 'specialist_doctor'].includes(actor.role) || (actor.role !== 'system_admin' && actor.hospitalId !== appointment.destinationHospitalId) || (['medical_officer', 'specialist_doctor'].includes(actor.role) && appointment.assignedDoctorId !== actor.userId)) {
      const err: any = new Error('Only authorized staff at the assigned facility can check in this appointment');
      err.code = 'APPOINTMENT_ACCESS_DENIED'; err.statusCode = 403; throw err;
    }

    if (appointment.status !== 'confirmed') {
      const err: any = new Error(
        `Cannot check in appointment with status ${appointment.status}; appointment must be confirmed first`
      );
      err.code = 'INVALID_APPOINTMENT_TRANSITION';
      err.statusCode = 400;
      throw err;
    }

    appointment.status = 'checked_in';
    (appointment as any).statusHistory = (appointment as any).statusHistory || [];
    (appointment as any).statusHistory.push({ status: 'checked_in', changedBy: actor.userId, time: new Date(), note: 'Checked in' });
    await appointment.save();

    await notifyAppointmentPatient(appointment, 'Appointment check-in', 'Your appointment has been marked as checked in.');

    return appointment;
  }

  /**
   * Completes an appointment consultation
   */
  static async completeAppointment(
    appointmentId: string,
    actor: { userId: string; role: string; hospitalId?: string }
  ): Promise<IAppointmentDocument> {
    const appointment = await Appointment.findOne({ appointmentId });
    if (!appointment) {
      const err: any = new Error('Appointment not found');
      err.code = 'APPOINTMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (!['admin', 'system_admin', 'medical_officer', 'specialist_doctor'].includes(actor.role) || (actor.role !== 'system_admin' && actor.hospitalId !== appointment.destinationHospitalId) || (['medical_officer', 'specialist_doctor'].includes(actor.role) && appointment.assignedDoctorId !== actor.userId)) {
      const err: any = new Error('Only the assigned doctor or authorized facility staff can complete this appointment');
      err.code = 'APPOINTMENT_ACCESS_DENIED'; err.statusCode = 403; throw err;
    }

    if (appointment.status !== 'checked_in' && appointment.status !== 'confirmed') {
      const err: any = new Error(
        `Cannot complete appointment with status ${appointment.status}`
      );
      err.code = 'INVALID_APPOINTMENT_TRANSITION';
      err.statusCode = 400;
      throw err;
    }

    appointment.status = 'completed';
    (appointment as any).statusHistory = (appointment as any).statusHistory || [];
    (appointment as any).statusHistory.push({ status: 'completed', changedBy: actor.userId, time: new Date(), note: 'Consultation completed' });
    await appointment.save();

    await notifyAppointmentPatient(appointment, 'Appointment completed', 'Your appointment is marked complete. Your doctor can share any follow-up instructions in your records.');

    await AuditLog.create({
      action: 'appointment.completed',
      resourceType: 'appointment',
      resourceId: appointmentId,
      actorId: actor.userId,
      actorRole: actor.role,
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: {
        destinationHospitalId: appointment.destinationHospitalId,
      },
      simulation: true,
    });

    return appointment;
  }

  static async getAppointmentById(appointmentId: string): Promise<IAppointmentDocument | null> {
    return Appointment.findOne({ appointmentId });
  }

  static async listAppointments(filters: {
    hospitalId?: string;
    patientId?: string;
    doctorId?: string;
    status?: AppointmentStatus;
    startDate?: string | Date;
    endDate?: string | Date;
  }): Promise<IAppointmentDocument[]> {
    const query: any = {};
    if (filters.hospitalId) query.destinationHospitalId = filters.hospitalId;
    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.doctorId) query.assignedDoctorId = filters.doctorId;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.slotStartTime = {};
      if (filters.startDate) query.slotStartTime.$gte = new Date(filters.startDate);
      if (filters.endDate) query.slotStartTime.$lte = new Date(filters.endDate);
    }

    return Appointment.find(query).sort({ slotStartTime: 1 }).limit(100);
  }
}
