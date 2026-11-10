import mongoose, { Schema, Document } from 'mongoose';

export type RecoveryStatus =
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'approved'
  | 'completed';

export interface IClaimedDemographics {
  fullName: string;
  gender: string;
  ageEstimated: number;
  villageId: string;
  villageName: string;
  guardianName?: string;
  phone?: string;
  originalAddressText?: string;
}

export interface IRecoveryTicket extends Document {
  ticketId: string;
  targetPatientId?: string;
  claimedDemographics: IClaimedDemographics;
  matchedPatientId: string | null;
  matchScore: number;
  matchReasons: string[];
  status: RecoveryStatus;

  // Role 1: Requester
  requesterId: string;
  requesterRole: string;
  requestedAt: Date;

  // Role 2: Verifier (Must be different from Requester and Approver)
  verifierId?: string;
  verifierRole?: string;
  verifiedAt?: Date;
  verificationNotes?: string;
  verificationEvidence?: string;

  // Role 3: Approver (Must be different from Requester and Verifier)
  approverId?: string;
  approverRole?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  rejectionReason?: string;

  // Credential Reissue Token
  recoveryTokenHash?: string;
  recoveryTokenExpiresAt?: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const ClaimedDemographicsSchema = new Schema(
  {
    fullName: { type: String, required: true },
    gender: { type: String, required: true },
    ageEstimated: { type: Number, required: true },
    villageId: { type: String, required: true },
    villageName: { type: String, required: true },
    guardianName: { type: String },
    phone: { type: String },
    originalAddressText: { type: String },
  },
  { _id: false }
);

const RecoveryTicketSchema = new Schema<IRecoveryTicket>(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    targetPatientId: {
      type: String,
      index: true,
    },
    claimedDemographics: {
      type: ClaimedDemographicsSchema,
      required: true,
    },
    matchedPatientId: {
      type: String,
      default: null,
      index: true,
    },
    matchScore: {
      type: Number,
      default: 0,
    },
    matchReasons: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['pending_verification', 'verified', 'rejected', 'approved', 'completed'],
      default: 'pending_verification',
      index: true,
    },

    // 1. Requester
    requesterId: {
      type: String,
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },

    // 2. Verifier
    verifierId: {
      type: String,
      index: true,
    },
    verifierRole: {
      type: String,
    },
    verifiedAt: {
      type: Date,
    },
    verificationNotes: {
      type: String,
    },
    verificationEvidence: {
      type: String,
    },

    // 3. Approver
    approverId: {
      type: String,
      index: true,
    },
    approverRole: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
    approvalNotes: {
      type: String,
    },
    rejectionReason: {
      type: String,
    },

    // Reissue Token
    recoveryTokenHash: {
      type: String,
    },
    recoveryTokenExpiresAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const RecoveryTicket = mongoose.model<IRecoveryTicket>(
  'RecoveryTicket',
  RecoveryTicketSchema
);
