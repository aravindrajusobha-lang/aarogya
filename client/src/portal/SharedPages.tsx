import React, { useState } from 'react';
import { LanguageCode } from '../i18n';
import { Card, Empty, Notice, PageHeader, Skeleton, StatusPill } from './PortalShell';
import { Icon } from './icons';
import { downloadPrescriptionPdf } from './prescriptionPdf';
import { api, fmtDate, fmtDateTime, fmtDuration, fmtTime, followUpLabel, SessionInfo, Translate, useApi } from './lib';

interface HistoryEntry extends SessionInfo {
  appointmentId: string; patientId: string; patientName: string | null; doctorName: string | null; facilityName: string | null; scheduledStart: string | null;
}

/* ---------- Consultation history (patient + doctor) ---------- */
export const ConsultationHistoryPage: React.FC<{ t: Translate; lang: LanguageCode; role: 'patient' | 'doctor' }> = ({ t, lang, role }) => {
  const { data, error, loading } = useApi<{ sessions: HistoryEntry[]; visitsByPatient: Record<string, number> }>('/api/v1/consultation-sessions/history', [], 30_000);
  const sessions = data?.sessions || [];
  return (
    <>
      <PageHeader title={t('session.history')} />
      <Card>
        {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice> : !sessions.length ? <Empty icon="history">{t('session.noHistory')}</Empty> : (
          <div className="adp-table-wrap">
            <table className="adp-table">
              <thead>
                <tr>
                  <th>{role === 'doctor' ? t('doctor.patient') : t('nav.consultations')}</th>
                  <th>{t('doctor.mode')}</th>
                  <th>{t('session.started')}</th>
                  <th>{t('session.ended')}</th>
                  <th>{t('session.duration')}</th>
                  <th>{t('session.followUp')}</th>
                  <th>{t('session.nextFollowUp')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((item) => {
                  const live = item.startedAt && !item.endedAt;
                  return (
                    <tr key={item.appointmentId}>
                      <td>
                        <strong>{role === 'doctor' ? item.patientName || item.patientId : item.doctorName || '—'}</strong>
                        <small>{role === 'doctor' ? t('doctor.visits', { n: data?.visitsByPatient[item.patientId] || 1 }) : item.facilityName}</small>
                      </td>
                      <td>{item.consultationMode === 'online' ? t('common.online') : t('common.inPerson')}</td>
                      <td>{fmtDate(item.startedAt, lang)}<small>{fmtTime(item.startedAt, lang)}</small></td>
                      <td>{live ? <span className="adp-live">{t('session.live')}</span> : <>{fmtDate(item.endedAt, lang)}<small>{fmtTime(item.endedAt, lang)}</small></>}</td>
                      <td>{fmtDuration(item.durationSeconds)}</td>
                      <td>{followUpLabel(t, item.followUp)}{item.followUp?.plannedSessions ? <small>{t('session.planned', { n: item.followUp.plannedSessions })}</small> : null}</td>
                      <td>{item.followUp?.nextFollowUpAt ? fmtDate(item.followUp.nextFollowUpAt, lang) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
};

/* ---------- Prescriptions (patient) ---------- */
interface Prescription {
  prescriptionId: string; doctorName: string; doctorSpecialty?: string; hospitalName?: string; createdAt: string; status: string; followUpDate?: string;
  medicines: Array<{ medicineName: string; dosage: string; frequency: string; durationDays: number; instructions?: string }>;
  labTestsRecommended?: string[];
}

export const PrescriptionsPage: React.FC<{ t: Translate; lang: LanguageCode; patientId?: string; patientName?: string }> = ({ t, lang, patientId, patientName }) => {
  const { data, error, loading, reload } = useApi<{ prescriptions: Prescription[] }>(patientId ? `/api/v1/prescriptions/patient/${encodeURIComponent(patientId)}` : null, [patientId], 15000);
  const items = data?.prescriptions || [];
  return (
    <>
      <PageHeader title={t('nav.prescriptions')} action={<button className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => void reload()}>{t('common.refresh')}</button>} />
      {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice> : !items.length ? <Card><Empty icon="pill">{t('common.noPrescriptions')}</Empty></Card> : (
        <div className="adp-list">
          {items.map((item) => (
            <Card key={item.prescriptionId} title={item.doctorName} icon="pill" action={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><StatusPill tone={item.status === 'active' ? 'green' : 'gray'}>{item.status}</StatusPill><button type="button" className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => downloadPrescriptionPdf(item, patientName || '')}><Icon.file size={16} />{t('rx.download')}</button></div>}>
              <p style={{ color: 'var(--adp-text-3)', fontSize: '.85rem', marginBottom: 12 }}>{[item.doctorSpecialty, item.hospitalName, fmtDate(item.createdAt, lang)].filter(Boolean).join(' · ')}</p>
              <div className="adp-table-wrap">
                <table className="adp-table" style={{ minWidth: 520 }}>
                  <tbody>
                    {item.medicines.map((medicine, index) => (
                      <tr key={`${medicine.medicineName}-${index}`}>
                        <td><strong>{medicine.medicineName}</strong><small>{medicine.instructions}</small></td>
                        <td>{medicine.dosage}</td>
                        <td>{medicine.frequency}</td>
                        <td>{medicine.durationDays} d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {item.followUpDate && <p style={{ marginTop: 10, fontWeight: 600 }}>{t('session.nextFollowUp')}: {fmtDate(item.followUpDate, lang)}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

/* ---------- Notifications ---------- */
interface NotificationItem { notificationId: string; title: string; body: string; read: boolean; createdAt: string; link?: string }

export const NotificationsPage: React.FC<{ t: Translate; lang: LanguageCode; onChanged?: () => void }> = ({ t, lang, onChanged }) => {
  const { data, error, loading, reload } = useApi<{ notifications: NotificationItem[]; unreadCount: number }>('/api/v1/notifications?limit=50', []);
  const [busy, setBusy] = useState(false);
  const markAll = async () => {
    setBusy(true);
    try { await api('/api/v1/notifications/read-all', { method: 'PATCH' }); await reload(); onChanged?.(); } catch { /* shown on reload */ } finally { setBusy(false); }
  };
  const open = async (item: NotificationItem) => {
    if (!item.read) { try { await api(`/api/v1/notifications/${encodeURIComponent(item.notificationId)}/read`, { method: 'PATCH' }); onChanged?.(); } catch { /* ignore */ } }
    if (item.link?.startsWith('#/')) window.location.hash = item.link.slice(1);
    else void reload();
  };
  const items = data?.notifications || [];
  return (
    <>
      <PageHeader title={t('nav.notifications')} action={data?.unreadCount ? <button type="button" className="adp-btn adp-btn-outline adp-btn-sm" disabled={busy} onClick={() => void markAll()}><Icon.check size={16} />{t('common.markAllRead')}</button> : undefined} />
      <Card>
        {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice> : !items.length ? <Empty icon="bell">{t('common.noNotifications')}</Empty> : (
          <div className="adp-list">
            {items.map((item) => (
              <button key={item.notificationId} type="button" className="adp-quick-item" style={{ alignItems: 'flex-start' }} onClick={() => void open(item)}>
                <span className="adp-quick-icon" style={{ width: 40, height: 40 }}><Icon.bell size={18} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontWeight: item.read ? 600 : 800 }}>{item.title}</strong>
                  <small style={{ color: 'var(--adp-text-2)' }}>{item.body}</small>
                  <small>{fmtDateTime(item.createdAt, lang)}</small>
                </span>
                {!item.read && <span className="adp-badge" style={{ minWidth: 10, height: 10, padding: 0 }} aria-label="unread" />}
              </button>
            ))}
          </div>
        )}
      </Card>
    </>
  );
};
