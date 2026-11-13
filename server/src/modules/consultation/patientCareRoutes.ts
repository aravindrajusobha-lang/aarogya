import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { User } from '../auth/userModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { SyncLedger } from '../patient/syncLedgerModel.js';
import { CareTransfer, PatientCare } from './patientCareModel.js';
import { currentCare, patientIdentity } from './patientCareService.js';
import { runInTransaction } from '../../utils/transaction.js';

export const patientCareRouter = Router();
const Params = z.object({ patientId: z.string().trim().min(1).max(100) });
const Mutation = z.object({ mutationId: z.string().uuid() });
class CareError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
patientCareRouter.use(requireAuth, authorizeCapability('patient:read'), async (req, res, next) => {
  try {
    const doctor: any = await User.findOne({ userId: req.user!.id, role: { $in: ['medical_officer', 'specialist_doctor'] }, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] } }).lean();
    if (!doctor?.hospitalId) { res.envelopeError('DOCTOR_REQUIRED', 'An active verified doctor is required.', undefined, 403); return; }
    res.locals.doctor = doctor; res.setHeader('Cache-Control', 'private, no-store'); next();
  } catch (err) { next(err); }
});

patientCareRouter.get('/', async (_req, res, next) => {
  try {
    const doctorId = res.locals.doctor.userId;
    const [booked, assigned, transfers] = await Promise.all([
      Appointment.find({ assignedDoctorId: doctorId }).sort({ slotStartTime: -1 }).select('patientId patientName consultationMode status slotStartTime').lean(),
      PatientCare.find({ doctorId }).lean(),
      CareTransfer.find({ $or: [{ fromDoctorId: doctorId }, { toDoctorId: doctorId }] }).sort({ createdAt: -1 }).lean(),
    ]);
    const ids = [...new Set([...booked.map(a => a.patientId), ...assigned.map(a => a.patientId)])];
    const patients = await Promise.all(ids.map(async patientId => {
      const [patient, care] = await Promise.all([patientIdentity(patientId), currentCare(patientId)]);
      return { patientId, fullName: patient?.fullName || booked.find(a => a.patientId === patientId)?.patientName || patientId, currentDoctorId: care?.doctorId || null, appointments: booked.filter(a => a.patientId === patientId) };
    }));
    const doctors = await User.find({ userId: { $in: [...new Set(transfers.flatMap(r => [r.fromDoctorId, r.toDoctorId]))] } }).select('userId fullName').lean();
    res.envelope({ patients, transfers: transfers.map(r => ({ ...r, fromDoctorName: doctors.find(d => d.userId === r.fromDoctorId)?.fullName, toDoctorName: doctors.find(d => d.userId === r.toDoctorId)?.fullName, incoming: r.fromDoctorId === doctorId })) });
  } catch (err) { next(err); }
});

patientCareRouter.get('/:patientId', validate({ params: Params }), async (req, res, next) => {
  try {
    const patient = await patientIdentity(req.params.patientId);
    if (!patient) { res.envelopeError('PATIENT_NOT_FOUND', 'No patient was found with this patient ID.', undefined, 404); return; }
    const care = await currentCare(req.params.patientId);
    const doctor = care ? await User.findOne({ userId: care.doctorId }).select('userId fullName').lean() : null;
    const pending = await CareTransfer.findOne({ patientId: req.params.patientId, toDoctorId: req.user!.id, status: 'pending' }).lean();
    await AuditLog.create({ action: 'PATIENT_CARE_LOOKUP', actorId: req.user!.id, actorRole: req.user!.role, resourceType: 'patient', resourceId: req.params.patientId, ip: req.ip || '127.0.0.1', statusCode: 200, simulation: true });
    res.envelope({ patient, doctor, canTreat: care?.doctorId === req.user!.id, pending: Boolean(pending) });
  } catch (err) { next(err); }
});

