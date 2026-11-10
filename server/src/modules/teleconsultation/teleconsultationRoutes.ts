import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { TeleconsultationService } from './teleconsultationService.js';
import { Teleconsultation } from './teleconsultationModel.js';
import { User } from '../auth/userModel.js';
import { VideoSignalingService } from './videoSignaling.js';

export const teleconsultationRouter = Router();

const RequestConsultationSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().optional(),
  hospitalId: z.string().min(1, 'Hospital ID required'),
  assignedClinicianId: z.string().min(1, 'Assigned clinician ID required'),
  assignedClinicianName: z.string().optional(),
  assignedClinicianRole: z.string().optional(),
  screeningCaseId: z.string().optional(),
  appointmentId: z.string().optional(),
});

const ScheduleConsultationSchema = z.object({
  scheduledAt: z.string().min(1, 'Scheduled consultation date required'),
});

const RecordNotesSchema = z.object({
  noteText: z.string().min(1, 'Clinical note text required'),
});

const AmendNotesSchema = z.object({
  newNoteText: z.string().min(1, 'Amended clinical note text required'),
  amendmentReason: z.string().min(1, 'Amendment reason required'),
});

const ReleaseResultSchema = z.object({
  patientSummaryMessage: z.string().min(1, 'Patient summary message required'),
  recommendedAction: z.string().min(1, 'Recommended action required'),
});

const PostMessageSchema = z.object({
  messageText: z.string().min(1, 'Message text required'),
});

const CancelConsultationSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason required'),
});

const RequestUrgentConsultationSchema = z.object({
  patientId: z.string().min(1, 'Patient ID required'),
  patientName: z.string().optional(),
  hospitalId: z.string().min(1, 'Hospital ID required'),
  urgencyReason: z.string().min(3, 'Urgency reason required (e.g. rapidly enlarging ulcer, active bleeding, severe trismus)'),
  symptomDurationDays: z.number().min(0).default(3),
  assignedClinicianId: z.string().optional(),
  screeningCaseId: z.string().optional(),
  appointmentId: z.string().optional(),
});

async function resolveCaller(req: Request) {
  let name: string | undefined;
  if (req.user) {
    const u = await User.findOne({ userId: req.user.id });
    if (u) {
      name = u.fullName;
      if (!req.user.hospitalId && u.hospitalId) {
        req.user.hospitalId = u.hospitalId;
      }
    }
  }
  return {
    userId: req.user!.id,
    role: req.user!.role,
    hospitalId: req.user!.hospitalId,
    name,
  };
}

// 1. Request Consultation
teleconsultationRouter.post(
  '/',
  requireAuth,
  authorizeCapability('telemedicine:request'),
  auditTag('teleconsultation.requested', 'teleconsultation'),
  validate({ body: RequestConsultationSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const consultation = await TeleconsultationService.requestConsultation(req.body, caller);
      res.status(201).envelope({ consultation }, 'Teleconsultation session requested successfully');
    } catch (err: any) {
      next(err);
    }
  }
);

