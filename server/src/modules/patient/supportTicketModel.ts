import mongoose, { Schema, Document } from 'mongoose';

export interface ISupportTicket extends Document {
  ticketId: string;
  patientId: string;
  clientMutationId: string;
  category: 'account' | 'appointment' | 'report' | 'technical' | 'other';
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>({
  ticketId: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  clientMutationId: { type: String, required: true },
  category: { type: String, enum: ['account', 'appointment', 'report', 'technical', 'other'], required: true },
  subject: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open', index: true },
  simulation: { type: Boolean, default: true, immutable: true },
}, { timestamps: true });

SupportTicketSchema.index({ patientId: 1, clientMutationId: 1 }, { unique: true });

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);
