import React, { useMemo } from 'react';
import { LanguageCode } from '../../i18n';
import { PatientProfilePage } from '../../pages/patient/PatientProfilePage';
import { Card, Empty, Notice, PortalNavItem, PortalShell, Skeleton, StatusPill } from '../PortalShell';
import { Icon } from '../icons';
import { AppointmentItem, fmtDate, fmtDateTime, makeT, Translate, useApi } from '../lib';
import { ConsultationHistoryPage, NotificationsPage, PrescriptionsPage } from '../SharedPages';
import { AppointmentsPage, PatientAppointmentRow } from './AppointmentsPage';
import { PrivatePhoto, ScreeningHistory, ScreeningListItem, ScreeningPage, ScreeningResultPage } from './ScreeningPage';

const MyCaptures: React.FC<{ t: Translate; lang: LanguageCode }> = ({ t, lang }) => {
  const { data } = useApi<{ captures: Array<{ captureId: string; fileId: string; doctorName: string | null; note: string; createdAt: string }> }>('/api/v1/consultation-sessions/captures/my', []);
  if (!data?.captures.length) return null;
  return (
    <Card title={t('records.captures')} icon="camera">
      <div className="adp-capture-grid">
        {data.captures.map((c) => (
          <figure key={c.captureId}>
            <PrivatePhoto fileId={c.fileId} alt={c.note || c.captureId} />
            <figcaption><strong>{fmtDateTime(c.createdAt, lang)}</strong>{c.doctorName && <small>{t('records.by', { name: c.doctorName })}</small>}{c.note && <small>{c.note}</small>}</figcaption>
          </figure>
        ))}
      </div>
    </Card>
  );
};

interface PatientPortalProps {
  currentUser: any;
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  route: string; // e.g. "#/patient/appointments"
  onLogout: () => void;
}

const go = (path: string) => { window.location.hash = `#/patient${path ? `/${path}` : ''}`; };

