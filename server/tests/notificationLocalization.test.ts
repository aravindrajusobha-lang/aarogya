import { describe, expect, it } from 'vitest';
import { makeT } from '../../client/src/portal/lib';
import { notificationContent, NotificationItem } from '../../client/src/portal/notificationContent';

const notification = (overrides: Partial<NotificationItem>): NotificationItem => ({
  notificationId: 'NOTIF-test',
  title: '',
  body: '',
  read: false,
  createdAt: '2026-11-16T00:00:00.000Z',
  ...overrides,
});

describe('patient notification localization', () => {
  it('translates saved appointment notices and keeps facility and slot details', () => {
    const t = makeT('te');
    const confirmed = notificationContent(notification({
      title: 'Appointment Confirmed',
      body: 'Your consultation appointment at Araku Valley Community Health Centre is confirmed for 14/1/2026, 10:00:00 am.',
      metadata: {
        slotStartTime: '2026-01-14T04:30:00.000Z',
      },
    }), t, 'te');
    const requested = notificationContent(notification({
      title: 'Consultation Appointment Requested',
      body: 'A consultation appointment has been requested at Araku Valley Community Health Centre for 14/1/2026, 10:00:00 am. Confirmation pending review by hospital staff.',
      metadata: {
        slotStartTime: '2026-01-14T04:30:00.000Z',
      },
    }), t, 'te');

    expect(confirmed.title).toBe(t('notificationMessages.appointmentConfirmedTitle'));
    expect(confirmed.body).toContain('Araku Valley Community Health Centre');
    expect(confirmed.body).not.toContain('Your consultation appointment');
    expect(requested.title).toBe(t('notificationMessages.appointmentRequestedTitle'));
    expect(requested.body).toContain('Araku Valley Community Health Centre');
    expect(requested.body).not.toContain('Confirmation pending review');
  });

  it('translates consultation start and completion messages in the selected language', () => {
    const t = makeT('hi');
    const started = notificationContent(notification({
      title: 'Your doctor has started the consultation',
      body: 'Open your appointment and tap "Join consultation" to enter the private video room.',
    }), t, 'hi');
    const completed = notificationContent(notification({
      title: 'Consultation completed',
      body: 'Your consultation has ended.',
    }), t, 'hi');

    expect(started.title).toBe(t('notificationMessages.consultationStartedTitle'));
    expect(started.body).toBe(t('notificationMessages.consultationStartedBody'));
    expect(completed.title).toBe(t('notificationMessages.consultationCompletedTitle'));
    expect(completed.body).toBe(t('notificationMessages.consultationCompletedBody'));
  });

  it('uses the selected language for template-backed notifications', () => {
    const result = notificationContent(notification({
      title: 'Oral Health Screening Recorded',
      body: 'Stored English copy',
      templateId: 'SCREENING_RECORDED',
    }), makeT('te'), 'te');

    expect(result.title).toBe('నోటి ఆరోగ్య స్క్రీనింగ్ నమోదు చేయబడింది');
    expect(result.body).toBe('దృశ్య నోటి ఆరోగ్య స్క్రీనింగ్ సెషన్ నమోదు చేయబడింది. పరిశీలనలు మరియు తదుపరి సిఫార్సులను సమీక్షించండి.');
  });
});
