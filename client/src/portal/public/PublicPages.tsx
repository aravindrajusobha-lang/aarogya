import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { BrandMark, Icon } from '../icons';
import { makeT, Translate } from '../lib';
import '../portal.css';

export interface AuthResult { user: any; tokens: { accessToken: string; refreshToken?: string; deviceSessionId?: string } }

const LANGS: Array<{ code: LanguageCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'hi', label: 'हिन्दी' },
];

async function publicApi<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw Object.assign(new Error(payload?.error?.message || payload?.message || `Request failed (${response.status})`), { status: response.status, code: payload?.error?.code });
  }
  return (payload?.data ?? payload) as T;
}
export { publicApi };

/* ---------- Shell ---------- */
export const PublicShell: React.FC<{ lang: LanguageCode; onChangeLang: (lang: LanguageCode) => void; children: React.ReactNode; t: Translate; narrow?: boolean }> = ({ lang, onChangeLang, children, t, narrow }) => (
  <div className="adp-root adp-public">
    <header className="adp-public-header">
      <a href="#/" className="adp-public-brand" aria-label="Aarogya-Drishti home"><BrandMark size={52} /><span><strong>Aarogya-Drishti</strong><small>{t('common.tagline')}</small></span></a>
      <div className="adp-public-lang" role="group" aria-label={t('common.language')}>
        {LANGS.map((item) => <button key={item.code} type="button" aria-pressed={lang === item.code} onClick={() => onChangeLang(item.code)}>{item.label}</button>)}
      </div>
    </header>
    <main className={`adp-public-main${narrow ? ' is-narrow' : ''}`}>{children}</main>
    <footer className="adp-public-footer"><span>© {new Date().getFullYear()} Aarogya-Drishti · ITDA Paderu</span><span>{t('common.demoAi')} · SIMULATION</span></footer>
  </div>
);

/* ---------- Home ---------- */
export const HomePage: React.FC<{ lang: LanguageCode; onChangeLang: (lang: LanguageCode) => void }> = ({ lang, onChangeLang }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const steps: Array<{ icon: keyof typeof Icon; title: string; sub: string }> = [
    { icon: 'user', title: t('public.home.step1'), sub: t('public.home.step1Sub') },
    { icon: 'camera', title: t('public.home.step2'), sub: t('public.home.step2Sub') },
    { icon: 'stethoscope', title: t('public.home.step3'), sub: t('public.home.step3Sub') },
  ];
  return (
    <PublicShell lang={lang} onChangeLang={onChangeLang} t={t}>
      <section className="adp-home-hero">
        <div className="adp-home-copy">
          <BrandMark size={120} />
          <h1>{t('public.home.title')}</h1>
          <p>{t('public.home.subtitle')}</p>
          <div className="adp-home-actions">
            <a className="adp-big-choice is-primary" href="#/patient/register">
              <span className="adp-big-icon"><Icon.user size={28} /></span>
              <span><strong>{t('public.home.registerCta')}</strong><small>{t('public.home.registerSub')}</small></span>
              <Icon.arrow size={24} />
            </a>
            <a className="adp-big-choice" href="#/patient/login">
              <span className="adp-big-icon"><Icon.phone size={26} /></span>
              <span><strong>{t('public.home.loginCta')}</strong><small>{t('public.home.loginSub')}</small></span>
              <Icon.arrow size={24} />
            </a>
            <a className="adp-staff-link" href="#/login"><Icon.stethoscope size={18} />{t('public.home.staffCta')} — {t('public.home.staffSub')}</a>
          </div>
        </div>
        <figure className="adp-home-visual">
          <img src="/assets/healthcare/patient-recovery.jpg" alt={t('public.home.imageAlt')} loading="eager" />
          <span className="adp-home-badge adp-home-badge-top"><Icon.clinic size={18} />{t('public.home.badgeFree')}</span>
          <span className="adp-home-badge adp-home-badge-bottom"><Icon.check size={18} />{t('public.home.badgeLang')}</span>
        </figure>
      </section>
      <section className="adp-landing-steps" aria-labelledby="adp-how">
        <h2 id="adp-how">{t('public.home.howTitle')}</h2>
        <ol>
          {steps.map((step, index) => {
            const IconCmp = Icon[step.icon];
            return <li key={step.title}><span className="adp-step-num">{index + 1}</span><span className="adp-big-icon"><IconCmp size={26} /></span><strong>{step.title}</strong><p>{step.sub}</p></li>;
          })}
        </ol>
      </section>
      <p className="adp-landing-help"><Icon.bell size={20} />{t('public.home.help')}</p>
    </PublicShell>
  );
};