// 1b. Request Urgent Consultation
teleconsultationRouter.post(
  '/urgent',
  requireAuth,
  authorizeCapability('telemedicine:request'),
  auditTag('teleconsultation.urgent_requested', 'teleconsultation'),
  validate({ body: RequestUrgentConsultationSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const emergencyInstructions = [
        'Avoid hot, spicy, sour, or abrasive foods',
        'Gently rinse mouth with warm saline water (1/2 tsp salt in 1 cup warm water)',
        'Do not apply caustic lime, tobacco paste, or home chemicals',
        'Keep patient hydrated with cool liquids through a straw if painful',
        'If airway obstruction, acute bleeding or severe swelling occurs, immediately dial 108',
      ];
      const emergencyContact = '108 (Free Tribal Emergency Ambulance) / CHC Paderu 24/7 Desk: +91 8935-254108';

      const consultationId = `tc_urg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const consultation = await Teleconsultation.create({
        consultationId,
        patientId: req.body.patientId,
        patientName: req.body.patientName || 'Urgent Triage Patient',
        requestedBy: caller.userId,
        requesterRole: caller.role,
        hospitalId: req.body.hospitalId,
        assignedClinicianId: req.body.assignedClinicianId || 'DR-PAD-01',
        assignedClinicianName: 'On-Call Medical Officer',
        assignedClinicianRole: 'medical_officer',
        screeningCaseId: req.body.screeningCaseId,
        appointmentId: req.body.appointmentId,
        status: 'REQUESTED',
        channelConfig: {
          videoStatus: 'BLOCKED',
          voiceStatus: 'BLOCKED',
          textChatStatus: 'ACTIVE',
        },
        isUrgent: true,
        urgencyDetails: {
          urgencyReason: req.body.urgencyReason,
          symptomDurationDays: req.body.symptomDurationDays,
          doctorNotificationDispatched: true,
          urgentStatus: 'REQUESTED',
          emergencyInstructions,
          hospitalEmergencyContact: emergencyContact,
        },
        simulation: true,
      });

      res.status(201).envelope({
        consultation,
        urgentAlertDispatched: true,
        emergencyContact,
        emergencyInstructions,
        simulation: true,
      }, 'Urgent consultation requested. On-call clinician alerted.');
    } catch (err: any) {
      next(err);
    }
  }
);

// 1c. Acknowledge Urgent Consultation
teleconsultationRouter.post(
  '/:id/urgent-acknowledge',
  requireAuth,
  authorizeCapability('telemedicine:manage'),
  auditTag('teleconsultation.urgent_acknowledged', 'teleconsultation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const consultation = await Teleconsultation.findOne({ consultationId: req.params.id });
      if (!consultation) {
        res.envelopeError('TELECONSULT_NOT_FOUND', 'Urgent teleconsultation record not found', undefined, 404);
        return;
      }

      if (!consultation.isUrgent || !consultation.urgencyDetails) {
        res.envelopeError('NOT_URGENT_CONSULTATION', 'This consultation is not marked as urgent', undefined, 400);
        return;
      }

      consultation.urgencyDetails.urgentStatus = 'ACKNOWLEDGED';
      consultation.urgencyDetails.acknowledgedBy = caller.userId;
      consultation.urgencyDetails.acknowledgedAt = new Date();
      await consultation.save();

      res.envelope({
        consultationId: consultation.consultationId,
        urgentStatus: consultation.urgencyDetails.urgentStatus,
        acknowledgedBy: caller.userId,
        acknowledgedAt: consultation.urgencyDetails.acknowledgedAt,
        simulation: true,
      }, 'Urgent consultation acknowledged by clinical team');
    } catch (err: any) {
      next(err);
    }
  }
);

// 2. List Consultations
teleconsultationRouter.get(
  '/',
  requireAuth,
  authorizeCapability('telemedicine:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const hospitalId = req.query.hospitalId as string | undefined;
      const patientId = req.query.patientId as string | undefined;
      const status = req.query.status as any;

      const consultations = await TeleconsultationService.listConsultations(
        { hospitalId, patientId, status },
        caller
      );
      res.envelope({ consultations, count: consultations.length });
    } catch (err: any) {
      next(err);
    }
  }
);

// 3. Get Consultation by ID
teleconsultationRouter.get(
  '/:id',
  requireAuth,
  authorizeCapability('telemedicine:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const consultation = await TeleconsultationService.getConsultationById(req.params.id as string, caller);
      if (!consultation) {
        res.envelopeError('TELECONSULT_NOT_FOUND', 'Teleconsultation record not found', undefined, 404);
        return;
      }
      res.envelope({ consultation });
    } catch (err: any) {
      next(err);
    }
  }
);

// 4. Schedule Consultation
teleconsultationRouter.post(
  '/:id/schedule',
  requireAuth,
  authorizeCapability('telemedicine:manage'),
  auditTag('teleconsultation.scheduled', 'teleconsultation'),
  validate({ body: ScheduleConsultationSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const consultation = await TeleconsultationService.scheduleConsultation(
        req.params.id as string,
        req.body.scheduledAt,
        caller
      );
      res.envelope({ consultation }, 'Teleconsultation scheduled successfully');
    } catch (err: any) {
      next(err);
    }
  }
);

// 5. Start Consultation
teleconsultationRouter.post(
  '/:id/start',
  requireAuth,
  authorizeCapability('telemedicine:manage'),
  auditTag('teleconsultation.started', 'teleconsultation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const consultation = await TeleconsultationService.startConsultation(req.params.id as string, caller);
      res.envelope({ consultation }, 'Teleconsultation marked as in progress');
    } catch (err: any) {
      next(err);
    }
  }
);

// 6. Video Session Status (BLOCKED Simulation Adapter)
teleconsultationRouter.get(
  '/:id/video-session',
  requireAuth,
  authorizeCapability('telemedicine:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const videoStatus = await TeleconsultationService.getVideoSession(req.params.id as string, caller);
      res.envelope({ videoStatus });
    } catch (err: any) {
      next(err);
    }
  }
);

// 7. Voice Session Status (BLOCKED Simulation Adapter)
teleconsultationRouter.get(
  '/:id/voice-session',
  requireAuth,
  authorizeCapability('telemedicine:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const voiceStatus = await TeleconsultationService.getVoiceSession(req.params.id as string, caller);
      res.envelope({ voiceStatus });
    } catch (err: any) {
      next(err);
    }
  }
);

// 8. Record Clinician Notes
teleconsultationRouter.post(
  '/:id/notes',
  requireAuth,
  authorizeCapability('telemedicine:notes'),
  auditTag('teleconsultation.notes_recorded', 'teleconsultation'),
  validate({ body: RecordNotesSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const note = await TeleconsultationService.recordClinicianNotes(
        req.params.id as string,
        req.body.noteText,
        caller
      );
      res.status(201).envelope({ note }, 'Clinical consultation note recorded');
    } catch (err: any) {
      next(err);
    }
  }
);

// 9. Amend Clinician Notes
teleconsultationRouter.post(
  '/:id/notes/amend',
  requireAuth,
  authorizeCapability('telemedicine:notes'),
  auditTag('teleconsultation.notes_amended', 'teleconsultation'),
  validate({ body: AmendNotesSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const note = await TeleconsultationService.amendClinicianNotes(
        req.params.id as string,
        req.body,
        caller
      );
      res.envelope({ note }, 'Clinical note amended with version increment');
    } catch (err: any) {
      next(err);
    }
  }
);

// 10. Get Clinical Notes
teleconsultationRouter.get(
  '/:id/notes',
  requireAuth,
  authorizeCapability('telemedicine:read'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const note = await TeleconsultationService.getConsultationNotes(req.params.id as string, caller);
      res.envelope({ note });
    } catch (err: any) {
      next(err);
    }
  }
);

// 11. Release Consultation Summary to Patient
teleconsultationRouter.post(
  '/:id/release',
  requireAuth,
  authorizeCapability('telemedicine:release'),
  auditTag('teleconsultation.result_released', 'teleconsultation'),
  validate({ body: ReleaseResultSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const consultation = await TeleconsultationService.releaseConsultationResult(
        req.params.id as string,
        req.body,
        caller
      );
      res.envelope({ consultation }, 'Consultation summary authorized and released');
    } catch (err: any) {
      next(err);
    }
  }
);

// 12. Post Discussion Message (Staff Only)
teleconsultationRouter.post(
  '/:id/messages',
  requireAuth,
  authorizeCapability('telemedicine:discuss'),
  auditTag('teleconsultation.message_posted', 'teleconsultation'),
  validate({ body: PostMessageSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const message = await TeleconsultationService.postCaseDiscussionMessage(
        req.params.id as string,
        req.body.messageText,
        caller
      );
      res.status(201).envelope({ message }, 'Case discussion message posted');
    } catch (err: any) {
      next(err);
    }
  }
);

// 13. Get Discussion Messages
teleconsultationRouter.get(
  '/:id/messages',
  requireAuth,
  authorizeCapability('telemedicine:discuss'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const messages = await TeleconsultationService.getCaseDiscussionMessages(
        req.params.id as string,
        caller
      );
      res.envelope({ messages, count: messages.length });
    } catch (err: any) {
      next(err);
    }
  }
);

// 14. Cancel Consultation
teleconsultationRouter.post(
  '/:id/cancel',
  requireAuth,
  authorizeCapability('telemedicine:manage'),
  auditTag('teleconsultation.cancelled', 'teleconsultation'),
  validate({ body: CancelConsultationSchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const caller = await resolveCaller(req);
      const consultation = await TeleconsultationService.cancelConsultation(
        req.params.id as string,
        req.body.reason,
        caller
      );
      res.envelope({ consultation }, 'Teleconsultation cancelled');
    } catch (err: any) {
      next(err);
    }
  }
);

// =============================================================================
// 15. WebRTC Peer Video Consultation Signaling (Module 4)
// =============================================================================

// Join Video Consultation Room
teleconsultationRouter.post(
  '/rooms/:id/join',
  requireAuth,
  auditTag('teleconsultation.room_joined', 'teleconsultation'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.id as string;
      const caller = await resolveCaller(req);
      const roomInfo = VideoSignalingService.joinRoom(consultationId, caller.userId, caller.role);
      res.envelope({
        ...roomInfo,
        userRole: caller.role,
        userName: caller.name,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Exchange WebRTC Signals (Offer, Answer, ICE Candidates)
teleconsultationRouter.post(
  '/rooms/:id/signal',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.id as string;
      const caller = await resolveCaller(req);
      const { type, data } = req.body;
      const result = VideoSignalingService.postSignal(consultationId, caller.userId, caller.role, type, data);
      res.envelope(result);
    } catch (err) {
      next(err);
    }
  }
);

// Poll Pending WebRTC Signals
teleconsultationRouter.get(
  '/rooms/:id/signal',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.id as string;
      const caller = await resolveCaller(req);
      const since = Number(req.query.since) || 0;
      const signals = VideoSignalingService.getSignals(consultationId, caller.userId, since);
      res.envelope(signals);
    } catch (err) {
      next(err);
    }
  }
);

// Leave Room
teleconsultationRouter.post(
  '/rooms/:id/leave',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const consultationId = req.params.id as string;
      const caller = await resolveCaller(req);
      const result = VideoSignalingService.leaveRoom(consultationId, caller.userId);
      res.envelope(result);
    } catch (err) {
      next(err);
    }
  }
);
