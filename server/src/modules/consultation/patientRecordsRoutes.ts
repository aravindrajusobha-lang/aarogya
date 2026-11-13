import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { User } from '../auth/userModel.js';
import { Patient } from '../patient/patientModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { AiScreening } from '../ai/aiScreeningModel.js';
import { buildPatientScreeningSummary } from '../ai/patientScreeningSummary.js';
import { ScreeningCase } from '../screening/screeningCaseModel.js';
import { Prescription } from '../prescription/prescriptionModel.js';
import { ConsultationNote } from '../teleconsultation/teleconsultationModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { StoredFile } from '../storage/storageModel.js';
import { readStoredFileBuffer } from '../storage/storageService.js';
import { Consultation } from './consultationModel.js';
import { ConsultationCapture } from './consultationCaptureModel.js';
import { sessionView } from './consultationRoutes.js';

/**
 * Explicit project-owner exception: active verified doctors may read records across
 * facilities by exact patient ID. This exception applies only to these GET routes;
 * write permissions and appointment assignment checks remain independently enforced.
 * Every lookup and every file view is audit-logged and shown in the patient's access history.
 */
export const patientRecordsRouter = Router();

const DOCTOR_ROLES = new Set(['medical_officer', 'specialist_doctor']);
const PatientParams = z.object({ patientId: z.string().trim().min(1).max(100) });
const FileParams = PatientParams.extend({ fileId: z.string().trim().min(3).max(100) });

type Access = { allowed: boolean; ownFacility: boolean; consentedShare: boolean; canPrescribe: boolean; reason: string };

async function resolveAccess(doctor: any, patientId: string): Promise<Access> {
  const [facilityPatient, patientUser, appointments] = await Promise.all([
    Patient.findOne({ patientId }).select('patientId hospitalId').lean(),
    User.findOne({ patientId, role: 'patient' }).select('hospitalId').lean() as any,
    Appointment.find({ patientId, assignedDoctorId: doctor.userId, status: { $nin: ['declined'] } }).select('consentGiven visitDetails').lean(),
  ]);
  const ownFacility = facilityPatient?.hospitalId === doctor.hospitalId || Boolean(patientUser?.hospitalId && patientUser.hospitalId === doctor.hospitalId);
  const consentedShare = (appointments as any[]).some((a) => a.consentGiven === true || a.visitDetails?.shareProfile === true || a.visitDetails?.shareReport === true || a.visitDetails?.patientSharingConsent?.granted === true);
  const booked = appointments.length > 0;
  const allowed = Boolean(facilityPatient || patientUser);
  return { allowed, ownFacility, consentedShare, canPrescribe: false, reason: ownFacility ? 'facility_patient' : booked ? (consentedShare ? 'appointment_shared' : 'appointment') : allowed ? 'verified_doctor_lookup' : 'none' };
}

async function verifiedDoctor(req: Request, res: Response) {
  if (!DOCTOR_ROLES.has(req.user!.role)) { res.status(403).envelopeError('DOCTOR_REQUIRED', 'Doctor access is required.', undefined, 403); return null; }
  const doctor: any = await User.findOne({ userId: req.user!.id, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] } }).select('userId fullName hospitalId role').lean();
  if (!doctor?.hospitalId) { res.status(403).envelopeError('APPROVAL_REQUIRED', 'An administrator must verify your account first.', undefined, 403); return null; }
  return doctor;
}

