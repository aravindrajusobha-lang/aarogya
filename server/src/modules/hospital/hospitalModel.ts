import mongoose, { Schema, Document } from 'mongoose';

export type HospitalType =
  | 'district_hospital'
  | 'area_hospital'
  | 'community_health_centre'
  | 'primary_health_centre'
  | 'sub_centre';

export interface IHospital extends Document {
  hospitalId: string;
  name: string;
  type: HospitalType;
  district: string;
  mandal: string;
  village?: string;
  state: string;
  address?: string;
  contactNumber?: string;
  services: string[];
  specialties: string[];
  managerEmail?: string;
  managerPhone?: string;
  jurisdictionVillages: string[];
  adminUserIds: string[];
  isActive?: boolean;
  status: 'active' | 'inactive';
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema = new Schema<IHospital>(
  {
    hospitalId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: [
        'district_hospital',
        'area_hospital',
        'community_health_centre',
        'primary_health_centre',
        'sub_centre',
      ],
      index: true,
    },
    district: { type: String, required: true, default: 'Alluri Sitharama Raju' },
    mandal: { type: String, required: true, index: true },
    village: { type: String, trim: true },
    state: { type: String, default: 'Andhra Pradesh' },
    address: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    services: {
      type: [String],
      default: ['Oral Mucosal Screening', 'Dental Consultation', 'Biopsy Collection', 'Teleconsultation'],
    },
    specialties: {
      type: [String],
      default: ['Dentistry', 'Oral & Maxillofacial Surgery', 'Oncology Referral', 'ENT'],
    },
    managerEmail: { type: String, trim: true },
    managerPhone: { type: String, trim: true },
    jurisdictionVillages: [{ type: String, required: true }],
    adminUserIds: [{ type: String }],
    isActive: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const Hospital =
  mongoose.models.Hospital || mongoose.model<IHospital>('Hospital', HospitalSchema);
