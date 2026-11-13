import mongoose, { Schema, Document } from 'mongoose';

/**
 * A still image the doctor captured from the patient's live video during a consultation.
 * The image itself lives in private storage (StoredFile, SHA-256 hashed); this record links it to
 * the patient, appointment and (optionally) the DEMO AI screening the doctor ran on it.
 */
export interface IConsultationCapture extends Document {
  captureId: string;
  appointmentId: string;
  consultationId?: string;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  hospitalId: string;
  fileId: string;
  sha256Hash: string;
  note?: string;
  aiScreeningId?: string;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConsultationCaptureSchema = new Schema<IConsultationCapture>({
  captureId: { type: String, required: true, unique: true, index: true },
  appointmentId: { type: String, required: true, index: true },
  consultationId: { type: String },
  patientId: { type: String, required: true, index: true },
  doctorId: { type: String, required: true, index: true },
  doctorName: { type: String },
  hospitalId: { type: String, required: true, index: true },
  fileId: { type: String, required: true, immutable: true },
  sha256Hash: { type: String, required: true, immutable: true },
  note: { type: String, maxlength: 1000 },
  aiScreeningId: { type: String },
  clientId: { type: String, required: true, unique: true },
}, { timestamps: true });

export const ConsultationCapture = mongoose.models.ConsultationCapture || mongoose.model<IConsultationCapture>('ConsultationCapture', ConsultationCaptureSchema);
