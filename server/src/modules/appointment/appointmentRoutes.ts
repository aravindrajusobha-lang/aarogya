import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { AppointmentService } from './appointmentService.js';
import { User } from '../auth/userModel.js';

export const appointmentRouter = Router();

const CreateAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().optional(),
  destinationHospitalId: z.string().min(1, 'Destination hospital ID required'),
  destinationHospitalName: z.string().optional(),
  department: z.string().optional(),
  assignedDoctorId: z.string().optional(),
  assignedDoctorName: z.string().optional(),
  slotStartTime: z.string().min(1, 'Slot start time required'),
  slotEndTime: z.string().optional(),
  type: z
    .enum([
      'screening_review',
      'clinical_consultation',
      'specialist_referral',
      'routine_follow_up',
      'biopsy_procedure',
    ])
    .optional(),
  reason: z.string().optional(),
  idempotencyKey: z.string().optional(),
  clientRequestId: z.string().optional(),
  offlineQueued: z.boolean().optional(),
  notes: z.string().optional(),
});

const RescheduleAppointmentSchema = z.object({
  newSlotStartTime: z.string().min(1, 'New slot start time required'),
  newSlotEndTime: z.string().optional(),
  reason: z.string().min(1, 'Reschedule reason required'),
});

const CancelAppointmentSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason required'),
});

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
      const result = await AppointmentService.requestAppointment(req.body, {
        userId: caller.userId,
        role: caller.role,
        name: caller.name,
      });

      const statusCode = result.idempotentReplay ? 200 : 201;
      return res.status(statusCode).envelope(
        {
          appointment: result.appointment,
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
      const patientId = req.query.patientId as string | undefined;
      const status = req.query.status as any;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const appointments = await AppointmentService.listAppointments({
        hospitalId,
        patientId,
        status,
        startDate,
        endDate,
      });

      return res.envelope({ appointments, count: appointments.length });
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

      return res.envelope({ appointment });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'APPOINTMENT_READ_ERROR', err.message);
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
          appointment: result.appointment,
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
          appointment: result.appointment,
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
      const result = await AppointmentService.cancelAppointment(
        req.params.id,
        req.body.reason,
        caller
      );

      return res.envelope(
        {
          appointment: result.appointment,
          notification: result.notification,
        },
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
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const appointment = await AppointmentService.checkInAppointment(req.params.id, caller);
      return res.envelope({ appointment }, 'Patient marked as checked in');
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
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const appointment = await AppointmentService.completeAppointment(req.params.id, caller);
      return res.envelope({ appointment }, 'Appointment consultation completed');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'COMPLETION_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);
