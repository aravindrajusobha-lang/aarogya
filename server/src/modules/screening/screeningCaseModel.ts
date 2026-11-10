import mongoose, { Schema, Document } from 'mongoose';

export type ScreeningCaseStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'under_review'
  | 'escalated'
  | 'referral_requested'
  | 'completed';

export type ScreeningPriority = 'routine' | 'urgent' | 'high_priority';

export interface IDemoAiResult {
  riskSupportLabel:
    | 'low_risk_support'
    | 'moderate_risk_support'
    | 'high_risk_support'
    | 'indeterminate_risk_support';
  confidenceScore: number;
  qualityChecks: {
    positioning: 'unavailable';
    obstruction: 'unavailable';
    missingArea: 'unavailable';
  };
  disclaimer: string;
  simulationBanner: string;
  analyzedAt: Date;
  observedCondition?: string;
  recommendedDoctor?: {
    specialty: string;
    facility: string;
    urgency: string;
    timelineDays: number;
    consultationReason: string;
  };
  visualFindings?: string[];
  lifestyleAdvice?: string[];
}

export interface IScreeningCase extends Document {
  caseId: string;
  patientId: string;
  patientName: string;
  villageId: string;
  villageName?: string;
  hospitalId: string;
  createdBy: string;
  status: ScreeningCaseStatus;
  priority: ScreeningPriority;
  photoIds: string[];
  demoAiResult?: IDemoAiResult;
  assignedMoId?: string;
  assignedMoName?: string;
  assignedBy?: string;
  assignedAt?: Date;
  clinicalAssessmentId?: string;
  resultReleaseId?: string;
  resultReleased: boolean;
  escalationDetails?: {
    escalatedBy: string;
    escalatedAt: Date;
    escalationReason: string;
    escalatedToRole: string;
  };
  referralDetails?: {
    referredBy: string;
    referredAt: Date;
    specialistId?: string;
    specialty: string;
    facilityName: string;
    referralNotes: string;
  };
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const ScreeningCaseSchema = new Schema<IScreeningCase>(
  {
    caseId: {
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
      required: true,
      trim: true,
    },
    villageId: {
      type: String,
      required: true,
      index: true,
    },
    villageName: {
      type: String,
      trim: true,
    },
    hospitalId: {
      type: String,
      required: true,
      index: true, // Crucial for cross-hospital isolation
    },
    createdBy: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'pending_assignment',
        'assigned',
        'under_review',
        'escalated',
        'referral_requested',
        'completed',
      ],
      default: 'pending_assignment',
      index: true,
    },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'high_priority'],
      default: 'routine',
      index: true,
    },
    photoIds: {
      type: [String],
      default: [],
    },
    demoAiResult: {
      riskSupportLabel: {
        type: String,
        enum: [
          'low_risk_support',
          'moderate_risk_support',
          'high_risk_support',
          'indeterminate_risk_support',
        ],
      },
      confidenceScore: { type: Number },
      qualityChecks: {
        positioning: { type: String, default: 'unavailable' },
        obstruction: { type: String, default: 'unavailable' },
        missingArea: { type: String, default: 'unavailable' },
      },
      disclaimer: { type: String },
      simulationBanner: { type: String },
      analyzedAt: { type: Date },
      observedCondition: { type: String },
      recommendedDoctor: {
        specialty: { type: String },
        facility: { type: String },
        urgency: { type: String },
        timelineDays: { type: Number },
        consultationReason: { type: String },
      },
      visualFindings: { type: [String], default: [] },
    },
    assignedMoId: {
      type: String,
      index: true,
    },
    assignedMoName: {
      type: String,
      trim: true,
    },
    assignedBy: {
      type: String,
      index: true,
    },
    assignedAt: {
      type: Date,
    },
    clinicalAssessmentId: {
      type: String,
      index: true,
    },
    resultReleaseId: {
      type: String,
      index: true,
    },
    resultReleased: {
      type: Boolean,
      default: false,
      index: true,
    },
    escalationDetails: {
      escalatedBy: { type: String },
      escalatedAt: { type: Date },
      escalationReason: { type: String },
      escalatedToRole: { type: String },
    },
    referralDetails: {
      referredBy: { type: String },
      referredAt: { type: Date },
      specialistId: { type: String },
      specialty: { type: String },
      facilityName: { type: String },
      referralNotes: { type: String },
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

export const ScreeningCase =
  mongoose.models.ScreeningCase ||
  mongoose.model<IScreeningCase>('ScreeningCase', ScreeningCaseSchema);
