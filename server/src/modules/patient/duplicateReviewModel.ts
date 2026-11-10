import mongoose, { Schema, Document } from 'mongoose';

export interface IDuplicateReview extends Document {
  reviewId: string;
  newPatientId: string;
  existingPatientId: string;
  matchScore: number;
  matchReasons: string[];
  status: 'pending' | 'resolved_distinct' | 'resolved_merged';
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  simulation: boolean;
}

const DuplicateReviewSchema = new Schema<IDuplicateReview>(
  {
    reviewId: { type: String, required: true, unique: true, index: true },
    newPatientId: { type: String, required: true, index: true },
    existingPatientId: { type: String, required: true, index: true },
    matchScore: { type: Number, required: true },
    matchReasons: { type: [String], required: true },
    status: {
      type: String,
      enum: ['pending', 'resolved_distinct', 'resolved_merged'],
      default: 'pending',
      index: true,
    },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
    simulation: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const DuplicateReview = mongoose.model<IDuplicateReview>('DuplicateReview', DuplicateReviewSchema);
