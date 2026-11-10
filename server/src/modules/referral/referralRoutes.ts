import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { ReferralService } from './referralService.js';
import { User } from '../auth/userModel.js';

import { Referral } from './referralModel.js';
import { Specialist } from '../specialist/specialistModel.js';

export const referralRouter = Router();

const CreateReferralSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().optional(),
  sourceHospitalId: z.string().optional(),
  destinationHospitalId: z.string().min(1, 'Destination hospital ID required'),
  specialistId: z.string().optional(),
  screeningCaseId: z.string().optional(),
  reasonForReferral: z.string().min(1, 'Reason for referral required'),
});

const ScheduleFollowUpSchema = z.object({
  scheduledDate: z.string().min(1, 'Scheduled follow-up date required'),
});

const MissedFollowUpSchema = z.object({
  reason: z.string().optional(),
});

const CancelReferralSchema = z.object({
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
 * POST /api/v1/referrals
 * Creates a referral request (MO or MO lead only)
 */
referralRouter.post(
  '/',
  requireAuth,
  authorizeCapability('referral:create'),
  auditTag('referral.created', 'referral'),
  validate(CreateReferralSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await ReferralService.createReferral(
        {
          ...req.body,
          sourceHospitalId: req.body.sourceHospitalId || caller.hospitalId,
        },
        caller
      );

      return res.status(201).envelope({ referral }, 'Referral request successfully created');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_CREATE_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * GET /api/v1/referrals
 * Lists referrals with destination hospital scoping
 */
referralRouter.get(
  '/',
  requireAuth,
  authorizeCapability('referral:read'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const destinationHospitalId = req.query.destinationHospitalId as string | undefined;
      const patientId = req.query.patientId as string | undefined;
      const status = req.query.status as any;

      const referrals = await ReferralService.listReferrals(
        { destinationHospitalId, patientId, status },
        caller
      );

      return res.envelope({ referrals, count: referrals.length });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_LIST_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * GET /api/v1/referrals/:id
 * Fetches referral details with cross-hospital scoping
 */
referralRouter.get(
  '/:id',
  requireAuth,
  authorizeCapability('referral:read'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await ReferralService.getReferralById(req.params.id, caller);
      if (!referral) {
        return res.status(404).envelopeError('REFERRAL_NOT_FOUND', 'Referral record not found');
      }

      return res.envelope({ referral });
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_READ_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/referrals/:id/accept
 * Destination hospital staff accepts referral
 */
referralRouter.post(
  '/:id/accept',
  requireAuth,
  authorizeCapability('referral:manage'),
  auditTag('referral.accepted', 'referral'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await ReferralService.acceptReferral(req.params.id, caller);
      return res.envelope({ referral }, 'Referral successfully accepted by destination hospital');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_ACCEPT_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/referrals/:id/schedule
 * Schedules follow-up date and registers Agenda reminder
 */
referralRouter.post(
  '/:id/schedule',
  requireAuth,
  authorizeCapability('referral:manage'),
  auditTag('referral.scheduled', 'referral'),
  validate(ScheduleFollowUpSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await ReferralService.scheduleFollowUp(req.params.id, req.body, caller);
      return res.envelope({ referral }, 'Follow-up consultation successfully scheduled');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_SCHEDULE_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/referrals/:id/missed
 * Marks follow-up as missed and escalates back to MO queue (Exactly once)
 */
referralRouter.post(
  '/:id/missed',
  requireAuth,
  authorizeCapability('referral:manage'),
  auditTag('referral.missed_followup_escalated', 'referral'),
  validate(MissedFollowUpSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const { referral, escalatedScreeningCase } = await ReferralService.recordMissedFollowUp(
        req.params.id,
        req.body.reason || 'Patient missed scheduled hospital follow-up consultation',
        caller
      );

      return res.envelope(
        { referral, escalatedScreeningCase },
        'Missed follow-up recorded and escalated back to Medical Officer queue'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_MISSED_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/referrals/:id/attended
 * Marks referral consultation as attended
 */
referralRouter.post(
  '/:id/attended',
  requireAuth,
  authorizeCapability('referral:manage'),
  auditTag('referral.attended', 'referral'),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await ReferralService.recordAttended(req.params.id, caller);
      return res.envelope({ referral }, 'Referral consultation marked as attended');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_ATTENDED_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

/**
 * POST /api/v1/referrals/:id/cancel
 * Cancels referral with mandatory reason
 */
referralRouter.post(
  '/:id/cancel',
  requireAuth,
  authorizeCapability('referral:manage'),
  auditTag('referral.cancelled', 'referral'),
  validate(CancelReferralSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await ReferralService.cancelReferral(req.params.id, req.body.reason, caller);
      return res.envelope({ referral }, 'Referral successfully cancelled');
    } catch (err: any) {
      return res
        .status(err.statusCode || 400)
        .envelopeError(err.code || 'REFERRAL_CANCEL_FAILED', err.message, undefined, err.statusCode || 400);
    }
  }
);

const AssignDoctorSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID required'),
  doctorName: z.string().optional(),
  scheduledDate: z.string().optional(),
});

/**
 * POST /api/v1/referrals/:id/assign-doctor
 * Hospital Manager assigns doctor to referred patient
 */
referralRouter.post(
  '/:id/assign-doctor',
  requireAuth,
  authorizeCapability('referral:manage'),
  auditTag('referral.doctor_assigned', 'referral'),
  validate(AssignDoctorSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await Referral.findOne({ referralId: req.params.id });
      if (!referral) {
        return res.status(404).envelopeError('REFERRAL_NOT_FOUND', 'Referral not found', undefined, 404);
      }

      // Cross-Hospital Check
      if (caller.role !== 'system_admin' && caller.hospitalId && referral.destinationHospitalId !== caller.hospitalId) {
        return res.status(403).envelopeError(
          'CROSS_HOSPITAL_FORBIDDEN',
          'Cannot assign doctor for another hospital referral',
          undefined,
          403
        );
      }

      let docName = req.body.doctorName;
      if (!docName) {
        const spec = await Specialist.findOne({ specialistId: req.body.doctorId }).lean();
        docName = spec ? (spec as any).name : req.body.doctorId;
      }

      referral.assignedDoctorId = req.body.doctorId;
      referral.assignedDoctorName = docName;
      referral.specialistId = req.body.doctorId;
      referral.specialistName = docName;
      referral.status = req.body.scheduledDate ? 'appointment_scheduled' : 'hospital_assigned';
      if (req.body.scheduledDate) {
        referral.scheduledFollowUpDate = new Date(req.body.scheduledDate);
      }

      await referral.save();

      return res.envelope({ referral }, 'Doctor assigned to referred patient successfully');
    } catch (err: any) {
      return res
        .status(err.statusCode || 500)
        .envelopeError('ASSIGN_DOCTOR_FAILED', err.message || 'Failed to assign doctor', undefined, 500);
    }
  }
);

const DoctorReviewSchema = z.object({
  agreedWithAi: z.boolean(),
  clinicalObservations: z.string().min(3, 'Clinical observations required'),
  recommendedFollowUpDays: z.number().min(1).max(365).optional(),
  furtherExamRequired: z.boolean().default(false),
  furtherExamNotes: z.string().optional(),
  markCompleted: z.boolean().default(false),
});

/**
 * POST /api/v1/referrals/:id/doctor-review
 * Doctor records clinical review, agrees/disagrees with AI, and sets follow-up
 */
referralRouter.post(
  '/:id/doctor-review',
  requireAuth,
  auditTag('referral.doctor_reviewed', 'referral'),
  validate(DoctorReviewSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await Referral.findOne({ referralId: req.params.id });
      if (!referral) {
        return res.status(404).envelopeError('REFERRAL_NOT_FOUND', 'Referral not found', undefined, 404);
      }

      // Check Cross-Hospital Scope
      if (caller.role !== 'system_admin' && caller.hospitalId && referral.destinationHospitalId !== caller.hospitalId) {
        return res.status(403).envelopeError(
          'CROSS_HOSPITAL_FORBIDDEN',
          'Access denied to referral outside assigned hospital',
          undefined,
          403
        );
      }

      const review = {
        doctorId: caller.userId,
        doctorName: caller.name || caller.userId,
        agreedWithAi: req.body.agreedWithAi,
        clinicalObservations: req.body.clinicalObservations,
        recommendedFollowUpDays: req.body.recommendedFollowUpDays,
        furtherExamNotes: req.body.furtherExamNotes,
        reviewDate: new Date(),
      };

      referral.doctorReview = review;

      if (req.body.markCompleted) {
        referral.status = 'referral_completed';
      } else if (req.body.furtherExamRequired) {
        referral.status = 'further_examination_required';
      } else if (req.body.recommendedFollowUpDays) {
        referral.status = 'follow_up_scheduled';
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + req.body.recommendedFollowUpDays);
        referral.scheduledFollowUpDate = nextDate;
      } else {
        referral.status = 'doctor_reviewed';
      }

      await referral.save();

      return res.envelope(
        { referral, doctorReview: review },
        'Doctor clinical assessment and review recorded successfully'
      );
    } catch (err: any) {
      return res
        .status(err.statusCode || 500)
        .envelopeError('DOCTOR_REVIEW_FAILED', err.message || 'Failed to record doctor review', undefined, 500);
    }
  }
);

const UpdateStatusSchema = z.object({
  status: z.enum([
    'pending_referral',
    'hospital_assigned',
    'appointment_scheduled',
    'patient_visited',
    'doctor_reviewed',
    'further_examination_required',
    'follow_up_scheduled',
    'referral_completed',
    'REQUESTED',
    'ACCEPTED',
    'SCHEDULED',
    'ATTENDED',
    'MISSED',
    'CANCELLED',
  ]),
});

/**
 * PATCH /api/v1/referrals/:id/status
 * Updates status progression across the 8 referral stages
 */
referralRouter.patch(
  '/:id/status',
  requireAuth,
  auditTag('referral.status_updated', 'referral'),
  validate(UpdateStatusSchema),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const referral = await Referral.findOne({ referralId: req.params.id });
      if (!referral) {
        return res.status(404).envelopeError('REFERRAL_NOT_FOUND', 'Referral not found', undefined, 404);
      }

      if (caller.role !== 'system_admin' && caller.hospitalId && referral.destinationHospitalId !== caller.hospitalId) {
        return res.status(403).envelopeError(
          'CROSS_HOSPITAL_FORBIDDEN',
          'Cross-hospital modification denied',
          undefined,
          403
        );
      }

      referral.status = req.body.status as any;
      await referral.save();

      return res.envelope({ referral }, `Referral status progressed to ${req.body.status}`);
    } catch (err: any) {
      return res
        .status(err.statusCode || 500)
        .envelopeError('STATUS_UPDATE_FAILED', err.message || 'Failed to update referral status', undefined, 500);
    }
  }
);

/**
 * GET /api/v1/referrals/patient/:patientId
 * Fetches referrals for a patient (accessible by patient themselves or clinicians)
 */
referralRouter.get(
  '/patient/:patientId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const patientId = req.params.patientId;
      const caller = req.user!;

      // Patient scoping
      if (caller.role === 'patient' && caller.patientId && caller.patientId !== patientId) {
        return res.status(403).envelopeError('ACCESS_DENIED', 'You can only view your own referrals', undefined, 403);
      }

      const referrals = await Referral.find({ patientId }).sort({ createdAt: -1 }).lean();
      return res.envelope({ referrals, total: referrals.length });
    } catch (err: any) {
      return res
        .status(err.statusCode || 500)
        .envelopeError('REFERRAL_FETCH_FAILED', err.message || 'Failed to fetch patient referrals', undefined, 500);
    }
  }
);
