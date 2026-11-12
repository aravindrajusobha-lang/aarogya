import mongoose, { Document, Schema } from 'mongoose';

export interface IDailyProviderConfig extends Document {
  provider: 'daily';
  domain: string;
  encryptedApiKey: string;
  iv: string;
  authTag: string;
  configuredBy: string;
  configuredAt: Date;
}

const DailyProviderConfigSchema = new Schema<IDailyProviderConfig>({
  provider: { type: String, enum: ['daily'], required: true, unique: true },
  domain: { type: String, required: true },
  encryptedApiKey: { type: String, required: true, select: false },
  iv: { type: String, required: true, select: false },
  authTag: { type: String, required: true, select: false },
  configuredBy: { type: String, required: true },
  configuredAt: { type: Date, required: true },
}, { timestamps: true });

export const DailyProviderConfig = mongoose.models.DailyProviderConfig || mongoose.model<IDailyProviderConfig>('DailyProviderConfig', DailyProviderConfigSchema);