import { ClientSession } from 'mongoose';
import { PatientCare } from './patientCareModel.js';
import { Appointment } from '../appointment/appointmentModel.js';
import { User } from '../auth/userModel.js';
import { Patient } from '../patient/patientModel.js';

export async function currentCare(patientId: string, session: ClientSession | null | undefined = null) {
  const saved = await PatientCare.findOne({ patientId }).session(session).lean();
  if (saved) return saved;
  // Legacy records: prefer the latest attended visit; otherwise the earliest accepted booking.
  const attended: any = await Appointment.findOne({ patientId, assignedDoctorId: { $nin: [null, ''] }, status: { $in: ['completed', 'checked_in'] } }).sort({ slotStartTime: -1, appointmentId: 1 }).session(session).lean();
  const booked: any = attended || await Appointment.findOne({ patientId, assignedDoctorId: { $nin: [null, ''] }, status: { $in: ['confirmed', 'rescheduled'] } }).sort({ slotStartTime: 1, appointmentId: 1 }).session(session).lean();
  return booked?.assignedDoctorId ? { patientId, doctorId: booked.assignedDoctorId, version: 0 } : null;
}

export async function patientIdentity(patientId: string, session: ClientSession | null | undefined = null): Promise<{ patientId?: string; fullName: string; hospitalId?: string } | null> {
  const patient = await Patient.findOne({ patientId }).select('patientId fullName hospitalId').session(session).lean() as any;
  return patient || await User.findOne({ patientId, role: 'patient' }).select('patientId fullName hospitalId').session(session).lean() as any;
}

export async function canTreatPatient(doctorId: string, patientId: string) {
  const doctor: any = await User.findOne({ userId: doctorId, role: { $in: ['medical_officer', 'specialist_doctor'] }, status: 'active', verificationStatus: { $in: ['verified', 'VERIFIED'] } }).lean();
  if (!doctor?.hospitalId) return false;
  const care = await currentCare(patientId);
  if (care) return care.doctorId === doctorId;
  const patient = await patientIdentity(patientId);
  return Boolean(patient && patient.hospitalId === doctor.hospitalId);
}

/** A persisted transfer applies to all subsequent consultation mutations too. */
export async function assertCareAssignment(doctorId: string, patientId: string) {
  const care = await PatientCare.findOne({ patientId }).lean();
  if (care && care.doctorId !== doctorId) throw Object.assign(new Error('This patient has another treating doctor. Request a transfer before providing care.'), { statusCode: 403, code: 'TRANSFER_REQUIRED' });
}
