import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicineItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

export interface IPrescriptionDocument extends Document {
  prescriptionId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalId: string;
  hospitalName: string;
  consultationId?: string;
  screeningCaseId?: string;
  clinicalObservations: string;
  diagnosisImpression: string;
  medicines: IMedicineItem[];
  labTestsRecommended: string[];
  dietaryLifestyleAdvice: string[];
  followUpDate?: Date;
  status: 'active' | 'dispensed' | 'completed' | 'discontinued';
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineItemSchema = new Schema<IMedicineItem>(
  {
    medicineName: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    durationDays: { type: Number, required: true, default: 5 },
    instructions: { type: String, default: '' },
  },
  { _id: false }
);

const PrescriptionSchema = new Schema<IPrescriptionDocument>(
  {
    prescriptionId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true, trim: true },
    patientPhone: { type: String, trim: true },
    doctorId: { type: String, required: true, index: true },
    doctorName: { type: String, required: true, trim: true },
    doctorSpecialty: { type: String, default: 'Dental Surgeon / Medical Officer' },
    hospitalId: { type: String, required: true, index: true },
    hospitalName: { type: String, default: 'Community Health Centre (CHC) Paderu' },
    consultationId: { type: String, sparse: true },
    screeningCaseId: { type: String, sparse: true },
    clinicalObservations: { type: String, required: true },
    diagnosisImpression: { type: String, required: true },
    medicines: { type: [MedicineItemSchema], default: [] },
    labTestsRecommended: { type: [String], default: [] },
    dietaryLifestyleAdvice: { type: [String], default: [] },
    followUpDate: { type: Date },
    status: {
      type: String,
      enum: ['active', 'dispensed', 'completed', 'discontinued'],
      default: 'active',
      index: true,
    },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const Prescription =
  mongoose.models.Prescription ||
  mongoose.model<IPrescriptionDocument>('Prescription', PrescriptionSchema);

