import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IRiskQuestionnaireAnswers, RiskLevel } from './riskScore.js';

export type AiLabel = string;

export interface IDentalFinding {
  label: string;
  probability: number;
  threshold: number;
  flagged: boolean;
}

export interface IClinicianReview {
  status: 'PENDING' | 'CONFIRMED' | 'OVERRIDDEN';
  reviewedBy?: string;
  reviewerName?: string;
  finalImpression?: string;
  notes?: string;
  reviewedAt?: Date;
}

export interface ICombinedRecommendation {
  referToSpecialist: boolean;
  seeDentist: boolean;
  triageCategory: 'URGENT_SPECIALIST' | 'DENTAL_MONITOR' | 'ROUTINE';
  badgeColor: 'RED' | 'AMBER' | 'GREEN';
  triggerModules: string[];
  advice: string;
}

export interface IAiScreening extends Document {
  screeningId: string;
  patientId: string;
  performedBy: {
    userId: string;
    username: string;
    role: string;
    fullName?: string;
  };
  hospitalId?: string;

  // Backward-compatible Module A lesion fields
  label: AiLabel | null;
  confidence: number;
  probabilities: Record<string, number>;
  referToSpecialist: boolean;
  modelVersion: string;
  source: 'server' | 'on-device';
  imageRef?: string;
  imageQuality?: {
    ok: boolean;
    reason?: string | null;
    blurScore?: number;
    brightness?: number;
  };

  // Structured Module A
  moduleA?: {
    label: AiLabel | null;
    confidence: number;
    probabilities: Record<string, number>;
    modelVersion: string;
    source: 'server' | 'on-device';
    imageRef?: string;
    imageQuality?: {
      ok: boolean;
      reason?: string | null;
      blurScore?: number;
      brightness?: number;
    };
  };

  // Structured Module B (Dental Examination)
  moduleB?: {
    findings: IDentalFinding[];
    seeDentistRecommended: boolean;
    modelVersion: string;
    source: 'server' | 'on-device';
    imageRef?: string;
    imageQuality?: {
      ok: boolean;
      reason?: string | null;
      blurScore?: number;
      brightness?: number;
    };
  };

  // Structured Module C (Risk Questionnaire)
  moduleC?: {
    answers: IRiskQuestionnaireAnswers;
    score: number;
    level: RiskLevel;
    flaggedSymptoms: string[];
    flaggedHabits: string[];
    reportedByPatient: boolean;
    rationale: string;
    clinicalValidationRequired: boolean;
  };

  // Combined Multi-Module Recommendation
  combinedRecommendation?: ICombinedRecommendation;

  clinicianReview: IClinicianReview;
  serverVerification?: {
    label?: AiLabel;
    confidence?: number;
    probabilities?: Record<string, number>;
    dentalFindings?: IDentalFinding[];
    verifiedAt: Date;
    matchesOnDevice: boolean;
  };
  consentGiven: boolean;
  consentTimestamp: Date;
  syncStatus: 'SYNCED' | 'PENDING_SYNC';
  clientId: string; // UUID for deduplication
  geminiAnalysis?: any;
  createdAt: Date;
  updatedAt: Date;
}

