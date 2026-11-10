import mongoose, { Schema, Document } from 'mongoose';

export type ReferralStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'SCHEDULED'
  | 'ATTENDED'
  | 'MISSED'
  | 'CANCELLED'
  | 'pending_referral'
  | 'hospital_assigned'
  | 'appointment_scheduled'
  | 'patient_visited'
  | 'doctor_reviewed'
  | 'further_examination_required'
  | 'follow_up_scheduled'
  | 'referral_completed';

export interface IDoctorReview {
  doctorId: string;
  doctorName: string;
  agreedWithAi: boolean;
  clinicalObservations: string;
  recommendedFollowUpDays?: number;
  furtherExamNotes?: string;
  reviewDate: Date;
}

export interface IReferralDocument extends Document {
  referralId: string;
  patientId: string;
  patientName?: string;
  patientPhone?: string;
  patientMandal?: string;
  patientVillage?: string;
  sourceHospitalId: string;
  sourceHospitalName?: string;
  destinationHospitalId: string;
  destinationHospitalName?: string;
  specialistId?: string;
  specialistName?: string;
  assignedDoctorId?: string;
  assignedDoctorName?: string;
  specialty?: string;
  screeningCaseId?: string;
  aiScreeningSummary?: string;
  status: ReferralStatus;
  priority?: 'routine' | 'urgent' | 'high_priority';
  reasonForReferral: string;
  referringDoctorId: string;
  referringDoctorName?: string;
  scheduledFollowUpDate?: Date;
  doctorReview?: IDoctorReview;
  followUpReminder: {
    scheduledFor?: Date;
    reminderText?: string;
    jobId?: string;
    dispatched: boolean;
    dispatchedAt?: Date;
  };
  missedEscalation: {
    isEscalated: boolean;
    escalatedAt?: Date;
    escalatedBy?: string;
    escalationReason?: string;
  };
  cancellation?: {
    cancelledBy: string;
    reason: string;
    cancelledAt: Date;
  };
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferralDocument>(
  {
    referralId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    patientName: {
      type: String,
      trim: true,
    },
    patientPhone: {
      type: String,
      trim: true,
    },
    patientMandal: {
      type: String,
      trim: true,
    },
    patientVillage: {
      type: String,
      trim: true,
    },
    sourceHospitalId: {
      type: String,
      required: true,
      index: true,
    },
    sourceHospitalName: {
      type: String,
      trim: true,
    },
    destinationHospitalId: {
      type: String,
      required: true,
      index: true, // Key index for cross-hospital scoping
    },
    destinationHospitalName: {
      type: String,
      trim: true,
    },
    specialistId: {
      type: String,
      index: true,
    },
    specialistName: {
      type: String,
      trim: true,
    },
    assignedDoctorId: {
      type: String,
      index: true,
    },
    assignedDoctorName: {
      type: String,
      trim: true,
    },
    specialty: {
      type: String,
      trim: true,
    },
    screeningCaseId: {
      type: String,
      index: true,
    },
    aiScreeningSummary: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'ACCEPTED',
        'SCHEDULED',
        'ATTENDED',
        'MISSED',
        'CANCELLED',
        'pending_referral',
        'hospital_assigned',
        'appointment_scheduled',
        'patient_visited',
        'doctor_reviewed',
        'further_examination_required',
        'follow_up_scheduled',
        'referral_completed',
      ],
      default: 'pending_referral',
      index: true,
    },
    doctorReview: {
      doctorId: { type: String },
      doctorName: { type: String },
      agreedWithAi: { type: Boolean },
      clinicalObservations: { type: String },
      recommendedFollowUpDays: { type: Number },
      furtherExamNotes: { type: String },
      reviewDate: { type: Date },
    },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'high_priority'],
      default: 'routine',
      index: true,
    },
    reasonForReferral: {
      type: String,
      required: true,
      trim: true,
    },
    referringDoctorId: {
      type: String,
      required: true,
      index: true,
    },
    referringDoctorName: {
      type: String,
      trim: true,
    },
    scheduledFollowUpDate: {
      type: Date,
    },
    followUpReminder: {
      scheduledFor: { type: Date },
      reminderText: { type: String },
      jobId: { type: String },
      dispatched: { type: Boolean, default: false },
      dispatchedAt: { type: Date },
    },
    missedEscalation: {
      isEscalated: { type: Boolean, default: false },
      escalatedAt: { type: Date },
      escalatedBy: { type: String },
      escalationReason: { type: String },
    },
    cancellation: {
      cancelledBy: { type: String },
      reason: { type: String },
      cancelledAt: { type: Date },
    },
    simulation: {
      type: Boolean,
      default: true,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

ReferralSchema.index({ destinationHospitalId: 1, status: 1 });
ReferralSchema.index({ patientId: 1, status: 1 });

export const Referral =
  mongoose.models.Referral || mongoose.model<IReferralDocument>('Referral', ReferralSchema);
export const ReferralRecord = Referral;
