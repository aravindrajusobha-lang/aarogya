import { DoctorSlot, availableDoctorSlots } from './doctorSlotModel.js';
import { Prescription } from '../prescription/prescriptionModel.js';
import { AiScreening } from '../ai/aiScreeningModel.js';
import { ScreeningCase } from '../screening/screeningCaseModel.js';
import { Router, Request } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { User } from '../auth/userModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { AppointmentService } from '../appointment/appointmentService.js';
import { Consultation } from './consultationModel.js';
import { DailyAdapter } from './dailyAdapter.js';
import { NotificationQueue } from '../notification/notificationQueue.js';
import { ConsultationNote } from '../teleconsultation/teleconsultationModel.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { Patient } from '../patient/patientModel.js';
import { SyncLedger } from '../patient/syncLedgerModel.js';

export const consultationRouter = Router();
const NoteSchema = z.object({ notes: z.string().trim().min(1).max(10000), clientMutationId: z.string().uuid().optional() });
const EndSchema = z.object({ notes: z.string().trim().max(10000).optional(), clientMutationId: z.string().uuid().optional() }).optional();
const DirectCallSchema = z.object({ patientId: z.string().trim().min(1).max(64), clientMutationId: z.string().uuid() });
const DirectMutationSchema = z.object({ clientMutationId: z.string().uuid() });
const DirectEndSchema = z.object({ clientMutationId: z.string().uuid(), notes: z.string().trim().max(10000).optional() });
const DirectNotesSchema = z.object({ clientMutationId: z.string().uuid(), notes: z.string().trim().min(1).max(10000) });
const DailyProviderConfigSchema = z.object({ apiKey: z.string().trim().min(10).max(500), domain: z.string().trim().min(3).max(253) });
const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
async function saveClinicalNote(consultationId: string, clinician: { userId: string; name: string; role: string }, text: string) {
  if (!text.trim()) return;
  const digest = hash(text); const existing: any = await ConsultationNote.findOne({ consultationId });
  if (!existing) await ConsultationNote.create({ noteId: `NOTE-${crypto.randomUUID()}`, consultationId, clinicianId: clinician.userId, clinicianName: clinician.name, clinicianRole: clinician.role, originalNoteText: text, originalHash: digest, currentNoteText: text, currentHash: digest, currentVersion: 1, notesHistory: [] });
  else { existing.notesHistory.push({ version: existing.currentVersion, noteText: existing.currentNoteText, hash: existing.currentHash, amendedBy: clinician.userId, amendedAt: new Date(), amendmentReason: 'Versioned consultation note amendment' }); existing.currentVersion += 1; existing.currentNoteText = text; existing.currentHash = digest; await existing.save(); }
}
async function caller(req: Request) {
  const userId = req.user?.id || (req.user as any)?.userId;
  if (!userId) throw Object.assign(new Error('Authentication required.'), { statusCode: 401 });
  const dbUser = await User.findOne({ userId }).lean() as any;
  return { userId, role: req.user!.role, hospitalId: (req.user as any).hospitalId || dbUser?.hospitalId, name: dbUser?.fullName || userId, patientId: dbUser?.patientId || userId };
}
function error(res: any, err: any) { const status = err.statusCode || 400; return res.status(status).envelopeError(err.code || 'CONSULTATION_ERROR', err.message, undefined, status); }
function doctorRole(role: string) { return role === 'medical_officer' || role === 'specialist_doctor'; }
function clientOrigin(req: Request) {
  const configuredOrigin = process.env.CLIENT_ORIGIN?.trim();
  if (configuredOrigin) {
    try { return new URL(configuredOrigin).origin; }
    catch { throw Object.assign(new Error('CLIENT_ORIGIN must be a valid absolute URL.'), { statusCode: 503, code: 'CLIENT_ORIGIN_INVALID' }); }
  }
  const requestOrigin = req.header('origin');
  if (process.env.NODE_ENV !== 'production' && requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      if (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) return parsed.origin;
    } catch { /* use the local development fallback */ }
  }
  return 'http://localhost:5173';
}
async function authorizedConsultation(req: Request, appointmentId: string) {
  const user = await caller(req);
  const item = await Consultation.findOne({ appointmentId });
  if (!item) throw Object.assign(new Error('No consultation link has been issued for this appointment.'), { statusCode: 404, code: 'CONSULTATION_NOT_FOUND' });
  const doctor = ['medical_officer', 'specialist_doctor'].includes(user.role) && item.doctorId === user.userId && item.hospitalId === user.hospitalId;
  const patient = user.role === 'patient' && item.patientId === user.patientId;
  if (!doctor && !patient) throw Object.assign(new Error('This consultation is not assigned to your account.'), { statusCode: 403, code: 'CONSULTATION_ACCESS_DENIED' });
  return { item, user, doctor, patient };
}
async function finish(item: any, status: 'COMPLETED' | 'MISSED' = 'COMPLETED') {
  if (item.status === 'IN_CALL' || item.status === 'LINK_SENT' || item.status === 'WAITING') {
    const endedAt = new Date();
    item.status = status; item.endedAt = endedAt;
    item.durationSeconds = item.startedAt ? Math.max(0, Math.floor((endedAt.getTime() - item.startedAt.getTime()) / 1000)) : 0;
    await item.save();
    if (item.roomName) await DailyAdapter.closeRoom(item.roomName);
    if (item.callType !== 'DIRECT') await Appointment.updateOne({ appointmentId: item.appointmentId }, { $set: { status: 'completed' } });
  }
  return item;
}

