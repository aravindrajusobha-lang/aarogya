import { ConsultationChat } from './consultationChatModel.js';
import type { Server as HttpServer } from 'node:http';
import crypto from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../auth/tokenService.js';
import { isDeviceSessionActive } from '../auth/deviceService.js';
import { User } from '../auth/userModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { Consultation } from './consultationModel.js';

type Participant = { userId: string; role: string; hospitalId?: string; patientId?: string };
type SignalPayload = { type: 'offer' | 'answer' | 'ice-candidate'; data: Record<string, unknown> };

const rooms = new Map<string, Set<string>>();
const doctorRoles = new Set(['medical_officer', 'specialist_doctor']);
const activeStatuses = new Set(['confirmed', 'rescheduled', 'checked_in']);
const roomForAppointment = (appointmentId: string) => `appointment:${appointmentId}`;

function configuredIceServers() {
  const stunUrls = (process.env.STUN_URLS || 'stun:stun.l.google.com:19302')
    .split(',').map((url) => url.trim()).filter(Boolean);
  const iceServers: Array<Record<string, unknown>> = stunUrls.map((urls) => ({ urls }));
  const turnUrl = process.env.TURN_URL?.trim();
  const turnUsername = process.env.TURN_USERNAME?.trim();
  const turnCredential = process.env.TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }
  return iceServers;
}

async function authenticateSocket(socket: Socket) {
  const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
  if (!token || token.startsWith('sim_user_')) throw new Error('A verified patient or doctor sign-in is required for a live call.');
  const payload = verifyAccessToken(token);
  if (payload.type !== 'access') throw new Error('This session cannot enter a consultation.');
  if (payload.deviceSessionId && !(await isDeviceSessionActive(payload.deviceSessionId))) throw new Error('This device session has been revoked.');
  const user = await User.findOne({ userId: payload.sub })
    .select('userId role hospitalId patientId status verificationStatus')
    .lean() as any;
  if (!user || user.status !== 'active' || (doctorRoles.has(user.role) && !['verified', 'VERIFIED'].includes(user.verificationStatus))) throw new Error('This account is unavailable for a consultation.');
  if (user.role !== 'patient' && !doctorRoles.has(user.role)) throw new Error('This account cannot enter a consultation.');
  return { userId: user.userId, role: user.role, hospitalId: user.hospitalId, patientId: user.patientId } satisfies Participant;
}

async function authorizeAppointment(participant: Participant, appointmentId: string) {
  const appointment: any = await Appointment.findOne({ appointmentId }).lean();
  if (!appointment) throw new Error('Appointment not found.');
  if (appointment.consultationMode !== 'online') throw new Error('Live call is available only for online appointments.');
  if (!activeStatuses.has(String(appointment.status).toLowerCase())) throw new Error('The doctor must confirm this appointment before the room opens.');
  if (participant.role === 'patient') {
    if (![participant.userId, participant.patientId].filter(Boolean).includes(appointment.patientId)) throw new Error('This appointment is not assigned to your patient account.');
  } else if (!doctorRoles.has(participant.role) || participant.hospitalId !== appointment.destinationHospitalId || appointment.assignedDoctorId !== participant.userId) {
    throw new Error('Only the doctor assigned to this appointment can enter the room.');
  }
  const now = Date.now();
  const opensAt = new Date(appointment.slotStartTime).getTime() - 15 * 60_000;
  const closesAt = new Date(appointment.slotEndTime).getTime() + 60 * 60_000;
  if (now < opensAt) throw new Error('The consultation room opens 15 minutes before the appointment.');
  if (now > closesAt) throw new Error('The consultation room time window has ended.');
  return appointment;
}

async function removeFromRoom(io: Server, socket: Socket) {
  const roomId = socket.data.roomId as string | undefined;
  if (!roomId) return;
  const members = rooms.get(roomId);
  members?.delete(socket.id);
  socket.to(roomId).emit('consultation:participant-left');
  if (!members?.size) rooms.delete(roomId);
  await socket.leave(roomId);
  delete socket.data.roomId;
  delete socket.data.appointmentId;
}

