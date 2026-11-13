import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { User } from '../auth/userModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { SyncLedger } from '../patient/syncLedgerModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { NotificationQueue } from '../notification/notificationQueue.js';
import { logger } from '../../config/logger.js';
import { Consultation, FOLLOW_UP_FREQUENCIES, FOLLOW_UP_INTERVAL_DAYS } from './consultationModel.js';
import { saveClinicalNote, sessionView } from './consultationRoutes.js';
import multer from 'multer';
import { ConsultationCapture } from './consultationCaptureModel.js';
import { savePrivateFile, readStoredFileBuffer } from '../storage/storageService.js';
import { StoredFile } from '../storage/storageModel.js';
import { validateMagicBytes } from '../storage/magicBytes.js';
import { Consent } from '../consent/consentModel.js';
import { AiScreening } from '../ai/aiScreeningModel.js';
import { analyzeOralScreeningImage } from '../ai/aiAnalysisService.js';
import { computeCombinedRecommendation } from '../ai/aiRoutes.js';
import { buildPatientScreeningSummary } from '../ai/patientScreeningSummary.js';
import { runInTransaction } from '../../utils/transaction.js';
import { PatientCare } from './patientCareModel.js';

/**
 * Doctor-controlled consultation sessions for booked appointments (online and in-person).
 * The assigned doctor may start a session at any time once the appointment is confirmed,
 * and the server records start time, end time, duration and the follow-up frequency.
 */
export const consultationSessionRouter = Router();

const DOCTOR_ROLES = new Set(['medical_officer', 'specialist_doctor']);
const STARTABLE_APPOINTMENT_STATUSES = new Set(['confirmed', 'rescheduled', 'checked_in']);
const FINISHED_SESSION_STATUSES = new Set(['COMPLETED', 'MISSED', 'CANCELLED']);
// The record stays open long enough for a doctor-initiated session; it is closed explicitly by /end.
const SESSION_RECORD_TTL_MS = 12 * 60 * 60_000;

const AppointmentParams = z.object({ appointmentId: z.string().trim().min(1).max(100) });
const StartSchema = z.object({ clientMutationId: z.string().uuid() });
const FollowUpSchema = z.object({
  frequency: z.enum(FOLLOW_UP_FREQUENCIES),
  intervalDays: z.number().int().min(1).max(365).optional(),
  plannedSessions: z.number().int().min(1).max(52).optional(),
  instructions: z.string().trim().max(2000).optional(),
}).superRefine((value, ctx) => {
  if (value.frequency === 'custom' && !value.intervalDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['intervalDays'], message: 'A custom follow-up needs the number of days between visits.' });
  }
});
const EndSchema = z.object({
  clientMutationId: z.string().uuid(),
  notes: z.string().trim().max(10000).optional(),
  followUp: FollowUpSchema,
});
const HistoryQuery = z.object({ patientId: z.string().trim().min(1).max(100).optional() });

type Caller = { userId: string; role: string; hospitalId?: string; name: string; patientId?: string };

async function resolveCaller(req: Request): Promise<Caller> {
  const userId = req.user?.id || (req.user as any)?.userId;
  if (!userId) throw Object.assign(new Error('Authentication required.'), { statusCode: 401, code: 'UNAUTHORIZED' });
  const dbUser: any = await User.findOne({ userId }).select('fullName hospitalId patientId').lean();
  return { userId, role: req.user!.role, hospitalId: (req.user as any).hospitalId || dbUser?.hospitalId, name: dbUser?.fullName || userId, patientId: dbUser?.patientId || userId };
}

function fail(res: Response, err: any) {
  const status = err?.statusCode || 400;
  return res.status(status).envelopeError(err?.code || 'CONSULTATION_SESSION_ERROR', err?.message || 'Consultation session request failed.', undefined, status);
}

function forbidden(message: string, code = 'DOCTOR_NOT_ASSIGNED') {
  return Object.assign(new Error(message), { statusCode: 403, code });
}