async function authorizedDirectCall(req: Request, callId: string) {
  const user = await caller(req);
  const item: any = await Consultation.findOne({ consultationId: callId, callType: 'DIRECT' });
  if (!item) throw Object.assign(new Error('Direct video call not found.'), { statusCode: 404, code: 'DIRECT_CALL_NOT_FOUND' });
  const doctor = doctorRole(user.role) && item.doctorId === user.userId && item.hospitalId === user.hospitalId;
  const patient = user.role === 'patient' && item.patientId === user.patientId;
  if (!doctor && !patient) throw Object.assign(new Error('Only the calling doctor and invited patient can access this call.'), { statusCode: 403, code: 'DIRECT_CALL_ACCESS_DENIED' });
  return { item, user, doctor, patient };
}
async function findDirectMutation(clientMutationId: string, action: string, callId?: string) {
  const ledger: any = await SyncLedger.findOne({ clientMutationId }).lean();
  if (!ledger) return null;
  if (ledger.entityType !== `direct-video-call:${action}` || (callId && ledger.entityId !== callId)) {
    throw Object.assign(new Error('This mutation ID was already used for a different action.'), { statusCode: 409, code: 'MUTATION_ID_REUSED' });
  }
  return ledger;
}
async function saveDirectMutation(clientMutationId: string, action: string, callId: string, responsePayload: Record<string, unknown>) {
  await SyncLedger.create({ clientMutationId, entityType: `direct-video-call:${action}`, entityId: callId, responsePayload, simulation: true });
}

consultationRouter.get('/provider-status', requireAuth, authorizeCapability('appointment:read'), async (_req, res) => {
  const status = await DailyAdapter.getStatus();
  return res.envelope({ liveVideo: { provider: 'DAILY', ...status } });
});

consultationRouter.get('/admin/video-provider', requireAuth, authorizeCapability('users:manage'), async (req, res) => {
  try {
    const user = await caller(req);
    if (user.role !== 'system_admin') return res.status(403).envelopeError('SYSTEM_ADMIN_REQUIRED', 'Only a system administrator can manage video provider settings.', undefined, 403);
    const status = await DailyAdapter.getStatus();
    return res.envelope({ provider: 'DAILY', ...status, canStoreCredentials: DailyAdapter.canStoreAdminCredentials() });
  } catch (err) { return error(res, err); }
});

consultationRouter.put('/admin/video-provider', requireAuth, authorizeCapability('users:manage'), auditTag('daily_provider.configured', 'video_provider'), validate({ body: DailyProviderConfigSchema }), async (req, res) => {
  try {
    const user = await caller(req);
    if (user.role !== 'system_admin') return res.status(403).envelopeError('SYSTEM_ADMIN_REQUIRED', 'Only a system administrator can manage video provider settings.', undefined, 403);
    const saved = await DailyAdapter.saveAdminCredentials(req.body.apiKey, req.body.domain, user.userId);
    return res.status(200).envelope({ provider: 'DAILY', status: 'CONNECTED', source: 'admin', domain: saved.domain, configuredAt: saved.configuredAt }, 'Daily provider verified and saved securely.');
  } catch (err) { return error(res, err); }
});

consultationRouter.get('/direct-calls/patients', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const user = await caller(req);
    if (!doctorRole(user.role) || !user.hospitalId) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only a doctor assigned to a facility can start a direct call.', undefined, 403);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
    const scopedPatients: any[] = await Patient.find({ hospitalId: user.hospitalId }).select('patientId').limit(500).lean();
    const patientIds = [...new Set(scopedPatients.map((patient) => patient.patientId).filter(Boolean))];
    const filter: Record<string, any> = { patientId: { $in: patientIds }, role: 'patient', status: { $in: ['active', null] }, verificationStatus: { $in: ['verified', 'VERIFIED', null] } };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.fullName = { $regex: escaped, $options: 'i' };
    }
    const patients = await User.find(filter).select('patientId fullName').sort({ fullName: 1 }).limit(100).lean();
    return res.envelope({ patients: patients.map((patient: any) => ({ patientId: patient.patientId, name: patient.fullName })) });
  } catch (err) { return error(res, err); }
});

consultationRouter.get('/direct-calls/incoming', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const user = await caller(req);
    if (user.role !== 'patient') return res.status(403).envelopeError('PATIENT_REQUIRED', 'Only patient accounts can view incoming direct calls.', undefined, 403);
    const calls: any[] = await Consultation.find({ patientId: user.patientId, callType: 'DIRECT', status: { $in: ['LINK_SENT', 'WAITING', 'IN_CALL'] }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
    const doctors = await User.find({ userId: { $in: calls.map((call) => call.doctorId) } }).select('userId fullName').lean();
    const doctorNames = new Map(doctors.map((doctor: any) => [doctor.userId, doctor.fullName]));
    return res.envelope({ calls: calls.map((call) => ({ callId: call.consultationId, doctorName: doctorNames.get(call.doctorId) || 'Doctor', status: call.status, expiresAt: call.expiresAt })) });
  } catch (err) { return error(res, err); }
});

