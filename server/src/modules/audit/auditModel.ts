import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  timestamp: Date;
  action: string;
  actorId?: string;
  actorRole?: string;
  resourceType?: string;
  resourceId?: string;
  ip: string;
  userAgent?: string;
  statusCode: number;
  metadata?: Record<string, unknown>;
  simulation: true;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    timestamp: { type: Date, default: Date.now, index: true, immutable: true },
    action: { type: String, required: true, index: true, immutable: true },
    actorId: { type: String, index: true, immutable: true },
    actorRole: { type: String, immutable: true },
    resourceType: { type: String, index: true, immutable: true },
    resourceId: { type: String, immutable: true },
    ip: { type: String, required: true, immutable: true },
    userAgent: { type: String, immutable: true },
    statusCode: { type: Number, required: true, immutable: true },
    metadata: { type: Schema.Types.Mixed, immutable: true },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// IMMUTABILITY ENFORCEMENT: Audit entries are append-only.
// Deny any query-level updates or deletions.
const rejectMutation = function (this: any, next: (err?: Error) => void) {
  next(new Error('AuditLog is append-only: updates and deletions are strictly prohibited'));
};

AuditLogSchema.pre('updateOne', rejectMutation);
AuditLogSchema.pre('updateMany', rejectMutation);
AuditLogSchema.pre('findOneAndUpdate', rejectMutation);
AuditLogSchema.pre('replaceOne', rejectMutation);
AuditLogSchema.pre('deleteOne', rejectMutation);
AuditLogSchema.pre('deleteMany', rejectMutation);
AuditLogSchema.pre('findOneAndDelete', rejectMutation);
AuditLogSchema.pre('findOneAndRemove' as any, rejectMutation);

// Document-level protection
AuditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('AuditLog is append-only: existing entries cannot be updated'));
  }
  next();
});

AuditLogSchema.pre('deleteOne', function (next) {
  next(new Error('AuditLog is append-only: deletions are strictly prohibited'));
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
