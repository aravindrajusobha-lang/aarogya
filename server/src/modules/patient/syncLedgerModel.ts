import mongoose, { Schema, Document } from 'mongoose';

export interface ISyncLedger extends Document {
  clientMutationId: string;
  entityType: string;
  entityId: string;
  responsePayload: Record<string, unknown>;
  processedAt: Date;
  simulation: boolean;
}

const SyncLedgerSchema = new Schema<ISyncLedger>(
  {
    clientMutationId: { type: String, required: true, unique: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    responsePayload: { type: Schema.Types.Mixed, required: true },
    processedAt: { type: Date, default: Date.now },
    simulation: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const SyncLedger = mongoose.model<ISyncLedger>('SyncLedger', SyncLedgerSchema);
