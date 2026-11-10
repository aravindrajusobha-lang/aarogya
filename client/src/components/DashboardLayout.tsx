import React, { useState } from 'react';
import { AuthUser } from './AuthPanel';
import { ThemeToggle } from './ThemeToggle';
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
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  currentUser,
  activeNav,
  onNavSelect,
  onLogout,
  onToggleAIAssistant,
  title = 'Command Dashboard',
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  const role = (currentUser?.role || 'PATIENT').toUpperCase();
  const isAdmin = role.includes('ADMIN') || role.includes('OFFICER');
  const isDoctor = role.includes('DOCTOR') || role.includes('MEDICAL') || role.includes('MANAGER');

  // Navigation Items by Role
  const navItems: NavItem[] = isAdmin
    ? [
        { id: 'overview', label: 'Admin Overview', icon: '📊' },
        { id: 'hospitals', label: 'Hospital Registry', icon: '🏥' },
        { id: 'doctors', label: 'Doctor Provisioning', icon: '👨‍⚕️' },
        { id: 'reports', label: 'Mandal GIS Reports', icon: '📈' },
        { id: 'audit', label: 'Audit Log & Security', icon: '🛡️' },
      ]
    : isDoctor
    ? [
        { id: 'queue', label: 'Clinical Review Queue', icon: '🩺', badge: '14 New' },
        { id: 'high-risk', label: 'High-Risk Triage', icon: '🚨', badge: '3 Alerts' },
        { id: 'referrals', label: 'Patient Referrals', icon: '📋' },
        { id: 'teleconsult', label: 'Teleconsult Discussions', icon: '💬' },
        { id: 'biopsy', label: 'Biopsy Lab Status', icon: '🔬' },
      ]
    : [
        { id: 'dashboard', label: 'Patient Dashboard', icon: '🏠' },
        { id: 'screening', label: 'My Medical Cases', icon: '🩺' },
        { id: 'specialists', label: 'Specialist Directory', icon: '👨‍⚕️' },
        { id: 'hospitals', label: 'Hospitals and Network', icon: '🏥' },
        { id: 'notifications', label: 'My Notifications', icon: '🔔' },
        { id: 'consent', label: 'Patient Consent', icon: '📋' },
        { id: 'auth', label: 'My Profile', icon: '👤' },
        { id: 'appointments', label: 'My Appointments', icon: '📅' },
        { id: 'patients', label: 'Medical Records', icon: '📂' },
        { id: 'reports', label: 'Medical Reports', icon: '📄' },
        { id: 'help', label: 'Help and Support', icon: '❓' },
      ];

  const getRoleClass = () => {
    if (isAdmin) return 'role-badge-admin';
    if (isDoctor) return 'role-badge-doctor';
    return 'role-badge-patient';
  };

  const getRoleDisplay = () => {
    if (isAdmin) return 'Super Admin';
    if (isDoctor) return 'Medical Officer / Doctor';
    return 'Patient / Frontline Citizen';
  };

  return (
    <div className="dashboard-layout-root">
      {/* 1. Collapsible Sidebar */}
      <aside className={`dash-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        {/* Brand */}
        <div className="dash-sidebar-brand">
          <div className="dash-brand-icon">🌿</div>
          <div className="dash-brand-text">
            <span>Aarogya-Drishti</span>
            <span className="dash-brand-sub">ITDA Paderu Agency</span>
          </div>
        </div>

        {/* User Card */}
        <div className="dash-user-card">
          <div className="dash-user-avatar">
            {currentUser?.fullName?.charAt(0) || currentUser?.username?.charAt(0) || 'U'}
          </div>
          <div className="dash-user-meta">
            <div className="dash-user-name" title={currentUser?.fullName || currentUser?.username || 'User'}>
              {currentUser?.fullName || currentUser?.username || 'Demo User'}
            </div>
            <span className={`dash-user-role-badge ${getRoleClass()}`}>
              {getRoleDisplay()}
            </span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="dash-sidebar-nav">
          {navItems.map((item) => {
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
        </nav>

        {/* Footer with Logout */}
        <div className="dash-sidebar-footer">
          {/* AI Assistant Chatbot Button in Sidebar */}
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

      {/* 2. Main Content Wrapper */}
      <div className="dash-main-wrapper">
        {/* Top Header Bar */}
        <header className="dash-topbar">
          <div className="dash-topbar-left">
            <button
              type="button"
              className="dash-mobile-toggle"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
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

            {/* Admin Command button: Hidden from Patients and Doctors, visible only to Super Admins */}
            {isAdmin && (
              <button
                type="button"
                className="dash-btn dash-btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                onClick={() => (window.location.hash = '#/admin')}
              >
                🛡️ Admin Command
              </button>
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

