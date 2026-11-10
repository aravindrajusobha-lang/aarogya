import mongoose, { Schema, Document } from 'mongoose';

export interface IHealthWorkerAssignment extends Document {
  assignmentId: string;
  workerId: string;
  workerName: string;
  workerRole: 'asha' | 'anm';
  hospitalId: string;
  assignedMandal: string;
  assignedVillages: string[];
  assignedBy: string;
  status: 'active' | 'revoked';
  assignedAt: Date;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const HealthWorkerAssignmentSchema = new Schema<IHealthWorkerAssignment>(
  {
    assignmentId: { type: String, required: true, unique: true, index: true },
    workerId: { type: String, required: true, index: true },
    workerName: { type: String, required: true },
    workerRole: { type: String, required: true, enum: ['asha', 'anm'], index: true },
    hospitalId: { type: String, required: true, index: true },
    assignedMandal: { type: String, required: true },
    assignedVillages: [{ type: String, required: true }],
    assignedBy: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    assignedAt: { type: Date, default: Date.now },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const HealthWorkerAssignment =
  mongoose.models.HealthWorkerAssignment ||
  mongoose.model<IHealthWorkerAssignment>('HealthWorkerAssignment', HealthWorkerAssignmentSchema);
