import mongoose, { Schema, Document } from 'mongoose';

export interface ITreatmentLog extends Document {
  logId: string;
  treatmentPlanId: string;
  patientId: string;
  date: Date;
  medicineLogs: IMedicineLogEntry[];
  symptomLog?: ISymptomLogEntry;
  painLog?: IPainLogEntry;
  photoProgress?: IPhotoProgressEntry;
  adherencePercentage: number;
  notes?: string;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMedicineLogEntry {
  medicineId: string;
  medicineName: string;
  scheduledTime?: string;
  takenTime?: string;
  taken: boolean;
  skipped: boolean;
  skipReason?: string;
}

export interface ISymptomLogEntry {
  symptoms: string[];
  severity: 'none' | 'mild' | 'moderate' | 'severe';
  notes?: string;
}

export interface IPainLogEntry {
  score: number;
  location?: string;
  notes?: string;
}

export interface IPhotoProgressEntry {
  photoId: string;
  fileId?: string;
  description?: string;
  anatomicalSite?: string;
}

const TreatmentLogSchema = new Schema<ITreatmentLog>({
  logId: { type: String, required: true, unique: true, index: true },
  treatmentPlanId: { type: String, required: true, index: true },
  patientId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  medicineLogs: [{
    medicineId: { type: String, required: true },
    medicineName: { type: String, required: true },
    scheduledTime: { type: String },
    takenTime: { type: String },
    taken: { type: Boolean, default: false },
    skipped: { type: Boolean, default: false },
    skipReason: { type: String },
  }],
  symptomLog: {
    symptoms: [{ type: String }],
    severity: { type: String, enum: ['none', 'mild', 'moderate', 'severe'] },
    notes: { type: String },
  },
  painLog: {
    score: { type: Number, min: 0, max: 10 },
    location: { type: String },
    notes: { type: String },
  },
  photoProgress: {
    photoId: { type: String },
    fileId: { type: String },
    description: { type: String },
    anatomicalSite: { type: String },
  },
  adherencePercentage: { type: Number, default: 0, min: 0, max: 100 },
  notes: { type: String },
  simulation: { type: Boolean, default: true, immutable: true },
}, { timestamps: true });

TreatmentLogSchema.index({ treatmentPlanId: 1, date: 1 }, { unique: true });

export const TreatmentLog = mongoose.models.TreatmentLog || mongoose.model<ITreatmentLog>('TreatmentLog', TreatmentLogSchema);
