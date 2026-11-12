import mongoose, { Schema, Document } from 'mongoose';

export interface IAiChatMessage extends Document {
  chatId: string;
  screeningId: string;
  patientId: string;
  messages: IChatMessageEntry[];
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatMessageEntry {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  language: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
  timestamp: Date;
  metadata?: {
    reportContext?: boolean;
    profileContext?: boolean;
  };
}

const AiChatMessageSchema = new Schema<IAiChatMessage>({
  chatId: { type: String, required: true, unique: true, index: true },
  screeningId: { type: String, required: true, index: true },
  patientId: { type: String, required: true, index: true },
  messages: [{
    messageId: { type: String, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    language: { type: String, enum: ['en', 'te', 'hi', 'ta', 'kn', 'ml'], required: true },
    timestamp: { type: Date, default: Date.now },
    metadata: {
      reportContext: { type: Boolean, default: true },
      profileContext: { type: Boolean, default: true },
    },
  }],
  simulation: { type: Boolean, default: true, immutable: true },
}, { timestamps: true });

export const AiChatMessage = mongoose.models.AiChatMessage || mongoose.model<IAiChatMessage>('AiChatMessage', AiChatMessageSchema);