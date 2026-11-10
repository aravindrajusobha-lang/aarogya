import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { createTestReplicaSet } from './setupReplSet.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { SmsAdapter } from '../src/modules/notification/adapters/smsAdapter.js';
import { EmailAdapter } from '../src/modules/notification/adapters/emailAdapter.js';
import { InAppAdapter } from '../src/modules/notification/adapters/inAppAdapter.js';
import { NOTIFICATION_TEMPLATES, renderTemplate } from '../src/modules/notification/templates.js';
import { Notification } from '../src/modules/notification/notificationModel.js';
import { NotificationPreferences } from '../src/modules/notification/notificationPreferencesModel.js';
import { NotificationQueue } from '../src/modules/notification/notificationQueue.js';
import enLocale from '../src/i18n/locales/en.json';
import teLocale from '../src/i18n/locales/te.json';
import hiLocale from '../src/i18n/locales/hi.json';

const PROHIBITED_PATTERNS = [
  /\bdiagnosis\b/i,
  /\bdiagnose\b/i,
  /\bcancer[- ]free\b/i,
  /\bcancer stage\b/i,
  /\bstage\s+[1-4ivx]+\b/i,
  /\bcurative\b/i,
  /\bchemotherapy\b/i,
  /\bradiation plan\b/i,
];

