import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { AppointmentService } from './appointmentService.js';
import { User } from '../auth/userModel.js';
import { Appointment } from './appointmentModel.js';
import { NotificationQueue } from '../notification/notificationQueue.js';
import { SyncLedger } from '../patient/syncLedgerModel.js';
import { AuditLog } from '../audit/auditModel.js';

export const appointmentRouter = Router();

const CreateAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().optional(),
  destinationHospitalId: z.string().min(1, 'Destination hospital ID required'),
  destinationHospitalName: z.string().optional(),
  hospitalId: z.string().optional(),
  department: z.string().optional(),
  assignedDoctorId: z.string().optional(),
  assignedDoctorName: z.string().optional(),
  preferredDoctorId: z.string().optional(),
  screeningId: z.string().optional(),
  riskLevel: z.enum(['low','medium','high']).optional(),
  conditionCategory: z.string().optional(),
  suggestedDoctorType: z.string().optional(),
  consultationMode: z.enum(['online','offline']).optional(),
  slotStartTime: z.string().min(1, 'Slot start time required'),
  slotEndTime: z.string().optional(),
  type: z.enum(['screening_review','clinical_consultation','specialist_referral','routine_follow_up','biopsy_procedure']).optional(),
  reason: z.string().optional(),
  idempotencyKey: z.string().optional(),
  clientRequestId: z.string().optional(),
  offlineQueued: z.boolean().optional(),
  notes: z.string().optional(),
  patientNote: z.string().trim().max(2000).optional(),
  mutationId: z.string().uuid().optional(),
  consentGiven: z.boolean().optional(),
  visitDetails: z.record(z.any()).optional(),
});

const RescheduleAppointmentSchema = z.object({
  newSlotStartTime: z.string().min(1, 'New slot start time required'),
  newSlotEndTime: z.string().optional(),
  reason: z.string().min(1, 'Reschedule reason required'),
});

const CancelAppointmentSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason required'),
  mutationId: z.string().uuid().optional(),
});

const VerifyVideoInviteSchema = z.object({ token: z.string().min(32).max(128) });
const AppointmentMutationSchema = z.object({ mutationId: z.string().uuid().optional() }).default({});
const DoctorResponseSchema = z.object({
  mutationId: z.string().uuid(),
  decision: z.enum(['accept', 'decline']),
  declineReason: z.string().trim().min(3).max(1000).optional(),
  patientNote: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.decision === 'decline' && !value.declineReason) context.addIssue({ code: z.ZodIssueCode.custom, path: ['declineReason'], message: 'A reason is required when declining an appointment.' });
});

function publicAppointment(appointment: any) {
  const value = appointment.toObject ? appointment.toObject() : { ...appointment };
  if (value.videoInvite) {
    value.videoInvite = {
      issuedAt: value.videoInvite.issuedAt,
      expiresAt: value.videoInvite.expiresAt,
      revokedAt: value.videoInvite.revokedAt,
    };
  }
  return value;
}

