import { getClientTranslation, LanguageCode, translations } from '../i18n';
import { fmtDate, fmtDateTime, Translate } from './lib';

export interface NotificationItem {
  notificationId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link?: string;
  templateId?: string;
  metadata?: Record<string, unknown>;
}

const TEMPLATE_NOTIFICATION_KEYS: Record<string, string> = {
  SCREENING_RECORDED: 'screeningRecorded',
  REFERRAL_DISPATCHED: 'referralDispatched',
  CAMP_SCHEDULED: 'campScheduled',
  DUPLICATE_ALERT: 'duplicateAlert',
  SECURITY_ALERT: 'securityAlert',
};

export function notificationContent(item: NotificationItem, t: Translate, lang: LanguageCode) {
  const { title, body, metadata = {} } = item;
  const localizedSlot = (value: unknown, fallback: string) =>
    typeof value === 'string' ? fmtDateTime(value, lang) : fallback;

  if (item.templateId && TEMPLATE_NOTIFICATION_KEYS[item.templateId]) {
    const key = TEMPLATE_NOTIFICATION_KEYS[item.templateId];
    return {
      title: getClientTranslation(translations[lang], `notifications.${key}Title`),
      body: getClientTranslation(translations[lang], `notifications.${key}Body`),
    };
  }

  if (title === 'Your doctor has started the consultation') {
    return { title: t('notificationMessages.consultationStartedTitle'), body: t('notificationMessages.consultationStartedBody') };
  }

  if (title === 'Consultation completed') {
    const followUp = body.match(/Next follow-up is due around (.+)\.$/);
    return {
      title: t('notificationMessages.consultationCompletedTitle'),
      body: followUp
        ? t('notificationMessages.consultationCompletedFollowUpBody', { date: fmtDate(followUp[1], lang) })
        : t('notificationMessages.consultationCompletedBody'),
    };
  }

  if (title === 'Appointment check-in') {
    return { title: t('notificationMessages.appointmentCheckInTitle'), body: t('notificationMessages.appointmentCheckInBody') };
  }

  if (title === 'Appointment completed') {
    return { title: t('notificationMessages.appointmentCompletedTitle'), body: t('notificationMessages.appointmentCompletedBody') };
  }

  const appointmentNotice = {
    'Appointment Confirmed': {
      title: 'appointmentConfirmedTitle',
      body: 'appointmentConfirmedBody',
      fallback: 'appointmentConfirmedFallback',
      pattern: /^Your consultation appointment at (.+) is confirmed for (.+)\.$/,
      slot: metadata.slotStartTime,
    },
    'Consultation Appointment Requested': {
      title: 'appointmentRequestedTitle',
      body: 'appointmentRequestedBody',
      fallback: 'appointmentRequestedFallback',
      pattern: /^A consultation appointment has been requested at (.+) for (.+)\. Confirmation pending review by hospital staff\.$/,
      slot: metadata.slotStartTime,
    },
    'Appointment Rescheduled': {
      title: 'appointmentRescheduledTitle',
      body: 'appointmentRescheduledBody',
      fallback: 'appointmentRescheduledFallback',
      pattern: /^Your consultation appointment at (.+) has been rescheduled to (.+)\. Reason: (.+)\.$/,
      slot: metadata.newSlotStartTime,
    },
    'Appointment Cancelled': {
      title: 'appointmentCancelledTitle',
      body: 'appointmentCancelledBody',
      fallback: 'appointmentCancelledFallback',
      pattern: /^Your consultation appointment at (.+) scheduled for (.+) has been cancelled\. Reason: (.+)\.$/,
      slot: metadata.slotStartTime,
    },
  }[title];

  if (appointmentNotice) {
    const match = body.match(appointmentNotice.pattern);
    if (!match) {
      return {
        title: t(`notificationMessages.${appointmentNotice.title}`),
        body: t(`notificationMessages.${appointmentNotice.fallback}`),
      };
    }

    const hospital = match[1];
    const time = localizedSlot(appointmentNotice.slot, match[2]);
    const reason = typeof metadata.reason === 'string' ? metadata.reason : match[3] || '';
    return {
      title: t(`notificationMessages.${appointmentNotice.title}`),
      body: t(`notificationMessages.${appointmentNotice.body}`, { hospital, time, reason }),
    };
  }

  return { title, body };
}