describe('Phase 5: Notification Core & Clinical Safety Verification', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  const testUserId = 'test_worker_asha_1';
  let ashaToken: string;
  let adminToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsNotification');
    await mongoose.connect(replSet.getUri());

    ashaToken = signAccessToken({
      userId: testUserId,
      role: 'asha',
      scopes: ['notification:read_own', 'notification:manage_own', 'notification:send'],
      deviceSessionId: 'ses_notif_asha',
      deviceId: 'dev_notif_asha',
    });

    adminToken = signAccessToken({
      userId: 'test_admin_1',
      role: 'admin',
      scopes: ['*'],
      deviceSessionId: 'ses_notif_admin',
      deviceId: 'dev_notif_admin',
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  // ==========================================
  // 1. Adapter Stubs & Truth in Delivery
  // ==========================================
  describe('Channel Adapters: SMS and Email BLOCKED Stubs', () => {
    it('SmsAdapter strictly returns BLOCKED_STUB, delivered: false, claimed: false', async () => {
      const result = await SmsAdapter.send('+919876543210', 'Test message');

      expect(SmsAdapter.isBlockedStub).toBe(true);
      expect(SmsAdapter.gatewayConfigured).toBe(false);
      expect(result.channel).toBe('sms');
      expect(result.delivered).toBe(false);
      expect(result.status).toBe('BLOCKED_STUB');
      expect(result.claimed).toBe(false);
      expect(result.reason).toContain('BLOCKED stub in simulation/sandbox mode');
      expect(result.reason).toContain('No SMS gateway or telecommunications delivery is claimed');
    });

    it('EmailAdapter strictly returns BLOCKED_STUB, delivered: false, claimed: false', async () => {
      const result = await EmailAdapter.send(
        'worker@example.com',
        'Test Subject',
        'Test Email Content'
      );

      expect(EmailAdapter.isBlockedStub).toBe(true);
      expect(EmailAdapter.transportConfigured).toBe(false);
      expect(result.channel).toBe('email');
      expect(result.delivered).toBe(false);
      expect(result.status).toBe('BLOCKED_STUB');
      expect(result.claimed).toBe(false);
      expect(result.reason).toContain('BLOCKED stub in simulation/sandbox mode');
      expect(result.reason).toContain('No SMTP transport or delivery is claimed');
    });

    it('InAppAdapter succeeds and records real in-app delivery', async () => {
      const result = await InAppAdapter.send('NOTIF-TEST-123');

      expect(InAppAdapter.isBlockedStub).toBe(false);
      expect(result.channel).toBe('in_app');
      expect(result.delivered).toBe(true);
      expect(result.status).toBe('delivered');
      expect(result.notificationId).toBe('NOTIF-TEST-123');
    });
  });

  // ==========================================
  // 2. Clinical Safety Guardrail on Templates
  // ==========================================
  describe('Clinical Safety: Zero Diagnostic/Clinical Claims in Templates', () => {
    it('verifies that no template in NOTIFICATION_TEMPLATES contains prohibited oncology terms', () => {
      const violations: { templateId: string; lang: string; field: string; match: string }[] = [];

      for (const [templateId, def] of Object.entries(NOTIFICATION_TEMPLATES)) {
        for (const [lang, text] of Object.entries(def.translations)) {
          for (const pattern of PROHIBITED_PATTERNS) {
            if (pattern.test(text.title)) {
              violations.push({ templateId, lang, field: 'title', match: text.title });
            }
            if (pattern.test(text.body)) {
              violations.push({ templateId, lang, field: 'body', match: text.body });
            }
          }
        }
      }

      expect(violations).toEqual([]);
    });

    it('interpolates parameters while strictly preserving safe screening wording', () => {
      const rendered = renderTemplate('SCREENING_RECORDED', 'en', {
        patientId: 'PAD-2026-99999',
      });

      expect(rendered.title).toBe('Oral Health Screening Recorded');
      expect(rendered.body).toContain('PAD-2026-99999');
      expect(rendered.body).toContain('visual findings');
      // Prohibited patterns test
      PROHIBITED_PATTERNS.forEach((p) => {
        expect(p.test(rendered.body)).toBe(false);
      });
    });

    it('renders localized templates in Telugu and Hindi correctly', () => {
      const teRendered = renderTemplate('CAMP_SCHEDULED', 'te', {
        villageName: 'అరకు లోయ',
        campDate: '2026-11-15',
      });
      expect(teRendered.title).toBe('నోటి స్క్రీనింగ్ శిబిరం షెడ్యూల్ చేయబడింది');
      expect(teRendered.body).toContain('అరకు లోయ');
      expect(teRendered.body).toContain('2026-11-15');

      const hiRendered = renderTemplate('DUPLICATE_ALERT', 'hi', {
        patientId: 'PAD-2026-11111',
        score: 85,
      });
      expect(hiRendered.title).toBe('समान रोगी पंजीकरण समीक्षा आवश्यक');
      expect(hiRendered.body).toContain('PAD-2026-11111');
      expect(hiRendered.body).toContain('85%');
    });
  });

  // ==========================================
  // 3. i18n Parity Across All Locales
  // ==========================================
  describe('i18n Parity for Notification Keys', () => {
    it('ensures exact notification key parity across en.json, te.json, and hi.json', () => {
      const enNotif = (enLocale as any).notifications;
      const teNotif = (teLocale as any).notifications;
      const hiNotif = (hiLocale as any).notifications;

      expect(enNotif).toBeDefined();
      expect(teNotif).toBeDefined();
      expect(hiNotif).toBeDefined();

      const enKeys = Object.keys(enNotif).sort();
      const teKeys = Object.keys(teNotif).sort();
      const hiKeys = Object.keys(hiNotif).sort();

      expect(teKeys).toEqual(enKeys);
      expect(hiKeys).toEqual(enKeys);

      // Verify no empty translations
      enKeys.forEach((key) => {
        expect(enNotif[key].trim().length).toBeGreaterThan(0);
        expect(teNotif[key].trim().length).toBeGreaterThan(0);
        expect(hiNotif[key].trim().length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================
  // 4. Notification Queue & Multi-Channel Delivery Status
  // ==========================================
  describe('NotificationQueue Dispatch & Delivery Pipeline', () => {
    it('creates in-app notification with delivered: true', async () => {
      const notif = await NotificationQueue.enqueue({
        recipientId: testUserId,
        templateId: 'SCREENING_RECORDED',
        params: { patientId: 'PAD-2026-00001' },
        category: 'screening',
        priority: 'high',
        channels: ['in_app'],
      });

      expect(notif.notificationId).toMatch(/^NOTIF-/);
      expect(notif.recipientId).toBe(testUserId);
      expect(notif.overallStatus).toBe('delivered');
      expect(notif.read).toBe(false);
      expect(notif.deliveryStatus).toHaveLength(1);
      expect(notif.deliveryStatus[0].channel).toBe('in_app');
      expect(notif.deliveryStatus[0].delivered).toBe(true);
      expect(notif.deliveryStatus[0].status).toBe('delivered');
    });

    it('enforces BLOCKED_STUB for SMS and Email when dispatched', async () => {
      // Configure user preferences to allow sms and email
      await NotificationPreferences.findOneAndUpdate(
        { userId: testUserId },
        {
          userId: testUserId,
          channels: { inApp: true, sms: true, email: true },
          categories: {
            screening: true,
            referral: true,
            camp: true,
            duplicateAlert: true,
            securityAlert: true,
            advisory: true,
          },
          phone: '+919876543210',
          email: 'asha@aarogyadrishti.org',
        },
        { upsert: true, new: true }
      );

      const notif = await NotificationQueue.enqueue({
        recipientId: testUserId,
        templateId: 'REFERRAL_DISPATCHED',
        params: { patientId: 'PAD-2026-00002', facilityName: 'Paderu Area Hospital' },
        category: 'referral',
        channels: ['in_app', 'sms', 'email'],
      });

      expect(notif.overallStatus).toBe('partially_delivered');
      expect(notif.deliveryStatus).toHaveLength(3);

      const inAppStatus = notif.deliveryStatus.find((d) => d.channel === 'in_app')!;
      const smsStatus = notif.deliveryStatus.find((d) => d.channel === 'sms')!;
      const emailStatus = notif.deliveryStatus.find((d) => d.channel === 'email')!;

      // In-App succeeded
      expect(inAppStatus.delivered).toBe(true);
      expect(inAppStatus.status).toBe('delivered');

      // SMS is strictly a BLOCKED stub
      expect(smsStatus.delivered).toBe(false);
      expect(smsStatus.status).toBe('BLOCKED_STUB');
      expect(smsStatus.claimed).toBe(false);
      expect(smsStatus.reason).toContain('BLOCKED stub in simulation/sandbox mode');

      // Email is strictly a BLOCKED stub
      expect(emailStatus.delivered).toBe(false);
      expect(emailStatus.status).toBe('BLOCKED_STUB');
      expect(emailStatus.claimed).toBe(false);
      expect(emailStatus.reason).toContain('BLOCKED stub in simulation/sandbox mode');
    });

    it('skips disabled categories based on user preferences', async () => {
      // Disable camp category
      await NotificationPreferences.findOneAndUpdate(
        { userId: testUserId },
        { $set: { 'categories.camp': false } }
      );

      const notif = await NotificationQueue.enqueue({
        recipientId: testUserId,
        templateId: 'CAMP_SCHEDULED',
        params: { villageName: 'G. Madugula', campDate: '2026-11-20' },
        category: 'camp',
        channels: ['in_app'],
      });

      expect(notif.overallStatus).toBe('skipped');
      expect(notif.deliveryStatus[0].status).toBe('skipped_by_preference');
    });
  });

  // ==========================================
  // 5. Notification API Endpoints
  // ==========================================
  describe('Notification API Endpoints', () => {
    it('GET /api/v1/notifications lists user in-app notifications and unread count', async () => {
      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toBeInstanceOf(Array);
      expect(res.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/notifications enqueues a new notification', async () => {
      // Re-enable camp category
      await NotificationPreferences.findOneAndUpdate(
        { userId: testUserId },
        { $set: { 'categories.camp': true } }
      );

      const res = await request(app)
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          templateId: 'CAMP_SCHEDULED',
          params: { villageName: 'Chintapalli', campDate: '2026-11-10' },
          category: 'camp',
          channels: ['in_app', 'sms'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notification.notificationId).toBeDefined();
      expect(res.body.data.notice).toContain('BLOCKED stubs in simulation mode');
    });

    it('PATCH /api/v1/notifications/:id/read marks notification as read', async () => {
      const unreadNotif = await Notification.findOne({ recipientId: testUserId, read: false });
      expect(unreadNotif).toBeDefined();

      const res = await request(app)
        .patch(`/api/v1/notifications/${unreadNotif!.notificationId}/read`)
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notification.read).toBe(true);
      expect(res.body.data.notification.readAt).toBeDefined();
    });

    it('PATCH /api/v1/notifications/read-all marks all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const remainingUnread = await Notification.countDocuments({
        recipientId: testUserId,
        read: false,
      });
      expect(remainingUnread).toBe(0);
    });

    it('GET /api/v1/notifications/preferences retrieves preferences', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.preferences.userId).toBe(testUserId);
      expect(res.body.data.preferences.channels.inApp).toBe(true);
    });

    it('PUT /api/v1/notifications/preferences updates preferences', async () => {
      const res = await request(app)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          channels: { inApp: true, sms: false, email: false },
          preferredLanguage: 'te',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.preferences.preferredLanguage).toBe('te');
      expect(res.body.data.preferences.channels.sms).toBe(false);
    });

    it('GET /api/v1/notifications/templates returns safe templates list', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/templates')
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.templates.length).toBeGreaterThan(0);
      expect(res.body.data.notice).toContain('non-diagnostic screening language');
    });

    it('GET /api/v1/notifications/:id/delivery-status inspects channel delivery details', async () => {
      // Create a test record with SMS & Email
      const notif = await Notification.create({
        notificationId: 'NOTIF-STATUS-CHECK-1',
        recipientId: testUserId,
        title: 'Status Check',
        body: 'Verifying delivery statuses',
        category: 'advisory',
        priority: 'normal',
        channels: ['in_app', 'sms', 'email'],
        deliveryStatus: [
          { channel: 'in_app', delivered: true, status: 'delivered', attemptedAt: new Date() },
          {
            channel: 'sms',
            delivered: false,
            status: 'BLOCKED_STUB',
            reason: 'SMS delivery is a BLOCKED stub in simulation/sandbox mode',
            claimed: false,
            attemptedAt: new Date(),
          },
          {
            channel: 'email',
            delivered: false,
            status: 'BLOCKED_STUB',
            reason: 'Email delivery is a BLOCKED stub in simulation/sandbox mode',
            claimed: false,
            attemptedAt: new Date(),
          },
        ],
        overallStatus: 'partially_delivered',
        read: false,
      });

      const res = await request(app)
        .get(`/api/v1/notifications/${notif.notificationId}/delivery-status`)
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isBlockedStubEnforced).toBe(true);

      const statuses = res.body.data.deliveryStatus;
      const smsStatus = statuses.find((s: any) => s.channel === 'sms');
      const emailStatus = statuses.find((s: any) => s.channel === 'email');

      expect(smsStatus.delivered).toBe(false);
      expect(smsStatus.status).toBe('BLOCKED_STUB');
      expect(smsStatus.claimed).toBe(false);

      expect(emailStatus.delivered).toBe(false);
      expect(emailStatus.status).toBe('BLOCKED_STUB');
      expect(emailStatus.claimed).toBe(false);
    });
  });
});
