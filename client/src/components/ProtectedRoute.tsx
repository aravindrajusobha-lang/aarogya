import React, { useEffect, useState } from 'react';
import { AuthUser } from './AuthPanel';
import { clearStoredAuth, readStoredAuth, validateAccessToken } from '../utils/session';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  currentUser?: AuthUser | null;
  onRedirectToLogin?: () => void;
  onRedirectToDashboard?: (role: string) => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  currentUser,
  onRedirectToLogin,
  onRedirectToDashboard,
}) => {
  const [checkedUser, setCheckedUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (currentUser) {
        if (!cancelled) setCheckedUser(currentUser);
        return;
      }
      const stored = readStoredAuth();
      if (!stored.user || !stored.tokens?.accessToken) {
        if (!cancelled) setCheckedUser(null);
        return;
      }
      const validated = await validateAccessToken(stored.tokens.accessToken);
      if (!cancelled) setCheckedUser((validated as AuthUser | null) || null);
      if (!validated) clearStoredAuth();
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  if (checkedUser === undefined) {
    return (
      <div className="login-page-root" aria-live="polite">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-logo">??</div>
          <h2 className="login-title">Checking session…</h2>
        </div>
      </div>
    );
  }

  if (!checkedUser) {
    if (onRedirectToLogin) {
      onRedirectToLogin();
    } else {
      window.location.hash = '#/login';
    }
    return (
      <div className="login-page-root">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-logo">??</div>
          <h2 className="login-title">Authentication Required</h2>
          <p className="login-sub">Please log in to access this clinical dashboard.</p>
          <button
            type="button"
            className="login-submit-btn"
            onClick={() => (window.location.hash = '#/login')}
            style={{ marginTop: '20px' }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (checkedUser.role || '').toUpperCase();
    const isAuthorized = allowedRoles.some((role) => {
      const targetRole = role.toUpperCase();
      if (targetRole === 'ADMIN' && (userRole === 'SYSTEM_ADMIN' || userRole === 'ADMIN' || userRole === 'DISTRICT_OFFICER')) return true;
      if (targetRole === 'DOCTOR' && (userRole === 'DOCTOR' || userRole === 'SPECIALIST_DOCTOR' || userRole === 'MEDICAL_OFFICER' || userRole === 'CHIEF_MEDICAL_OFFICER' || userRole === 'HOSPITAL_MANAGER')) return true;
      if (targetRole === 'PATIENT' && (userRole === 'PATIENT' || userRole === 'COMMUNITY_VOLUNTEER')) return true;
      return userRole === targetRole;
    });

    if (!isAuthorized) {
      if (onRedirectToDashboard) onRedirectToDashboard(userRole);
      return (
        <div className="login-page-root">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div className="login-logo" style={{ background: 'linear-gradient(135deg, #f43f5e, #be123c)' }}>??</div>
            <h2 className="login-title">Access Restricted</h2>
            <p className="login-sub">Your account role (<strong>{userRole}</strong>) does not have permission for this portal.</p>
            <button
              type="button"
              className="login-submit-btn"
              onClick={() => {
                if (userRole.includes('ADMIN')) window.location.hash = '#/admin';
                else if (userRole.includes('DOCTOR') || userRole.includes('MEDICAL')) window.location.hash = '#/doctor';
                else if (userRole.includes('PATIENT')) window.location.hash = '#/patient';
                else window.location.hash = '#/login';
              }}
              style={{ marginTop: '20px' }}
            >
              Return to Your Authorized Dashboard
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
