import mongoose, { Schema, Document } from 'mongoose';

export interface IDelegation extends Document {
  delegationId: string;
  fromUserId: string;
  fromRole: string;
  toUserId: string;
  toRole: string;
  capabilities: string[];
  validFrom: Date;
  validUntil: Date;
  status: 'active' | 'revoked';
  reason: string;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const DelegationSchema = new Schema<IDelegation>(
  {
    delegationId: { type: String, required: true, unique: true, index: true },
    fromUserId: { type: String, required: true, index: true },
    fromRole: { type: String, required: true },
    toUserId: { type: String, required: true, index: true },
    toRole: { type: String, required: true },
    capabilities: [{ type: String, required: true }],
    validFrom: { type: Date, required: true, index: true },
    validUntil: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    reason: { type: String, required: true },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const Delegation =
  mongoose.models.Delegation || mongoose.model<IDelegation>('Delegation', DelegationSchema);