async function assertVideoAppointmentAccess(appointment: any, caller: { userId: string; role: string; hospitalId?: string }, token?: string) {
  if (!['confirmed', 'rescheduled', 'checked_in'].includes(appointment.status)) {
    const error: any = new Error('The doctor must confirm this appointment before consultation access is available.');
    error.statusCode = 403;
    error.code = 'APPOINTMENT_NOT_CONFIRMED';
    throw error;
  }
  if (['medical_officer', 'specialist_doctor'].includes(caller.role)) {
    if (caller.hospitalId !== appointment.destinationHospitalId ||
        (appointment.assignedDoctorId && appointment.assignedDoctorId !== caller.userId) ||
        (!appointment.assignedDoctorId && appointment.videoInvite?.issuedBy && appointment.videoInvite.issuedBy !== caller.userId)) {
      const error: any = new Error('Only the assigned doctor at this facility can access the consultation.');
      error.statusCode = 403;
      error.code = 'DOCTOR_NOT_ASSIGNED';
      throw error;
    }
    return;
  }
  if (caller.role !== 'patient') {
    const error: any = new Error('Only the patient and assigned doctor can join this consultation.');
    error.statusCode = 403;
    error.code = 'CONSULTATION_ACCESS_DENIED';
    throw error;
  }
  const dbUser: any = await User.findOne({ userId: caller.userId }).lean();
  const patientIds = [caller.userId, dbUser?.patientId].filter(Boolean);
  const expectedHash = appointment.videoInvite?.tokenHash || '';
  const suppliedHash = token ? crypto.createHash('sha256').update(token).digest('hex') : '';
  const tokenMatches = expectedHash.length === suppliedHash.length && expectedHash.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(suppliedHash));
  if (!patientIds.includes(appointment.patientId) || !token || !appointment.videoInvite?.tokenHash ||
      appointment.videoInvite.revokedAt || new Date(appointment.videoInvite.expiresAt).getTime() <= Date.now() ||
      !tokenMatches) {
    const error: any = new Error('This patient-specific consultation link is invalid or expired.');
    error.statusCode = 403;
    error.code = 'VIDEO_INVITE_INVALID';
    throw error;
  }
}

async function resolveCaller(req: Request): Promise<{
  hospitalId?: string;
  role: string;
  userId: string;
  name?: string;
}> {
  const user = req.user;
  if (!user) throw new Error('Unauthenticated');

  const userId = user.id || (user as any).userId;
  let hospitalId = (user as any).hospitalId;
  let name = (user as any).name;
  if (!hospitalId || !name) {
    const dbUser = await User.findOne({ userId }).lean();
    if (dbUser) {
      hospitalId = hospitalId || (dbUser as any).hospitalId;
      name = name || (dbUser as any).fullName || (dbUser as any).name;
    }
  }

  return { hospitalId, role: user.role, userId, name: name || userId };
}

/**
 * GET /api/v1/appointments/slots
 * Queries available 20-minute OPD consultation slots for a hospital and date
 */
appointmentRouter.get(
  '/slots',
  requireAuth,
  authorizeCapability('appointment:read'),
  async (req: Request, res: Response) => {
    try {
      const dateStr = (req.query.date as string) || new Date().toISOString();
      const hospitalId = (req.query.hospitalId as string) || req.user?.hospitalId;

      if (!hospitalId) {
        return res
          .status(400)
          .envelopeError('HOSPITAL_ID_REQUIRED', 'Hospital ID is required to query slots');
      }

      const slots = await AppointmentService.getAvailableSlots(dateStr, hospitalId);
      return res.envelope(
        {
          date: dateStr,
          destinationHospitalId: hospitalId,
          slotDurationMinutes: 20,
          workingHours: '09:00 - 16:00 (Mon-Sat, Lunch 13:00-14:00)',
          totalSlots: slots.length,
          availableSlotsCount: slots.filter((s) => s.isAvailable).length,
          slots,
        },
        'Available appointment consultation slots retrieved'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'SLOT_QUERY_ERROR', err.message);
    }
  }
);

/**
 * POST /api/v1/appointments
 * Requests/books an appointment (idempotent, checks slot conflicts inside transaction)
 */
