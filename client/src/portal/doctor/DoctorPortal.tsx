import React, { useEffect, useMemo, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { PatientCarePage, YourPatientsSummary } from './PatientCarePage';
import { appointmentTone, Card, Empty, Notice, PageHeader, PortalNavItem, PortalShell, Skeleton, StatusPill } from '../PortalShell';
import { Icon } from '../icons';
import { api, AppointmentItem, fmtDate, fmtDuration, fmtTime, initials, isSameDay, makeT, newMutationId, sessionActive, SessionInfo, Translate, useApi, useElapsed } from '../lib';
import { ConsultationHistoryPage, NotificationsPage } from '../SharedPages';
import { SessionStrip } from '../patient/AppointmentsPage';
import { EndConsultationDialog } from './EndConsultationDialog';
import { AvailabilityPage } from './AvailabilityPage';
import { PatientRecordsPage } from './PatientRecordsPage';

interface DoctorPortalProps {
  currentUser: any;
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  route: string;
  onLogout: () => void;
}

const go = (path: string) => { window.location.hash = `#/doctor${path ? `/${path}` : ''}`; };
const openRoom = (appointmentId: string) => { window.location.hash = `#/consultation/webrtc/${encodeURIComponent(appointmentId)}`; };
const STARTABLE = ['confirmed', 'rescheduled', 'checked_in'];

/* ---------- Live session card ---------- */
const LiveSessionCard: React.FC<{ t: Translate; item: AppointmentItem; onEnd: () => void }> = ({ t, item, onEnd }) => {
  const elapsed = useElapsed(item.session?.startedAt, true);
  const online = item.consultationMode === 'online';
  return (
    <div className="adp-live-card" role="status">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="adp-appt-avatar">{initials(item.patientName)}</span>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong>{item.patientName || item.patientId}</strong><span className="adp-live">{t('session.live')}</span></div>
          <small style={{ color: 'var(--adp-text-3)' }}>{online ? t('common.online') : t('common.inPerson')} · {t('doctor.runningFor')}</small>
        </div>
      </div>
      <span className="adp-timer" aria-label={t('doctor.runningFor')}>{fmtDuration(elapsed)}</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {online && <button type="button" className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => openRoom(item.appointmentId)}><Icon.video size={16} />{t('doctor.openRoom')}</button>}
        <button type="button" className="adp-btn adp-btn-danger adp-btn-sm" onClick={onEnd}><Icon.stop size={14} />{t('doctor.end')}</button>
      </div>
    </div>
  );
};

