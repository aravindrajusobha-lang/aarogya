import mongoose, { Schema, Document } from 'mongoose';

export interface IDeviceSession extends Document {
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ip: string;
  refreshTokenHash: string;
  previousRefreshTokenHash?: string;
  status: 'active' | 'revoked';
  revokedAt?: Date;
  revocationReason?: string;
  lastActiveAt: Date;
  expiresAt: Date;
  simulation: true;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSessionSchema = new Schema<IDeviceSession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    deviceId: { type: String, required: true, index: true },
    deviceName: { type: String, required: true },
    userAgent: { type: String, default: 'Unknown' },
    ip: { type: String, required: true },
    refreshTokenHash: { type: String, required: true, index: true },
    previousRefreshTokenHash: { type: String, index: true },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    revokedAt: { type: Date },
    revocationReason: { type: String },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    simulation: { type: Boolean, default: true, immutable: true },
  },
  {
    timestamps: true,
  }
);

export const DeviceSession =
  mongoose.models.DeviceSession || mongoose.model<IDeviceSession>('DeviceSession', DeviceSessionSchema);