const DentalFindingSchema = new Schema(
  {
    label: { type: String, required: true },
    probability: { type: Number, required: true },
    threshold: { type: Number, required: true, default: 0.5 },
    flagged: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const CombinedRecommendationSchema = new Schema(
  {
    referToSpecialist: { type: Boolean, required: true, default: false },
    seeDentist: { type: Boolean, required: true, default: false },
    triageCategory: {
      type: String,
      enum: ['URGENT_SPECIALIST', 'DENTAL_MONITOR', 'ROUTINE'],
      default: 'ROUTINE',
    },
    badgeColor: {
      type: String,
      enum: ['RED', 'AMBER', 'GREEN'],
      default: 'GREEN',
    },
    triggerModules: [{ type: String }],
    advice: { type: String, default: 'Screening assessment aid only, not clinical confirmation. Please consult a doctor.' },
  },
  { _id: false }
);

const AiScreeningSchema = new Schema<IAiScreening>(
  {
    screeningId: {
      type: String,
      default: () => `AI-SCR-${uuidv4().substring(0, 8).toUpperCase()}`,
      index: true,
      unique: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: {
      userId: { type: String, required: true },
      username: { type: String, required: true },
      role: { type: String, required: true },
      fullName: { type: String },
    },
    hospitalId: {
      type: String,
      index: true,
    },

    // Backward-compatible fields
    label: {
      type: String,
      default: null,
    },
    confidence: {
      type: Number,
      required: true,
      default: 0.0,
    },
    probabilities: {
      type: Map,
      of: Number,
      default: {},
    },
    referToSpecialist: {
      type: Boolean,
      required: true,
      default: false,
    },
    modelVersion: {
      type: String,
      required: true,
      default: 'v1.0.0-efficientnet_b0',
    },
    source: {
      type: String,
      enum: ['server', 'on-device'],
      required: true,
      default: 'server',
    },
    imageRef: {
      type: String,
    },
    imageQuality: {
      ok: { type: Boolean, default: true },
      reason: { type: String, default: null },
      blurScore: { type: Number },
      brightness: { type: Number },
    },

    // Module A
    moduleA: {
      label: { type: String, default: null },
      confidence: { type: Number, default: 0.0 },
      probabilities: { type: Map, of: Number, default: {} },
      modelVersion: { type: String, default: 'v1.0.0-efficientnet_b0' },
      source: { type: String, enum: ['server', 'on-device'], default: 'server' },
      imageRef: { type: String },
      imageQuality: {
        ok: { type: Boolean, default: true },
        reason: { type: String, default: null },
        blurScore: { type: Number },
        brightness: { type: Number },
      },
    },

    // Module B
    moduleB: {
      findings: [DentalFindingSchema],
      seeDentistRecommended: { type: Boolean, default: false },
      modelVersion: { type: String, default: 'v1.0.0-dental-efficientnet_b0' },
      source: { type: String, enum: ['server', 'on-device'], default: 'server' },
      imageRef: { type: String },
      imageQuality: {
        ok: { type: Boolean, default: true },
        reason: { type: String, default: null },
        blurScore: { type: Number },
        brightness: { type: Number },
      },
    },

    // Module C
    moduleC: {
      answers: { type: Schema.Types.Mixed, default: {} },
      score: { type: Number, default: 0 },
      level: { type: String, enum: ['LOW', 'MODERATE', 'HIGH'], default: 'LOW' },
      flaggedSymptoms: [{ type: String }],
      flaggedHabits: [{ type: String }],
      reportedByPatient: { type: Boolean, default: true },
      rationale: { type: String, default: '' },
      clinicalValidationRequired: { type: Boolean, default: true },
    },

    // Combined Recommendation
    combinedRecommendation: CombinedRecommendationSchema,

    clinicianReview: {
      status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'OVERRIDDEN'],
        default: 'PENDING',
      },
      reviewedBy: { type: String },
      reviewerName: { type: String },
      finalImpression: { type: String },
      notes: { type: String },
      reviewedAt: { type: Date },
    },
    serverVerification: {
      label: { type: String },
      confidence: { type: Number },
      probabilities: { type: Map, of: Number },
      dentalFindings: [DentalFindingSchema],
      verifiedAt: { type: Date },
      matchesOnDevice: { type: Boolean },
    },
    consentGiven: {
      type: Boolean,
      required: true,
      default: true,
    },
    consentTimestamp: {
      type: Date,
      default: Date.now,
    },
    geminiAnalysis: {
      type: Schema.Types.Mixed,
    },
    syncStatus: {
      type: String,
      enum: ['SYNCED', 'PENDING_SYNC'],
      default: 'SYNCED',
      index: true,
    },
    clientId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

AiScreeningSchema.index({ hospitalId: 1, createdAt: -1 });
AiScreeningSchema.index({ patientId: 1, createdAt: -1 });

export const AiScreening =
  mongoose.models.AiScreening || mongoose.model<IAiScreening>('AiScreening', AiScreeningSchema);