async function assignedAppointment(caller: Caller, appointmentId: string) {
  if (!DOCTOR_ROLES.has(caller.role)) throw forbidden('Only the assigned doctor can manage this consultation.', 'DOCTOR_REQUIRED');
  const appointment: any = await Appointment.findOne({ appointmentId });
  if (!appointment) throw Object.assign(new Error('Appointment not found.'), { statusCode: 404, code: 'APPOINTMENT_NOT_FOUND' });
  if (appointment.destinationHospitalId !== caller.hospitalId || appointment.assignedDoctorId !== caller.userId) {
    throw forbidden('Only the doctor assigned to this appointment at this facility can manage the consultation.');
  }
  const care = await PatientCare.findOne({ patientId: appointment.patientId }).lean();
  if (care && care.doctorId !== caller.userId) throw forbidden('This patient has another treating doctor. Request a transfer before providing care.', 'TRANSFER_REQUIRED');
  return appointment;
}

async function replayFor(clientMutationId: string, action: 'start' | 'end', appointmentId: string, actorId: string) {
  const ledger: any = await SyncLedger.findOne({ clientMutationId }).lean();
  if (!ledger) return null;
  if (ledger.entityType !== `consultation-session:${action}` || ledger.entityId !== appointmentId || ledger.responsePayload?.actorId !== actorId) {
    throw Object.assign(new Error('This mutation ID is already attached to another action.'), { statusCode: 409, code: 'MUTATION_ID_REUSED' });
  }
  return ledger.responsePayload;
}

export function computeNextFollowUp(endedAt: Date, frequency: string, intervalDays?: number): { intervalDays?: number; nextFollowUpAt?: Date } {
  if (frequency === 'none') return {};
  const days = frequency === 'custom' ? intervalDays : FOLLOW_UP_INTERVAL_DAYS[frequency as keyof typeof FOLLOW_UP_INTERVAL_DAYS];
  if (!days) return {};
  return { intervalDays: days, nextFollowUpAt: new Date(endedAt.getTime() + days * 24 * 60 * 60_000) };
}

/** POST /api/v1/consultation-sessions/:appointmentId/start */
consultationSessionRouter.post(
  '/:appointmentId/start',
  requireAuth,
  authorizeCapability('appointment:confirm'),
  validate({ params: AppointmentParams, body: StartSchema }),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const { appointmentId } = req.params;
      const replay = await replayFor(req.body.clientMutationId, 'start', appointmentId, caller.userId);
      if (replay) return res.envelope({ ...replay, idempotentReplay: true }, 'Consultation start replayed.');

      const appointment = await assignedAppointment(caller, appointmentId);
      if (!STARTABLE_APPOINTMENT_STATUSES.has(String(appointment.status))) {
        return res.status(409).envelopeError('APPOINTMENT_NOT_CONFIRMED', 'Accept the appointment before starting the consultation.', undefined, 409);
      }
      const mode: 'online' | 'offline' = appointment.consultationMode === 'online' ? 'online' : 'offline';
      const now = new Date();

      let session: any = await Consultation.findOne({ appointmentId });
      if (session && FINISHED_SESSION_STATUSES.has(session.status)) {
        return res.status(409).envelopeError('CONSULTATION_ALREADY_ENDED', 'This consultation has already ended.', undefined, 409);
      }
      if (!session) {
        session = new Consultation({
          consultationId: `SESSION-${crypto.randomUUID()}`,
          appointmentId,
          callType: 'APPOINTMENT',
          patientId: appointment.patientId,
          doctorId: caller.userId,
          hospitalId: appointment.destinationHospitalId,
          tokenHash: crypto.randomBytes(32).toString('hex'),
          linkSentAt: now,
          status: 'WAITING',
        });
      }
      session.consultationMode = mode;
      if (!session.startedAt) { session.startedAt = now; session.startedBy = caller.userId; }
      session.expiresAt = new Date(Math.max(now.getTime(), session.startedAt.getTime()) + SESSION_RECORD_TTL_MS);
      // In-person visits are "in consultation" immediately; online ones become IN_CALL when both peers join the WebRTC room.
      if (mode === 'offline') session.status = 'IN_CALL';

      try {
        await session.save();
      } catch (saveError: any) {
        if (saveError?.code === 11000) {
          return res.status(409).envelopeError('DOCTOR_ALREADY_IN_CONSULTATION', 'End your current consultation before starting another one.', undefined, 409);
        }
        throw saveError;
      }

      if (mode === 'offline' && appointment.status !== 'checked_in') {
        appointment.status = 'checked_in';
        appointment.statusHistory = appointment.statusHistory || [];
        appointment.statusHistory.push({ status: 'checked_in', changedBy: caller.userId, time: now, note: 'In-person consultation started by doctor' });
        await appointment.save();
      }

      const responsePayload = { session: sessionView(session), appointmentId, consultationMode: mode, actorId: caller.userId };
      await SyncLedger.create({ clientMutationId: req.body.clientMutationId, entityType: 'consultation-session:start', entityId: appointmentId, responsePayload, simulation: true });
      await AuditLog.create({ action: 'consultation.session.started', resourceType: 'appointment', resourceId: appointmentId, actorId: caller.userId, actorRole: caller.role, ip: req.ip || '127.0.0.1', statusCode: 200, metadata: { consultationMode: mode }, simulation: true });

      if (mode === 'online') {
        const patientUser: any = await User.findOne({ $or: [{ patientId: appointment.patientId }, { userId: appointment.patientId }], role: 'patient' }).select('userId').lean();
        if (patientUser) {
          await NotificationQueue.enqueue({
            recipientId: patientUser.userId,
            recipientRole: 'patient',
            customTitle: 'Your doctor has started the consultation',
            customBody: 'Open your appointment and tap "Join consultation" to enter the private video room.',
            category: 'advisory',
            channels: ['in_app'],
            link: `#/consultation/webrtc/${encodeURIComponent(appointmentId)}`,
            metadata: { appointmentId },
          } as any).catch((notifyError: unknown) => logger.warn({ err: notifyError instanceof Error ? notifyError.message : 'notify failed' }, 'Consultation start notification failed'));
        }
      }

      return res.envelope(responsePayload, mode === 'online' ? 'Consultation started. The patient can now join the room.' : 'In-person consultation started.');
    } catch (err) { return fail(res, err); }
  }
);

