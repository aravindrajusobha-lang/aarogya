import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  timestamp: Date;
  action: string;
  actorId?: string;
  actorRole?: string;
  resourceType?: string;
  resourceId?: string;
  ip: string;
  statusCode: number;
  simulation: true;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    action: { type: String, required: true, index: true },
    actorId: { type: String, index: true },
    actorRole: { type: String },
    resourceType: { type: String, index: true },
    resourceId: { type: String },
    ip: { type: String, required: true },
    statusCode: { type: Number, required: true },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
