import mongoose, { Schema, Document } from 'mongoose';

export type OtpPurpose = 'REGISTER' | 'LOGIN' | 'RESET';

export interface IOtp extends Document {
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    phone: { type: String, required: true, index: true },
    purpose: {
      type: String,
      enum: ['REGISTER', 'LOGIN', 'RESET'],
      default: 'REGISTER',
      index: true,
    },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true, expires: 0 }, // MongoDB deletes it automatically via TTL index
  },
  { timestamps: true }
);

export const Otp = mongoose.models.Otp || mongoose.model<IOtp>('Otp', OtpSchema);
export default Otp;

