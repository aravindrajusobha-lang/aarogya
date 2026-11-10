import React, { useState, useEffect } from 'react';

export interface AuthUser {
  userId: string;
  username: string;
  fullName: string;
  role: 'system_admin' | 'admin' | 'medical_officer' | 'anm' | 'asha' | 'patient';
  hospitalId?: string;
  patientId?: string;
  phone?: string;
  abhaNumber?: string;
  capabilities: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  deviceSessionId: string;
}

interface AuthPanelProps {
  currentUser: AuthUser | null;
  tokens: AuthTokens | null;
  onLoginSuccess: (user: AuthUser, tokens: AuthTokens) => void;
  onLogout: () => void;
  onNavigateToRecovery?: () => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  currentUser,
  tokens,
  onLoginSuccess,
  onLogout,
  onNavigateToRecovery,
}) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'patient' | 'register' | 'biometric'>('staff');
  const [userSubTab, setUserSubTab] = useState<'overview' | 'profile' | 'password' | 'security'>('overview');

  // Login form state
  const [username, setUsername] = useState('asha.pad01');
  const [password, setPassword] = useState('Asha@2026');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registration form state
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<'patient' | 'asha' | 'anm' | 'medical_officer'>('patient');
  const [regHospitalId, setRegHospitalId] = useState('hosp_paderu_dh');
  const [regPhoneToken, setRegPhoneToken] = useState<string | null>(null);
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regOtpCooldown, setRegOtpCooldown] = useState(0);
  const [regOtpLoading, setRegOtpLoading] = useState(false);

  // Edit profile state
  const [editFullName, setEditFullName] = useState(currentUser?.fullName || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [editHospitalId, setEditHospitalId] = useState(currentUser?.hospitalId || '');

  // Change password state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  // Lockout / Backoff Countdown
  const [lockoutSec, setLockoutSec] = useState<number | null>(null);

  // TOTP MFA Step 2 State
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [mfaNotice, setMfaNotice] = useState<string | null>(null);

  // TOTP Setup Modal
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [mfaSuccessMsg, setMfaSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setEditFullName(currentUser.fullName || '');
      setEditPhone(currentUser.phone || '');
      setEditHospitalId(currentUser.hospitalId || '');
    }
  }, [currentUser]);

  useEffect(() => {
    let timer: any;
    if (lockoutSec && lockoutSec > 0) {
      timer = setInterval(() => {
        setLockoutSec((prev) => (prev && prev > 1 ? prev - 1 : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutSec]);

  useEffect(() => {
    let timer: any;
    if (regOtpCooldown > 0) {
      timer = setInterval(() => {
        setRegOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [regOtpCooldown]);

  const handleSendRegOtp = async () => {
    const clean = regPhone.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Indian phone number.');
      return;
    }
    setRegOtpLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, purpose: 'REGISTER' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'Failed to send OTP');
        return;
      }
      setRegOtpSent(true);
      setRegOtpCooldown(30);
      setSuccessMsg(`OTP code dispatched to +91 ${clean}. Enter the 6-digit verification code below.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while requesting OTP');
    } finally {
      setRegOtpLoading(false);
    }
  };

  const handleVerifyRegOtp = async () => {
    const clean = regPhone.replace(/\D/g, '').slice(-10);
    if (!regOtpCode || regOtpCode.length !== 6) {
      setErrorMsg('Please enter the 6-digit OTP code.');
      return;
    }
    setRegOtpLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, otp: regOtpCode, purpose: 'REGISTER' }),
      });
      const data = await res.json();
      if (!res.ok || !data.phoneToken) {
        setErrorMsg(data.message || 'Failed to verify OTP');
        return;
      }
      setRegPhoneToken(data.phoneToken);
      setSuccessMsg('✅ Phone number verified successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error during verification');
    } finally {
      setRegOtpLoading(false);
    }
  };

  // 1-Click Demo Quick Register with Demo OTP 123456
  const handleDemoQuickRegisterFill = async () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const demoPhone = '98480' + String(Math.floor(10000 + Math.random() * 90000));
    setRegUsername(`demo.user.${randomSuffix}`);
    setRegFullName(`Beneficiary Demo (${randomSuffix})`);
    setRegPassword('Aarogya@2026');
    setRegPhone(demoPhone);
    setRegRole('patient');
    setRegHospitalId('hosp_paderu_dh');
    setRegOtpSent(true);
    setRegOtpCode('123456');

    setRegOtpLoading(true);
    try {
      await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: demoPhone, purpose: 'REGISTER' }),
      });

      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: demoPhone, otp: '123456', purpose: 'REGISTER' }),
      });
      const data = await res.json();
      if (data.phoneToken) {
        setRegPhoneToken(data.phoneToken);
        setSuccessMsg('⚡ Demo Profile generated & Phone Verified with Demo OTP (123456)! Click "Create Account" to complete.');
      }
    } catch {
      setErrorMsg('Failed to initialize demo OTP registration');
    } finally {
      setRegOtpLoading(false);
    }
  };

  // 1-Click Demo Patient Mobile OTP Login
  const handleDemoPatientOtpLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/otp/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9876543210', otp: '123456', deviceName: 'Web Browser (Demo)' }),
      });
      const data = await res.json();
      if (res.ok && data.user && data.accessToken) {
        onLoginSuccess(data.user, {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          deviceSessionId: data.deviceSessionId,
        });
        return;
      }

      // Fallback
      const fbRes = await fetch('/api/v1/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9876543210', otp: '123456', deviceName: 'Web Browser (Demo)' }),
      });
      const fbData = await fbRes.json();
      if (fbRes.ok && fbData.data?.user) {
        onLoginSuccess(fbData.data.user, {
          accessToken: fbData.data.accessToken,
          refreshToken: fbData.data.refreshToken,
          deviceSessionId: fbData.data.deviceSessionId,
        });
        return;
      }
      setErrorMsg(data.message || 'Demo OTP login failed');
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo OTP login network error');
    } finally {
      setLoading(false);
    }
  };

  // Demo Preset Credentials
  const PRESETS = [
    { label: 'System Admin', u: 'sysadmin.itda', p: 'SystemAdmin@2026', tab: 'staff' },
    { label: 'Admin (District)', u: 'admin.paderu', p: 'Admin@2026', tab: 'staff' },
    { label: 'Medical Officer', u: 'doctor.paderu', p: 'Doctor@2026', tab: 'staff' },
    { label: 'ANM (Sub-Centre)', u: 'anm.chintapalli', p: 'Anm@2026', tab: 'staff' },
    { label: 'ASHA Worker', u: 'asha.pad01', p: 'Asha@2026', tab: 'staff' },
    { label: 'Patient (Tribal)', u: 'patient.pad01', p: 'Patient@2026', tab: 'patient' },
  ];

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setActiveTab(preset.tab as any);
    setUsername(preset.u);
    setPassword(preset.p);
    setErrorMsg(null);
  };

  // Submit Password Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSec) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          deviceName: navigator.userAgent.includes('Mobile') ? 'Tribal PWA Tablet' : 'Workstation Desktop',
        }),
      });

      const envelope = await res.json();

      if (!res.ok || !envelope.success) {
        if (envelope.error?.code === 'ACCOUNT_LOCKED' || envelope.error?.code === 'BACKOFF_REQUIRED') {
          const waitTime = envelope.error.details?.lockoutRemainingSeconds || 30;
          setLockoutSec(waitTime);
          setErrorMsg(envelope.error.message || 'Account temporarily locked due to repeated failed attempts.');
        } else {
          setErrorMsg(envelope.error?.message || 'Login failed. Please check credentials.');
        }
        return;
      }

      // Check if 2FA TOTP Challenge is required
      if (envelope.data?.mfaRequired) {
        setMfaPendingToken(envelope.data.mfaSessionToken);
        setMfaNotice(envelope.data.message || 'Please provide your 6-digit TOTP authentication code.');
        return;
      }

      // Login Successful
      if (envelope.data?.user && envelope.data?.accessToken) {
        onLoginSuccess(envelope.data.user, {
          accessToken: envelope.data.accessToken,
          refreshToken: envelope.data.refreshToken,
          deviceSessionId: envelope.data.deviceSessionId,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error occurred connecting to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  // Submit User Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      setErrorMsg('A valid 10-digit Indian phone number is required.');
      setLoading(false);
      return;
    }

    if (!regPhoneToken) {
      setErrorMsg('Please verify your phone number via OTP first.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername.trim(),
          fullName: regFullName.trim(),
          password: regPassword,
          role: regRole,
          phone: cleanPhone,
          phoneToken: regPhoneToken,
          hospitalId: regHospitalId || undefined,
        }),
      });

      const envelope = await res.json();

      if (!res.ok || (envelope.success === false && !envelope.data)) {
        setErrorMsg(envelope.message || envelope.error?.message || 'Registration failed. Username may already exist.');
        return;
      }

      setSuccessMsg('Registration successful! Automatically logging in...');

      if (envelope.data?.user && envelope.data?.accessToken) {
        setTimeout(() => {
          onLoginSuccess(envelope.data.user, {
            accessToken: envelope.data.accessToken,
            refreshToken: envelope.data.refreshToken,
            deviceSessionId: envelope.data.deviceSessionId,
          });
        }, 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.accessToken) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          phone: editPhone.trim(),
          hospitalId: editHospitalId.trim() || undefined,
        }),
      });

      const envelope = await res.json();

      if (!res.ok || !envelope.success) {
        setErrorMsg(envelope.error?.message || 'Failed to update profile.');
        return;
      }

      setSuccessMsg('Profile updated successfully!');
      if (currentUser && envelope.data?.user) {
        const updated = { ...currentUser, ...envelope.data.user };
        localStorage.setItem('aarogya_user', JSON.stringify(updated));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating profile.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.accessToken) return;

    if (newPwd !== confirmPwd) {
      setErrorMsg('New password and confirmation password do not match.');
      return;
    }

    if (newPwd.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: currentPwd,
          newPassword: newPwd,
        }),
      });

      const envelope = await res.json();

      if (!res.ok || !envelope.success) {
        setErrorMsg(envelope.error?.message || 'Password change failed.');
        return;
      }

      setSuccessMsg('Password changed successfully! Keep your new password safe.');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error changing password.');
    } finally {
      setLoading(false);
    }
  };

  // Submit Account Deletion
  const handleDeleteAccount = async () => {
    if (!tokens?.accessToken) return;
    const confirm = window.confirm(
      'Are you sure you want to de-activate your account? You will be immediately logged out.'
    );
    if (!confirm) return;

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      const envelope = await res.json();
      if (res.ok && envelope.success) {
        alert('Account deactivated successfully.');
        onLogout();
      } else {
        alert(envelope.error?.message || 'Failed to deactivate account.');
      }
    } catch (err: any) {
      alert('Error deactivating account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit TOTP Step 2 Verification
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaPendingToken || totpCode.length !== 6) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfaSessionToken: mfaPendingToken,
          code: totpCode,
        }),
      });

      const envelope = await res.json();

      if (!res.ok || !envelope.success) {
        setErrorMsg(envelope.error?.message || 'Invalid authentication code.');
        return;
      }

      if (envelope.data?.user && envelope.data?.accessToken) {
        setMfaPendingToken(null);
        setTotpCode('');
        onLoginSuccess(envelope.data.user, {
          accessToken: envelope.data.accessToken,
          refreshToken: envelope.data.refreshToken,
          deviceSessionId: envelope.data.deviceSessionId,
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify TOTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Begin WebAuthn Biometric Login Challenge
  const handleBiometricLogin = async () => {
    if (!window.PublicKeyCredential) {
      setErrorMsg('WebAuthn biometrics are not supported by this browser.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const optRes = await fetch('/api/v1/auth/webauthn/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const optEnv = await optRes.json();
      if (!optRes.ok || !optEnv.success) {
        throw new Error(optEnv.error?.message || 'Biometric authentication challenge failed.');
      }

      setErrorMsg('Please tap your biometric sensor or security key.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Biometric challenge rejected.');
    } finally {
      setLoading(false);
    }
  };

  // Initiate TOTP MFA Setup
  const handleStartMfaSetup = async () => {
    if (!tokens?.accessToken) return;
    try {
      const res = await fetch('/api/v1/auth/mfa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      const envelope = await res.json();
      if (res.ok && envelope.success) {
        setMfaSetupData(envelope.data);
        setShowMfaSetup(true);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Confirm TOTP MFA Setup
  const handleConfirmMfaSetup = async () => {
    if (!tokens?.accessToken || setupCode.length !== 6) return;
    try {
      const res = await fetch('/api/v1/auth/mfa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ code: setupCode }),
      });
      const envelope = await res.json();
      if (res.ok && envelope.success) {
        setShowMfaSetup(false);
        setMfaSuccessMsg('TOTP Two-Factor Authentication is now enabled for your account!');
      } else {
        setErrorMsg(envelope.error?.message || 'Invalid code. Could not verify authenticator app.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="card forest-card-panel">
      {/* 2FA Challenge Interstitial */}
      {mfaPendingToken ? (
        <div className="mfa-challenge-box">
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '2rem' }}>📱</span>
            <h3 style={{ fontSize: '1.25rem', marginTop: '6px' }}>Two-Factor Authentication Required</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{mfaNotice}</p>
          </div>

          {errorMsg && (
            <div style={{ color: 'var(--color-status-danger)', fontSize: '0.85rem', marginBottom: '12px' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleVerifyTotp}>
            <div className="form-group">
              <label className="form-label">Enter 6-digit Code from Authenticator App</label>
              <input
                type="text"
                maxLength={6}
                className="mfa-code-input"
                placeholder="123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setMfaPendingToken(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2 }}
                disabled={loading || totpCode.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify Code & Proceed'}
              </button>
            </div>
          </form>
        </div>
      ) : currentUser ? (
        /* ==================================================== */
        /* LOGGED IN USER MANAGEMENT (Profile, Password, Settings) */
        /* ==================================================== */
        <div>
          <div className="auth-profile-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="user-avatar-circle" style={{ width: '48px', height: '48px', fontSize: '1.3rem' }}>
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: '#ffffff', margin: 0 }}>
                  {currentUser.fullName || currentUser.username}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="role-tag-forest">{currentUser.role.replace('_', ' ')}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    ID: {currentUser.userId}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-forest-secondary"
              onClick={onLogout}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
            >
              🚪 Sign Out
            </button>
          </div>

          {/* Sub Navigation Tabs for User Settings */}
          <div className="user-settings-tabs">
            <button
              type="button"
              className={`user-subtab ${userSubTab === 'overview' ? 'active' : ''}`}
              onClick={() => {
                setUserSubTab('overview');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              📋 Overview &amp; Scopes
            </button>
            <button
              type="button"
              className={`user-subtab ${userSubTab === 'profile' ? 'active' : ''}`}
              onClick={() => {
                setUserSubTab('profile');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              ✏️ Edit Profile
            </button>
            <button
              type="button"
              className={`user-subtab ${userSubTab === 'password' ? 'active' : ''}`}
              onClick={() => {
                setUserSubTab('password');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              🔑 Change Password
            </button>
            <button
              type="button"
              className={`user-subtab ${userSubTab === 'security' ? 'active' : ''}`}
              onClick={() => {
                setUserSubTab('security');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              🛡️ Security &amp; MFA
            </button>
          </div>

          {successMsg && (
            <div className="alert-forest-success" style={{ margin: '12px 0' }}>
              ✓ {successMsg}
            </div>
          )}

          {errorMsg && (
            <div style={{ color: 'var(--color-status-danger)', fontSize: '0.85rem', margin: '12px 0' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {/* SUBTAB 1: OVERVIEW */}
          {userSubTab === 'overview' && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div className="forest-stat-card" style={{ padding: '14px' }}>
                  <span className="stat-title">Hospital Assignment</span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginTop: '4px' }}>
                    {currentUser.hospitalId || 'ITDA Agency Wide'}
                  </div>
                </div>
                <div className="forest-stat-card" style={{ padding: '14px' }}>
                  <span className="stat-title">Registered Phone</span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: '#ffffff', marginTop: '4px' }}>
                    {currentUser.phone || 'Not Registered'}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                  ACTIVE PERMISSION CAPABILITIES (ROLE BASED ACCESS CONTROL):
                </div>
                <div className="capabilities-cloud">
                  {currentUser.capabilities.map((cap) => (
                    <span key={cap} className="capability-pill">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 2: EDIT PROFILE */}
          {userSubTab === 'profile' && (
            <form onSubmit={handleUpdateProfile} style={{ marginTop: '16px', maxWidth: '500px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Phone Number (Simulation SMS)</label>
                <input
                  type="text"
                  className="form-control"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Hospital / Health Facility ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={editHospitalId}
                  onChange={(e) => setEditHospitalId(e.target.value)}
                  placeholder="e.g. hosp_paderu_dh"
                />
              </div>

              <button type="submit" className="btn-forest-primary" disabled={loading}>
                {loading ? 'Saving Changes...' : '💾 Save Profile Updates'}
              </button>
            </form>
          )}

          {/* SUBTAB 3: CHANGE PASSWORD */}
          {userSubTab === 'password' && (
            <form onSubmit={handleChangePassword} style={{ marginTop: '16px', maxWidth: '500px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">New Password (min 6 characters)</label>
                <input
                  type="password"
                  className="form-control"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Enter new strong password"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <button type="submit" className="btn-forest-primary" disabled={loading}>
                {loading ? 'Updating Password...' : '🔒 Change Password'}
              </button>
            </form>
          )}

          {/* SUBTAB 4: SECURITY & MFA */}
          {userSubTab === 'security' && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <button
                  type="button"
                  className="btn-forest-secondary"
                  onClick={handleStartMfaSetup}
                >
                  🔐 Setup TOTP Authenticator App
                </button>
              </div>

              {mfaSuccessMsg && (
                <div className="alert-forest-success" style={{ marginBottom: '16px' }}>
                  ✓ {mfaSuccessMsg}
                </div>
              )}

              {/* Danger Zone */}
              <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '16px' }}>
                <h4 style={{ color: '#ef4444', fontSize: '0.95rem', marginBottom: '8px' }}>
                  ⚠️ Danger Zone
                </h4>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
                  Deactivating your account will suspend all active credentials and terminate any existing sessions.
                </p>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                >
                  Deactivate / Delete My Account
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==================================================== */
        /* GUEST / NOT LOGGED IN AUTHENTICATION TABS */
        /* ==================================================== */
        <div>
          <div className="auth-tabs">
            <button
              className={`auth-tab ${activeTab === 'staff' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('staff');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              🏥 Health Staff Login
            </button>
            <button
              className={`auth-tab ${activeTab === 'patient' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('patient');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              🧑 Patient / Citizen Login
            </button>
            <button
              className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              📝 Create New Account
            </button>
            <button
              className={`auth-tab ${activeTab === 'biometric' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('biometric');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
            >
              👆 WebAuthn Biometrics
            </button>
          </div>

          {/* Quick Preset Selector for Staff & Patient */}
          {(activeTab === 'staff' || activeTab === 'patient') && (
            <div className="preset-roles-container">
              <div className="preset-roles-label">Quick Switch Role Presets (Live Demo Accounts):</div>
              <div className="preset-roles-grid">
                {PRESETS.map((p) => (
                  <button key={p.u} type="button" className="preset-chip" onClick={() => applyPreset(p)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lockout / Backoff Countdown Alert */}
          {lockoutSec && (
            <div className="lockout-alert">
              <span>⏳</span>
              <div>
                <strong>Lockout / Exponential Backoff Active:</strong>
                <div>Please wait {lockoutSec} seconds before attempting another login.</div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{ color: 'var(--color-status-danger)', fontSize: '0.85rem', marginBottom: '12px' }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="alert-forest-success" style={{ marginBottom: '12px' }}>
              ✓ {successMsg}
            </div>
          )}

          {/* TAB 1 & 2: STAFF & PATIENT LOGIN FORM */}
          {(activeTab === 'staff' || activeTab === 'patient') && (
            <form onSubmit={handleLogin}>
              {activeTab === 'patient' && (
                <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: '#065f46' }}>📱 Demo Patient Mobile OTP Login:</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Log in immediately using phone 9876543210 and demo OTP 123456.</div>
                  </div>
                  <button
                    type="button"
                    className="btn-forest-primary"
                    onClick={handleDemoPatientOtpLogin}
                    disabled={loading}
                    style={{ whiteSpace: 'nowrap', padding: '6px 14px', fontSize: '0.85rem' }}
                  >
                    ⚡ Demo OTP Login (123456)
                  </button>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-brand-accent)',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                  }}
                  onClick={() => {
                    if (onNavigateToRecovery) onNavigateToRecovery();
                  }}
                >
                  Forgot password? Recover account
                </button>
              </div>

              <button
                type="submit"
                className="btn-forest-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading || Boolean(lockoutSec)}
              >
                {loading ? 'Authenticating...' : `Sign In as ${activeTab === 'staff' ? 'Health Staff' : 'Patient'}`}
              </button>
            </form>
          )}

          {/* TAB 3: REGISTRATION FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.25)', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <strong style={{ fontSize: '0.88rem', color: '#1e40af' }}>⚡ Quick Demo Registration:</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Auto-generates persona, verifies phone with demo OTP 123456, and fills the form.</div>
                </div>
                <button
                  type="button"
                  className="btn-forest-secondary"
                  onClick={handleDemoQuickRegisterFill}
                  disabled={regOtpLoading}
                  style={{ whiteSpace: 'nowrap', padding: '6px 14px', fontSize: '0.85rem' }}
                >
                  ⚡ Auto-Fill &amp; Verify Demo OTP
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Choose Username *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. raju.somu"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Somu Raju"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Password * (min 6 characters)</label>
                  <input
                    type="password"
                    className="form-control"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Phone Number *</span>
                    {regPhoneToken && <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.82rem' }}>✓ Verified</span>}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={regPhone}
                      onChange={(e) => {
                        setRegPhone(e.target.value);
                        setRegPhoneToken(null);
                        setRegOtpSent(false);
                      }}
                      placeholder="10-digit phone (e.g. 9848012345)"
                      required
                    />
                    <button
                      type="button"
                      className="btn-forest-secondary"
                      onClick={handleSendRegOtp}
                      disabled={regOtpLoading || regOtpCooldown > 0 || Boolean(regPhoneToken)}
                      style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      {regOtpLoading ? 'Sending...' : regOtpCooldown > 0 ? `${regOtpCooldown}s` : regPhoneToken ? '✓ Done' : 'Send OTP'}
                    </button>
                  </div>

                  {regOtpSent && !regPhoneToken && (
                    <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        Enter the 6-digit OTP sent to your phone:
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          className="form-control"
                          value={regOtpCode}
                          onChange={(e) => setRegOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="6-digit OTP"
                          style={{ maxWidth: '140px', letterSpacing: '2px', textAlign: 'center', fontWeight: 'bold' }}
                        />
                        <button
                          type="button"
                          className="btn-forest-primary"
                          onClick={handleVerifyRegOtp}
                          disabled={regOtpLoading || regOtpCode.length !== 6}
                          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                        >
                          {regOtpLoading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                        <button
                          type="button"
                          className="btn-forest-secondary"
                          onClick={() => setRegOtpCode('123456')}
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                          title="Fills simulated test OTP"
                        >
                          Fill 123456
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">User Role</label>
                  <select
                    className="form-control"
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as any)}
                  >
                    <option value="patient">Tribal Patient / Citizen</option>
                    <option value="asha">ASHA Frontline Worker</option>
                    <option value="anm">ANM Sub-Centre Staff</option>
                    <option value="medical_officer">Medical Officer (MO)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Facility Assignment</label>
                  <input
                    type="text"
                    className="form-control"
                    value={regHospitalId}
                    onChange={(e) => setRegHospitalId(e.target.value)}
                    placeholder="e.g. hosp_paderu_dh"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-forest-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : '✨ Create Account & Log In'}
              </button>
            </form>
          )}

          {/* TAB 4: BIOMETRIC LOGIN */}
          {activeTab === 'biometric' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
                Authenticate securely using device-bound biometric sensors (FIDO2 / WebAuthn).
              </p>
              <div className="form-group" style={{ maxWidth: '300px', margin: '0 auto 16px' }}>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-forest-primary"
                onClick={handleBiometricLogin}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : '👆 Authenticate with Biometrics'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TOTP Setup Modal */}
      {showMfaSetup && mfaSetupData && (
        <div className="mfa-modal-overlay">
          <div className="mfa-modal-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🔐 Setup Authenticator App</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
              Enter this secret key in Google Authenticator, Duo, or Microsoft Authenticator:
            </p>

            <div
              style={{
                background: 'rgba(0,0,0,0.5)',
                padding: '10px',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '1rem',
                textAlign: 'center',
                color: 'var(--color-brand-accent)',
                letterSpacing: '2px',
                marginBottom: '16px',
              }}
            >
              {mfaSetupData.secret}
            </div>

            <div className="form-group">
              <label className="form-label">Enter 6-digit code from App to confirm:</label>
              <input
                type="text"
                maxLength={6}
                className="mfa-code-input"
                placeholder="000000"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowMfaSetup(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-forest-primary"
                onClick={handleConfirmMfaSetup}
                disabled={setupCode.length !== 6}
              >
                Confirm &amp; Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