/** POST /api/v1/consultation-sessions/:appointmentId/end */
consultationSessionRouter.post(
  '/:appointmentId/end',
  requireAuth,
  authorizeCapability('appointment:confirm'),
  validate({ params: AppointmentParams, body: EndSchema }),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const { appointmentId } = req.params;
      const replay = await replayFor(req.body.clientMutationId, 'end', appointmentId, caller.userId);
      if (replay) return res.envelope({ ...replay, idempotentReplay: true }, 'Consultation end replayed.');

      await assignedAppointment(caller, appointmentId);
      const existing: any = await Consultation.findOne({ appointmentId }).lean();
      if (!existing?.startedAt) return res.status(409).envelopeError('CONSULTATION_NOT_STARTED', 'Start the consultation before ending it.', undefined, 409);
      if (FINISHED_SESSION_STATUSES.has(existing.status)) return res.status(409).envelopeError('CONSULTATION_ALREADY_ENDED', 'This consultation has already ended.', undefined, 409);

      const endedAt = new Date();
      const { frequency, intervalDays, plannedSessions, instructions } = req.body.followUp;
      const next = computeNextFollowUp(endedAt, frequency, intervalDays);
      let responsePayload: Record<string, unknown> = {};

      try {
        await runInTransaction(async (dbSession) => {
          const session: any = await Consultation.findOne({ appointmentId }).session(dbSession);
          const appointment: any = await Appointment.findOne({ appointmentId }).session(dbSession);
          session.status = 'COMPLETED';
          session.endedAt = endedAt;
          session.endedBy = caller.userId;
          session.durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000));
          session.followUp = {
            frequency,
            ...(next.intervalDays ? { intervalDays: next.intervalDays } : {}),
            ...(next.nextFollowUpAt ? { nextFollowUpAt: next.nextFollowUpAt } : {}),
            ...(plannedSessions && frequency !== 'none' ? { plannedSessions } : {}),
            ...(instructions ? { instructions } : {}),
            setBy: caller.userId,
            setAt: endedAt,
          };
          await session.save({ session: dbSession });
          await saveClinicalNote(session.consultationId, caller, req.body.notes || '', dbSession);

          appointment.status = 'completed';
          appointment.statusHistory = appointment.statusHistory || [];
          appointment.statusHistory.push({ status: 'completed', changedBy: caller.userId, time: endedAt, note: `Consultation ended (${Math.round(session.durationSeconds / 60)} min)` });
          await appointment.save({ session: dbSession });

          responsePayload = { session: sessionView(session), appointmentId, actorId: caller.userId };
          await SyncLedger.create([{ clientMutationId: req.body.clientMutationId, entityType: 'consultation-session:end', entityId: appointmentId, responsePayload, simulation: true }], { session: dbSession });
        });
      } finally {
        /* session ended by runInTransaction */
      }

      await AuditLog.create({ action: 'consultation.session.ended', resourceType: 'appointment', resourceId: appointmentId, actorId: caller.userId, actorRole: caller.role, ip: req.ip || '127.0.0.1', statusCode: 200, metadata: { followUpFrequency: frequency }, simulation: true });
      const patientUser: any = await User.findOne({ $or: [{ patientId: existing.patientId }, { userId: existing.patientId }], role: 'patient' }).select('userId').lean();
      if (patientUser) {
        const followText = next.nextFollowUpAt ? ` Next follow-up is due around ${next.nextFollowUpAt.toDateString()}.` : '';
        await NotificationQueue.enqueue({
          recipientId: patientUser.userId,
          recipientRole: 'patient',
          customTitle: 'Consultation completed',
          customBody: `Your consultation has ended.${followText}`,
          category: 'advisory',
          channels: ['in_app'],
          metadata: { appointmentId },
        } as any).catch((notifyError: unknown) => logger.warn({ err: notifyError instanceof Error ? notifyError.message : 'notify failed' }, 'Consultation end notification failed'));
      }

      return res.envelope(responsePayload, 'Consultation ended and follow-up plan saved.');
    } catch (err) { return fail(res, err); }
  }
);