appointmentRouter.post(
  '/',
  requireAuth,
  authorizeCapability('appointment:create'),
  auditTag('appointment.requested', 'appointment'),
  validate(CreateAppointmentSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const appointmentInput: any = { ...req.body };
      if (caller.role === 'patient') {
        const dbUser: any = await User.findOne({ userId: caller.userId }).lean();
        appointmentInput.patientId = dbUser?.patientId || caller.userId;
        appointmentInput.patientName = dbUser?.fullName || caller.name;
        appointmentInput.patientUserId = dbUser?.userId || caller.userId;
        appointmentInput.idempotencyKey = appointmentInput.idempotencyKey || appointmentInput.mutationId;
        const sharesReport = Boolean(appointmentInput.screeningId || appointmentInput.visitDetails?.shareReport);
        const sharesProfile = Boolean(appointmentInput.visitDetails?.shareProfile);
        if ((sharesReport || sharesProfile) && appointmentInput.consentGiven !== true) {
          return res.status(400).envelopeError('CONSENT_REQUIRED', 'Explicit patient consent is required before sharing profile or screening information.', undefined, 400);
        }
        appointmentInput.visitDetails = {
          ...(appointmentInput.visitDetails || {}),
          patientSharingConsent: {
            report: sharesReport,
            profile: sharesProfile,
            granted: appointmentInput.consentGiven === true,
            recordedAt: new Date(),
          },
        };
      }
      const result = await AppointmentService.requestAppointment(appointmentInput, {
        userId: caller.userId,
        role: caller.role,
        name: caller.name,
      });

      const statusCode = result.idempotentReplay ? 200 : 201;
      return res.status(statusCode).envelope(
        {
          appointment: publicAppointment(result.appointment),
          idempotentReplay: result.idempotentReplay,
          notification: result.notification,
        },
        result.idempotentReplay
          ? 'Idempotent appointment request replayed; existing record returned'
          : 'Appointment consultation successfully requested'
      );
    } catch (err: any) {
      const status = err.statusCode || (err.code === 'SLOT_CONFLICT' ? 409 : 400);
      return res
        .status(status)
        .envelopeError(err.code || 'APPOINTMENT_REQUEST_FAILED', err.message, undefined, status);
    }
  }
);

