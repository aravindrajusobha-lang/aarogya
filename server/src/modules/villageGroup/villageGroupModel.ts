import mongoose, { Schema, Document } from 'mongoose';

export type VillageGroupStatus =
  | 'pending_approval'
  | 'active'
  | 'inactive'
  | 'rejected'
  | 'deleted';

export interface IVillageGroup extends Document {
  groupId: string;
  groupName: string;
  villageId: string;
  villageName: string;
  mandal: string;
  normalizedAddress: string;
  sampleAddressText: string;
  memberPatientIds: string[];
  patientCount: number;
  status: VillageGroupStatus;
  autoCreated: boolean;
  autoTriggerBlocked: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  unblockedBy?: string;
  unblockedAt?: Date;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const VillageGroupSchema = new Schema<IVillageGroup>(
  {
    groupId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    groupName: {
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
      required: true,
      trim: true,
    },
    mandal: {
      type: String,
      required: true,
      index: true,
    },
    normalizedAddress: {
      type: String,
      required: true,
      trim: true,
    },

    sampleAddressText: {
      type: String,
      required: true,
      trim: true,
    },
    memberPatientIds: {
      type: [String],
      default: [],
    },
    patientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending_approval', 'active', 'inactive', 'rejected', 'deleted'],
      default: 'pending_approval',
      index: true,
    },
    autoCreated: {
      type: Boolean,
      default: true,
    },
    autoTriggerBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    approvedBy: {
      type: String,
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: String,
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    unblockedBy: {
      type: String,
    },
    unblockedAt: {
      type: Date,
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

/**
 * Partial Unique Index:
 * When status is 'active', 'inactive', or 'pending_approval', normalizedAddress must be unique.
 * - 'inactive' groups still block duplicates because they are included in the index filter.
 * - 'rejected' and 'deleted' groups are excluded from the index filter, so they don't block
 *   creation of a new group with the same normalized address.
 */
VillageGroupSchema.index(
  { normalizedAddress: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['active', 'inactive', 'pending_approval'] },
    },
  }
);

export const VillageGroup =
  mongoose.models.VillageGroup ||
  mongoose.model<IVillageGroup>('VillageGroup', VillageGroupSchema);