const HeroArt: React.FC = () => (
  <svg className="adp-hero-art" viewBox="0 0 360 260" role="img" aria-label="">
    <defs>
      <linearGradient id="adpHeroG" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#3fbf74" /><stop offset="1" stopColor="#1f8a4c" /></linearGradient>
    </defs>
    <circle cx="200" cy="130" r="118" fill="var(--adp-primary-soft)" />
    <circle cx="200" cy="130" r="86" fill="var(--adp-primary-tint)" opacity=".7" />
    <rect x="128" y="62" width="144" height="150" rx="22" fill="var(--adp-surface)" stroke="var(--adp-border)" strokeWidth="2" />
    <rect x="148" y="84" width="104" height="12" rx="6" fill="var(--adp-primary-tint)" />
    <rect x="148" y="106" width="70" height="10" rx="5" fill="var(--adp-border)" />
    <path d="M150 160h22l10-22 14 40 12-26 8 8h34" fill="none" stroke="url(#adpHeroG)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="282" cy="78" r="26" fill="url(#adpHeroG)" />
    <path d="M282 66v24M270 78h24" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    <path d="M86 196c0-24 18-40 34-40s22 10 22 26-10 34-28 34-28-6-28-20z" fill="#f59e0b" opacity=".85" />
    <path d="M100 168c6-6 14-8 20-6" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
  </svg>
);

const HomePage: React.FC<{ t: Translate; lang: LanguageCode; user: any }> = ({ t, lang, user }) => {
  const appointments = useApi<{ appointments: AppointmentItem[] }>('/api/v1/consultations/appointments/my', [], 15_000);
  const screenings = useApi<ScreeningListItem[]>(user?.patientId ? `/api/ai/screenings?patientId=${encodeURIComponent(user.patientId)}` : null, [user?.patientId]);
  const upcoming = (appointments.data?.appointments || [])
    .filter((item) => ['requested', 'confirmed', 'rescheduled', 'checked_in'].includes(item.status))
    .sort((a, b) => +new Date(a.slotStartTime) - +new Date(b.slotStartTime));
  const nextFollowUp = (appointments.data?.appointments || [])
    .map((item) => item.session?.followUp?.nextFollowUpAt)
    .filter((value): value is string => Boolean(value) && new Date(value as string).getTime() > Date.now() - 86_400_000)
    .sort()[0];
  const latest = screenings.data?.[0];
  const firstName = String(user?.fullName || '').split(/\s+/)[0] || '';
  const quick: Array<{ key: string; icon: keyof typeof Icon; title: string; sub: string; path: string }> = [
    { key: 'screen', icon: 'camera', title: t('home.quickScreenTitle'), sub: t('home.quickScreenSub'), path: 'screening' },
    { key: 'book', icon: 'calendar', title: t('home.quickBookTitle'), sub: t('home.quickBookSub'), path: 'appointments?book=1' },
    { key: 'consult', icon: 'video', title: t('home.quickConsultTitle'), sub: t('home.quickConsultSub'), path: 'consultations' },
    { key: 'rx', icon: 'file', title: t('home.quickRxTitle'), sub: t('home.quickRxSub'), path: 'prescriptions' },
  ];

  return (
    <>
      <section className="adp-hero" aria-labelledby="adp-hero-title">
        <div>
          <p style={{ color: 'var(--adp-primary)', fontWeight: 700, marginBottom: 8 }}>{t('home.greeting', { name: firstName })}</p>
          <h1 id="adp-hero-title">{t('home.heroTitle1')}<em>{t('home.heroTitle2')}</em></h1>
          <p>{t('home.heroBody')}</p>
          <div className="adp-hero-actions">
            <button type="button" className="adp-btn adp-btn-primary" onClick={() => go('appointments?book=1')}>{t('home.heroCta')}<Icon.arrow size={18} /></button>
            <button type="button" className="adp-btn adp-btn-outline" onClick={() => go('screening')}><Icon.camera size={18} />{t('home.heroCta2')}</button>
          </div>
        </div>
        <HeroArt />
      </section>

      <div className="adp-quick">
        {quick.map((item) => {
          const IconCmp = Icon[item.icon];
          return (
            <button key={item.key} type="button" className="adp-quick-item" onClick={() => go(item.path)}>
              <span className="adp-quick-icon"><IconCmp size={24} /></span>
              <span style={{ minWidth: 0 }}><strong>{item.title}</strong><small>{item.sub}</small></span>
              <Icon.arrow size={18} />
            </button>
          );
        })}
      </div>

      {nextFollowUp && <Notice tone="success">{t('home.nextFollowUp')}: <strong>{fmtDate(nextFollowUp, lang)}</strong></Notice>}

      <div className="adp-grid-2">
        <Card title={t('home.upcoming')} icon="calendar" action={<button type="button" className="adp-link" onClick={() => go('appointments')}>{t('common.viewAll')} <Icon.arrow size={16} /></button>}>
          {appointments.loading ? <Skeleton rows={2} /> : appointments.error ? <Notice tone="error">{appointments.error}</Notice>
            : !upcoming.length ? <Empty icon="calendar" action={<button type="button" className="adp-btn adp-btn-primary adp-btn-sm" onClick={() => go('appointments?book=1')}>{t('appt.book')}</button>}>{t('home.noUpcoming')}</Empty>
            : <div className="adp-list">{upcoming.slice(0, 3).map((item) => <PatientAppointmentRow key={item.appointmentId} t={t} lang={lang} item={item} compact onChanged={() => void appointments.reload()} />)}</div>}
        </Card>

        <Card title={t('home.latestResult')} icon="scan" action={latest ? <button type="button" className="adp-link" onClick={() => go('records')}>{t('common.viewAll')} <Icon.arrow size={16} /></button> : undefined}>
          {screenings.loading ? <Skeleton rows={1} /> : !latest ? (
            <Empty icon="scan" action={<button type="button" className="adp-btn adp-btn-primary adp-btn-sm" onClick={() => go('screening')}>{t('home.startCheck')}</button>}>{t('home.noResult')}</Empty>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div className={`adp-severity adp-severity-${latest.riskLevel || 'low'}`}>
                <div className="adp-severity-top">
                  <div><small>{t('result.severity')}</small><strong>{t(`result.${latest.riskLevel || 'low'}`)}</strong></div>
                  <span className="adp-tag-demo">{t('common.demoAi')}</span>
                </div>
                <p style={{ color: 'var(--adp-text-2)', fontSize: '.88rem' }}>{fmtDateTime(latest.createdAt, lang)}</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                {latest.clinicianReviewStatus === 'PENDING' ? <StatusPill tone="amber">{t('result.reviewPending')}</StatusPill> : <StatusPill tone="green">{t('result.reviewDone')}</StatusPill>}
                <button type="button" className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => go(`screening/${encodeURIComponent(latest.screeningId)}`)}>{t('result.viewResult')}</button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

export const PatientPortal: React.FC<PatientPortalProps> = ({ currentUser, lang, onChangeLang, route, onLogout }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const [pathPart, queryPart = ''] = route.replace(/^#\/patient\/?/, '').split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = new URLSearchParams(queryPart);
  // Older links (notifications, bookmarks) used other names or ?tab=…; map them onto the new pages.
  const LEGACY: Record<string, string> = { home: 'dashboard', consult: 'appointments', consultation: 'appointments', reminders: 'notifications', history: 'records', reports: 'records', 'report-detail': 'records', assessment: 'records', referrals: 'records', treatment: 'prescriptions', help: 'dashboard', education: 'dashboard', hospitals: 'appointments', 'care-team': 'appointments' };
  const rawPage = segments[0] || query.get('tab') || 'dashboard';
  const page = LEGACY[rawPage] || rawPage;
  const notifications = useApi<{ unreadCount: number }>('/api/v1/notifications?limit=1', [], 30_000);
  const unread = Number(notifications.data?.unreadCount || 0);
  const patientId: string | undefined = currentUser?.patientId || currentUser?.userId;

  const nav: PortalNavItem[] = [
    { key: 'dashboard', label: t('nav.dashboard'), icon: 'home', mobile: true },
    { key: 'appointments', label: t('nav.appointments'), icon: 'calendar', mobile: true },
    { key: 'screening', label: t('nav.screening'), icon: 'camera', mobile: true },
    { key: 'consultations', label: t('nav.consultations'), icon: 'history' },
    { key: 'prescriptions', label: t('nav.prescriptions'), icon: 'pill', mobile: true },
    { key: 'records', label: t('nav.records'), icon: 'file' },
    { key: 'notifications', label: t('nav.notifications'), icon: 'bell', badge: unread },
    { key: 'profile', label: t('nav.profile'), icon: 'user' },
  ];
  const active = nav.some((item) => item.key === page) ? page : 'dashboard';
  const toBooking = () => go('appointments?book=1');

  let content: React.ReactNode;
  switch (page) {
    case 'appointments': content = <AppointmentsPage key={queryPart} t={t} lang={lang} patientId={patientId} openBooking={query.get('book') === '1'} />; break;
    case 'screening': content = segments[1]
      ? <ScreeningResultPage t={t} lang={lang} screeningId={segments[1]} onBook={() => { try { sessionStorage.setItem('patient_booking_screening_id', segments[1]); } catch { /* ignore */ } toBooking(); }} onBack={() => go('screening')} onOpenResult={(id) => go(`screening/${encodeURIComponent(id)}`)} />
      : <ScreeningPage t={t} lang={lang} patientId={patientId} onOpenResult={(id) => go(`screening/${encodeURIComponent(id)}`)} onBook={toBooking} />; break;
    case 'consultations': content = <ConsultationHistoryPage t={t} lang={lang} role="patient" />; break;
    case 'prescriptions': content = <PrescriptionsPage t={t} lang={lang} patientId={patientId} patientName={currentUser?.fullName} />; break;
    case 'records': content = <><Card title={t('nav.records')} icon="file"><ScreeningHistory t={t} lang={lang} patientId={patientId} onOpen={(id) => go(`screening/${encodeURIComponent(id)}`)} /></Card><MyCaptures t={t} lang={lang} /></>; break;
    case 'notifications': content = <NotificationsPage t={t} lang={lang} onChanged={() => void notifications.reload()} />; break;
    case 'profile': content = <PatientProfilePage currentUser={currentUser} currentLang={lang} />; break;
    default: content = <HomePage t={t} lang={lang} user={currentUser} />;
  }

  return (
    <PortalShell
      t={t} lang={lang} onChangeLang={onChangeLang}
      userName={currentUser?.fullName || currentUser?.username || 'Patient'} userRole="Patient"
      nav={nav} active={active} onNavigate={(key) => go(key === 'dashboard' ? '' : key)} onLogout={onLogout}
      notificationCount={unread} onOpenNotifications={() => go('notifications')}
    >
      {content}
    </PortalShell>
  );
};