// Uses a transaction on Atlas/replica sets and a single-document-safe development path locally.
patientCareRouter.post('/:patientId/:action', authorizeCapability('screening:create'), validate({ params: Params.extend({ action: z.enum(['claim', 'request', 'approve', 'reject']) }), body: Mutation.extend({ requestId: z.string().uuid().optional() }) }), async (req, res, next) => {
  try {
    const { patientId, action } = req.params;
    const actorId = req.user!.id;
    const fingerprint = crypto.createHash('sha256').update(JSON.stringify([actorId, patientId, action, req.body.requestId || null])).digest('hex');
    let result: any;
    await runInTransaction(async (session) => {
      const ledger = await SyncLedger.findOne({ clientMutationId: req.body.mutationId }).session(session as any);
      if (ledger) {
        if (ledger.entityType !== 'patient_care' || ledger.responsePayload.fingerprint !== fingerprint) throw new CareError(409, 'MUTATION_CONFLICT', 'This mutation ID belongs to another operation.');
        result = ledger.responsePayload.result; return;
      }
      if (!(await patientIdentity(patientId, session || null))) throw new CareError(404, 'PATIENT_NOT_FOUND', 'No patient was found with this patient ID.');
      let care = await currentCare(patientId, session || null);
      if (!care && action !== 'claim') throw new CareError(409, 'NO_TREATING_DOCTOR', 'This patient has no treating doctor yet.');
      if (action === 'claim') {
        if (care && care.doctorId !== actorId) throw new CareError(409, 'TRANSFER_REQUIRED', 'Request approval from the current treating doctor.');
        if (!care || care.version === 0) await PatientCare.create([{ patientId, doctorId: actorId, version: 1 }], session ? { session } : {});
        result = { status: 'assigned', patientId, doctorId: actorId };
      } else if (action === 'request') {
        if (care!.doctorId === actorId) throw new CareError(409, 'ALREADY_TREATING', 'You are already the treating doctor.');
        if (care!.version === 0) { await PatientCare.create([{ patientId, doctorId: care!.doctorId, version: 1 }], session ? { session } : {}); care = { ...care!, version: 1 }; }
        const existing = await CareTransfer.findOne({ patientId, toDoctorId: actorId, status: 'pending' }).session(session as any).lean();
        const created = existing || (await CareTransfer.create([{ requestId: crypto.randomUUID(), patientId, fromDoctorId: care!.doctorId, toDoctorId: actorId, assignmentVersion: care!.version }], { session }))[0].toObject();
        result = { status: 'pending', requestId: created.requestId, patientId };
      } else {
        const transfer = await CareTransfer.findOne({ requestId: req.body.requestId || '', patientId, status: 'pending', fromDoctorId: actorId }).session(session as any);
        if (!transfer) throw new CareError(403, 'APPROVER_REQUIRED', 'Only the current treating doctor may decide this request.');
        if (care!.doctorId !== actorId || care!.version !== transfer.assignmentVersion) throw new CareError(409, 'STALE_TRANSFER', 'The treating doctor has changed. Send a new request.');
        if (action === 'approve') {
          const target = await User.findOne({ userId: transfer.toDoctorId, role: { $in: ['medical_officer', 'specialist_doctor'] }, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] }, hospitalId: { $nin: ['', null] } }).session(session as any);
          if (!target) throw new CareError(409, 'DOCTOR_UNAVAILABLE', 'The receiving doctor must be active and verified.');
          const updated = await PatientCare.updateOne({ patientId, doctorId: actorId, version: transfer.assignmentVersion }, { $set: { doctorId: transfer.toDoctorId }, $inc: { version: 1 } }, { session: session || undefined });
          if (updated.modifiedCount !== 1) throw new CareError(409, 'STALE_TRANSFER', 'The treating doctor has changed.');
          await CareTransfer.updateMany({ patientId, status: 'pending', requestId: { $ne: transfer.requestId } }, { $set: { status: 'superseded', decidedAt: new Date() } }, { session: session || undefined });
        }
        transfer.status = action === 'approve' ? 'approved' : 'rejected'; transfer.decidedAt = new Date(); await transfer.save({ session: session || undefined });
        result = { status: transfer.status, patientId, requestId: transfer.requestId };
      }
      await AuditLog.create([{ action: `PATIENT_CARE_${action.toUpperCase()}`, actorId, actorRole: req.user!.role, resourceType: 'patient', resourceId: patientId, ip: req.ip || '127.0.0.1', statusCode: 200, metadata: result, simulation: true }], session ? { session } : {});
      await SyncLedger.create([{ clientMutationId: req.body.mutationId, entityType: 'patient_care', entityId: patientId, responsePayload: { fingerprint, result, statusCode: 200 } }], session ? { session } : {});
    });
    res.envelope(result);
  } catch (err) {
    if (err instanceof CareError) res.envelopeError(err.code, err.message, undefined, err.status);
    else if ((err as any)?.code === 11000) res.envelopeError('CARE_CONFLICT', 'Care changed concurrently. Refresh and retry.', undefined, 409);
    else next(err);
  }
});