consultationRouter.get('/direct-calls/outgoing', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const user = await caller(req);
    if (!doctorRole(user.role)) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only doctor accounts can view outgoing direct calls.', undefined, 403);
    const calls: any[] = await Consultation.find({ doctorId: user.userId, callType: 'DIRECT', status: { $in: ['LINK_SENT', 'WAITING', 'IN_CALL'] }, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
    const patients = await User.find({ patientId: { $in: calls.map((call) => call.patientId) }, role: 'patient' }).select('patientId fullName').lean();
    const patientNames = new Map(patients.map((patient: any) => [patient.patientId, patient.fullName]));
    return res.envelope({ calls: calls.map((call) => ({ callId: call.consultationId, patientId: call.patientId, patientName: patientNames.get(call.patientId) || 'Patient', status: call.status, patientWaiting: Boolean(call.patientWaitingAt), expiresAt: call.expiresAt })) });
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/direct-calls', requireAuth, authorizeCapability('appointment:confirm'), validate({ body: DirectCallSchema }), async (req, res) => {
  try {
    const user = await caller(req);
    if (!doctorRole(user.role) || !user.hospitalId) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only a doctor assigned to a facility can start a direct call.', undefined, 403);
    const replay = await findDirectMutation(req.body.clientMutationId, 'create');
    if (replay) {
      const priorCall = await Consultation.findOne({ consultationId: replay.entityId, callType: 'DIRECT', doctorId: user.userId, hospitalId: user.hospitalId });
      if (!priorCall) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID cannot be replayed for another account.', undefined, 409);
      return res.status(200).envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Replayed direct call request.');
    }
    const patient = await Patient.findOne({ patientId: req.body.patientId, hospitalId: user.hospitalId }).select('patientId').lean();
    const patientAccount = await User.findOne({ patientId: req.body.patientId, role: 'patient', status: { $in: ['active', null] }, verificationStatus: { $in: ['verified', 'VERIFIED', null] } }).select('userId patientId fullName').lean() as any;
    if (!patient || !patientAccount) return res.status(404).envelopeError('PATIENT_NOT_FOUND', 'No verified patient account in your facility matches this selection.', undefined, 404);
    const activeCall = await Consultation.findOne({ doctorId: user.userId, status: { $in: ['LINK_SENT', 'WAITING', 'IN_CALL'] }, expiresAt: { $gt: new Date() } });
    if (activeCall) return res.status(409).envelopeError('DOCTOR_CALL_ACTIVE', 'Finish or wait for the current video call before starting another.', undefined, 409);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const callId = `CALL-${crypto.randomUUID()}`;
    const room = await DailyAdapter.createRoom(Math.floor(expiresAt.getTime() / 1000));
    const call = await Consultation.create({
      consultationId: callId,
      appointmentId: `DIRECT-${callId}`,
      callType: 'DIRECT',
      patientId: patientAccount.patientId,
      doctorId: user.userId,
      hospitalId: user.hospitalId,
      status: 'LINK_SENT',
      roomName: room.name,
      roomUrl: room.url,
      tokenHash: hash(crypto.randomBytes(32).toString('base64url')),
      linkSentAt: now,
      expiresAt,
    });
    const origin = clientOrigin(req);
    const link = `${origin}/#/consultation/direct/${encodeURIComponent(call.consultationId)}`;
    const responsePayload = { callId: call.consultationId, patientId: call.patientId, link, expiresAt, provider: 'DAILY' };
    await saveDirectMutation(req.body.clientMutationId, 'create', call.consultationId, responsePayload);
    await NotificationQueue.enqueue({ recipientId: patientAccount.userId, recipientRole: 'patient', customTitle: 'Incoming video call', customBody: `${user.name} is inviting you to a private video consultation. Join before ${expiresAt.toISOString()}.`, category: 'advisory', priority: 'high', channels: ['in_app'], link, metadata: { consultationId: call.consultationId, callType: 'DIRECT' } });
    return res.status(201).envelope(responsePayload, 'Direct video call invitation sent to the patient inbox.');
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/direct-calls/:callId/join', requireAuth, authorizeCapability('appointment:read'), validate({ body: DirectMutationSchema }), async (req, res) => {
  try {
    const { item, user, doctor, patient } = await authorizedDirectCall(req, req.params.callId);
    if (!['LINK_SENT', 'WAITING', 'IN_CALL'].includes(item.status) || item.expiresAt.getTime() <= Date.now()) return res.status(410).envelopeError('DIRECT_CALL_ENDED', 'This direct video call is no longer available.', undefined, 410);
    if (!item.roomName || !item.roomUrl) return res.status(503).envelopeError('VIDEO_PROVIDER_BLOCKED', 'The live video room is unavailable.', undefined, 503);
    const replay = await findDirectMutation(req.body.clientMutationId, 'join', item.consultationId);
    if (!replay) {
      if (patient && !item.patientWaitingAt) { item.patientWaitingAt = new Date(); item.status = 'WAITING'; await item.save(); }
      await saveDirectMutation(req.body.clientMutationId, 'join', item.consultationId, { callId: item.consultationId, status: item.status });
    }
    const tokenExp = Math.floor((item.startedAt ? Math.min(item.expiresAt.getTime(), item.startedAt.getTime() + 30 * 60_000) : item.expiresAt.getTime()) / 1000);
    const meetingToken = await DailyAdapter.createMeetingToken(item.roomName, user.userId, user.name, tokenExp, doctor);
    return res.envelope({ consultationId: item.consultationId, status: item.status, roomUrl: item.roomUrl, meetingToken, expiresAt: item.expiresAt, startedAt: item.startedAt || null });
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/direct-calls/:callId/reject', requireAuth, authorizeCapability('appointment:read'), validate({ body: DirectMutationSchema }), async (req, res) => {
  try {
    const { item, patient } = await authorizedDirectCall(req, req.params.callId);
    if (!patient) return res.status(403).envelopeError('PATIENT_REQUIRED', 'Only the invited patient can reject this call.', undefined, 403);
    const replay = await findDirectMutation(req.body.clientMutationId, 'reject', item.consultationId);
    if (replay) return res.status(200).envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Replayed direct call rejection.');
    if (!['LINK_SENT', 'WAITING'].includes(item.status)) return res.status(409).envelopeError('DIRECT_CALL_NOT_REJECTABLE', 'This call can no longer be rejected.', undefined, 409);
    item.status = 'CANCELLED'; item.endedAt = new Date(); item.durationSeconds = 0; await item.save();
    if (item.roomName) await DailyAdapter.closeRoom(item.roomName);
    const responsePayload = { status: item.status, endedAt: item.endedAt };
    await saveDirectMutation(req.body.clientMutationId, 'reject', item.consultationId, responsePayload);
    return res.envelope(responsePayload, 'Direct video call declined.');
  } catch (err) { return error(res, err); }
});

consultationRouter.get('/direct-calls/:callId/status', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const { item } = await authorizedDirectCall(req, req.params.callId);
    if (item.status === 'IN_CALL' && item.startedAt && item.startedAt.getTime() + 30 * 60_000 <= Date.now()) await finish(item);
    else if (['LINK_SENT', 'WAITING'].includes(item.status) && item.expiresAt.getTime() <= Date.now()) await finish(item, 'MISSED');
    const fresh: any = await Consultation.findById(item._id);
    return res.envelope({ status: fresh.status, patientWaiting: Boolean(fresh.patientWaitingAt), startedAt: fresh.startedAt || null, expiresAt: fresh.expiresAt });
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/direct-calls/:callId/start', requireAuth, authorizeCapability('appointment:confirm'), validate({ body: DirectMutationSchema }), async (req, res) => {
  try {
    const { item, doctor } = await authorizedDirectCall(req, req.params.callId);
    if (!doctor) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the calling doctor can start this video call.', undefined, 403);
    const replay = await findDirectMutation(req.body.clientMutationId, 'start', item.consultationId);
    if (replay) return res.status(200).envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Replayed direct call start.');
    if (item.status === 'IN_CALL') return res.envelope({ startedAt: item.startedAt, expiresAt: item.expiresAt }, 'Direct video call is already active.');
    if (item.status !== 'WAITING' || !item.patientWaitingAt) return res.status(409).envelopeError('PATIENT_NOT_READY', 'Wait for the patient to answer before starting the call.', undefined, 409);
    const now = new Date();
    item.status = 'IN_CALL'; item.startedAt = now; item.expiresAt = new Date(now.getTime() + 30 * 60_000); await item.save();
    await DailyAdapter.setRoomExpiry(item.roomName, Math.floor(item.expiresAt.getTime() / 1000));
    const responsePayload = { startedAt: item.startedAt, expiresAt: item.expiresAt };
    await saveDirectMutation(req.body.clientMutationId, 'start', item.consultationId, responsePayload);
    return res.envelope(responsePayload, 'Direct video call started.');
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/direct-calls/:callId/end', requireAuth, authorizeCapability('appointment:confirm'), validate({ body: DirectEndSchema }), async (req, res) => {
  try {
    const { item, user, doctor } = await authorizedDirectCall(req, req.params.callId);
    if (!doctor) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the calling doctor can end this video call.', undefined, 403);
    const replay = await findDirectMutation(req.body.clientMutationId, 'end', item.consultationId);
    if (replay) return res.status(200).envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Replayed direct call end.');
    await saveClinicalNote(item.consultationId, user, req.body?.notes || '');
    await finish(item);
    const responsePayload = { status: item.status, endedAt: item.endedAt, durationSeconds: item.durationSeconds };
    await saveDirectMutation(req.body.clientMutationId, 'end', item.consultationId, responsePayload);
    return res.envelope(responsePayload, 'Direct video call ended.');
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/direct-calls/:callId/leave', requireAuth, authorizeCapability('appointment:read'), validate({ body: DirectMutationSchema }), async (req, res) => {
  try {
    const { item } = await authorizedDirectCall(req, req.params.callId);
    const replay = await findDirectMutation(req.body.clientMutationId, 'leave', item.consultationId);
    if (replay) return res.status(200).envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Replayed direct call leave.');
    await finish(item);
    const responsePayload = { status: item.status, endedAt: item.endedAt };
    await saveDirectMutation(req.body.clientMutationId, 'leave', item.consultationId, responsePayload);
    return res.envelope(responsePayload, 'Direct video call ended.');
  } catch (err) { return error(res, err); }
});

consultationRouter.put('/direct-calls/:callId/notes', requireAuth, authorizeCapability('telemedicine:notes'), validate({ body: DirectNotesSchema }), async (req, res) => {
  try {
    const { item, user, doctor } = await authorizedDirectCall(req, req.params.callId);
    if (!doctor) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the calling doctor can record consultation notes.', undefined, 403);
    const replay = await findDirectMutation(req.body.clientMutationId, 'notes', item.consultationId);
    if (replay) return res.status(200).envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Replayed consultation notes.');
    await saveClinicalNote(item.consultationId, user, req.body.notes);
    const responsePayload = { saved: true, immutableVersioned: true };
    await saveDirectMutation(req.body.clientMutationId, 'notes', item.consultationId, responsePayload);
    return res.envelope(responsePayload, 'Consultation notes saved.');
  } catch (err) { return error(res, err); }
});

// Patient's existing appointments and doctor's hospital-scoped appointment list.
consultationRouter.get('/appointments/my', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try { const user = await caller(req); if (user.role !== 'patient') return res.status(403).envelopeError('ROLE_REQUIRED', 'Patient access is required.', undefined, 403);
    const appointments = await Appointment.find({ patientId: user.patientId }).sort({ slotStartTime: -1 }).lean();
    const consultations = await Consultation.find({ patientId: user.patientId }).lean();
    return res.envelope({ appointments: appointments.map((a: any) => { const consultation = consultations.find((c: any) => c.appointmentId === a.appointmentId); return { ...a, consultationStatus: consultation?.status || null, consultationStarted: Boolean(consultation?.startedAt) }; }) });
  } catch (err) { return error(res, err); }
});
const SlotInput = z.object({ startTime: z.string().datetime(), endTime: z.string().datetime().optional(), mutationId: z.string().uuid() });
consultationRouter.get('/doctor/availability', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try { const user = await caller(req); if (!doctorRole(user.role)) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Doctor access required.', undefined, 403);
    return res.envelope({ slots: await DoctorSlot.find({ doctorId: user.userId, startTime: { $gte: new Date() } }).sort({ startTime: 1 }).lean() });
  } catch (err) { return error(res, err); }
});
consultationRouter.post('/doctor/availability', requireAuth, authorizeCapability('appointment:manage'), validate({ body: SlotInput }), async (req, res) => {
  try { const user = await caller(req); const doctor = await User.findOne({ userId: user.userId, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] } });
    if (!doctorRole(user.role) || !doctor || !user.hospitalId) return res.status(403).envelopeError('VERIFIED_DOCTOR_REQUIRED', 'Administrator approval is required to publish slots.', undefined, 403);
    const replay = await DoctorSlot.findOne({ mutationId: req.body.mutationId });
    if (replay) { if (replay.doctorId !== user.userId) return res.status(409).envelopeError('MUTATION_CONFLICT', 'Request ID already used.', undefined, 409); return res.envelope({ slot: replay }); }
    const startTime = new Date(req.body.startTime); const endTime = req.body.endTime ? new Date(req.body.endTime) : new Date(startTime.getTime() + 20 * 60000);
    if (startTime.getTime() <= Date.now() || endTime.getTime() <= startTime.getTime() || endTime.getTime() - startTime.getTime() > 4 * 60 * 60000 || startTime.getUTCSeconds() !== 0 || endTime.getUTCSeconds() !== 0) return res.status(400).envelopeError('INVALID_SLOT', 'Choose a future start and end time, up to four hours long.', undefined, 400);
    const slot = await DoctorSlot.create({ doctorId: user.userId, hospitalId: user.hospitalId, startTime, endTime, mutationId: req.body.mutationId });
    return res.status(201).envelope({ slot });
  } catch (err) { return error(res, err); }
});
consultationRouter.get('/availability/:doctorId', requireAuth, authorizeCapability('appointment:read'), validate({ params: z.object({ doctorId: z.string().min(1).max(100) }), query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) }), async (req, res) => {
  try { const doctor = await User.findOne({ userId: req.params.doctorId, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] }, role: { $in: ['medical_officer', 'specialist_doctor'] } });
    return res.envelope({ slots: doctor ? await availableDoctorSlots(doctor.userId, String(req.query.date)) : [] });
  } catch (err) { return error(res, err); }
});
consultationRouter.get('/doctor/patients/:patientId/records', requireAuth, authorizeCapability('patient:read'), validate({ params: z.object({ patientId: z.string().min(1).max(100) }) }), auditTag('PATIENT_RECORD_ACCESSED', 'patient'), async (req, res) => {
  try { const user = await caller(req); if (!doctorRole(user.role)) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Doctor access required.', undefined, 403);
    const approved = await User.exists({ userId: user.userId, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] } });
    if (!approved) return res.status(403).envelopeError('APPROVAL_REQUIRED', 'Doctor approval required.', undefined, 403);
    const patientId = String(req.params.patientId);
    const patient = await Patient.findOne({ patientId, hospitalId: user.hospitalId }).lean();
    if (!patient || !user.hospitalId) return res.status(404).envelopeError('PATIENT_NOT_FOUND', 'Patient ID not found in your authorized facility.', undefined, 404);
    const [screenings, cases, prescriptions, appointments] = await Promise.all([
      AiScreening.find({ patientId, hospitalId: user.hospitalId }).sort({ createdAt: -1 }).lean(),
      ScreeningCase.find({ patientId, hospitalId: user.hospitalId }).sort({ createdAt: -1 }).lean(),
      Prescription.find({ patientId, hospitalId: user.hospitalId }).sort({ createdAt: -1 }).lean(),
      Appointment.find({ patientId, destinationHospitalId: user.hospitalId }).sort({ slotStartTime: -1 }).lean(),
    ]);
    const consultations = await Consultation.find({ patientId, hospitalId: user.hospitalId }).lean();
    const notes = await ConsultationNote.find({ consultationId: { $in: consultations.map(c => c.consultationId) } }).lean();
    return res.envelope({ patient, screenings, cases, prescriptions, appointments, consultations, notes });
  } catch (err) { return error(res, err); }
});
consultationRouter.get('/availability', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const user = await caller(req);
    if (user.role !== 'patient') return res.status(403).envelopeError('PATIENT_REQUIRED', 'Patient access is required.', undefined, 403);
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T12:00:00`).getTime())) return res.status(400).envelopeError('INVALID_DATE', 'Use a valid YYYY-MM-DD date.', undefined, 400);
    const doctors: any[] = await User.find({ role: { $in: ['medical_officer', 'specialist_doctor'] }, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] }, hospitalId: { $exists: true, $ne: '' } }).select('userId fullName hospitalId verificationDetails').sort({ fullName: 1 }).lean();
    const hospitals: any[] = await Hospital.find({ hospitalId: { $in: doctors.map(d => d.hospitalId) } }).select('hospitalId name').lean();
    const nameById = new Map(hospitals.map(h => [h.hospitalId, h.name]));
    const availableDoctors = (await Promise.all(doctors.map(async d => ({ userId: d.userId, name: d.fullName, hospitalId: d.hospitalId, hospitalName: nameById.get(d.hospitalId) || d.hospitalId, specialization: d.verificationDetails?.specialization, availableSlotsCount: (await availableDoctorSlots(d.userId, date)).filter(s => s.isAvailable).length })))).filter(d => d.availableSlotsCount > 0);
    return res.envelope({ date, doctors: availableDoctors, availableDoctorCount: availableDoctors.length }, 'Verified doctors with free appointment slots retrieved.');
  } catch (err) { return error(res, err); }
});
consultationRouter.get('/doctor/appointments', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const user = await caller(req);
    if (!['medical_officer', 'specialist_doctor'].includes(user.role)) {
      return res.status(403).envelopeError('ROLE_REQUIRED', 'Doctor access is required.', undefined, 403);
    }
    const date = typeof req.query.date === 'string' ? new Date(req.query.date) : new Date();
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const now = new Date();
    const activeConsultations = await Consultation.find({
      hospitalId: user.hospitalId,
      status: { $in: ['WAITING', 'LINK_SENT', 'IN_CALL'] },
      expiresAt: { $gt: now },
      $or: [{ doctorId: user.userId }, { doctorId: '' }],
    }).select('appointmentId status patientWaitingAt expiresAt').lean();
    const activeAppointmentIds = activeConsultations.map((item) => item.appointmentId);
    const appointments = await Appointment.find({ destinationHospitalId: user.hospitalId, assignedDoctorId: user.userId }).sort({ slotStartTime: -1 }).limit(200).lean();

    return res.envelope({
      appointments: appointments.map((appointment: any) => {
        const consultation = activeConsultations.find((item) => item.appointmentId === appointment.appointmentId);
        return {
          ...appointment,
          consultationStatus: consultation?.status || null,
          patientWaiting: consultation?.status === 'WAITING' && Boolean(consultation.patientWaitingAt),
        };
      }),
    });
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/:appointmentId/waiting', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try { const user = await caller(req); if (user.role !== 'patient') return res.status(403).envelopeError('PATIENT_REQUIRED', 'Only the appointment patient can enter the waiting room.', undefined, 403);
    const appointment = await Appointment.findOne({ appointmentId: req.params.appointmentId, patientId: user.patientId });
    if (!appointment) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment not found for this patient.', undefined, 404);
    if (!appointment.assignedDoctorId) return res.status(409).envelopeError('DOCTOR_NOT_ASSIGNED', 'The facility must assign a doctor before the waiting room opens.', undefined, 409);
    if (!['confirmed','rescheduled','checked_in'].includes(appointment.status)) return res.status(409).envelopeError('APPOINTMENT_NOT_CONFIRMED', 'Wait until the doctor confirms this appointment.', undefined, 409);
    if (Date.now() < appointment.slotStartTime.getTime()) return res.status(409).envelopeError('WAITING_ROOM_EARLY', 'The waiting room opens at the appointment time.', undefined, 409);
    let item = await Consultation.findOne({ appointmentId: appointment.appointmentId });
    if (!item) item = await Consultation.create({ consultationId: `CONS-${crypto.randomUUID()}`, appointmentId: appointment.appointmentId, patientId: appointment.patientId, doctorId: appointment.assignedDoctorId || '', hospitalId: appointment.destinationHospitalId, status: 'WAITING', tokenHash: `pending-${crypto.randomBytes(24).toString('hex')}`, linkSentAt: new Date(), expiresAt: new Date(appointment.slotStartTime.getTime()+60*60_000), patientWaitingAt: new Date() });
    else if (!item.patientWaitingAt && !['COMPLETED','MISSED','CANCELLED'].includes(item.status)) { item.patientWaitingAt = new Date(); if (item.status === 'LINK_SENT') item.status = 'WAITING'; await item.save(); }
    return res.envelope({ status: item.status, patientWaiting: true, appointmentId: appointment.appointmentId, linkReceived: !!item.roomUrl }, 'You are in the waiting room. The doctor will share the consultation link when ready.');
  } catch (err) { return error(res, err); }
});

// Doctor issues an appointment-bound link; the raw capability exists only in the returned URL and inbox link.
consultationRouter.post('/:appointmentId/send-link', requireAuth, authorizeCapability('appointment:confirm'), async (req, res) => {
  try {
    const user = await caller(req); const appointment = await Appointment.findOne({ appointmentId: req.params.appointmentId });
    if (!appointment) return res.status(404).envelopeError('APPOINTMENT_NOT_FOUND', 'Appointment not found.', undefined, 404);
    if (!['medical_officer', 'specialist_doctor'].includes(user.role) || user.hospitalId !== appointment.destinationHospitalId || (appointment.assignedDoctorId && appointment.assignedDoctorId !== user.userId)) return res.status(403).envelopeError('DOCTOR_NOT_ASSIGNED', 'Only the assigned doctor at this facility can issue a link.', undefined, 403);
    if (!['confirmed', 'rescheduled', 'checked_in'].includes(appointment.status)) return res.status(409).envelopeError('APPOINTMENT_NOT_CONFIRMED', 'The appointment must be confirmed first.', undefined, 409);
    const previous = await Consultation.findOne({ appointmentId: appointment.appointmentId });
    const patient = await User.findOne({ $or: [{ patientId: appointment.patientId }, { userId: appointment.patientId }], role: 'patient' }).lean() as any;
    if (!patient) return res.status(409).envelopeError('PATIENT_ACCOUNT_MISSING', 'The patient account could not be matched for private link delivery.', undefined, 409);
    const now = new Date();
    if (previous && ['IN_CALL', 'COMPLETED'].includes(previous.status)) return res.status(409).envelopeError('CONSULTATION_ALREADY_USED', 'This appointment consultation link has already been used.', undefined, 409);
    if (previous?.status === 'LINK_SENT' && previous.expiresAt.getTime() > now.getTime()) return res.status(409).envelopeError('CONSULTATION_LINK_ALREADY_SENT', 'A valid private link has already been sent for this appointment.', undefined, 409);
    const expiresAt = new Date(now.getTime() + 60 * 60_000); const raw = crypto.randomBytes(32).toString('base64url');
    const room = await DailyAdapter.createRoom(Math.floor(expiresAt.getTime()/1000));
    if (previous?.roomName) await DailyAdapter.closeRoom(previous.roomName);
    const consult = await Consultation.findOneAndUpdate({ appointmentId: appointment.appointmentId }, { $set: { consultationId: `CONS-${crypto.randomUUID()}`, appointmentId: appointment.appointmentId, patientId: appointment.patientId, doctorId: user.userId, hospitalId: appointment.destinationHospitalId, status: 'LINK_SENT', roomName: room.name, roomUrl: room.url, tokenHash: hash(raw), linkSentAt: now, expiresAt, startedAt: undefined, endedAt: undefined } }, { upsert: true, new: true, runValidators: true });
    const origin = clientOrigin(req); const link = `${origin}/#/consultation/join/${encodeURIComponent(raw)}`;
    await NotificationQueue.enqueue({ recipientId: patient.userId, recipientRole: 'patient', customTitle: 'Video consultation link', customBody: `Your doctor shared a consultation link. It expires ${expiresAt.toISOString()}.`, category: 'advisory', channels: ['in_app', 'sms', 'email'], link, metadata: { appointmentId: appointment.appointmentId, consultationId: consult.consultationId } });
    return res.status(201).envelope({ consultationId: consult.consultationId, appointmentId: appointment.appointmentId, link, expiresAt, status: consult.status, videoStatus: 'DAILY_CONFIGURED', externalNotifications: 'SMS/email adapters remain blocked by simulation policy' }, 'Private Daily consultation link sent to the patient inbox.');
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/join/:token', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const user = await caller(req); const tokenHash = hash(req.params.token); const item: any = await Consultation.findOne({ tokenHash });
    if (!item || item.expiresAt.getTime() <= Date.now() || item.status === 'COMPLETED' || item.status === 'CANCELLED' || item.status === 'MISSED') return res.status(410).envelopeError('CONSULTATION_LINK_EXPIRED', 'This consultation link is unavailable or expired.', undefined, 410);
    const doctor = ['medical_officer','specialist_doctor'].includes(user.role) && item.doctorId === user.userId && item.hospitalId === user.hospitalId;
    const patient = user.role === 'patient' && item.patientId === user.patientId;
    if (!doctor && !patient) return res.status(403).envelopeError('CONSULTATION_ACCESS_DENIED', 'Only the assigned patient and doctor can join.', undefined, 403);
    if (!item.roomName || !item.roomUrl) return res.status(503).envelopeError('VIDEO_PROVIDER_BLOCKED', 'Video room is unavailable.', undefined, 503);
    if (patient && !item.patientWaitingAt) { item.patientWaitingAt = new Date(); if (item.status === 'LINK_SENT') item.status = 'WAITING'; await item.save(); }
    if (item.status === 'IN_CALL' && item.startedAt && item.startedAt.getTime() + 30*60_000 <= Date.now()) { await finish(item); return res.status(410).envelopeError('CONSULTATION_ENDED', 'The 30-minute consultation has ended.', undefined, 410); }
    const tokenExp = Math.floor((item.startedAt ? Math.min(item.expiresAt.getTime(), item.startedAt.getTime() + 30*60_000) : item.expiresAt.getTime())/1000);
    const meetingToken = await DailyAdapter.createMeetingToken(item.roomName, user.userId, user.name, tokenExp, doctor);
    return res.envelope({ consultationId: item.consultationId, appointmentId: item.appointmentId, status: item.status, roomUrl: item.roomUrl, meetingToken, expiresAt: item.expiresAt, startedAt: item.startedAt || null, maxDurationSeconds: 1800 });
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/:appointmentId/doctor-join', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try {
    const { item, user, doctor } = await authorizedConsultation(req, req.params.appointmentId);
    if (!doctor) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the assigned doctor can join this consultation.', undefined, 403);
    if (!['LINK_SENT', 'WAITING', 'IN_CALL'].includes(item.status) || item.expiresAt.getTime() <= Date.now()) return res.status(410).envelopeError('CONSULTATION_LINK_EXPIRED', 'This consultation is no longer available.', undefined, 410);
    if (!item.patientWaitingAt) return res.status(409).envelopeError('PATIENT_NOT_READY', 'The patient must open the private video link before the doctor joins.', undefined, 409);
    if (!item.roomName || !item.roomUrl) return res.status(503).envelopeError('VIDEO_PROVIDER_BLOCKED', 'Video room is unavailable.', undefined, 503);
    const tokenExp = Math.floor((item.startedAt ? Math.min(item.expiresAt.getTime(), item.startedAt.getTime() + 30 * 60_000) : item.expiresAt.getTime()) / 1000);
    const meetingToken = await DailyAdapter.createMeetingToken(item.roomName, user.userId, user.name, tokenExp, true);
    return res.envelope({ consultationId: item.consultationId, appointmentId: item.appointmentId, status: item.status, roomUrl: item.roomUrl, meetingToken, expiresAt: item.expiresAt, startedAt: item.startedAt || null, maxDurationSeconds: 1800 });
  } catch (err) { return error(res, err); }
});

