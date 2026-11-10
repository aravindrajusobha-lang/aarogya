import mongoose, { Schema, Document } from 'mongoose';

export type AssessmentRiskTier =
  | 'low_risk_support'
  | 'moderate_risk_support'
  | 'high_risk_support';

export interface IClinicalAssessment extends Document {
  assessmentId: string;
  caseId: string;
  patientId: string;
  hospitalId: string;
  evaluatorId: string;
  evaluatorName: string;
  clinicalImpression: string;
  lesionObserved: boolean;
  anatomicalSite?: string;
  riskCategorization: AssessmentRiskTier;
  recommendedFollowUpDays: number;
  clinicalNotes: string;
  status: 'draft' | 'completed';
  completedAt?: Date;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const ClinicalAssessmentSchema = new Schema<IClinicalAssessment>(
  {
    assessmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    caseId: {
      type: String,
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      required: true,
      index: true,
    },
    hospitalId: {
      type: String,
      required: true,
      index: true,
    },
    evaluatorId: {
      type: String,
      required: true,
      index: true,
    },
    evaluatorName: {
      type: String,
      required: true,
      trim: true,
    },
    clinicalImpression: {
      type: String,
      required: true,
      trim: true,
    },
    lesionObserved: {
      type: Boolean,
      default: false,
    },
    anatomicalSite: {
      type: String,
      trim: true,
    },
    riskCategorization: {
      type: String,
      enum: ['low_risk_support', 'moderate_risk_support', 'high_risk_support'],
      required: true,
    },
    recommendedFollowUpDays: {
      type: Number,
      default: 30,
    },
    clinicalNotes: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'completed'],
      default: 'completed',
    },
    completedAt: {
      type: Date,
      default: Date.now,
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

export const ClinicalAssessment =
  mongoose.models.ClinicalAssessment ||
  mongoose.model<IClinicalAssessment>('ClinicalAssessment', ClinicalAssessmentSchema);
