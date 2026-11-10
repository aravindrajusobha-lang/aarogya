import mongoose, { Schema, Document } from 'mongoose';

export type SpecialistField =
  | 'oral_oncology'
  | 'maxillofacial_surgery'
  | 'ent_head_neck'
  | 'pathology'
  | 'general_dental'
  | 'radiation_oncology';

export interface ISpecialist extends Document {
  specialistId: string;
  name: string;
  specialty: SpecialistField;
  hospitalId: string;
  hospitalName: string;
  qualifications: string[];
  teleconsultAvailable: boolean;
  contactPhone: string;
  email: string;
  languages: string[];
  status: 'active' | 'inactive' | 'on_leave';
  consultationTimings?: {
    days: string[];
    hours: string;
  };
  experienceYears?: number;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const SpecialistSchema = new Schema<ISpecialist>(
  {
    specialistId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    specialty: {
      type: String,
      required: true,
      enum: [
        'oral_oncology',
        'maxillofacial_surgery',
        'ent_head_neck',
        'pathology',
        'general_dental',
        'radiation_oncology',
      ],
      index: true,
    },
    hospitalId: { type: String, required: true, index: true },
    hospitalName: { type: String, required: true },
    qualifications: [{ type: String }],
    teleconsultAvailable: { type: Boolean, default: true, index: true },
    contactPhone: { type: String, required: true },
    email: { type: String, required: true },
    languages: [{ type: String, default: ['te', 'en'] }],
    status: {
      type: String,
      enum: ['active', 'inactive', 'on_leave'],
      default: 'active',
      index: true,
    },
    consultationTimings: {
      days: [{ type: String }],
      hours: { type: String },
    },
    experienceYears: { type: Number },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const Specialist =
  mongoose.models.Specialist || mongoose.model<ISpecialist>('Specialist', SpecialistSchema);
