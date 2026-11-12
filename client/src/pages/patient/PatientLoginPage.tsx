import React, { useEffect, useState } from 'react';
import { LanguageCode, translations } from '../../i18n';
import { SimulationBanner } from '../../components/SimulationBanner';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import '../../styles/PatientAuth.css';

interface PatientLoginPageProps {
  currentLang: LanguageCode;
  onSelectLang: (lang: LanguageCode) => void;
  onLoginSuccess: (user: any, tokens: any) => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

export const PatientLoginPage: React.FC<PatientLoginPageProps> = ({
  currentLang,
  onSelectLang,
  onLoginSuccess,
  onNavigateToRegister,
  onNavigateToForgotPassword,
}) => {
  const labels = (translations[currentLang] as typeof translations.en).patientAuthUi || translations.en.patientAuthUi;
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState('');

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setInterval(() => setOtpCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  const normalizedPhone = phone.replace(/\D/g, '').slice(0, 10);

  const sendOtp = async () => {
    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError(labels.phoneError);
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setDemoOtpHint('');
    try {
      const response = await fetch('/api/v1/auth/patient/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, purpose: 'LOGIN' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || labels.networkError);
      }
      setOtpSent(true);
      setOtp('');
      setOtpCooldown(Number(payload.data?.cooldownSeconds) || 60);
      setMessage(`${labels.otpSent} +91 ${normalizedPhone}`);
      if (payload.data?.demoOtpHint) setDemoOtpHint(String(payload.data.demoOtpHint));
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : labels.networkError);
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!otpSent) {
      await sendOtp();
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError(labels.otpError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/v1/patient/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, otp, deviceName: 'Patient Portal' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.error?.message || labels.networkError);
      }
      onLoginSuccess(payload.data.user, {
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
        deviceSessionId: payload.data.deviceSessionId,
      });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : labels.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SimulationBanner />
      <div className="patient-auth-language"><LanguageSwitcher currentLang={currentLang} onSelect={onSelectLang} /></div>
      <main className="patient-auth-page">
        <div className="patient-auth-shell">
          <aside className="patient-auth-intro" aria-label={labels.portal}>
            <div className="patient-auth-brand-mark" aria-hidden="true">AD</div>
            <p className="patient-auth-eyebrow">{labels.portal}</p>
            <h1>{labels.loginTitle}</h1>
            <p className="patient-auth-intro-copy">{labels.loginSubtitle}</p>
            <div className="patient-auth-step-list" aria-label={labels.signInSteps}>
              <span className="patient-auth-step is-active"><b>1</b> {labels.mobile}</span>
              <span className={`patient-auth-step ${otpSent ? 'is-active' : ''}`}><b>2</b> {labels.otp}</span>
            </div>
            <div className="patient-auth-info-note">{labels.loginHelp}</div>
          </aside>

          <section className="patient-auth-form-panel" aria-labelledby="patient-login-heading">
            <div className="patient-auth-panel-heading">
              <span className="patient-auth-form-kicker">{labels.loginTab}</span>
              <h2 id="patient-login-heading">{labels.loginTitle}</h2>
              <p>{labels.loginSubtitle}</p>
            </div>

            <form className="patient-auth-form" onSubmit={submit}>
              <label htmlFor="patient-login-mobile">{labels.mobile}</label>
              <div className="patient-auth-mobile-row">
                <span aria-hidden="true">+91</span>
                <input
                  id="patient-login-mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  pattern="[0-9]{10}"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                    setOtpSent(false);
                    setOtp('');
                    setDemoOtpHint('');
                    setError('');
                    setMessage('');
                  }}
                  placeholder="9876543210"
                  required
                />
                <button
                  className="patient-auth-button patient-auth-button-secondary patient-auth-send-otp"
                  type="button"
                  onClick={() => void sendOtp()}
                  disabled={loading || normalizedPhone.length !== 10 || otpCooldown > 0}
                >
                  {otpCooldown > 0 ? `${otpCooldown}s` : otpSent ? labels.resendOtp : labels.sendOtp}
                </button>
              </div>

              {otpSent && (
                <div className="patient-auth-field">
                  <label htmlFor="patient-login-otp">{labels.otp}</label>
                  <input
                    id="patient-login-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    required
                    autoFocus
                  />
                </div>
              )}

              {message && <div className="patient-auth-message" role="status">{message}</div>}
              {demoOtpHint && <div className="patient-auth-demo-code" role="note">{labels.simulationOtp} <strong>{demoOtpHint}</strong></div>}
              {error && <div className="patient-auth-error" role="alert">{error}</div>}

              <button
                className="patient-auth-button patient-auth-button-primary patient-auth-submit"
                type="submit"
                disabled={loading || (otpSent && otp.length !== 6)}
              >
                {loading ? labels.loading : otpSent ? labels.verifyContinue : labels.sendOtp}
              </button>
            </form>

            <div className="patient-auth-links">
              <button type="button" onClick={onNavigateToRegister}>{labels.loginHelp}</button>
              <button type="button" onClick={onNavigateToForgotPassword}>{labels.forgotPassword}</button>
            </div>
          </section>
        </div>
        <p className="patient-auth-footer">{labels.safetyFooter}</p>
      </main>
    </>
  );
};
