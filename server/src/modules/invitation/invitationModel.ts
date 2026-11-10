import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../auth/userModel.js';

export interface IInvitation extends Document {
  invitationId: string;
  hospitalId: string;
  email: string;
  fullName: string;
  role: UserRole;
  token: string;
  invitationLink: string;
  createdBy: string;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  acceptedAt?: Date;
  acceptedBy?: string;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
  {
    invitationId: { type: String, required: true, unique: true, index: true },
    hospitalId: { type: String, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'medical_officer', 'anm', 'asha'],
      index: true,
    },
    token: { type: String, required: true, unique: true, index: true },
    invitationLink: { type: String, required: true },
    createdBy: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
    acceptedAt: { type: Date },
    acceptedBy: { type: String },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const Invitation =
  mongoose.models.Invitation || mongoose.model<IInvitation>('Invitation', InvitationSchema);
