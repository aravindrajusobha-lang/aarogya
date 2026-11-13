import React, { useEffect, useState } from 'react';
import { LanguageCode } from '../i18n';
import { BrandMark, Icon } from './icons';
import { initials, Translate } from './lib';
import './portal.css';

export interface PortalNavItem { key: string; label: string; icon: keyof typeof Icon; badge?: number; mobile?: boolean }

interface PortalShellProps {
  t: Translate;
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  userName: string;
  userRole: string;
  nav: PortalNavItem[];
  active: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  children: React.ReactNode;
}

const LANGS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
];

export const PortalShell: React.FC<PortalShellProps> = ({ t, lang, onChangeLang, userName, userRole, nav, active, onNavigate, onLogout, notificationCount = 0, onOpenNotifications, children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [active]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const mobileItems = nav.filter((item) => item.mobile).slice(0, 4);

  const navList = (
    <nav className="adp-nav" aria-label={t('nav.menu')}>
      {nav.map((item) => {
        const IconCmp = Icon[item.icon];
        return (
          <button key={item.key} type="button" className={`adp-nav-item${active === item.key ? ' is-active' : ''}`} aria-current={active === item.key ? 'page' : undefined} onClick={() => onNavigate(item.key)}>
            <IconCmp size={20} />
            <span>{item.label}</span>
            {item.badge ? <b className="adp-badge" aria-label={`${item.badge}`}>{item.badge > 99 ? '99+' : item.badge}</b> : null}
          </button>
        );
      })}
      <button type="button" className="adp-nav-item" onClick={onLogout}>
        <Icon.logout size={20} />
        <span>{t('nav.logout')}</span>
      </button>
    </nav>
  );

  return (
    <div className="adp-root">
      <div className="adp-layout">
        <aside className={`adp-sidebar${drawerOpen ? ' is-open' : ''}`} aria-label={t('nav.menu')}>
          <div className="adp-brand">
            <BrandMark size={58} />
            <div>
              <strong>Aarogya-Drishti</strong>
              <small>{t('common.tagline')}</small>
            </div>
            <button type="button" className="adp-icon-btn adp-drawer-close" aria-label={t('common.close')} onClick={() => setDrawerOpen(false)}><Icon.x /></button>
          </div>
          {navList}
          <div className="adp-sidebar-art" aria-hidden="true">
            <svg viewBox="0 0 240 150" preserveAspectRatio="none"><path d="M0 120 C60 80 120 150 240 70 L240 150 L0 150 Z" fill="var(--adp-primary-soft)" /><path d="M0 140 C80 100 150 150 240 110 L240 150 L0 150 Z" fill="var(--adp-primary-tint)" /></svg>
          </div>
        </aside>
        {drawerOpen && <button type="button" className="adp-scrim" aria-label={t('common.close')} onClick={() => setDrawerOpen(false)} />}

        <div className="adp-main">
          <header className="adp-topbar">
            <button type="button" className="adp-icon-btn adp-menu-btn" aria-label={t('nav.menu')} aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon.menu /></button>
            <div className="adp-topbar-brand"><BrandMark size={40} /><strong>Aarogya-Drishti</strong></div>
            <div className="adp-topbar-spacer" />
            <label className="adp-lang">
              <span className="sr-only">{t('common.language')}</span>
              <select value={lang} onChange={(event) => onChangeLang(event.target.value as LanguageCode)}>
                {LANGS.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
              </select>
            </label>
            {onOpenNotifications && (
              <button type="button" className="adp-icon-btn adp-bell" aria-label={`${t('nav.notifications')} (${notificationCount})`} onClick={onOpenNotifications}>
                <Icon.bell size={22} />
                {notificationCount > 0 && <b className="adp-badge adp-badge-dot">{notificationCount > 9 ? '9+' : notificationCount}</b>}
              </button>
            )}
            <div className="adp-user">
              <span className="adp-avatar" aria-hidden="true">{initials(userName)}</span>
              <span className="adp-user-text"><strong>{userName}</strong><small>{userRole}</small></span>
            </div>
          </header>

          <main className="adp-content" id="adp-main">{children}</main>

          <footer className="adp-footer">
            <span>© {new Date().getFullYear()} Aarogya-Drishti · ITDA Paderu</span>
            <span className="adp-footer-sim">{t('common.demoAi')} · SIMULATION</span>
          </footer>
        </div>
      </div>

      {mobileItems.length > 0 && (
        <nav className="adp-bottom-nav" aria-label={t('nav.menu')}>
          {mobileItems.map((item) => {
            const IconCmp = Icon[item.icon];
            return (
              <button key={item.key} type="button" className={active === item.key ? 'is-active' : ''} aria-current={active === item.key ? 'page' : undefined} onClick={() => onNavigate(item.key)}>
                <IconCmp size={22} />
                <span>{item.label}</span>
                {item.badge ? <b className="adp-badge adp-badge-dot">{item.badge}</b> : null}
              </button>
            );
          })}
          <button type="button" onClick={() => setDrawerOpen(true)}>
            <Icon.menu size={22} />
            <span>{t('nav.more')}</span>
          </button>
        </nav>
      )}
    </div>
  );
};

/* ---------- Small shared UI ---------- */
export const Card: React.FC<{ title?: React.ReactNode; icon?: keyof typeof Icon; action?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, icon, action, className = '', children }) => {
  const IconCmp = icon ? Icon[icon] : null;
  return (
    <section className={`adp-card ${className}`}>
      {(title || action) && (
        <header className="adp-card-head">
          <h2>{IconCmp && <IconCmp size={22} />}{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
};

export const PageHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="adp-page-head">
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {action}
  </div>
);

export const Notice: React.FC<{ tone?: 'error' | 'success' | 'info' | 'warn'; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <p className={`adp-notice adp-notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>
);

export const Empty: React.FC<{ icon?: keyof typeof Icon; children: React.ReactNode; action?: React.ReactNode }> = ({ icon = 'file', children, action }) => {
  const IconCmp = Icon[icon];
  return <div className="adp-empty"><span><IconCmp size={26} /></span><p>{children}</p>{action}</div>;
};

export const Skeleton: React.FC<{ rows?: number }> = ({ rows = 2 }) => (
  <div className="adp-skeleton" role="status" aria-label="Loading">{Array.from({ length: rows }).map((_, index) => <span key={index} />)}</div>
);

export const StatusPill: React.FC<{ tone: 'green' | 'amber' | 'red' | 'gray' | 'blue'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`adp-pill adp-pill-${tone}`}>{children}</span>
);

export function appointmentTone(status: string): 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  if (['confirmed', 'completed'].includes(status)) return 'green';
  if (['requested', 'rescheduled'].includes(status)) return 'amber';
  if (['cancelled', 'declined', 'no_show'].includes(status)) return 'red';
  if (status === 'checked_in') return 'blue';
  return 'gray';
}
