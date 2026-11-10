import mongoose, { Schema, Document } from 'mongoose';

export type ConsentPurpose = 'screening_ai_analysis' | 'telemedicine_share' | 'data_storage';
export type ConsentStatus = 'granted' | 'revoked' | 'denied';

export interface IConsent extends Document {
  consentId: string;
  patientId: string;
  purpose: ConsentPurpose;
  status: ConsentStatus;
  validUntil: Date;
  grantedAt: Date;
  revokedAt?: Date;
  actorId: string;
  actorRole: string;
  witnessName?: string;
  language: string;
  termsVersion: string;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const ConsentSchema = new Schema<IConsent>(
  {
    consentId: { type: String, required: true, unique: true, index: true },
    patientId: { type: String, required: true, index: true },
    purpose: {
      type: String,
      required: true,
      enum: ['screening_ai_analysis', 'telemedicine_share', 'data_storage'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['granted', 'revoked', 'denied'],
      default: 'granted',
      index: true,
    },
    validUntil: { type: Date, required: true, index: true },
    grantedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date },
    actorId: { type: String, required: true, index: true },
    actorRole: { type: String, required: true },
    witnessName: { type: String },
    language: { type: String, default: 'en' },
    termsVersion: { type: String, default: '1.0.0' },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const Consent = mongoose.models.Consent || mongoose.model<IConsent>('Consent', ConsentSchema);