appointmentRouter.post(
  '/:id/doctor-response',
  requireAuth,
  authorizeCapability('appointment:confirm'),
  auditTag('appointment.doctor_response', 'appointment'),
  validate({ body: DoctorResponseSchema }),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      if (!['medical_officer', 'specialist_doctor'].includes(caller.role)) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the assigned doctor can respond to this appointment.', undefined, 403);
      const appointment: any = await Appointment.findOne({ appointmentId: req.params.id });
      if (!appointment) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment not found.', undefined, 404);
      if (caller.hospitalId !== appointment.destinationHospitalId || appointment.assignedDoctorId !== caller.userId) return res.status(403).envelopeError('DOCTOR_NOT_ASSIGNED', 'Only the doctor selected for this appointment can respond.', undefined, 403);

      const replay: any = await SyncLedger.findOne({ clientMutationId: req.body.mutationId }).lean();
      if (replay) {
        if (replay.entityType !== 'appointment-doctor-response' || replay.entityId !== appointment.appointmentId || replay.responsePayload?.doctorId !== caller.userId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID is already attached to another action.', undefined, 409);
        return res.envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Appointment response replayed.');
      }

      let saved: any;
      if (req.body.decision === 'accept') {
        const result = await AppointmentService.confirmAppointment(appointment.appointmentId, caller);
        saved = result.appointment;
      } else {
        if (!['requested', 'rescheduled'].includes(String(appointment.status))) return res.status(409).envelopeError('INVALID_APPOINTMENT_TRANSITION', 'Only pending appointments can be declined.', undefined, 409);
        appointment.status = 'declined';
        appointment.declineReason = req.body.declineReason;
        if (req.body.patientNote) appointment.patientNote = req.body.patientNote;
        appointment.statusHistory = appointment.statusHistory || [];
        appointment.statusHistory.push({ status: 'declined', changedBy: caller.userId, time: new Date(), note: req.body.declineReason });
        await appointment.save();
        saved = appointment;
        const patient = await User.findOne({ role: 'patient', $or: [{ patientId: appointment.patientId }, { userId: appointment.patientId }] }).select('userId').lean() as any;
        if (patient?.userId) await NotificationQueue.enqueue({ recipientId: patient.userId, recipientRole: 'patient', customTitle: 'Appointment request update', customBody: `The doctor could not accept the requested time. Reason: ${req.body.declineReason}`, category: 'referral', priority: 'normal', channels: ['in_app'], metadata: { appointmentId: appointment.appointmentId, status: 'declined' } });
      }
      const responsePayload = { appointment: publicAppointment(saved), decision: req.body.decision, status: saved.status, doctorId: caller.userId };
      await SyncLedger.create({ clientMutationId: req.body.mutationId, entityType: 'appointment-doctor-response', entityId: appointment.appointmentId, responsePayload, simulation: true });
      return res.envelope(responsePayload, req.body.decision === 'accept' ? 'Appointment accepted.' : 'Appointment declined and patient notified.');
    } catch (err: any) {
      return res.status(err.statusCode || 400).envelopeError(err.code || 'DOCTOR_RESPONSE_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * GET /api/v1/appointments
 * Lists appointments with filters
 */
appointmentRouter.get(
  '/',
  requireAuth,
  authorizeCapability('appointment:read'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const hospitalId = (req.query.hospitalId as string) || (caller.role !== 'system_admin' ? caller.hospitalId : undefined);
      let patientId = req.query.patientId as string | undefined;
      if (caller.role === 'patient') {
        const dbUser: any = await User.findOne({ userId: caller.userId }).lean();
        patientId = dbUser?.patientId || caller.userId;
      }
      const status = req.query.status as any;
      const doctorId = ['medical_officer', 'specialist_doctor'].includes(caller.role) ? caller.userId : undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const appointments = await AppointmentService.listAppointments({
        hospitalId,
        patientId,
        doctorId,
        status,
        startDate,
        endDate,
      });

      return res.envelope({ appointments: appointments.map(publicAppointment), count: appointments.length });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'APPOINTMENT_LIST_ERROR', err.message);
    }
  }
);

/**
 * GET /api/v1/appointments/:id
 * Fetches appointment details
 */
appointmentRouter.get(
  '/:id',
  requireAuth,
  authorizeCapability('appointment:read'),
  async (req: Request, res: Response) => {
    try {
      const appointment = await AppointmentService.getAppointmentById(req.params.id);
      if (!appointment) {
        return res
          .status(404)
          .envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment record not found');
      }

      const caller = await resolveCaller(req);
      if (caller.role === 'patient') {
        const dbUser: any = await User.findOne({ userId: caller.userId }).lean();
        if (![caller.userId, dbUser?.patientId].includes(appointment.patientId)) {
          return res.status(403).envelopeError('APPOINTMENT_ACCESS_DENIED', 'This appointment is not assigned to your patient account.', undefined, 403);
        }
      } else if (['medical_officer', 'specialist_doctor'].includes(caller.role) && (caller.hospitalId !== appointment.destinationHospitalId || appointment.assignedDoctorId !== caller.userId)) {
        return res.status(403).envelopeError('APPOINTMENT_ACCESS_DENIED', 'This appointment is not assigned to your account.', undefined, 403);
      } else if (!['system_admin', 'admin', 'medical_officer', 'specialist_doctor'].includes(caller.role) || (caller.role !== 'system_admin' && caller.hospitalId !== appointment.destinationHospitalId)) {
        return res.status(403).envelopeError('APPOINTMENT_ACCESS_DENIED', 'This appointment belongs to another facility.', undefined, 403);
      }

      await AuditLog.create({ action: 'appointment.read', resourceType: 'appointment', resourceId: appointment.appointmentId, actorId: caller.userId, actorRole: caller.role, ip: req.ip || '127.0.0.1', userAgent: req.get('user-agent'), statusCode: 200, metadata: { destinationHospitalId: appointment.destinationHospitalId }, simulation: true });

      return res.envelope({ appointment: publicAppointment(appointment) });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'APPOINTMENT_READ_ERROR', err.message);
    }
  }
);

