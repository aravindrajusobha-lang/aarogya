import mongoose, { Schema } from 'mongoose';
import { User } from '../auth/userModel.js';
import { logger } from '../../config/logger.js';

/** Atomic sequence counters (one document per sequence name). */
const CounterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } }, { versionKey: false });
export const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

export const DOCTOR_ROLES = ['medical_officer', 'specialist_doctor'];

/** Unique, human-readable doctor ID, e.g. AD-DR-00012. Never reused. */
export function formatDoctorCode(seq: number): string {
  return `AD-DR-${String(seq).padStart(5, '0')}`;
}

export async function nextDoctorCode(session?: mongoose.ClientSession | null): Promise<string> {
  const counter: any = await Counter.findOneAndUpdate(
    { _id: 'doctorCode' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, session },
  );
  return formatDoctorCode(counter.seq);
}

/** Assigns a doctor ID to every existing doctor account that does not have one yet (idempotent). */
export async function backfillDoctorCodes(): Promise<number> {
  const missing = await User.find({ role: { $in: DOCTOR_ROLES }, $or: [{ doctorCode: { $exists: false } }, { doctorCode: null }, { doctorCode: '' }] })
    .select('userId createdAt').sort({ createdAt: 1 }).lean();
  let assigned = 0;
  for (const doctor of missing as any[]) {
    const code = await nextDoctorCode();
    const result = await User.updateOne({ userId: doctor.userId, $or: [{ doctorCode: { $exists: false } }, { doctorCode: null }, { doctorCode: '' }] }, { $set: { doctorCode: code } });
    if (result.modifiedCount) assigned += 1;
  }
  if (assigned) logger.info({ event: 'doctor_codes_backfilled', assigned }, 'Assigned unique doctor IDs to existing doctors');
  return assigned;
}
