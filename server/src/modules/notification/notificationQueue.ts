import crypto from 'crypto';
import {
  Notification,
  INotification,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  ChannelDeliveryStatus,
} from './notificationModel.js';
import {
  NotificationPreferences,
  INotificationPreferences,
} from './notificationPreferencesModel.js';
import { renderTemplate, SupportedLanguage } from './templates.js';
import { SmsAdapter } from './adapters/smsAdapter.js';
import { EmailAdapter } from './adapters/emailAdapter.js';
import { InAppAdapter } from './adapters/inAppAdapter.js';
import { logger } from '../../config/logger.js';

export interface EnqueueNotificationOptions {
  recipientId: string;
  recipientRole?: string;
  templateId?: string;
  params?: Record<string, string | number>;
  customTitle?: string;
  customBody?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  link?: string;
  metadata?: Record<string, any>;
}

export class NotificationQueue {
  /**
   * Enqueues and executes dispatch across requested channels.
   * Enforces user channel & category preferences, and records explicit delivery status per channel.
   * External adapters (SMS, Email) are strictly BLOCKED stubs and never claim delivery.
   */
  static async enqueue(options: EnqueueNotificationOptions): Promise<INotification> {
    const {
      recipientId,
      recipientRole,
      templateId,
      params = {},
      customTitle,
      customBody,
      category = 'advisory',
      priority = 'normal',
      channels = ['in_app'],
      link,
      metadata = {},
    } = options;

    // 1. Fetch or default recipient preferences
    let prefs: any = await NotificationPreferences.findOne({ userId: recipientId });
    if (!prefs) {
      prefs = {
        userId: recipientId,
        channels: { inApp: true, sms: false, email: false },
        categories: {
          screening: true,
          referral: true,
          camp: true,
          duplicateAlert: true,
          securityAlert: true,
          advisory: true,
        },
        preferredLanguage: 'en',
      } as unknown as INotificationPreferences;
    }

    // 2. Check category preference
    const categoryKeyMap: Record<NotificationCategory, keyof typeof prefs.categories> = {
      screening: 'screening',
      referral: 'referral',
      camp: 'camp',
      duplicate_alert: 'duplicateAlert',
      security: 'securityAlert',
      advisory: 'advisory',
    };

    const prefKey = categoryKeyMap[category];
    const categoryEnabled = prefs.categories?.[prefKey] ?? true;

    // 3. Resolve Title & Body
    let title = customTitle || 'Notification';
    let body = customBody || '';

    if (templateId) {
      const rendered = renderTemplate(
        templateId,
        (prefs.preferredLanguage as SupportedLanguage) || 'en',
        params
      );
      title = rendered.title;
      body = rendered.body;
    }

    // 4. Generate notification ID
    const notificationId = `NOTIF-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    // 5. If category is disabled by preference, record as skipped
    if (!categoryEnabled) {
      const skippedStatuses: ChannelDeliveryStatus[] = channels.map((ch) => ({
        channel: ch,
        delivered: false,
        status: 'skipped_by_preference',
        attemptedAt: new Date(),
        reason: `Category '${category}' is disabled in recipient notification preferences`,
        claimed: false,
      }));

      const record = await Notification.create({
        notificationId,
        recipientId,
        recipientRole,
        title,
        body,
        templateId,
        category,
        priority,
        channels,
        deliveryStatus: skippedStatuses,
        overallStatus: 'skipped',
        read: false,
        link,
        metadata,
      });

      logger.info({ notificationId, recipientId, category }, 'Notification skipped by user category preference');
      return record;
    }

    // 6. Channel Dispatch
    const deliveryStatuses: ChannelDeliveryStatus[] = [];

    for (const channel of channels) {
      const now = new Date();

      if (channel === 'in_app') {
        if (!prefs.channels.inApp) {
          deliveryStatuses.push({
            channel: 'in_app',
            delivered: false,
            status: 'skipped_by_preference',
            attemptedAt: now,
            reason: 'In-app notifications disabled in recipient preferences',
            claimed: false,
          });
        } else {
          await InAppAdapter.send(notificationId);
          deliveryStatuses.push({
            channel: 'in_app',
            delivered: true,
            status: 'delivered',
            attemptedAt: now,
            reason: 'In-app notification saved and queued for inbox delivery',
            claimed: true,
          });
        }
      } else if (channel === 'sms') {
        if (!prefs.channels.sms) {
          deliveryStatuses.push({
            channel: 'sms',
            delivered: false,
            status: 'skipped_by_preference',
            attemptedAt: now,
            reason: 'SMS notifications disabled in recipient preferences',
            claimed: false,
          });
        } else {
          const smsResult = await SmsAdapter.send(prefs.phone || '', `${title}: ${body}`);
          deliveryStatuses.push({
            channel: 'sms',
            delivered: false,
            status: smsResult.status,
            attemptedAt: now,
            reason: smsResult.reason,
            claimed: false,
          });
        }
      } else if (channel === 'email') {
        if (!prefs.channels.email) {
          deliveryStatuses.push({
            channel: 'email',
            delivered: false,
            status: 'skipped_by_preference',
            attemptedAt: now,
            reason: 'Email notifications disabled in recipient preferences',
            claimed: false,
          });
        } else {
          const emailResult = await EmailAdapter.send(prefs.email || '', title, body);
          deliveryStatuses.push({
            channel: 'email',
            delivered: false,
            status: emailResult.status,
            attemptedAt: now,
            reason: emailResult.reason,
            claimed: false,
          });
        }
      }
    }

    // 7. Calculate overall status
    const inAppStatus = deliveryStatuses.find((s) => s.channel === 'in_app');
    const hasExternalBlocked = deliveryStatuses.some(
      (s) => s.status === 'BLOCKED_STUB'
    );

    let overallStatus: 'delivered' | 'partially_delivered' | 'blocked' | 'skipped' = 'delivered';

    if (inAppStatus?.delivered && hasExternalBlocked) {
      overallStatus = 'partially_delivered';
    } else if (inAppStatus?.delivered) {
      overallStatus = 'delivered';
    } else if (deliveryStatuses.every((s) => s.status === 'BLOCKED_STUB')) {
      overallStatus = 'blocked';
    } else if (deliveryStatuses.every((s) => s.status === 'skipped_by_preference')) {
      overallStatus = 'skipped';
    }

    // 8. Create and persist Notification
    const notification = await Notification.create({
      notificationId,
      recipientId,
      recipientRole,
      title,
      body,
      templateId,
      category,
      priority,
      channels,
      deliveryStatus: deliveryStatuses,
      overallStatus,
      read: false,
      link,
      metadata,
    });

    logger.info(
      {
        notificationId,
        recipientId,
        overallStatus,
        deliverySummary: deliveryStatuses.map((d) => `${d.channel}:${d.status}`),
      },
      'Notification processed through delivery pipeline'
    );

    return notification;
  }
}
