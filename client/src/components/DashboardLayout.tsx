import React, { useState } from 'react';
import { AuthUser } from './AuthPanel';
import { ThemeToggle } from './ThemeToggle';
import { getMenuItemsForRole, normalizeUserRole } from '../config/roleNavigation';
import { getClientTranslation, LanguageCode, translations } from '../i18n';
import '../styles/Dashboard.css';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
}

export interface DashboardLayoutProps {
  children: React.ReactNode;
  currentUser: AuthUser | null;
  activeNav: string;
  onNavSelect: (navId: string) => void;
  onLogout: () => void;
  onToggleAIAssistant?: () => void;
  title?: string;
  currentLang?: LanguageCode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  currentUser,
  activeNav,
  onNavSelect,
  onLogout,
  onToggleAIAssistant,
  title = 'Command Dashboard',
  currentLang = 'en',
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const normRole = normalizeUserRole(currentUser?.role);
  const isPatientPortal = normRole === 'patient';
  const isAdmin = normRole === 'admin';
  const isDoctor = normRole === 'doctor';

  // Single Role-to-Menu Configuration (Part B Implementation)
  const primaryNavItems = isPatientPortal ? [] : getMenuItemsForRole(currentUser?.role);
  const secondaryNavItems: NavItem[] = [];
  const showSidebar = !isPatientPortal;
  const patientName = currentUser?.fullName || currentUser?.username || 'Patient';
  const patientInitials = patientName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const confirmPatientLogout = () => {
    const confirmText = getClientTranslation(translations[currentLang] || translations.en, 'patientActions.signOutConfirm');
    if (window.confirm(confirmText === 'patientActions.signOutConfirm' ? 'Sign out of your patient account?' : confirmText)) onLogout();
  };

  const getRoleClass = () => {
    if (isAdmin) return 'role-badge-admin';
    if (isDoctor) return 'role-badge-doctor';
    return 'role-badge-patient';
  };

  const getRoleDisplay = () => {
    if (isAdmin) return 'System Administrator';
    if (isDoctor) return 'Medical Officer / Doctor';
    return 'Patient / Frontline Citizen';
  };

  return (
    <div className={`dashboard-layout-root${isPatientPortal ? ' patient-portal-layout' : ''}`}>
      {/* 1. Collapsible Sidebar (hidden from patient portal UI; backend/features unchanged) */}
      {showSidebar && (
      <aside className={`dash-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand */}
        <div className="dash-sidebar-brand">
          <div className="dash-brand-icon">🌿</div>
          <div className="dash-brand-text">
            <span>Aarogya-Drishti</span>
            <span className="dash-brand-sub">ITDA Paderu Agency</span>
          </div>
        </div>

        {/* User Card (simplified) */}
        <div className="dash-user-card" style={{ padding: '10px 12px', gap: '8px' }}>
          <div className="dash-user-meta" style={{ minWidth: 0 }}>
            <div className="dash-user-name" style={{ fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={currentUser?.fullName || currentUser?.username || 'User'}>
              {currentUser?.fullName || currentUser?.username || 'User'}
            </div>
            <span className={`dash-user-role-badge ${getRoleClass()}`} style={{ fontSize: '0.68rem' }}>
              {getRoleDisplay()}
            </span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="dash-sidebar-nav">
          {primaryNavItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`dash-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onNavSelect(item.id);
                  setIsMobileOpen(false);
                }}
              >
                <span className="dash-nav-icon">{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: 'var(--danger-bg)',
                      color: 'var(--danger-text)',
                      border: '1px solid var(--danger-text)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      fontWeight: 700,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
          {secondaryNavItems.length > 0 && (
            <details style={{ marginTop: '8px' }}>
              <summary className="dash-nav-item" style={{ cursor: 'pointer', listStyle: 'none' }}>
                <span className="dash-nav-icon">⋯</span>
                <span>More patient services</span>
              </summary>
              <div style={{ paddingLeft: '10px' }}>
                {secondaryNavItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`dash-nav-item ${activeNav === item.id ? 'active' : ''}`}
                    onClick={() => {
                      onNavSelect(item.id);
                      setIsMobileOpen(false);
                    }}
                  >
                    <span className="dash-nav-icon">{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </nav>

        {/* Footer with Logout */}
        <div className="dash-sidebar-footer">
          {onToggleAIAssistant && (
            <button
              type="button"
              className="dash-btn dash-btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '10px',
                width: '100%',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                marginBottom: '8px',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
              onClick={onToggleAIAssistant}
              title="Open Drishti AI Voice & Chat Assistant"
            >
              <span>🤖</span>
              <span>Drishti AI Assistant</span>
            </button>
          )}
          <button type="button" className="dash-btn-logout" onClick={onLogout}>
            <span>🚪</span>
            <span>Sign Out Session</span>
          </button>
        </div>
      </aside>
      )}

      {/* 2. Main Content Wrapper */}
      <div className="dash-main-wrapper">
        {/* Top Header Bar */}
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            {showSidebar && (
            <button
              type="button"
              className="dash-mobile-toggle"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
            )}
            <h1 className="dash-page-title">{title}</h1>
          </div>

          <div className="dash-topbar-right">
            {/* Theme Toggle (Light / Dark Mode) */}
            <ThemeToggle compact={false} />

            {/* AI Assistant Chatbot Button in Topbar */}
            {onToggleAIAssistant && (
              <button
                type="button"
                className="dash-btn dash-btn-outline"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderColor: 'var(--btn-primary-bg)',
                  color: 'var(--text-primary)',
                }}
                onClick={onToggleAIAssistant}
                title="Open Drishti AI Voice & Chat Assistant"
              >
                <span>🤖</span>
                <span>Drishti AI</span>
              </button>
            )}

            {/* AGENTS.md Invariant 2: Mandatory Simulation Demarcation */}
            <div className="dash-simulation-pill">
              <span>⚠️</span>
              <span>SIMULATION SYSTEM • DEMO DATA ONLY</span>
            </div>
            {isPatientPortal && (
              <div className="patient-topbar-account">
                <span className="patient-topbar-avatar" aria-hidden="true">{patientInitials || 'P'}</span>
                <span className="patient-topbar-name" title={patientName}>{patientName}</span>
                <button type="button" className="patient-signout-button" onClick={confirmPatientLogout}>
                  {getClientTranslation(translations[currentLang] || translations.en, 'auth.logout')}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Body with In-Place Tab Transition */}
        <main className="dash-content-body">
          <div key={activeNav} className="tab-pane-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