/** All facility records for the exact patient are readable through this verified-doctor endpoint. */
patientRecordsRouter.get('/:patientId', requireAuth, authorizeCapability('patient:read'), validate({ params: PatientParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await verifiedDoctor(req, res); if (!doctor) return;
    const patientId = req.params.patientId;
    const access = await resolveAccess(doctor, patientId);
    if (!access.allowed) {
      await AuditLog.create({ action: 'PATIENT_RECORD_ACCESS_DENIED', resourceType: 'patient', resourceId: patientId, actorId: doctor.userId, actorRole: doctor.role, ip: req.ip || '127.0.0.1', statusCode: 404, simulation: true });
      res.status(404).envelopeError('PATIENT_NOT_FOUND', 'No patient was found with this patient ID.', undefined, 404);
      return;
    }

    const [facilityPatient, patientUser] = await Promise.all([
      Patient.findOne({ patientId }).lean() as any,
      User.findOne({ patientId, role: 'patient' }).select('userId fullName phone gender yearOfBirth village mandal address hospitalId createdAt').lean() as any,
    ]);
    const [screenings, cases, prescriptions, appointments, consultations, captures] = await Promise.all([
      AiScreening.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean(),
      ScreeningCase.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean(),
      Prescription.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean(),
      Appointment.find({ patientId }).sort({ slotStartTime: -1 }).limit(100).lean(),
      Consultation.find({ patientId, callType: { $ne: 'DIRECT' } }).sort({ startedAt: -1 }).lean(),
      ConsultationCapture.find({ patientId }).sort({ createdAt: -1 }).limit(100).lean(),
    ]);
    const notes = await ConsultationNote.find({ consultationId: { $in: (consultations as any[]).map((c) => c.consultationId) } }).lean();

    await AuditLog.create({ action: 'PATIENT_RECORD_ACCESSED', resourceType: 'patient', resourceId: patientId, actorId: doctor.userId, actorRole: doctor.role, ip: req.ip || '127.0.0.1', statusCode: 200, metadata: { reason: access.reason }, simulation: true });

    // Who has looked at / worked on this patient's records.
    const rawViews: any[] = await AuditLog.find({ resourceType: 'patient', resourceId: patientId, action: 'PATIENT_RECORD_ACCESSED' }).sort({ timestamp: -1 }).limit(200).lean();
    // Collapse repeat views by the same person within 30 minutes into one entry (the full log stays in the audit trail).
    const views: any[] = [];
    for (const view of rawViews) {
      const previous = views.find((v) => v.actorId === view.actorId);
      if (previous && new Date(previous.timestamp).getTime() - new Date(view.timestamp).getTime() < 30 * 60_000) continue;
      views.push(view);
      if (views.length >= 40) break;
    }
    const actorIds = [...new Set([...views.map((v) => v.actorId), ...(consultations as any[]).map((c) => c.doctorId)].filter(Boolean))];
    const actors: any[] = await User.find({ userId: { $in: actorIds } }).select('userId fullName role doctorCode').lean();
    const actorName = new Map(actors.map((a) => [a.userId, { name: a.fullName, role: a.role, doctorCode: a.doctorCode || null }]));
    const activity = [
      ...views.map((v) => ({ type: 'viewed', at: v.timestamp || v.createdAt, by: actorName.get(v.actorId)?.name || v.actorId, role: actorName.get(v.actorId)?.role || v.actorRole, doctorCode: actorName.get(v.actorId)?.doctorCode || null })),
      ...(prescriptions as any[]).map((p) => ({ type: 'prescribed', at: p.createdAt, by: p.doctorName, role: 'doctor', doctorCode: null, reference: p.prescriptionId })),
      ...(consultations as any[]).filter((c) => c.startedAt).map((c) => ({ type: 'consulted', at: c.startedAt, by: actorName.get(c.doctorId)?.name || 'Doctor', role: 'doctor', doctorCode: actorName.get(c.doctorId)?.doctorCode || null, reference: c.appointmentId })),
      ...(screenings as any[]).filter((s) => s.clinicianReview?.reviewedAt).map((s) => ({ type: 'reviewed_screening', at: s.clinicianReview.reviewedAt, by: s.clinicianReview.reviewerName || 'Clinician', role: 'doctor', doctorCode: null, reference: s.screeningId })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 60);

    res.setHeader('Cache-Control', 'private, no-store');
    res.envelope({
      access: { reason: access.reason, consentedShare: access.consentedShare, canPrescribe: access.canPrescribe },
      patient: {
        patientId,
        fullName: facilityPatient?.fullName || patientUser?.fullName || 'Patient',
        gender: facilityPatient?.gender || patientUser?.gender || null,
        age: facilityPatient?.age ?? facilityPatient?.ageEstimated ?? (patientUser?.yearOfBirth ? new Date().getFullYear() - patientUser.yearOfBirth : null),
        phone: facilityPatient?.phone || patientUser?.phone || null,
        village: facilityPatient?.villageName || patientUser?.village || null,
        mandal: facilityPatient?.mandal || patientUser?.mandal || null,
        address: facilityPatient?.originalAddressText || patientUser?.address || null,
        registeredAt: facilityPatient?.registeredAt || patientUser?.createdAt || null,
      },
      screenings: (screenings as any[]).map((s) => ({ ...buildPatientScreeningSummary(s), performedBy: s.performedBy?.fullName || s.performedBy?.username || null, performedByRole: s.performedBy?.role || null })),
      cases,
      prescriptions,
      appointments: (appointments as any[]).map((a) => ({ appointmentId: a.appointmentId, slotStartTime: a.slotStartTime, slotEndTime: a.slotEndTime, status: a.status, consultationMode: a.consultationMode, assignedDoctorName: a.assignedDoctorName, destinationHospitalName: a.destinationHospitalName, patientNote: a.patientNote })),
      consultations: (consultations as any[]).map((c) => ({ appointmentId: c.appointmentId, doctorName: actorName.get(c.doctorId)?.name || null, ...sessionView(c) })),
      notes: (notes as any[]).map((n) => ({ noteId: n.noteId, consultationId: n.consultationId, clinicianName: n.clinicianName, text: n.currentNoteText, version: n.currentVersion, hash: n.currentHash, updatedAt: n.updatedAt })),
      captures: (captures as any[]).map((c) => ({ captureId: c.captureId, appointmentId: c.appointmentId, fileId: c.fileId, doctorName: c.doctorName, note: c.note, aiScreeningId: c.aiScreeningId || null, createdAt: c.createdAt })),
      activity,
    });
  } catch (err) { next(err); }
});

/** Streams a patient image/document after re-checking the same patient access (no public URLs). */
patientRecordsRouter.get('/:patientId/files/:fileId', requireAuth, authorizeCapability('patient:read'), validate({ params: FileParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctor = await verifiedDoctor(req, res); if (!doctor) return;
    const { patientId, fileId } = req.params;
    const access = await resolveAccess(doctor, patientId);
    const file: any = await StoredFile.findOne({ fileId, patientId, uploadStatus: { $ne: 'deleted' } });
    if (!access.allowed || !file) { res.status(404).envelopeError('FILE_NOT_FOUND', 'File not found for this patient.', undefined, 404); return; }
    const buffer = await readStoredFileBuffer(file);
    await AuditLog.create({ action: 'PATIENT_FILE_VIEWED', resourceType: 'file', resourceId: fileId, actorId: doctor.userId, actorRole: doctor.role, ip: req.ip || '127.0.0.1', statusCode: 200, metadata: { patientId }, simulation: true });
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-SHA256', file.sha256Hash || '');
    res.send(buffer);
  } catch (err) { next(err); }
});