/** Doctor creates a patient-specific demo video invitation after confirming an appointment. */
appointmentRouter.post(
  '/:id/video-invite',
  requireAuth,
  authorizeCapability('appointment:confirm'),
  auditTag('appointment.video_invite_issued', 'appointment'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const appointment = await Appointment.findOne({ appointmentId: req.params.id });
      if (!appointment) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment record not found', undefined, 404);
      if (!['medical_officer', 'specialist_doctor'].includes(caller.role) || caller.hospitalId !== appointment.destinationHospitalId ||
          (appointment.assignedDoctorId && appointment.assignedDoctorId !== caller.userId)) {
        return res.status(403).envelopeError('DOCTOR_NOT_ASSIGNED', 'Only the doctor assigned to this facility appointment can issue a consultation link.', undefined, 403);
      }
      if (!['confirmed', 'rescheduled'].includes(appointment.status)) {
        return res.status(409).envelopeError('APPOINTMENT_NOT_CONFIRMED', 'Confirm or respond to the appointment before issuing a video consultation link.', undefined, 409);
      }

      const patient = await User.findOne({
        role: 'patient',
        $or: [{ patientId: appointment.patientId }, { userId: appointment.patientId }],
      }).select('userId');
      if (!patient) {
        return res.status(409).envelopeError('PATIENT_ACCOUNT_MISSING', 'The patient account could not be matched for in-app link delivery.', undefined, 409);
      }

      const token = crypto.randomBytes(32).toString('hex');
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + 30 * 60 * 1000);
      appointment.videoInvite = {
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        issuedBy: caller.userId,
        issuedAt,
        expiresAt,
      };
      await appointment.save();

      const link = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/#/appointment-consultation/${encodeURIComponent(appointment.appointmentId)}?invite=${encodeURIComponent(token)}`;
      const notification = await NotificationQueue.enqueue({
        recipientId: patient.userId,
        recipientRole: 'patient',
        customTitle: 'Video consultation link',
        customBody: `Your doctor sent a consultation link for your appointment. It expires at ${expiresAt.toLocaleTimeString()}. Open it before it expires.`,
        category: 'advisory',
        priority: 'high',
        channels: ['in_app', 'sms', 'email'],
        link,
        metadata: { appointmentId: appointment.appointmentId, expiresAt: expiresAt.toISOString(), videoStatus: 'DEMO' },
      });

      return res.status(201).envelope({
        appointmentId: appointment.appointmentId,
        token,
        link,
        expiresAt,
        videoStatus: 'DEMO',
        notification: {
          notificationId: notification.notificationId,
          deliveryStatus: notification.deliveryStatus,
          overallStatus: notification.overallStatus,
        },
      }, 'Consultation link sent to the patient inbox. You can also share it directly.');
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).envelopeError(err.code || 'VIDEO_INVITE_CREATE_FAILED', err.message, undefined, status);
    }
  }
);

/** Validates the patient invite before allowing the demo room to open. */
appointmentRouter.post(
  '/:id/video-invite/verify',
  requireAuth,
  authorizeCapability('appointment:read'),
  validate({ body: VerifyVideoInviteSchema }),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const appointment = await Appointment.findOne({ appointmentId: req.params.id });
      if (!appointment) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment record not found', undefined, 404);
      await assertVideoAppointmentAccess(appointment, caller, req.body.token);
      return res.envelope({
        appointmentId: appointment.appointmentId,
        patientName: appointment.patientName || 'Patient',
        expiresAt: appointment.videoInvite?.expiresAt,
        videoStatus: 'DEMO',
      }, 'Consultation link verified for this appointment.');
    } catch (err: any) {
      const status = err.statusCode || 400;
      return res.status(status).envelopeError(err.code || 'VIDEO_INVITE_VERIFY_FAILED', err.message, undefined, status);
    }
  }
);

/**
 * POST /api/v1/appointments/:id/confirm
 * Confirms an appointment:
 * - Only Hospital Manager or Medical Officer of the destination hospital
 * - Self-confirmation blocked: Requester cannot confirm their own appointment
 * - Wrong-hospital staff denied (403)
 */
