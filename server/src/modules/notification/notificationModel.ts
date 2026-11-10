import mongoose, { Schema, Document } from 'mongoose';

export type NotificationChannel = 'in_app' | 'sms' | 'email';
export type NotificationCategory =
  | 'screening'
  | 'referral'
  | 'camp'
  | 'duplicate_alert'
  | 'security'
  | 'advisory';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ChannelDeliveryStatus {
  channel: NotificationChannel;
  delivered: boolean;
  status: 'delivered' | 'BLOCKED_STUB' | 'skipped_by_preference' | 'failed';
  attemptedAt: Date;
  reason?: string;
  claimed?: boolean;
}

export interface INotification extends Document {
  notificationId: string;
  recipientId: string;
  recipientRole?: string;
  title: string;
  body: string;
  templateId?: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  deliveryStatus: ChannelDeliveryStatus[];
  overallStatus: 'delivered' | 'partially_delivered' | 'blocked' | 'skipped';
  read: boolean;
  readAt?: Date;
  link?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ChannelDeliveryStatusSchema = new Schema(
  {
    channel: {
      type: String,
      enum: ['in_app', 'sms', 'email'],
      required: true,
    },
    delivered: {
      type: Boolean,
      required: true,
      default: false,
    },
    status: {
      type: String,
      required: true,
    },
    attemptedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
    },
    claimed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const NotificationSchema = new Schema<INotification>(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    templateId: {
      type: String,
    },
    category: {
      type: String,
      enum: ['screening', 'referral', 'camp', 'duplicate_alert', 'security', 'advisory'],
      default: 'advisory',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    channels: [
      {
        type: String,
        enum: ['in_app', 'sms', 'email'],
      },
    ],
    deliveryStatus: [ChannelDeliveryStatusSchema],
    overallStatus: {
      type: String,
      enum: ['delivered', 'partially_delivered', 'blocked', 'skipped'],
      default: 'delivered',
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    link: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
