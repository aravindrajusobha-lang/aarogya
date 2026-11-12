import mongoose, { Schema, Document } from 'mongoose';

export interface IAssessment extends Document {
  assessmentId: string;
  screeningId: string;
  patientId: string;
  conditionCategory: string;
  aiRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  recommendedSpecialty: string[];
  suggestedDoctors: ISuggestedDoctor[];
  hospitalReferrals: IHospitalReferral[];
  patientConsentGiven: boolean;
  status: 'pending' | 'doctor_selected' | 'appointment_booked' | 'completed';
  selectedDoctorId?: string;
  selectedDoctorName?: string;
  appointmentId?: string;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISuggestedDoctor {
  doctorId: string;
  name: string;
  specialization: string;
  hospital: string;
  hospitalId: string;
  distance: string;
  nextAvailability: string;
  rating?: number;
  consultationMode: 'online' | 'offline' | 'both';
  matchScore: number;
}

export interface IHospitalReferral {
  hospitalId: string;
  name: string;
  type: string;
  specialties: string[];
  distance: string;
  contactPhone: string;
  address: string;
  directionsUrl?: string;
  estimatedTravelTime: string;
}

const AssessmentSchema = new Schema<IAssessment>({
  assessmentId: { type: String, required: true, unique: true, index: true },
  screeningId: { type: String, required: true, index: true },
  patientId: { type: String, required: true, index: true },
  conditionCategory: { type: String, required: true },
  aiRiskLevel: { type: String, enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'], required: true },
  recommendedSpecialty: [{ type: String }],
  suggestedDoctors: [{
    doctorId: { type: String, required: true },
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    hospital: { type: String, required: true },
    hospitalId: { type: String, required: true },
    distance: { type: String },
    nextAvailability: { type: String },
    rating: { type: Number },
    consultationMode: { type: String, enum: ['online', 'offline', 'both'] },
    matchScore: { type: Number },
  }],
  hospitalReferrals: [{
    hospitalId: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String },
    specialties: [{ type: String }],
    distance: { type: String },
    contactPhone: { type: String },
    address: { type: String },
    directionsUrl: { type: String },
    estimatedTravelTime: { type: String },
  }],
  patientConsentGiven: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'doctor_selected', 'appointment_booked', 'completed'], default: 'pending' },
  selectedDoctorId: { type: String },
  selectedDoctorName: { type: String },
  appointmentId: { type: String },
  simulation: { type: Boolean, default: true, immutable: true },
}, { timestamps: true });

export const Assessment = mongoose.models.Assessment || mongoose.model<IAssessment>('Assessment', AssessmentSchema);