/* ---------- OTP input (6 large boxes) ---------- */
export const OtpBoxes: React.FC<{ value: string; onChange: (value: string) => void; label: string; autoFocus?: boolean }> = ({ value, onChange, label, autoFocus }) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);
  const setDigit = (index: number, digit: string) => {
    const chars = value.padEnd(6, ' ').split('');
    chars[index] = digit || ' ';
    onChange(chars.join('').replace(/\s+$/, '').replace(/ /g, ''));
  };
  return (
    <fieldset className="adp-otp">
      <legend>{label}</legend>
      <div onPaste={(event) => { const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (digits) { event.preventDefault(); onChange(digits); refs.current[Math.min(digits.length, 5)]?.focus(); } }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { refs.current[index] = el; }}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            aria-label={`${label} ${index + 1}`}
            value={value[index] || ''}
            onChange={(event) => { const digit = event.target.value.replace(/\D/g, '').slice(-1); setDigit(index, digit); if (digit) refs.current[index + 1]?.focus(); }}
            onKeyDown={(event) => { if (event.key === 'Backspace' && !value[index]) refs.current[index - 1]?.focus(); }}
          />
        ))}
      </div>
    </fieldset>
  );
};

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);
export const formatAbha = (value: string) => { const d = digitsOnly(value, 14); return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10), d.slice(10, 14)].filter(Boolean).join('-'); };

/* ---------- Patient login ---------- */
export const PatientLoginPage: React.FC<{ lang: LanguageCode; onChangeLang: (lang: LanguageCode) => void; onLoggedIn: (result: AuthResult) => void }> = ({ lang, onChangeLang, onLoggedIn }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const [mode, setMode] = useState<'mobile' | 'abha'>('mobile');
  const [phone, setPhone] = useState('');
  const [abha, setAbha] = useState('');
  const [otp, setOtp] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [demoHint, setDemoHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = mode === 'mobile' ? { phone } : { abhaNumber: abha.replace(/\D/g, '') };
  const ready = mode === 'mobile' ? /^[6-9]\d{9}$/.test(phone) : abha.replace(/\D/g, '').length === 14;

  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!ready) return;
    setBusy(true); setError('');
    try {
      const data = await publicApi<{ sentTo: string; demoOtpHint?: string }>('/api/v1/patient/easy/login/send-otp', target);
      setSentTo(data.sentTo); setDemoHint(data.demoOtpHint || ''); setOtp('');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (otp.length !== 6) return;
    setBusy(true); setError('');
    try {
      const data = await publicApi<any>('/api/v1/patient/easy/login', { ...target, otp });
      onLoggedIn({ user: data.user, tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, deviceSessionId: data.deviceSessionId } });
    } catch (e: any) { setError(e.message); setBusy(false); }
  };

  return (
    <PublicShell lang={lang} onChangeLang={onChangeLang} t={t} narrow>
      <section className="adp-auth-card">
        <a href="#/" className="adp-link">← {t('public.back')}</a>
        <h1>{t('public.patientLogin.title')}</h1>
        <p className="adp-auth-sub">{t('public.patientLogin.subtitle')}</p>
        {!sentTo ? (
          <form onSubmit={send} className="adp-auth-form">
            <div className="adp-segment" role="group">
              <button type="button" aria-pressed={mode === 'mobile'} onClick={() => { setMode('mobile'); setError(''); }}><Icon.phone size={20} />{t('public.patientLogin.byMobile')}</button>
              <button type="button" aria-pressed={mode === 'abha'} onClick={() => { setMode('abha'); setError(''); }}><Icon.shield size={20} />{t('public.patientLogin.byAbha')}</button>
            </div>
            {mode === 'mobile' ? (
              <label className="adp-field adp-field-xl">{t('public.patientLogin.mobileLabel')}
                <div className="adp-prefix-input"><span>+91</span><input type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(digitsOnly(e.target.value, 10))} /></div>
              </label>
            ) : (
              <label className="adp-field adp-field-xl">{t('public.patientLogin.abhaLabel')}
                <input inputMode="numeric" placeholder="91-1234-5678-9012" value={abha} onChange={(e) => setAbha(formatAbha(e.target.value))} />
              </label>
            )}
            {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
            <button type="submit" className="adp-btn adp-btn-primary adp-btn-xl" disabled={!ready || busy}>{busy ? t('public.patientLogin.sending') : t('public.patientLogin.sendOtp')}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="adp-auth-form">
            <p className="adp-notice adp-notice-success" role="status">{t('public.patientLogin.otpSentTo', { phone: sentTo })}</p>
            {demoHint && <p className="adp-muted">{t('public.patientLogin.demoHint', { code: demoHint })}</p>}
            <OtpBoxes value={otp} onChange={setOtp} label={t('public.patientLogin.otpLabel')} autoFocus />
            {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
            <button type="submit" className="adp-btn adp-btn-primary adp-btn-xl" disabled={otp.length !== 6 || busy}>{busy ? t('public.patientLogin.verifying') : t('public.patientLogin.verify')}</button>
            <div className="adp-auth-links">
              <button type="button" className="adp-link" onClick={() => void send()} disabled={busy}>{t('public.patientLogin.resend')}</button>
              <button type="button" className="adp-link" onClick={() => { setSentTo(''); setOtp(''); setError(''); }}>{t('public.change')}</button>
            </div>
          </form>
        )}
        <p className="adp-auth-switch">{t('public.patientLogin.newHere')} <a href="#/patient/register">{t('public.patientLogin.registerLink')}</a></p>
      </section>
    </PublicShell>
  );
};

