import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { Notification } from './notificationModel.js';
import { NotificationPreferences } from './notificationPreferencesModel.js';
import { NotificationQueue } from './notificationQueue.js';
import { NOTIFICATION_TEMPLATES } from './templates.js';

const router = Router();

const EnqueueNotificationSchema = z.object({
  recipientId: z.string().optional(),
  recipientRole: z.string().optional(),
  templateId: z.string().optional(),
  params: z.record(z.union([z.string(), z.number()])).optional(),
  customTitle: z.string().optional(),
  customBody: z.string().optional(),
  category: z
    .enum(['screening', 'referral', 'camp', 'duplicate_alert', 'security', 'advisory'])
    .optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  channels: z.array(z.enum(['in_app', 'sms', 'email'])).optional(),
  link: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const UpdatePreferencesSchema = z.object({
  channels: z
    .object({
      inApp: z.boolean().optional(),
      sms: z.boolean().optional(),
      email: z.boolean().optional(),
    })
    .optional(),
  categories: z
    .object({
      screening: z.boolean().optional(),
      referral: z.boolean().optional(),
      camp: z.boolean().optional(),
      duplicateAlert: z.boolean().optional(),
      securityAlert: z.boolean().optional(),
      advisory: z.boolean().optional(),
    })
    .optional(),
  preferredLanguage: z.enum(['en', 'te', 'hi']).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

// ==========================================
// 1. List In-App Notifications for Current User
// ==========================================
router.get(
  '/',
  requireAuth,
  authorizeCapability('notification:read_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const category = req.query.category as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

      const filter: Record<string, any> = { recipientId: userId };
      if (unreadOnly) {
        filter.read = false;
      }
      if (category) {
        filter.category = category;
      }

      const total = await Notification.countDocuments(filter);
      const unreadCount = await Notification.countDocuments({ recipientId: userId, read: false });

      const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);

      res.status(200).envelope({
        notifications,
        total,
        unreadCount,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 2. Enqueue / Dispatch Notification
// ==========================================
router.post(
  '/',
  requireAuth,
  authorizeCapability('notification:send'),
  validate({ body: EnqueueNotificationSchema }),
  auditTag('NOTIFICATION_DISPATCH', 'notification'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body;
      const recipientId = data.recipientId || req.user!.id;

      const record = await NotificationQueue.enqueue({
        recipientId,
        recipientRole: data.recipientRole || req.user!.role,
        templateId: data.templateId,
        params: data.params,
        customTitle: data.customTitle,
        customBody: data.customBody,
        category: data.category,
        priority: data.priority,
        channels: data.channels || ['in_app'],
        link: data.link,
        metadata: data.metadata,
      });

      res.status(201).envelope({
        notification: record,
        deliveryStatus: record.deliveryStatus,
        overallStatus: record.overallStatus,
        notice:
          'SMS and Email channels are explicitly configured as BLOCKED stubs in simulation mode. No external telecommunications or email delivery is claimed.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 3. Mark All In-App Notifications as Read
// ==========================================
router.patch(
  '/read-all',
  requireAuth,
  authorizeCapability('notification:manage_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await Notification.updateMany(
        { recipientId: userId, read: false },
        { $set: { read: true, readAt: new Date() } }
      );

      res.status(200).envelope({
        modifiedCount: result.modifiedCount,
        message: 'All notifications marked as read',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 4. Mark Specific Notification as Read
// ==========================================
router.patch(
  '/:id/read',
  requireAuth,
  authorizeCapability('notification:manage_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const notifQuery = mongoose.isValidObjectId(id)
        ? { $or: [{ _id: id }, { notificationId: id }] }
        : { notificationId: id };

      const notif = await Notification.findOne(notifQuery);

      if (!notif) {
        res.envelopeError('NOT_FOUND', 'Notification not found', undefined, 404);
        return;
      }

      // Must be own notification unless system_admin
      if (notif.recipientId !== userId && req.user!.role !== 'system_admin') {
        res.envelopeError('FORBIDDEN', 'Access denied to other user notification', undefined, 403);
        return;
      }

      notif.read = true;
      notif.readAt = new Date();
      await notif.save();

      res.status(200).envelope({
        notification: notif,
        message: 'Notification marked as read',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 5. Get User Notification Preferences
// ==========================================
router.get(
  '/preferences',
  requireAuth,
  authorizeCapability('notification:read_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      let prefs = await NotificationPreferences.findOne({ userId });

      if (!prefs) {
        prefs = await NotificationPreferences.create({
          userId,
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
        });
      }

      res.status(200).envelope({
        preferences: prefs,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 6. Update User Notification Preferences
// ==========================================
router.put(
  '/preferences',
  requireAuth,
  authorizeCapability('notification:manage_own'),
  validate({ body: UpdatePreferencesSchema }),
  auditTag('NOTIFICATION_PREFERENCES_UPDATE', 'notification_preferences'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const data = req.body;

      let prefs = await NotificationPreferences.findOne({ userId });
      if (!prefs) {
        prefs = new NotificationPreferences({ userId });
      }

      if (data.channels) {
        prefs.channels = { ...prefs.channels, ...data.channels };
      }
      if (data.categories) {
        prefs.categories = { ...prefs.categories, ...data.categories };
      }
      if (data.preferredLanguage) {
        prefs.preferredLanguage = data.preferredLanguage;
      }
      if (data.phone !== undefined) {
        prefs.phone = data.phone;
      }
      if (data.email !== undefined) {
        prefs.email = data.email;
      }

      await prefs.save();

      res.status(200).envelope({
        preferences: prefs,
        message: 'Notification preferences updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ==========================================
// 7. Get Available Templates Registry
// ==========================================
router.get(
  '/templates',
  requireAuth,
  authorizeCapability('notification:read_own'),
  async (req: Request, res: Response): Promise<void> => {
    const templates = Object.values(NOTIFICATION_TEMPLATES).map((t) => ({
      templateId: t.templateId,
      category: t.category,
      description: t.description,
      requiredParams: t.requiredParams,
      supportedLanguages: Object.keys(t.translations),
      previewEn: t.translations.en,
    }));

    res.status(200).envelope({
      templates,
      count: templates.length,
      notice: 'All templates strictly adhere to clinical safety standards with non-diagnostic screening language.',
    });
  }
);

// ==========================================
// 8. Inspect Delivery Status Per Channel
// ==========================================
router.get(
  '/:id/delivery-status',
  requireAuth,
  authorizeCapability('notification:read_own'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const notifQuery = mongoose.isValidObjectId(id)
        ? { $or: [{ _id: id }, { notificationId: id }] }
        : { notificationId: id };

      const notif = await Notification.findOne(notifQuery);

      if (!notif) {
        res.envelopeError('NOT_FOUND', 'Notification not found', undefined, 404);
        return;
      }

      // Check access: own notification or system_admin/admin
      if (
        notif.recipientId !== req.user!.id &&
        req.user!.role !== 'system_admin' &&
        req.user!.role !== 'admin'
      ) {
        res.envelopeError('FORBIDDEN', 'Access denied to delivery status for this record', undefined, 403);
        return;
      }

      res.status(200).envelope({
        notificationId: notif.notificationId,
        channels: notif.channels,
        deliveryStatus: notif.deliveryStatus,
        overallStatus: notif.overallStatus,
        isBlockedStubEnforced: notif.deliveryStatus.some(
          (d) => d.status === 'BLOCKED_STUB' && d.delivered === false && d.claimed === false
        ),
      });
    } catch (err) {
      next(err);
    }
  }
);

export const notificationRouter = router;