export function attachConsultationSocket(httpServer: HttpServer, allowedOrigins: string[]) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
    maxHttpBufferSize: 100_000,
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      socket.data.participant = await authenticateSocket(socket);
      next();
    } catch (error) {
      next(new Error(error instanceof Error ? error.message : 'Consultation authentication failed.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('consultation:join', async (payload: { appointmentId?: string }) => {
      try {
        const appointmentId = typeof payload?.appointmentId === 'string' ? payload.appointmentId.trim() : '';
        if (!appointmentId || appointmentId.length > 100) throw new Error('A valid appointment ID is required.');
        const participant = socket.data.participant as Participant;
        const appointment = await authorizeAppointment(participant, appointmentId);
        let consultation: any = await Consultation.findOne({ appointmentId });
        if (consultation && ['COMPLETED', 'MISSED', 'CANCELLED'].includes(consultation.status)) throw new Error('This appointment consultation has already ended.');
        if (participant.role === 'patient' && !consultation?.startedAt) throw new Error('The doctor has not started this consultation yet. Please try joining when the doctor is ready.');
        if (!consultation) {
          consultation = await Consultation.create({
            consultationId: `WEBRTC-${crypto.randomUUID()}`,
            appointmentId,
            callType: 'APPOINTMENT',
            patientId: appointment.patientId,
            doctorId: appointment.assignedDoctorId,
            hospitalId: appointment.destinationHospitalId,
            status: 'WAITING',
            tokenHash: crypto.randomBytes(32).toString('hex'),
            linkSentAt: new Date(),
            expiresAt: new Date(new Date(appointment.slotEndTime).getTime() + 60 * 60_000),
          });
        }
        if (doctorRoles.has(participant.role) && !consultation.startedAt) { consultation.startedAt = new Date(); await consultation.save(); }
        if (participant.role === 'patient' && !consultation.patientWaitingAt) {
          consultation.patientWaitingAt = new Date();
          await consultation.save();
        }
        const roomId = roomForAppointment(appointmentId);
        const members = rooms.get(roomId) || new Set<string>();
        const existing = [...members].map((id) => io.sockets.sockets.get(id)).filter(Boolean) as Socket[];
        if (existing.some((other) => (other.data.participant as Participant).role === participant.role && other.id !== socket.id)) {
          throw new Error('A participant with your role is already in this consultation.');
        }
        if (members.size >= 2 && !members.has(socket.id)) throw new Error('This consultation already has both participants.');

        await removeFromRoom(io, socket);
        members.add(socket.id);
        rooms.set(roomId, members);
        socket.data.roomId = roomId;
        socket.data.appointmentId = appointmentId;
        await socket.join(roomId);
        await AuditLog.create({ action: 'consultation.webrtc.joined', resourceType: 'appointment', resourceId: appointmentId, actorId: participant.userId, actorRole: participant.role, ip: socket.handshake.address || '127.0.0.1', statusCode: 200, metadata: { consultationMode: appointment.consultationMode }, simulation: true });
        socket.emit('consultation:joined', { appointmentId, patientId: appointment.patientId, patientName: appointment.patientName, doctorName: appointment.assignedDoctorName, consultationId: consultation.consultationId, role: participant.role, peerPresent: members.size === 2, iceServers: configuredIceServers() });
        socket.emit('consultation:chat-history', (await ConsultationChat.find({ appointmentId }).sort({ createdAt: -1 }).limit(100).lean()).reverse());
        if (members.size === 2) {
          consultation.status = 'IN_CALL';
          consultation.startedAt = consultation.startedAt || new Date();
          await consultation.save();
          socket.to(roomId).emit('consultation:participant-ready', { role: participant.role });
        }
      } catch (error) {
        socket.emit('consultation:error', { message: error instanceof Error ? error.message : 'Could not join consultation.' });
      }
    });

    socket.on('consultation:chat', async (payload: { messageId?: string; text?: string }) => {
      try {
        const appointmentId = socket.data.appointmentId as string;
        const participant = socket.data.participant as Participant;
        if (!appointmentId || !socket.data.roomId) throw new Error('Join the consultation before sending a message.');
        await authorizeAppointment(await authenticateSocket(socket), appointmentId);
        const consultation = await Consultation.findOne({ appointmentId });
        if (!consultation || ['COMPLETED', 'CANCELLED', 'MISSED'].includes(consultation.status)) throw new Error('This consultation has ended.');
        if (typeof payload?.text !== 'string' || !payload.text.trim() || payload.text.length > 2000 || !/^[0-9a-f-]{36}$/i.test(payload.messageId || '')) throw new Error('A message and valid request ID are required.');
        const prior = await ConsultationChat.findOne({ messageId: payload.messageId });
        if (prior) { if (prior.appointmentId === appointmentId && prior.senderId === participant.userId) socket.emit('consultation:chat-message', prior); return; }
        const text = payload.text.trim();
        const message = await ConsultationChat.create({ messageId: payload.messageId, appointmentId, senderId: participant.userId, role: participant.role, text, sha256: crypto.createHash('sha256').update(text).digest('hex') });
        io.to(socket.data.roomId).emit('consultation:chat-message', message);
      } catch (err) { socket.emit('consultation:error', { message: err instanceof Error ? err.message : 'Message could not be sent.' }); }
    });

    socket.on('webrtc:signal', (payload: SignalPayload) => {
      const roomId = socket.data.roomId as string | undefined;
      if (!roomId || !payload || !['offer', 'answer', 'ice-candidate'].includes(payload.type) || !payload.data || typeof payload.data !== 'object') return;
      if (JSON.stringify(payload.data).length > 80_000) return;
      socket.to(roomId).emit('webrtc:signal', { type: payload.type, data: payload.data });
    });

    socket.on('consultation:leave', async () => { await removeFromRoom(io, socket); });
    socket.on('disconnect', async () => { await removeFromRoom(io, socket); });
  });

  return io;
}