/** GET /api/v1/consultation-sessions/history?patientId= */
consultationSessionRouter.get(
  '/history',
  requireAuth,
  authorizeCapability('appointment:read'),
  validate({ query: HistoryQuery }),
  async (req: Request, res: Response) => {
    try {
      const caller = await resolveCaller(req);
      const filter: Record<string, unknown> = { callType: { $ne: 'DIRECT' }, startedAt: { $exists: true } };
      if (caller.role === 'patient') {
        filter.patientId = caller.patientId;
      } else if (DOCTOR_ROLES.has(caller.role)) {
        filter.doctorId = caller.userId;
        filter.hospitalId = caller.hospitalId;
        if (typeof req.query.patientId === 'string') filter.patientId = req.query.patientId;
      } else {
        throw forbidden('Only patients and doctors can view consultation history.', 'ROLE_REQUIRED');
      }
      const sessions: any[] = await Consultation.find(filter).sort({ startedAt: -1 }).limit(200).lean();
      const appointments: any[] = await Appointment.find({ appointmentId: { $in: sessions.map((item) => item.appointmentId) } })
        .select('appointmentId patientName assignedDoctorName destinationHospitalName consultationMode slotStartTime slotEndTime').lean();
      const byId = new Map(appointments.map((item) => [item.appointmentId, item]));
      const visitCounts = new Map<string, number>();
      sessions.forEach((item) => visitCounts.set(item.patientId, (visitCounts.get(item.patientId) || 0) + 1));
      return res.envelope({
        sessions: sessions.map((item) => {
          const appointment = byId.get(item.appointmentId) || {};
          return {
            appointmentId: item.appointmentId,
            patientId: item.patientId,
            patientName: appointment.patientName || null,
            doctorName: appointment.assignedDoctorName || null,
            facilityName: appointment.destinationHospitalName || null,
            scheduledStart: appointment.slotStartTime || null,
            scheduledEnd: appointment.slotEndTime || null,
            ...sessionView({ ...item, consultationMode: item.consultationMode || appointment.consultationMode }),
          };
        }),
        totalSessions: sessions.length,
        visitsByPatient: Object.fromEntries(visitCounts),
      });
    } catch (err) { return fail(res, err); }
  }
);

