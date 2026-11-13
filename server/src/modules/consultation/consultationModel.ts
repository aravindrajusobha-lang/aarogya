import mongoose, { Document, Schema } from 'mongoose';

export type ConsultationStatus = 'LINK_SENT' | 'WAITING' | 'IN_CALL' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
export const FOLLOW_UP_FREQUENCIES = ['none', 'weekly', 'biweekly', 'monthly', 'quarterly', 'custom'] as const;
export type FollowUpFrequency = typeof FOLLOW_UP_FREQUENCIES[number];
export const FOLLOW_UP_INTERVAL_DAYS: Record<Exclude<FollowUpFrequency, 'none' | 'custom'>, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
};

export interface IConsultationFollowUp {
  frequency: FollowUpFrequency;
  intervalDays?: number;
  nextFollowUpAt?: Date;
  plannedSessions?: number;
  instructions?: string;
  setBy: string;
  setAt: Date;
}

export interface IConsultation extends Document {
  consultationId: string; appointmentId: string; callType: 'APPOINTMENT' | 'DIRECT'; patientId: string; doctorId: string; hospitalId: string;
  consultationMode?: 'online' | 'offline';
  status: ConsultationStatus; roomName?: string; roomUrl?: string; tokenHash: string;
  linkSentAt: Date; expiresAt: Date; patientWaitingAt?: Date; startedAt?: Date; endedAt?: Date;
  startedBy?: string; endedBy?: string;
  durationSeconds?: number;
  followUp?: IConsultationFollowUp;
  createdAt: Date; updatedAt: Date;
}

const FollowUpSchema = new Schema<IConsultationFollowUp>({
  frequency: { type: String, enum: FOLLOW_UP_FREQUENCIES, required: true },
  intervalDays: { type: Number, min: 1, max: 365 },
  nextFollowUpAt: Date,
  plannedSessions: { type: Number, min: 1, max: 52 },
  instructions: { type: String, maxlength: 2000 },
  setBy: { type: String, required: true },
  setAt: { type: Date, required: true },
}, { _id: false });

const ConsultationSchema = new Schema<IConsultation>({
  consultationId: { type: String, required: true, unique: true, index: true },
  appointmentId: { type: String, required: true, unique: true, index: true },
  callType: { type: String, enum: ['APPOINTMENT', 'DIRECT'], default: 'APPOINTMENT', index: true },
  patientId: { type: String, required: true, index: true }, doctorId: { type: String, required: true },
  hospitalId: { type: String, required: true, index: true }, status: { type: String, required: true, enum: ['LINK_SENT','WAITING','IN_CALL','COMPLETED','MISSED','CANCELLED'], index: true },
  consultationMode: { type: String, enum: ['online', 'offline'] },
  roomName: { type: String, unique: true, sparse: true }, roomUrl: String, tokenHash: { type: String, required: true },
  linkSentAt: { type: Date, required: true }, expiresAt: { type: Date, required: true, index: true }, patientWaitingAt: Date,
  startedAt: Date, endedAt: Date, startedBy: String, endedBy: String, durationSeconds: Number,
  followUp: FollowUpSchema,
}, { timestamps: true });
ConsultationSchema.index({ doctorId:  1 }, { unique: true, partialFilterExpression: { status: 'IN_CALL' } });
export const Consultation = mongoose.models.VideoConsultation || mongoose.model<IConsultation>('VideoConsultation', ConsultationSchema);