/* ---------- Appointment row with all doctor actions ---------- */
const DoctorAppointmentRow: React.FC<{ t: Translate; lang: LanguageCode; item: AppointmentItem; onChanged: () => void; onEnd: (item: AppointmentItem) => void }> = ({ t, lang, item, onChanged, onEnd }) => {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'' | 'decline' | 'reschedule'>('');
  const [reason, setReason] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const live = sessionActive(item.session);
  const online = item.consultationMode === 'online';
  const canStart = STARTABLE.includes(item.status) && !item.session?.startedAt;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(''); }
  };

  const respond = (decision: 'accept' | 'decline') => run(decision, async () => {
    await api(`/api/v1/appointments/${encodeURIComponent(item.appointmentId)}/doctor-response`, { method: 'POST', body: JSON.stringify({ mutationId: newMutationId(), decision, ...(decision === 'decline' ? { declineReason: reason.trim() } : {}) }) });
    setPanel(''); setReason(''); onChanged();
  });

  const reschedule = () => run('reschedule', async () => {
    const start = new Date(newStart); const end = new Date(newEnd);
    if (Number.isNaN(+start) || Number.isNaN(+end) || end <= start || start <= new Date()) throw new Error(t('common.error'));
    await api(`/api/v1/appointments/${encodeURIComponent(item.appointmentId)}/reschedule`, { method: 'POST', body: JSON.stringify({ newSlotStartTime: start.toISOString(), newSlotEndTime: end.toISOString(), reason: reason.trim() }) });
    setPanel(''); setReason(''); onChanged();
  });

  const start = () => run('start', async () => {
    await api<{ session: SessionInfo }>(`/api/v1/consultation-sessions/${encodeURIComponent(item.appointmentId)}/start`, { method: 'POST', body: JSON.stringify({ clientMutationId: newMutationId() }) });
    if (online) openRoom(item.appointmentId); else onChanged();
  });

  return (
    <article className={`adp-appt${live ? ' is-live' : ''}`}>
      <span className="adp-appt-avatar" aria-hidden="true">{initials(item.patientName)}</span>
      <div className="adp-appt-main">
        <div className="adp-appt-title">
          <strong>{item.patientName || item.patientId}</strong>
          {live ? <span className="adp-live">{t('session.live')}</span> : <StatusPill tone={appointmentTone(item.status)}>{t(`appt.status.${item.status}`)}</StatusPill>}
          {item.patientWaiting && !live && <StatusPill tone="blue">{t('doctor.patientWaiting')}</StatusPill>}
        </div>
        <div className="adp-meta">
          <span><Icon.calendar size={16} />{fmtDate(item.slotStartTime, lang)}</span>
          <span><Icon.clock size={16} />{fmtTime(item.slotStartTime, lang)} – {fmtTime(item.slotEndTime, lang)}</span>
          <span>{online ? <Icon.video size={16} /> : <Icon.clinic size={16} />}{online ? t('common.online') : t('common.inPerson')}</span>
        </div>
        {item.patientNote && <p className="adp-appt-note">{item.patientNote}</p>}
        {item.session?.startedAt && !live && <SessionStrip t={t} lang={lang} session={item.session} />}
        {canStart && <small style={{ color: 'var(--adp-text-3)' }}>{t('doctor.startHint')}</small>}
        {panel === 'decline' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <label className="adp-field">{t('doctor.declineReason')}<input value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} /></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="adp-btn adp-btn-danger adp-btn-sm" disabled={!reason.trim() || !!busy} onClick={() => void respond('decline')}>{t('doctor.decline')}</button>
              <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => setPanel('')}>{t('common.cancel')}</button>
            </div>
          </div>
        )}
        {panel === 'reschedule' && (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label className="adp-field">{t('doctor.newStart')}<input type="datetime-local" value={newStart} onChange={(e) => setNewStart(e.target.value)} /></label>
            <label className="adp-field">{t('doctor.newEnd')}<input type="datetime-local" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} /></label>
            <label className="adp-field">{t('doctor.rescheduleReason')}<input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="button" className="adp-btn adp-btn-primary adp-btn-sm" disabled={!newStart || !newEnd || !reason.trim() || !!busy} onClick={() => void reschedule()}>{t('doctor.send')}</button>
              <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => setPanel('')}>{t('common.cancel')}</button>
            </div>
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <div className="adp-appt-actions">
        {item.status === 'requested' && !panel && <>
          <button type="button" className="adp-btn adp-btn-primary adp-btn-sm" disabled={!!busy} onClick={() => void respond('accept')}><Icon.check size={16} />{busy === 'accept' ? t('common.loading') : t('doctor.accept')}</button>
          <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={!!busy} onClick={() => { setPanel('reschedule'); setReason(''); }}>{t('doctor.reschedule')}</button>
          <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={!!busy} onClick={() => { setPanel('decline'); setReason(''); }}>{t('doctor.decline')}</button>
        </>}
        {canStart && <button type="button" className="adp-btn adp-btn-primary adp-btn-sm" disabled={!!busy} onClick={() => void start()}><Icon.play size={14} />{busy === 'start' ? t('common.loading') : t('doctor.start')}</button>}
        {live && online && <button type="button" className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => openRoom(item.appointmentId)}><Icon.video size={16} />{t('doctor.openRoom')}</button>}
        {live && <button type="button" className="adp-btn adp-btn-danger adp-btn-sm" onClick={() => onEnd(item)}><Icon.stop size={14} />{t('doctor.end')}</button>}
        <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => go(`patients?id=${encodeURIComponent(item.patientId)}`)}><Icon.file size={16} />{t('records.open')}</button>
      </div>
    </article>
  );
};

