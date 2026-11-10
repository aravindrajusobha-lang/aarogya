import React from 'react';
import { AuthUser } from './AuthPanel';

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
  // Check user authentication from props or localStorage
  const activeUser: AuthUser | null = currentUser || (() => {
    try {
      const saved = localStorage.getItem('aarogya_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const token = localStorage.getItem('aarogya_token') || localStorage.getItem('aarogya_tokens');

  // If unauthenticated, redirect to login
  if (!activeUser || !token) {
    if (onRedirectToLogin) {
      onRedirectToLogin();
    } else {
      window.location.hash = '#/login';
    }
    return (
      <div className="login-page-root">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div className="login-logo">🔒</div>
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
          <div style={{ marginTop: '12px' }}>
            <button
              type="button"
              className="dash-btn dash-btn-outline"
              style={{ fontSize: '0.82rem', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.hash = '#/';
                }
              }}
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Role validation
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (activeUser.role || '').toUpperCase();
    const isAuthorized = allowedRoles.some((role) => {
      const targetRole = role.toUpperCase();
      if (targetRole === 'ADMIN' && (userRole === 'SYSTEM_ADMIN' || userRole === 'ADMIN' || userRole === 'DISTRICT_OFFICER')) {
        return true;
      }
      if (
        targetRole === 'DOCTOR' &&
        (userRole === 'DOCTOR' ||
          userRole === 'SPECIALIST_DOCTOR' ||
          userRole === 'MEDICAL_OFFICER' ||
          userRole === 'CHIEF_MEDICAL_OFFICER' ||
          userRole === 'HOSPITAL_MANAGER')
      ) {
        return true;
      }
      if (targetRole === 'PATIENT' && (userRole === 'PATIENT' || userRole === 'COMMUNITY_VOLUNTEER')) {
        return true;
      }
      return userRole === targetRole;
    });

    if (!isAuthorized) {
      if (onRedirectToDashboard) {
        onRedirectToDashboard(userRole);
      }
      return (
        <div className="login-page-root">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div className="login-logo" style={{ background: 'linear-gradient(135deg, #f43f5e, #be123c)' }}>
              ⚠️
            </div>
            <h2 className="login-title">Access Restricted</h2>
            <p className="login-sub">
              Your account role (<strong>{userRole}</strong>) does not have permission for this portal.
            </p>
            <button
              type="button"
              className="login-submit-btn"
              onClick={() => {
                if (userRole.includes('ADMIN')) window.location.hash = '#/admin';
                else if (userRole.includes('DOCTOR') || userRole.includes('MEDICAL')) window.location.hash = '#/doctor';
                else if (userRole.includes('PATIENT')) window.location.hash = '#/patient';
                else window.location.hash = '#/';
              }}
              style={{ marginTop: '20px' }}
            >
              Return to Your Authorized Dashboard
            </button>

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="dash-btn dash-btn-outline"
                style={{
                  fontSize: '0.82rem',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  flex: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onClick={() => {
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.hash = '#/';
                  }
                }}
              >
                <span>←</span>
                <span>Go Back</span>
              </button>
              <button
                type="button"
                className="dash-btn dash-btn-outline"
                style={{
                  fontSize: '0.82rem',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  flex: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                onClick={() => {
                  window.location.hash = '#/login';
                }}
              >
                <span>🔑</span>
                <span>Switch Account</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