/* ======================================================================================
 * Live-call captures: the assigned doctor saves a still frame of the patient's video to the
 * patient's record during an active consultation, and may run DEMO AI analysis on it.
 * ==================================================================================== */
const captureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

consultationSessionRouter.post('/:appointmentId/captures', requireAuth, authorizeCapability('appointment:confirm'), validate({ params: AppointmentParams }), captureUpload.single('image'), async (req: Request, res: Response) => {
  try {
    const caller = await resolveCaller(req);
    const clientId = typeof req.body?.clientId === 'string' ? req.body.clientId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
      return res.status(400).envelopeError('INVALID_MUTATION_ID', 'clientId must be a UUID v4.', undefined, 400);
    }
    const replay: any = await ConsultationCapture.findOne({ clientId }).lean();
    if (replay) {
      if (replay.doctorId !== caller.userId || replay.appointmentId !== req.params.appointmentId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This request ID was already used.', undefined, 409);
      return res.envelope({ capture: publicCapture(replay), idempotentReplay: true }, 'Capture already saved.');
    }
    const appointment = await assignedAppointment(caller, req.params.appointmentId);
    const session: any = await Consultation.findOne({ appointmentId: appointment.appointmentId }).lean();
    if (!session?.startedAt || FINISHED_SESSION_STATUSES.has(session.status)) {
      return res.status(409).envelopeError('CONSULTATION_NOT_ACTIVE', 'Captures can be taken only during an active consultation.', undefined, 409);
    }
    if (!req.file) return res.status(400).envelopeError('IMAGE_REQUIRED', 'A JPEG, PNG or WebP image is required.', undefined, 400);
    const magic = validateMagicBytes(req.file.buffer, req.file.mimetype);
    if (!magic.valid) return res.status(400).envelopeError('INVALID_FILE_SIGNATURE', magic.error || 'Invalid image.', undefined, 400);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 1000) : '';

    const stored = await savePrivateFile({
      originalFilename: `consultation-capture-${appointment.appointmentId}.jpg`,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      uploader: req.user as any,
      accessScopes: ['storage:read_clinical'],
      category: 'patients/consultation-records/',
      patientId: appointment.patientId,
      hospitalId: appointment.destinationHospitalId,
    });
    const capture = await ConsultationCapture.create({
      captureId: `CAP-${crypto.randomUUID()}`,
      appointmentId: appointment.appointmentId,
      consultationId: session.consultationId,
      patientId: appointment.patientId,
      doctorId: caller.userId,
      doctorName: caller.name,
      hospitalId: appointment.destinationHospitalId,
      fileId: stored.fileId,
      sha256Hash: stored.sha256Hash,
      note: note || undefined,
      clientId,
    });
    await AuditLog.create({ action: 'consultation.capture.saved', resourceType: 'appointment', resourceId: appointment.appointmentId, actorId: caller.userId, actorRole: caller.role, ip: req.ip || '127.0.0.1', statusCode: 201, metadata: { captureId: capture.captureId }, simulation: true });
    return res.status(201).envelope({ capture: publicCapture(capture) }, 'Capture saved to the patient record.');
  } catch (err) { return fail(res, err); }
});