/* ---------- Appointments data + end dialog (shared by dashboard & list) ---------- */
function useDoctorAppointments() {
  return useApi<{ appointments: AppointmentItem[] }>('/api/v1/consultations/doctor/appointments', [], 12_000);
}

const DashboardPage: React.FC<{ t: Translate; lang: LanguageCode; user: any }> = ({ t, lang, user }) => {
  const { data, error, loading, reload } = useDoctorAppointments();
  const [ending, setEnding] = useState<AppointmentItem | null>(null);
  const all = data?.appointments || [];
  const now = new Date();
  const today = all.filter((item) => isSameDay(new Date(item.slotStartTime), now) && !['cancelled', 'declined'].includes(item.status)).sort((a, b) => +new Date(a.slotStartTime) - +new Date(b.slotStartTime));
  const requests = all.filter((item) => item.status === 'requested');
  const liveItems = all.filter((item) => sessionActive(item.session));
  const waiting = all.filter((item) => item.patientWaiting && !sessionActive(item.session)).length;
  const name = String(user?.fullName || '').replace(/,.*$/, '');

  const stats: Array<{ icon: keyof typeof Icon; label: string; value: number; tone?: string }> = [
    { icon: 'calendar', label: t('doctor.today'), value: today.length },
    { icon: 'bell', label: t('doctor.requests'), value: requests.length, tone: requests.length ? 'is-alert' : '' },
    { icon: 'users', label: t('doctor.waiting'), value: waiting, tone: waiting ? 'is-alert' : '' },
    { icon: 'video', label: t('doctor.live'), value: liveItems.length, tone: liveItems.length ? 'is-live' : '' },
  ];

  return (
    <>
      <PageHeader title={t('doctor.greeting', { name })} subtitle={t('doctor.subtitle')} />
      <YourPatientsSummary t={t} />
      <div className="adp-stats">
        {stats.map((item) => { const IconCmp = Icon[item.icon]; return <div key={item.label} className={`adp-stat ${item.tone || ''}`}><span><IconCmp size={22} /></span><div><strong>{loading ? '–' : item.value}</strong><small>{item.label}</small></div></div>; })}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {liveItems.map((item) => <LiveSessionCard key={item.appointmentId} t={t} item={item} onEnd={() => setEnding(item)} />)}
      <div className="adp-grid-2">
        <Card title={t('doctor.schedule')} icon="clock" action={<button type="button" className="adp-link" onClick={() => go('appointments')}>{t('common.viewAll')} <Icon.arrow size={16} /></button>}>
          {loading ? <Skeleton rows={3} /> : !today.length ? <Empty icon="calendar">{t('doctor.noSchedule')}</Empty>
            : <div className="adp-list">{today.map((item) => <DoctorAppointmentRow key={item.appointmentId} t={t} lang={lang} item={item} onChanged={() => void reload()} onEnd={setEnding} />)}</div>}
        </Card>
        <Card title={t('doctor.requestList')} icon="bell">
          {loading ? <Skeleton rows={2} /> : !requests.length ? <Empty icon="check">{t('doctor.noRequests')}</Empty>
            : <div className="adp-list">{requests.map((item) => <DoctorAppointmentRow key={item.appointmentId} t={t} lang={lang} item={item} onChanged={() => void reload()} onEnd={setEnding} />)}</div>}
        </Card>
      </div>
      {ending && <EndConsultationDialog t={t} appointmentId={ending.appointmentId} patientName={ending.patientName} startedAt={ending.session?.startedAt} onClose={() => setEnding(null)} onEnded={() => { setEnding(null); void reload(); }} />}
    </>
  );
};

