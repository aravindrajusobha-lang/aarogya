import mongoose, { Document, Schema } from 'mongoose';

export type ConsultationStatus = 'LINK_SENT' | 'WAITING' | 'IN_CALL' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
export interface IConsultation extends Document {
  consultationId: string; appointmentId: string; callType: 'APPOINTMENT' | 'DIRECT'; patientId: string; doctorId: string; hospitalId: string;
  status: ConsultationStatus; roomName?: string; roomUrl?: string; tokenHash: string;
  linkSentAt: Date; expiresAt: Date; patientWaitingAt?: Date; startedAt?: Date; endedAt?: Date;
  durationSeconds?: number; createdAt: Date; updatedAt: Date;
}
const ConsultationSchema = new Schema<IConsultation>({
  consultationId: { type: String, required: true, unique: true, index: true },
  appointmentId: { type: String, required: true, unique: true, index: true },
  callType: { type: String, enum: ['APPOINTMENT', 'DIRECT'], default: 'APPOINTMENT', index: true },
  patientId: { type: String, required: true, index: true }, doctorId: { type: String, required: true },
  hospitalId: { type: String, required: true, index: true }, status: { type: String, required: true, enum: ['LINK_SENT','WAITING','IN_CALL','COMPLETED','MISSED','CANCELLED'], index: true },
  roomName: { type: String, unique: true, sparse: true }, roomUrl: String, tokenHash: { type: String, required: true },
  linkSentAt: { type: Date, required: true }, expiresAt: { type: Date, required: true, index: true }, patientWaitingAt: Date,
  startedAt: Date, endedAt: Date, durationSeconds: Number,
}, { timestamps: true });
ConsultationSchema.index({ doctorId:  1 }, { unique: true, partialFilterExpression: { status: 'IN_CALL' } });
export const Consultation = mongoose.models.VideoConsultation || mongoose.model<IConsultation>('VideoConsultation', ConsultationSchema);