consultationRouter.get('/:appointmentId/status', requireAuth, authorizeCapability('appointment:read'), async (req, res) => {
  try { const { item } = await authorizedConsultation(req, req.params.appointmentId);
    if (item.status === 'LINK_SENT' || item.status === 'WAITING') { if (item.expiresAt.getTime() <= Date.now()) await finish(item, 'MISSED'); }
    if (item.status === 'IN_CALL' && item.startedAt && item.startedAt.getTime()+1800_000 <= Date.now()) await finish(item);
    const fresh: any = await Consultation.findById(item._id); const now = Date.now();
    return res.envelope({ consultationId: fresh.consultationId, appointmentId: fresh.appointmentId, status: fresh.status, patientWaiting: !!fresh.patientWaitingAt, linkSentAt: fresh.linkSentAt, startedAt: fresh.startedAt || null, expiresAt: fresh.expiresAt, remainingSeconds: fresh.startedAt ? Math.max(0, 1800-Math.floor((now-fresh.startedAt.getTime())/1000)) : null });
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/:appointmentId/start', requireAuth, authorizeCapability('appointment:confirm'), async (req, res) => {
  try { const { item, doctor } = await authorizedConsultation(req, req.params.appointmentId); if (!doctor) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the assigned doctor can start the call.', undefined, 403);
    if (item.status === 'IN_CALL') return res.envelope({ startedAt: item.startedAt, expiresAt: item.expiresAt, maxDurationSeconds: 1800 }, 'Consultation timer is already running.');
    if (item.status !== 'WAITING' && item.status !== 'LINK_SENT') return res.status(409).envelopeError('CONSULTATION_NOT_READY', 'This consultation is no longer available.', undefined, 409);
    if (item.expiresAt.getTime() <= Date.now()) { await finish(item, 'MISSED'); return res.status(410).envelopeError('CONSULTATION_LINK_EXPIRED', 'The consultation link has expired.', undefined, 410); }
    const now = new Date(); const end = new Date(now.getTime()+1800_000);
    item.status = 'IN_CALL'; item.startedAt = now; item.expiresAt = end; await item.save();
    await DailyAdapter.setRoomExpiry(item.roomName, Math.floor(end.getTime()/1000));
    return res.envelope({ startedAt: now, expiresAt: end, maxDurationSeconds: 1800 }, 'Consultation started; the server timer is active.');
  } catch (err) { return error(res, err); }
});

consultationRouter.post('/:appointmentId/end', requireAuth, authorizeCapability('appointment:confirm'), validate({ body: EndSchema }), async (req, res) => {
  try { const { item, doctor } = await authorizedConsultation(req, req.params.appointmentId); if (!doctor) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the assigned doctor can end the consultation.', undefined, 403);
    const user = await caller(req); const mutationId = req.body?.clientMutationId;
    if (mutationId) {
      const replay: any = await SyncLedger.findOne({ clientMutationId: mutationId }).lean();
      if (replay) {
        if (replay.entityType !== 'appointment-consultation:end' || replay.entityId !== item.appointmentId || replay.responsePayload?.doctorId !== user.userId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID is already attached to another action.', undefined, 409);
        return res.envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Consultation end replayed.');
      }
    }
    await saveClinicalNote(item.consultationId, user, req.body?.notes || '');
    await finish(item);
    const responsePayload = { status: item.status, endedAt: item.endedAt, durationSeconds: item.durationSeconds, doctorId: user.userId };
    if (mutationId) await SyncLedger.create({ clientMutationId: mutationId, entityType: 'appointment-consultation:end', entityId: item.appointmentId, responsePayload, simulation: true });
    return res.envelope(responsePayload, 'Consultation ended.');
  } catch (err) { return error(res, err); }
});

consultationRouter.put('/:appointmentId/notes', requireAuth, authorizeCapability('telemedicine:notes'), validate({ body: NoteSchema }), async (req, res) => {
  try { const { item, doctor, user } = await authorizedConsultation(req, req.params.appointmentId); if (!doctor) return res.status(403).envelopeError('DOCTOR_REQUIRED', 'Only the assigned doctor can record consultation notes.', undefined, 403);
    const mutationId = req.body.clientMutationId;
    if (mutationId) {
      const replay: any = await SyncLedger.findOne({ clientMutationId: mutationId }).lean();
      if (replay) {
        if (replay.entityType !== 'consultation-note' || replay.entityId !== item.consultationId || replay.responsePayload?.clinicianId !== user.userId) return res.status(409).envelopeError('MUTATION_ID_REUSED', 'This mutation ID is already attached to another action.', undefined, 409);
        return res.envelope({ ...replay.responsePayload, idempotentReplay: true }, 'Clinical note save replayed.');
      }
    }
    const text = req.body.notes; await saveClinicalNote(item.consultationId, user, text);
    const responsePayload = { saved: true, immutableVersioned: true, clinicianId: user.userId };
    if (mutationId) await SyncLedger.create({ clientMutationId: mutationId, entityType: 'consultation-note', entityId: item.consultationId, responsePayload, simulation: true });
    return res.envelope({ saved: true, immutableVersioned: true }, 'Consultation notes saved.');
  } catch (err) { return error(res, err); }
});
