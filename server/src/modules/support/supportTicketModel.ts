import mongoose, { Schema, Document } from 'mongoose';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_patient' | 'resolved' | 'closed';
export type TicketCategory = 'technical' | 'clinical' | 'billing' | 'accessibility' | 'feedback' | 'other';

export interface ISupportTicket extends Document {
  ticketId: string;
  patientId: string;
  patientName: string;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedTo?: string;
  assignedToName?: string;
  responses: ITicketResponse[];
  tags: string[];
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITicketResponse {
  responseId: string;
  authorId: string;
  authorName: string;
  authorRole: 'patient' | 'staff' | 'system';
  content: string;
  timestamp: Date;
  isInternal: boolean;
}

const SupportTicketSchema = new Schema<ISupportTicket>({
  ticketId: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, required: true },
  category: { type: String, enum: ['technical', 'clinical', 'billing', 'accessibility', 'feedback', 'other'], required: true, index: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'in_progress', 'waiting_patient', 'resolved', 'closed'], default: 'open', index: true },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  assignedTo: { type: String, index: true },
  assignedToName: { type: String },
  responses: [{
    responseId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ['patient', 'staff', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: false },
  }],
  tags: [{ type: String }],
  simulation: { type: Boolean, default: true, immutable: true },
}, { timestamps: true });

export const SupportTicket = mongoose.models.SupportTicket || mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);