const AppointmentsListPage: React.FC<{ t: Translate; lang: LanguageCode }> = ({ t, lang }) => {
  const { data, error, loading, reload } = useDoctorAppointments();
  const [filter, setFilter] = useState<'all' | 'requested' | 'confirmed' | 'completed'>('all');
  const [ending, setEnding] = useState<AppointmentItem | null>(null);
  const all = data?.appointments || [];
  const visible = all.filter((item) => filter === 'all' || (filter === 'confirmed' ? STARTABLE.includes(item.status) : item.status === filter));
  return (
    <>
      <PageHeader title={t('doctor.allAppointments')} action={
        <div className="adp-tabs" role="group">
          {(['all', 'requested', 'confirmed', 'completed'] as const).map((key) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{key === 'requested' ? t('doctor.requests') : t(`doctor.${key}`)}</button>
          ))}
        </div>
      } />
      <Card>
        {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice> : !visible.length ? <Empty icon="calendar">{t('appt.none')}</Empty>
          : <div className="adp-list">{visible.map((item) => <DoctorAppointmentRow key={item.appointmentId} t={t} lang={lang} item={item} onChanged={() => void reload()} onEnd={setEnding} />)}</div>}
      </Card>
      {ending && <EndConsultationDialog t={t} appointmentId={ending.appointmentId} patientName={ending.patientName} startedAt={ending.session?.startedAt} onClose={() => setEnding(null)} onEnded={() => { setEnding(null); void reload(); }} />}
    </>
  );
};

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ currentUser, lang, onChangeLang, route, onLogout }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const page = route.replace(/^#\/doctor\/?/, '').split('?')[0].split('/').filter(Boolean)[0] || 'dashboard';
  const notifications = useApi<{ unreadCount: number }>('/api/v1/notifications?limit=1', [], 30_000);
  const unread = Number(notifications.data?.unreadCount || 0);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);

  const nav: PortalNavItem[] = [
    { key: 'dashboard', label: t('nav.dashboard'), icon: 'home', mobile: true },
    { key: 'appointments', label: t('nav.schedule'), icon: 'calendar', mobile: true },
    { key: 'consultations', label: t('nav.consultations'), icon: 'history', mobile: true },
    { key: 'patients', label: t('nav.patients'), icon: 'users', mobile: true },
    { key: 'your-patients', label: t('care.title'), icon: 'users' },
    { key: 'ai-screening', label: t('nav.aiReview'), icon: 'scan' },
    { key: 'availability', label: t('nav.availability'), icon: 'clock' },
    { key: 'notifications', label: t('nav.notifications'), icon: 'bell', badge: unread },
  ];
  // Legacy links (#/doctor/queue, #/doctor/high-risk) land on the dashboard.
  const active = nav.some((item) => item.key === page) ? page : 'dashboard';

  let content: React.ReactNode;
  switch (active) {
    case 'appointments': content = <AppointmentsListPage t={t} lang={lang} />; break;
    case 'consultations': content = <ConsultationHistoryPage t={t} lang={lang} role="doctor" />; break;
    case 'patients': content = <PatientRecordsPage t={t} lang={lang} currentUser={currentUser} initialPatientId={new URLSearchParams(route.split('?')[1] || '').get('id') || undefined} />; break;
    case 'availability': content = <AvailabilityPage t={t} lang={lang} />; break;
    case 'your-patients': content = <PatientCarePage t={t} lang={lang} user={currentUser} />; break;
    case 'ai-screening': content = <PatientCarePage key={active} t={t} lang={lang} user={currentUser} screening initialPatientId={new URLSearchParams(route.split('?')[1] || '').get('id') || undefined} />; break;
    case 'notifications': content = <NotificationsPage t={t} lang={lang} onChanged={() => void notifications.reload()} />; break;
    default: content = <DashboardPage t={t} lang={lang} user={currentUser} />;
  }

  return (
    <PortalShell
      t={t} lang={lang} onChangeLang={onChangeLang}
      userName={currentUser?.fullName || currentUser?.username || 'Doctor'} userRole={String(currentUser?.role || 'doctor').replace(/_/g, ' ')}
      nav={nav} active={active} onNavigate={(key) => go(key === 'dashboard' ? '' : key)} onLogout={onLogout}
      notificationCount={unread} onOpenNotifications={() => go('notifications')}
    >
      {content}
    </PortalShell>
  );
};