appointmentRouter.post(
  '/:id/confirm',
  requireAuth,
  authorizeCapability('appointment:confirm'),
  auditTag('appointment.confirmed', 'appointment'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const result = await AppointmentService.confirmAppointment(req.params.id, {
        userId: caller.userId,
        role: caller.role,
        hospitalId: caller.hospitalId,
        name: caller.name,
      });

      return res.envelope(
        {
          appointment: publicAppointment(result.appointment),
          notification: result.notification,
        },
        'Appointment successfully confirmed by destination facility'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'APPOINTMENT_CONFIRMATION_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/appointments/:id/reschedule
 * Reschedules appointment to a new slot with conflict verification
 */
appointmentRouter.post(
  '/:id/reschedule',
  requireAuth,
  authorizeCapability('appointment:reschedule'),
  auditTag('appointment.rescheduled', 'appointment'),
  validate(RescheduleAppointmentSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const result = await AppointmentService.rescheduleAppointment(
        req.params.id,
        req.body.newSlotStartTime,
        req.body.newSlotEndTime,
        req.body.reason,
        caller
      );

      return res.envelope(
        {
          appointment: publicAppointment(result.appointment),
          notification: result.notification,
        },
        'Appointment consultation successfully rescheduled'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'APPOINTMENT_RESCHEDULE_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/appointments/:id/cancel
 * Cancels appointment with mandatory reason
 */
appointmentRouter.post(
  '/:id/cancel',
  requireAuth,
  authorizeCapability('appointment:cancel'),
  auditTag('appointment.cancelled', 'appointment'),
  validate(CancelAppointmentSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const target: any = await AppointmentService.getAppointmentById(req.params.id);
      if (!target) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment record not found.', undefined, 404);
      if (caller.role === 'patient') {
        const dbUser: any = await User.findOne({ userId: caller.userId }).lean();
        if (![caller.userId, dbUser?.patientId].filter(Boolean).includes(target.patientId)) return res.status(403).envelopeError('APPOINTMENT_ACCESS_DENIED', 'This appointment is not assigned to your patient account.', undefined, 403);
      } else if (['medical_officer', 'specialist_doctor'].includes(caller.role)) {
        if (caller.hospitalId !== target.destinationHospitalId || target.assignedDoctorId !== caller.userId) return res.status(403).envelopeError('DOCTOR_NOT_ASSIGNED', 'Only the assigned doctor at this facility can cancel this appointment.', undefined, 403);
      } else if (caller.role !== 'system_admin' && caller.hospitalId !== target.destinationHospitalId) {
        return res.status(403).envelopeError('HOSPITAL_SCOPE_DENIED', 'This appointment belongs to another facility.', undefined, 403);
      }
      const mutationId = req.body.mutationId;
      if (mutationId) {
        const replay: any = await SyncLedger.findOne({ clientMutationId: mutationId }).lean();
        if (replay) {
          if (replay.entityType !== 'appointment-cancel' || replay.entityId !== req.params.id || replay.responsePayload?.actorId !== caller.userId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID is already attached to another action.', undefined, 409);
          return res.envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Appointment cancellation replayed.');
        }
      }
      const result = await AppointmentService.cancelAppointment(
        req.params.id,
        req.body.reason,
        caller
      );

      const responsePayload = {
        appointment: publicAppointment(result.appointment),
        notification: result.notification,
        actorId: caller.userId,
      };
      if (mutationId) await SyncLedger.create({ clientMutationId: mutationId, entityType: 'appointment-cancel', entityId: req.params.id, responsePayload, simulation: true });

      return res.envelope(
        responsePayload,
        'Appointment consultation successfully cancelled'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'APPOINTMENT_CANCEL_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/appointments/:id/check-in
 * Marks patient as checked in for their consultation
 */
appointmentRouter.post(
  '/:id/check-in',
  requireAuth,
  authorizeCapability('appointment:manage'),
  validate({ body: AppointmentMutationSchema }),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const mutationId = req.body.mutationId as string | undefined;
      const replay: any = mutationId ? await SyncLedger.findOne({ clientMutationId: mutationId }).lean() : null;
      if (replay) {
        if (replay.entityType !== 'appointment-check-in' || replay.entityId !== req.params.id || replay.responsePayload?.actorId !== caller.userId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID is attached to another action.', undefined, 409);
        return res.envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Appointment check-in replayed.');
      }
      const appointment = await AppointmentService.checkInAppointment(req.params.id, caller);
      if (mutationId) await SyncLedger.create({ clientMutationId: mutationId, entityType: 'appointment-check-in', entityId: req.params.id, responsePayload: { appointment: publicAppointment(appointment), actorId: caller.userId }, simulation: true });
      return res.envelope({ appointment: publicAppointment(appointment) }, 'Patient marked as checked in');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'CHECK_IN_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/appointments/:id/complete
 * Completes consultation appointment
 */
appointmentRouter.post(
  '/:id/complete',
  requireAuth,
  authorizeCapability('appointment:manage'),
  validate({ body: AppointmentMutationSchema }),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const mutationId = req.body.mutationId as string | undefined;
      const replay: any = mutationId ? await SyncLedger.findOne({ clientMutationId: mutationId }).lean() : null;
      if (replay) {
        if (replay.entityType !== 'appointment-complete' || replay.entityId !== req.params.id || replay.responsePayload?.actorId !== caller.userId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID is attached to another action.', undefined, 409);
        return res.envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Appointment completion replayed.');
      }
      const appointment = await AppointmentService.completeAppointment(req.params.id, caller);
      if (mutationId) await SyncLedger.create({ clientMutationId: mutationId, entityType: 'appointment-complete', entityId: req.params.id, responsePayload: { appointment: publicAppointment(appointment), actorId: caller.userId }, simulation: true });
      return res.envelope({ appointment: publicAppointment(appointment) }, 'Appointment consultation completed');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'COMPLETION_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * GET /api/v1/appointments/:id/join
 * Patient/doctor join info for online consultation (ownership + time window enforced).
 */
appointmentRouter.get(
  '/:id/join',
  requireAuth,
  authorizeCapability('appointment:read'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const appointment = await AppointmentService.getAppointmentById(req.params.id);
      if (!appointment) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment record not found', undefined, 404);
      if ((appointment as any).consultationMode && (appointment as any).consultationMode !== 'online') {
        return res.status(400).envelopeError('NOT_ONLINE_APPOINTMENT', 'Join is available only for online consultations.', undefined, 400);
      }
      if (caller.role === 'patient') {
        const dbUser: any = await User.findOne({ userId: caller.userId }).lean();
        if (![caller.userId, dbUser?.patientId].includes(appointment.patientId)) {
          return res.status(403).envelopeError('APPOINTMENT_ACCESS_DENIED', 'This appointment is not assigned to your patient account.', undefined, 403);
        }
      } else if (!['medical_officer', 'specialist_doctor', 'system_admin', 'admin'].includes(caller.role)) {
        return res.status(403).envelopeError('CONSULTATION_ACCESS_DENIED', 'Only the patient and assigned doctor can join this consultation.', undefined, 403);
      }
      const now = Date.now();
      const url = (appointment as any).video?.url || ((appointment as any).videoInvite?.tokenHash ? undefined : undefined);
      const from = (appointment as any).video?.validFrom ? new Date((appointment as any).video.validFrom).getTime() : ((appointment as any).videoInvite?.expiresAt ? new Date(appointment.slotStartTime).getTime() - 15*60000 : undefined);
      const until = (appointment as any).video?.validUntil ? new Date((appointment as any).video.validUntil).getTime() : ((appointment as any).videoInvite?.expiresAt ? new Date((appointment as any).videoInvite.expiresAt).getTime() : undefined);
      if (!url) return res.status(409).envelopeError('LINK_NOT_READY', 'Consultation link is not available yet.', undefined, 409);
      if (from && now < from) return res.status(403).envelopeError('NOT_IN_WINDOW', 'This consultation is not open yet.', undefined, 403);
      if (until && now > until) return res.status(403).envelopeError('WINDOW_ENDED', 'This consultation has ended.', undefined, 403);
      return res.envelope({ appointmentId: appointment.appointmentId, roomUrl: url, validFrom: from ? new Date(from) : undefined, validUntil: until ? new Date(until) : undefined, status: appointment.status });
    } catch (err: any) {
      return res.status(err.statusCode || 400).envelopeError(err.code || 'APPOINTMENT_JOIN_ERROR', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * PATCH /api/v1/appointments/:id/respond-new-time
 * Patient accepts or declines a proposed reschedule.
 */
appointmentRouter.patch(
  '/:id/respond-new-time',
  requireAuth,
  authorizeCapability('appointment:reschedule'),
  auditTag('appointment.reschedule_response', 'appointment'),
  validate(z.object({ accept: z.boolean(), mutationId: z.string().uuid().optional() })),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const appointment = await AppointmentService.getAppointmentById(req.params.id);
      if (!appointment) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment record not found', undefined, 404);
      if (caller.role === 'patient') {
        const dbUser: any = await User.findOne({ userId: caller.userId }).lean();
        if (![caller.userId, dbUser?.patientId].includes(appointment.patientId)) {
          return res.status(403).envelopeError('APPOINTMENT_ACCESS_DENIED', 'This appointment is not assigned to your patient account.', undefined, 403);
        }
      } else if (['medical_officer', 'specialist_doctor'].includes(caller.role)) {
        if (caller.hospitalId !== appointment.destinationHospitalId || appointment.assignedDoctorId !== caller.userId) return res.status(403).envelopeError('DOCTOR_NOT_ASSIGNED', 'Only the assigned doctor at this facility can respond to the appointment.', undefined, 403);
      } else if (caller.role !== 'system_admin' && caller.hospitalId !== appointment.destinationHospitalId) {
        return res.status(403).envelopeError('HOSPITAL_SCOPE_DENIED', 'This appointment belongs to another facility.', undefined, 403);
      }
      const mutationId = req.body.mutationId;
      if (mutationId) {
        const replay: any = await SyncLedger.findOne({ clientMutationId: mutationId }).lean();
        if (replay) {
          if (replay.entityType !== 'appointment-reschedule-response' || replay.entityId !== req.params.id || replay.responsePayload?.actorId !== caller.userId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID is already attached to another action.', undefined, 409);
          return res.envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Appointment reschedule response replayed.');
        }
      }
      const proposed = (appointment as any).proposedReschedule;
      if (!proposed || proposed.status !== 'pending' || !proposed.newSlotStart) {
        return res.status(409).envelopeError('NO_PROPOSED_TIME', 'No pending proposed time to respond to.', undefined, 409);
      }
      if (req.body.accept) {
        const result = await AppointmentService.rescheduleAppointment(
          req.params.id,
          new Date(proposed.newSlotStart).toISOString(),
          proposed.newSlotEnd ? new Date(proposed.newSlotEnd).toISOString() : undefined,
          proposed.reason || 'Accepted proposed reschedule',
          { userId: caller.userId, role: caller.role, name: caller.name }
        );
        (result.appointment as any).proposedReschedule = { ...proposed, status: 'accepted' };
        await (result.appointment as any).save();
        const responsePayload = { appointment: publicAppointment(result.appointment), actorId: caller.userId };
        if (mutationId) await SyncLedger.create({ clientMutationId: mutationId, entityType: 'appointment-reschedule-response', entityId: req.params.id, responsePayload, simulation: true });
        return res.envelope(responsePayload, 'Proposed time accepted and appointment rescheduled.');
      }
      (appointment as any).proposedReschedule = { ...proposed, status: 'declined' };
      (appointment as any).statusHistory = (appointment as any).statusHistory || [];
      (appointment as any).statusHistory.push({ status: (appointment as any).status, changedBy: caller.userId, time: new Date(), note: 'Proposed reschedule declined' });
      await (appointment as any).save();
      const responsePayload = { appointment: publicAppointment(appointment), actorId: caller.userId };
      if (mutationId) await SyncLedger.create({ clientMutationId: mutationId, entityType: 'appointment-reschedule-response', entityId: req.params.id, responsePayload, simulation: true });
      return res.envelope(responsePayload, 'Proposed reschedule declined.');
    } catch (err: any) {
      return res.status(err.statusCode || 400).envelopeError(err.code || 'RESPOND_NEW_TIME_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);