/* ---------- Staff login (doctor / admin) ---------- */
export const StaffLoginPage: React.FC<{
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  onLoggedIn: (result: AuthResult) => void;
  ashaPortal?: boolean;
  onRegister?: () => void;
  onOpenAsha?: () => void;
  onBackToStaff?: () => void;
}> = ({ lang, onChangeLang, onLoggedIn, ashaPortal = false, onRegister, onOpenAsha, onBackToStaff }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const finish = (data: any) => onLoggedIn({ user: data.user, tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, deviceSessionId: data.deviceSessionId } });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      if (mfaToken) { finish(await publicApi('/api/v1/auth/mfa/verify', { mfaSessionToken: mfaToken, code })); return; }
      const data = await publicApi<any>('/api/v1/auth/login', { username: username.trim(), password });
      if (data.mfaRequired) { setMfaToken(data.mfaSessionToken); setBusy(false); return; }
      finish(data);
    } catch (e: any) { setError(e.message); setBusy(false); }
  };

  return (
    <PublicShell lang={lang} onChangeLang={onChangeLang} t={t} narrow>
      <section className="adp-auth-card">
        <a href={ashaPortal ? '#/login' : '#/'} className="adp-link" onClick={ashaPortal && onBackToStaff ? (event) => { event.preventDefault(); onBackToStaff(); } : undefined}>← {ashaPortal ? t('public.ashaRegistration.backToStaff') : t('public.back')}</a>
        <h1>{ashaPortal ? t('public.staffLogin.ashaTitle') : t('public.staffLogin.title')}</h1>
        {ashaPortal && !mfaToken && (
          <div className="adp-tabs" role="tablist" aria-label={t('public.ashaRegistration.authTabs')}>
            <button type="button" role="tab" aria-selected="true" aria-pressed="true">{t('public.ashaRegistration.loginTab')}</button>
            <button type="button" role="tab" aria-selected="false" aria-pressed="false" onClick={onRegister}>{t('public.ashaRegistration.registerTab')}</button>
          </div>
        )}
        <p className="adp-auth-sub">{ashaPortal ? t('public.staffLogin.ashaSubtitle') : t('public.staffLogin.subtitle')}</p>
        <form onSubmit={submit} className="adp-auth-form">
          {!mfaToken ? <>
            <label className="adp-field adp-field-xl">{ashaPortal ? t('public.ashaRegistration.username') : t('public.staffLogin.username')}<input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder={ashaPortal ? undefined : 'AD-DR-00012'} /></label>
            <label className="adp-field adp-field-xl">{t('public.staffLogin.password')}
              <span className="adp-password-field">
                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                <button
                  type="button"
                  className="adp-password-toggle"
                  aria-label={showPassword ? t('public.staffLogin.hidePassword') : t('public.staffLogin.showPassword')}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.2 9.5 7-.3.9-1 2-2 3M6.2 6.2C3.9 7.7 2.7 10 2.5 12c1 2.8 4.5 7 9.5 7 1.1 0 2.1-.2 3-.6" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </span>
            </label>
            <div className="adp-auth-recovery">
              <button type="button" className="adp-link" onClick={() => setShowRecoveryHelp((visible) => !visible)} aria-expanded={showRecoveryHelp}>
                {t('public.staffLogin.forgotPassword')}
              </button>
            </div>
            {showRecoveryHelp && <p className="adp-notice adp-notice-info" role="status">{t('public.staffLogin.recoveryHelp')}</p>}
          </> : <OtpBoxes value={code} onChange={setCode} label={t('public.staffLogin.mfa')} autoFocus />}
          {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
          <button type="submit" className="adp-btn adp-btn-primary adp-btn-xl" disabled={busy || (mfaToken ? code.length !== 6 : !username || !password)}>{busy ? t('common.loading') : t('public.staffLogin.submit')}</button>
        </form>
        {!mfaToken && !ashaPortal && <p className="adp-auth-switch">{onOpenAsha
          ? <button type="button" className="adp-link" onClick={onOpenAsha}>{t('public.staffLogin.ashaAccessLink')}</button>
          : <a href="#/asha?mode=register">{t('public.staffLogin.ashaAccessLink')}</a>}</p>}
        {!ashaPortal && <p className="adp-auth-switch">{t('public.staffLogin.patientInstead')} <a href="#/patient/login">{t('public.login')}</a></p>}
      </section>
    </PublicShell>
  );
};

