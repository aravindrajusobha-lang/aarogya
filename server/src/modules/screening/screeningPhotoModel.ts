import mongoose, { Schema, Document } from 'mongoose';

export interface IAmendmentHistory {
  version: number;
  fileId: string;
  sha256: string;
  amendedBy: string;
  amendedAt: Date;
  amendmentReason: string;
}

export interface IScreeningPhoto extends Document {
  photoId: string;
  patientId: string;
  caseId?: string;
  hospitalId: string;
  isDemo: boolean;
  consentId?: string;
  originalFileId: string;
  currentFileId: string;
  originalSha256: string;
  currentSha256: string;
  version: number;
  amendmentHistory: IAmendmentHistory[];
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const ScreeningPhotoSchema = new Schema<IScreeningPhoto>(
  {
    photoId: {
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
    caseId: {
      type: String,
      index: true,
    },
    hospitalId: {
      type: String,
      required: true,
      index: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
    consentId: {
      type: String,
      index: true,
    },
    originalFileId: {
      type: String,
      required: true,
    },
    currentFileId: {
      type: String,
      required: true,
    },
    originalSha256: {
      type: String,
      required: true,
      immutable: true, // Original image hash remains strictly byte-identical
    },
    currentSha256: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    amendmentHistory: [
      {
        version: { type: Number, required: true },
        fileId: { type: String, required: true },
        sha256: { type: String, required: true },
        amendedBy: { type: String, required: true },
        amendedAt: { type: Date, default: Date.now },
        amendmentReason: { type: String, required: true },
      },
    ],
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

export const ScreeningPhoto =
  mongoose.models.ScreeningPhoto ||
  mongoose.model<IScreeningPhoto>('ScreeningPhoto', ScreeningPhotoSchema);