consultationSessionRouter.post('/captures/:captureId/analyze', requireAuth, authorizeCapability('appointment:confirm'), validate({ params: z.object({ captureId: z.string().trim().min(5).max(80) }) }), async (req: Request, res: Response) => {
  try {
    const caller = await resolveCaller(req);
    const capture: any = await ConsultationCapture.findOne({ captureId: req.params.captureId });
    if (!capture) return res.status(404).envelopeError('CAPTURE_NOT_FOUND', 'Capture not found.', undefined, 404);
    if (capture.doctorId !== caller.userId || capture.hospitalId !== caller.hospitalId) throw forbidden('Only the doctor who took this capture can analyse it.');
    const care = await PatientCare.findOne({ patientId: capture.patientId }).lean();
    if (care && care.doctorId !== caller.userId) throw forbidden('The current treating doctor must approve access.', 'TRANSFER_REQUIRED');
    if (capture.aiScreeningId) {
      const existing: any = await AiScreening.findOne({ screeningId: capture.aiScreeningId }).lean();
      return res.envelope({ screeningId: capture.aiScreeningId, summary: existing ? buildPatientScreeningSummary(existing) : null, idempotentReplay: true }, 'This capture was already analysed.');
    }
    const consent = await Consent.findOne({ patientId: capture.patientId, purpose: 'screening_ai_analysis', status: 'granted', validUntil: { $gt: new Date() } }).lean();
    if (!consent) return res.status(403).envelopeError('CONSENT_REQUIRED', 'The patient has not given consent for AI photo analysis. The capture is saved; ask the patient to grant consent first.', undefined, 403);

    const file: any = await StoredFile.findOne({ fileId: capture.fileId }).lean();
    if (!file) return res.status(404).envelopeError('FILE_NOT_FOUND', 'The captured image is missing.', undefined, 404);
    const buffer = await readStoredFileBuffer(file);
    let analysis;
    try {
      analysis = await analyzeOralScreeningImage({ buffer, filename: file.originalFilename || 'capture.jpg', mimeType: file.mimeType || 'image/jpeg', patientNote: capture.note, language: 'en' });
    } catch (analysisError: any) {
      return res.status(analysisError?.statusCode || 503).envelopeError(analysisError?.code || 'AI_PROVIDER_BUSY', analysisError?.message || 'AI analysis is unavailable right now.', undefined, analysisError?.statusCode || 503);
    }
    const combined = computeCombinedRecommendation({ label: analysis.label, confidence: analysis.confidence, referToSpecialist: analysis.referToSpecialist }, null, null);
    const screening = await AiScreening.create({
      patientId: capture.patientId,
      performedBy: { userId: caller.userId, username: caller.userId, role: caller.role, fullName: caller.name },
      hospitalId: capture.hospitalId,
      label: analysis.label,
      confidence: analysis.confidence,
      probabilities: analysis.probabilities || {},
      referToSpecialist: analysis.referToSpecialist,
      modelVersion: analysis.modelVersion,
      source: 'server',
      imageRef: capture.fileId,
      imageQuality: analysis.imageQuality,
      moduleA: { label: analysis.label, confidence: analysis.confidence, probabilities: analysis.probabilities || {}, modelVersion: analysis.modelVersion, source: 'server', imageRef: capture.fileId },
      combinedRecommendation: combined,
      clinicianReview: { status: 'PENDING' },
      consentGiven: true,
      consentTimestamp: new Date(),
      syncStatus: 'SYNCED',
      clientId: crypto.randomUUID(),
      geminiAnalysis: analysis.geminiAnalysis,
    });
    capture.aiScreeningId = screening.screeningId;
    await capture.save();
    await AuditLog.create({ action: 'consultation.capture.analyzed', resourceType: 'ai_screening', resourceId: screening.screeningId, actorId: caller.userId, actorRole: caller.role, ip: req.ip || '127.0.0.1', statusCode: 200, metadata: { captureId: capture.captureId }, simulation: true });
    return res.envelope({ screeningId: screening.screeningId, summary: buildPatientScreeningSummary(screening.toObject()) }, 'DEMO AI analysis saved to the patient record.');
  } catch (err) { return fail(res, err); }
});

/** Patient: own consultation captures (images load via the JWT-protected storage route). */
consultationSessionRouter.get('/captures/my', requireAuth, authorizeCapability('appointment:read'), async (req: Request, res: Response) => {
  try {
    const caller = await resolveCaller(req);
    if (caller.role !== 'patient') throw forbidden('Patient access is required.', 'PATIENT_REQUIRED');
    const captures: any[] = await ConsultationCapture.find({ patientId: caller.patientId }).sort({ createdAt: -1 }).limit(100).lean();
    return res.envelope({ captures: captures.map(publicCapture) });
  } catch (err) { return fail(res, err); }
});

function publicCapture(capture: any) {
  return { captureId: capture.captureId, appointmentId: capture.appointmentId, fileId: capture.fileId, doctorName: capture.doctorName || null, note: capture.note || '', aiScreeningId: capture.aiScreeningId || null, createdAt: capture.createdAt };
}
