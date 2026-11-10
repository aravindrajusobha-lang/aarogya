import mongoose, { Schema, Document } from 'mongoose';
import { SupportedLanguage } from './templates.js';

export interface INotificationPreferences extends Document {
  userId: string;
  channels: {
    inApp: boolean;
    sms: boolean;
    email: boolean;
  };
  categories: {
    screening: boolean;
    referral: boolean;
    camp: boolean;
    duplicateAlert: boolean;
    securityAlert: boolean;
    advisory: boolean;
  };
  preferredLanguage: SupportedLanguage;
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationPreferencesSchema = new Schema<INotificationPreferences>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    channels: {
      inApp: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
    },
    categories: {
      screening: { type: Boolean, default: true },
      referral: { type: Boolean, default: true },
      camp: { type: Boolean, default: true },
      duplicateAlert: { type: Boolean, default: true },
      securityAlert: { type: Boolean, default: true },
      advisory: { type: Boolean, default: true },
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'te', 'hi'],
      default: 'en',
    },
    phone: {
      type: String,
    },
    email: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const NotificationPreferences = mongoose.model<INotificationPreferences>(
  'NotificationPreferences',
  NotificationPreferencesSchema
);
