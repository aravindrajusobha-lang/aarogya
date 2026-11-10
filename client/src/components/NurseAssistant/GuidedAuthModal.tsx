import React, { useState } from 'react';
import { AuthUser, AuthTokens } from '../AuthPanel';

interface GuidedAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser, tokens: AuthTokens) => void;
  onTriggerAnimation?: (state: any, expr: any, gesture: any) => void;
}

export const GuidedAuthModal: React.FC<GuidedAuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onTriggerAnimation,
}) => {
  const [authMode, setAuthMode] = useState<'register' | 'login' | 'demo'>('demo');

  // Form states
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'asha' | 'anm' | 'medical_officer'>('asha');
  const [hospitalId, setHospitalId] = useState('hosp_paderu_dh');

  // Login form states
  const [loginUsername, setLoginUsername] = useState('asha.pad01');
  const [loginPassword, setLoginPassword] = useState('Asha@2026');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nurseTip, setNurseTip] = useState<string>(
    "Hello! I'm Drishti, your 3D Nurse Assistant. Let's get you set up to access the tribal health registry."
  );

  if (!isOpen) return null;

  // Handle Quick Demo Sign In
  const handleQuickDemo = async (demoRole: 'asha' | 'doctor' | 'admin') => {
    setLoading(true);
    setErrorMsg(null);
    onTriggerAnimation?.('thinking', 'thoughtful', 'hand_to_chin');

    const creds =
      demoRole === 'doctor'
        ? { u: 'doctor.paderu', p: 'Doctor@2026' }
        : demoRole === 'admin'
        ? { u: 'admin.paderu', p: 'Admin@2026' }
        : { u: 'asha.pad01', p: 'Asha@2026' };

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: creds.u, password: creds.p }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        onTriggerAnimation?.('success', 'smiling', 'thumbs_up');
        setNurseTip(`Welcome! You are signed in as ${data.data.user.fullName || data.data.user.username}.`);
        setTimeout(() => {
          onLoginSuccess(data.data.user, data.data.tokens);
          onClose();
        }, 800);
      } else {
        onTriggerAnimation?.('error', 'concerned', 'open_hand');
        setErrorMsg(data.error?.message || 'Login failed');
      }
    } catch (err: any) {
      onTriggerAnimation?.('error', 'concerned', 'open_hand');
      setErrorMsg(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Guided Registration Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!username.trim() || username.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      setNurseTip('Please choose a username with at least 3 characters so health workers can identify you.');
      onTriggerAnimation?.('warning', 'concerned', 'gentle_warning');
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg('Full Name is required.');
      setNurseTip('Please provide your full legal name for the clinical registry.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      setNurseTip('Security requirement: Please use a strong password with at least 8 characters.');
      onTriggerAnimation?.('warning', 'concerned', 'gentle_warning');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      setNurseTip('The passwords entered do not match. Please verify them.');
      return;
    }

    setLoading(true);
    onTriggerAnimation?.('thinking', 'thoughtful', 'hand_to_chin');

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
          password,
          role,
          hospitalId: role !== 'patient' ? hospitalId : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        onTriggerAnimation?.('success', 'smiling', 'thumbs_up');
        setNurseTip('🎉 Congratulations! Your account has been created. Initializing your secure session...');
        setTimeout(() => {
          onLoginSuccess(data.data.user, data.data.tokens);
          onClose();
        }, 1000);
      } else {
        onTriggerAnimation?.('error', 'concerned', 'open_hand');
        setErrorMsg(data.error?.message || 'Registration failed');
        setNurseTip('We encountered an issue during registration. Please review the highlighted fields.');
      }
    } catch (err: any) {
      onTriggerAnimation?.('error', 'concerned', 'open_hand');
      setErrorMsg(err.message || 'Connection error to authentication server');
    } finally {
      setLoading(false);
    }
  };

  // Handle Standard Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    onTriggerAnimation?.('thinking', 'thoughtful', 'hand_to_chin');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername.trim(), password: loginPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        onTriggerAnimation?.('success', 'smiling', 'thumbs_up');
        setNurseTip(`Welcome back, ${data.data.user.fullName || data.data.user.username}!`);
        setTimeout(() => {
          onLoginSuccess(data.data.user, data.data.tokens);
          onClose();
        }, 800);
      } else {
        onTriggerAnimation?.('error', 'concerned', 'open_hand');
        setErrorMsg(data.error?.message || 'Invalid username or password');
        setNurseTip("Those credentials didn't match our records. Would you like to use Demo Login?");
      }
    } catch (err: any) {
      onTriggerAnimation?.('error', 'concerned', 'open_hand');
      setErrorMsg(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(32, 41, 67, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="modal-content card"
        style={{
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nurse Onboarding Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
          <div style={{ fontSize: '2.4rem', lineHeight: 1 }}>👩‍⚕️</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', margin: 0, color: 'var(--slate)' }}>
                Drishti Nurse Onboarding
              </h3>
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--slate-soft)' }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--coral)', fontWeight: 600 }}>
              {nurseTip}
            </p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="segmented-toggle" style={{ display: 'flex', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--line)' }}>
          <button
            type="button"
            className={authMode === 'demo' ? 'active' : ''}
            onClick={() => {
              setAuthMode('demo');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              background: authMode === 'demo' ? 'var(--coral)' : 'var(--paper-warm)',
              color: authMode === 'demo' ? '#fff' : 'var(--slate)',
              cursor: 'pointer',
            }}
          >
            ⚡ 1-Click Demo
          </button>
          <button
            type="button"
            className={authMode === 'login' ? 'active' : ''}
            onClick={() => {
              setAuthMode('login');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              background: authMode === 'login' ? 'var(--coral)' : 'var(--paper-warm)',
              color: authMode === 'login' ? '#fff' : 'var(--slate)',
              cursor: 'pointer',
            }}
          >
            🔐 Sign In
          </button>
          <button
            type="button"
            className={authMode === 'register' ? 'active' : ''}
            onClick={() => {
              setAuthMode('register');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              background: authMode === 'register' ? 'var(--coral)' : 'var(--paper-warm)',
              color: authMode === 'register' ? '#fff' : 'var(--slate)',
              cursor: 'pointer',
            }}
          >
            📝 Create Account
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #f87171',
              borderRadius: '6px',
              color: '#991b1b',
              fontSize: '0.84rem',
              marginBottom: '14px',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {/* 1. DEMO LOGIN MODE */}
        {authMode === 'demo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '0.84rem', color: 'var(--slate-soft)', margin: '0 0 4px' }}>
              Select a simulation clinical profile to immediately test full frontline capabilities:
            </p>
            <button
              type="button"
              className="button-coral"
              onClick={() => handleQuickDemo('asha')}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.88rem' }}
            >
              👩‍⚕️ Sign In as ASHA Worker (asha.pad01)
            </button>
            <button
              type="button"
              className="button-dark"
              onClick={() => handleQuickDemo('doctor')}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.88rem' }}
            >
              👨‍⚕️ Sign In as Medical Officer (doctor.paderu)
            </button>
            <button
              type="button"
              className="button-outline"
              onClick={() => handleQuickDemo('admin')}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '0.88rem' }}
            >
              🏛️ Sign In as District Admin (admin.paderu)
            </button>
          </div>
        )}

        {/* 2. SIGN IN MODE */}
        {authMode === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Password (Entered securely into form)
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="button-coral"
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* 3. GUIDED REGISTRATION MODE */}
        {authMode === 'register' && (
          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Dr. Rajesh Rao / K. Lakshmi"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. lakshmi.pad"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="9440188990"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="patient">Patient / Beneficiary</option>
                  <option value="asha">ASHA Worker</option>
                  <option value="anm">ANM Staff</option>
                  <option value="medical_officer">Medical Officer</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Hospital Affiliation
                </label>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="hosp_paderu_dh">District Hospital Paderu</option>
                  <option value="hosp_araku_ah">Area Hospital Araku</option>
                  <option value="hosp_chintapalli_chc">CHC Chintapalli</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Confirm Password
                </label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="button-coral"
              style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
            >
              {loading ? 'Creating Profile...' : 'Complete Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