/* ---------- ASHA worker self-registration ---------- */
interface AshaFacility { hospitalId: string; name: string; mandal: string }

export const AshaRegistrationPage: React.FC<{
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  ashaPortal?: boolean;
  onSignIn?: () => void;
  onBackToStaff?: () => void;
}> = ({ lang, onChangeLang, ashaPortal = false, onSignIn, onBackToStaff }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const tr = (key: string) => t(`public.ashaRegistration.${key}`);
  const [facilities, setFacilities] = useState<AshaFacility[]>([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);
  const [form, setForm] = useState({ fullName: '', username: '', phone: '', hospitalId: '', village: '', password: '', confirmPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applicationReference, setApplicationReference] = useState('');
  const selectedFacility = facilities.find((item) => item.hospitalId === form.hospitalId);

  useEffect(() => {
    let active = true;
    void publicApi<{ facilities: AshaFacility[] }>('/api/v1/asha-registration/facilities')
      .then((data) => { if (active) setFacilities(data.facilities); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : t('common.error')); })
      .finally(() => { if (active) setLoadingFacilities(false); });
    return () => { active = false; };
  }, [t]);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError(tr('passwordsMismatch')); return; }
    if (!selectedFacility) { setError(tr('selectFacilityError')); return; }
    setBusy(true);
    try {
      const data = await publicApi<{ applicationReference: string }>('/api/v1/asha-registration/register', {
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        hospitalId: selectedFacility.hospitalId,
        mandal: selectedFacility.mandal,
        village: form.village.trim(),
      });
      setApplicationReference(data.applicationReference);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell lang={lang} onChangeLang={onChangeLang} t={t} narrow>
      <section className="adp-auth-card">
        <a href="#/login" className="adp-link" onClick={onBackToStaff ? (event) => { event.preventDefault(); onBackToStaff(); } : undefined}>← {tr('backToStaff')}</a>
        <h1>{tr('title')}</h1>
        <div className="adp-notice adp-notice-info" role="note">
          <strong>{tr('purposeTitle')}</strong>
          <p className="adp-auth-sub" style={{ marginTop: 6, marginBottom: 0 }}>{tr('purpose')}</p>
        </div>
        {ashaPortal && (
          <div className="adp-tabs" role="tablist" aria-label={tr('authTabs')}>
            <button type="button" role="tab" aria-selected="false" aria-pressed="false" onClick={onSignIn}>{tr('loginTab')}</button>
            <button type="button" role="tab" aria-selected="true" aria-pressed="true">{tr('registerTab')}</button>
          </div>
        )}
        {applicationReference ? (
          <div className="adp-auth-form">
            <p className="adp-notice adp-notice-success" role="status">{tr('pending')}</p>
            <p className="adp-auth-sub">{tr('reference')} <strong>{applicationReference}</strong></p>
            <p className="adp-auth-sub">{tr('waitApproval')}</p>
            <a className="adp-btn adp-btn-primary adp-btn-xl" href={ashaPortal ? '#/asha' : '#/login'} onClick={onSignIn ? (event) => { event.preventDefault(); onSignIn(); } : undefined}>{tr('returnToLogin')}</a>
          </div>
        ) : (
          <>
            <p className="adp-auth-sub">{tr('subtitle')}</p>
            <form onSubmit={submit} className="adp-auth-form">
              <label className="adp-field adp-field-xl">{tr('fullName')}<input required minLength={3} maxLength={120} autoComplete="name" value={form.fullName} onChange={update('fullName')} /></label>
              <label className="adp-field adp-field-xl">{tr('username')}<input required minLength={3} maxLength={50} autoComplete="username" pattern="[A-Za-z0-9._-]+" value={form.username} onChange={update('username')} /></label>
              <label className="adp-field adp-field-xl">{tr('phone')}<input required type="tel" inputMode="tel" autoComplete="tel" pattern="\+?[0-9 ]{10,15}" value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" /></label>
              <label className="adp-field adp-field-xl">{tr('facility')}
                <select required value={form.hospitalId} onChange={update('hospitalId')} disabled={loadingFacilities || !facilities.length}>
                  <option value="">{loadingFacilities ? tr('loadingFacilities') : tr('chooseFacility')}</option>
                  {facilities.map((facility) => <option key={facility.hospitalId} value={facility.hospitalId}>{facility.name} — {facility.mandal}</option>)}
                </select>
              </label>
              <label className="adp-field adp-field-xl">{tr('village')}<input required minLength={2} maxLength={100} value={form.village} onChange={update('village')} /></label>
              <label className="adp-field adp-field-xl">{tr('password')}<input required type="password" autoComplete="new-password" minLength={10} maxLength={72} value={form.password} onChange={update('password')} /><small className="adp-hint">{tr('passwordHint')}</small></label>
              <label className="adp-field adp-field-xl">{tr('confirmPassword')}<input required type="password" autoComplete="new-password" minLength={10} maxLength={72} value={form.confirmPassword} onChange={update('confirmPassword')} /></label>
              {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
              <button type="submit" className="adp-btn adp-btn-primary adp-btn-xl" disabled={busy || loadingFacilities || !facilities.length}>{busy ? t('common.loading') : tr('submit')}</button>
            </form>
          </>
        )}
      </section>
    </PublicShell>
  );
};

export const AshaPortalPage: React.FC<{
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  onLoggedIn: (result: AuthResult) => void;
  onBackToStaff?: () => void;
  initialMode?: 'login' | 'register';
}> = ({ lang, onChangeLang, onLoggedIn, onBackToStaff, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode);
  useEffect(() => setMode(initialMode), [initialMode]);

  if (mode === 'register') {
    return <AshaRegistrationPage lang={lang} onChangeLang={onChangeLang} ashaPortal onSignIn={() => setMode('login')} onBackToStaff={onBackToStaff} />;
  }
  return <StaffLoginPage lang={lang} onChangeLang={onChangeLang} onLoggedIn={onLoggedIn} ashaPortal onRegister={() => setMode('register')} onBackToStaff={onBackToStaff} />;
};

export const StaffAccessPage: React.FC<{
  lang: LanguageCode;
  onChangeLang: (lang: LanguageCode) => void;
  onLoggedIn: (result: AuthResult) => void;
}> = ({ lang, onChangeLang, onLoggedIn }) => {
  const [ashaMode, setAshaMode] = useState(false);
  if (ashaMode) {
    return <AshaPortalPage lang={lang} onChangeLang={onChangeLang} onLoggedIn={onLoggedIn} onBackToStaff={() => setAshaMode(false)} />;
  }
  return <StaffLoginPage lang={lang} onChangeLang={onChangeLang} onLoggedIn={onLoggedIn} onOpenAsha={() => setAshaMode(true)} />;
};
