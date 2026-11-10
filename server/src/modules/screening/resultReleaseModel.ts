import mongoose, { Schema, Document } from 'mongoose';

export interface IResultRelease extends Document {
  releaseId: string;
  caseId: string;
  patientId: string;
  hospitalId: string;
  assessmentId: string;
  releasedBy: string;
  releasedByName: string;
  releasedAt: Date;
  patientSummaryMessage: string;
  recommendedAction: string;
  status: 'released' | 'withheld';
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const ResultReleaseSchema = new Schema<IResultRelease>(
  {
    releaseId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
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
    hospitalId: {
      type: String,
      required: true,
      index: true,
    },
    assessmentId: {
      type: String,
      required: true,
      index: true,
    },
    releasedBy: {
      type: String,
      required: true,
      index: true,
    },
    releasedByName: {
      type: String,
      required: true,
      trim: true,
    },
    releasedAt: {
      type: Date,
      default: Date.now,
    },
    patientSummaryMessage: {
      type: String,
      required: true,
      trim: true,
    },
    recommendedAction: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['released', 'withheld'],
      default: 'released',
      index: true,
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

export const ResultRelease =
  mongoose.models.ResultRelease ||
  mongoose.model<IResultRelease>('ResultRelease', ResultReleaseSchema);
