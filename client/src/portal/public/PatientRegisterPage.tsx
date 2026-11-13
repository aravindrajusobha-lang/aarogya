import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { extractIdentityFromImages } from '../../services/localIdentityOcr';
import { isValidAadhaarNumber } from '../../services/aadhaarQr';
import { Icon } from '../icons';
import { makeT, newMutationId, Translate } from '../lib';
import { AuthResult, formatAbha, OtpBoxes, PublicShell, publicApi } from './PublicPages';

type Method = 'aadhaar' | 'abha' | 'mobile';
type Step = 'method' | 'card' | 'abha' | 'mobile' | 'details' | 'done';
interface Mandal { mandalId: string; name: string; nameTe: string; nameHi: string; villages: Array<{ name: string; nameTe: string }> }

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

/* ---------- Live camera for one side of the card (image stays in browser memory) ---------- */
const CardCamera: React.FC<{ t: Translate; label: string; image: string; onImage: (dataUrl: string) => void }> = ({ t, label, image, onImage }) => {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const stop = () => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setOpen(false); };
  useEffect(() => () => stop(), []);
  useEffect(() => {
    const onStop = () => stop();
    window.addEventListener('aarogya:stop-camera', onStop);
    return () => window.removeEventListener('aarogya:stop-camera', onStop);
  }, []);

  const start = async () => {
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      stream.current = media; setOpen(true);
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = media; void video.current.play(); } });
    } catch { setError(t('public.reg.cameraError')); stop(); }
  };
  const capture = () => {
    const el = video.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = el.videoWidth; canvas.height = el.videoHeight;
    canvas.getContext('2d')?.drawImage(el, 0, 0);
    onImage(canvas.toDataURL('image/jpeg', 0.92));
    stop();
  };
  const fromFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => onImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="adp-card-slot">
      <h3>{label}</h3>
      {open ? (
        <div className="adp-camera">
          <video ref={video} playsInline muted />
          <div className="adp-camera-frame" aria-hidden="true" />
          <p>{t('public.reg.cameraHelp')}</p>
          <div className="adp-camera-actions">
            <button type="button" className="adp-btn adp-btn-ghost" onClick={stop}>{t('common.cancel')}</button>
            <button type="button" className="adp-btn adp-btn-primary adp-btn-xl adp-shutter" onClick={capture}><Icon.camera size={24} />{t('public.reg.capture')}</button>
          </div>
        </div>
      ) : image ? (
        <div className="adp-card-preview">
          <img src={image} alt={label} />
          <button type="button" className="adp-btn adp-btn-ghost" onClick={() => onImage('')}><Icon.repeat size={18} />{t('public.reg.retake')}</button>
        </div>
      ) : (
        <div className="adp-card-empty">
          <button type="button" className="adp-btn adp-btn-primary adp-btn-xl" onClick={() => void start()}><Icon.camera size={24} />{t('public.reg.useCamera')}</button>
          <label className="adp-btn adp-btn-outline">
            <Icon.file size={18} />{t('public.reg.upload')}
            <input type="file" accept="image/*" hidden onChange={(e) => fromFile(e.target.files?.[0])} />
          </label>
        </div>
      )}
      {error && <p className="adp-notice adp-notice-warn">{error}</p>}
    </div>
  );
};

/* ---------- Mobile verification (OTP) ---------- */
const MobileVerify: React.FC<{ t: Translate; phoneToken: string; onVerified: (token: string, phone: string) => void; optional?: boolean }> = ({ t, phoneToken, onVerified, optional }) => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [demo, setDemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (phoneToken) return <p className="adp-notice adp-notice-success" role="status"><Icon.check size={18} /> {t('public.reg.mobileVerified')}</p>;
  const send = async () => {
    setBusy(true); setError('');
    try { const data = await publicApi<{ demoOtp?: string }>('/api/v1/otp/send', { phone, purpose: 'REGISTER' }); setSent(true); setDemo(data.demoOtp || ''); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError('');
    try { const data = await publicApi<{ phoneToken: string }>('/api/v1/otp/verify', { phone, otp, purpose: 'REGISTER' }); onVerified(data.phoneToken, phone); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="adp-auth-form">
      <label className="adp-field adp-field-xl">{optional ? t('public.reg.mobileOptional') : t('public.reg.mobileLabel')}
        <div className="adp-prefix-input"><span>+91</span><input type="tel" inputMode="numeric" value={phone} disabled={sent} onChange={(e) => setPhone(digitsOnly(e.target.value, 10))} placeholder="98765 43210" /></div>
      </label>
      {!sent ? (
        <button type="button" className="adp-btn adp-btn-outline adp-btn-xl" disabled={!/^[6-9]\d{9}$/.test(phone) || busy} onClick={() => void send()}>{busy ? t('public.patientLogin.sending') : t('public.patientLogin.sendOtp')}</button>
      ) : (
        <>
          {demo && <p className="adp-muted">{t('public.patientLogin.demoHint', { code: demo })}</p>}
          <OtpBoxes value={otp} onChange={setOtp} label={t('public.patientLogin.otpLabel')} autoFocus />
          <div className="adp-auth-links">
            <button type="button" className="adp-btn adp-btn-primary adp-btn-xl" disabled={otp.length !== 6 || busy} onClick={() => void verify()}>{busy ? t('public.patientLogin.verifying') : t('public.reg.verifyMobile')}</button>
            <button type="button" className="adp-link" onClick={() => { setSent(false); setOtp(''); }}>{t('public.change')}</button>
          </div>
        </>
      )}
      {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
    </div>
  );
};

/* ---------- Page ---------- */
export const PatientRegisterPage: React.FC<{ lang: LanguageCode; onChangeLang: (lang: LanguageCode) => void; onRegistered: (result: AuthResult) => void }> = ({ lang, onChangeLang, onRegistered }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const [method, setMethod] = useState<Method | null>(null);
  const [step, setStep] = useState<Step>('method');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [aadhaar, setAadhaar] = useState('');
  const [abha, setAbha] = useState('');
  const [phoneToken, setPhoneToken] = useState('');
  const [places, setPlaces] = useState<Mandal[]>([]);
  const [form, setForm] = useState({ fullName: '', yearOfBirth: '', gender: '', mandalId: '', village: '', otherVillage: false, address: '', pincode: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ patientId: string; auth: AuthResult } | null>(null);
  const mutationId = useRef(newMutationId());

  useEffect(() => { publicApi<{ mandals: Mandal[] }>('/api/v1/patient/easy/places').then((d) => setPlaces(d.mandals)).catch(() => undefined); }, []);
  // Invariant 5: card images and Aadhaar digits live only in memory and are cleared on exit.
  useEffect(() => () => { setFront(''); setBack(''); setAadhaar(''); }, []);

  const aadhaarDigits = aadhaar.replace(/\D/g, '');
  const aadhaarOk = aadhaarDigits.length === 12 && isValidAadhaarNumber(aadhaarDigits);
  const mandal = places.find((m) => m.mandalId === form.mandalId);
  const placeName = (m: { name: string; nameTe?: string; nameHi?: string }) => (lang === 'te' && m.nameTe) ? `${m.nameTe} (${m.name})` : (lang === 'hi' && m.nameHi) ? `${m.nameHi} (${m.name})` : m.name;
  const set = (key: keyof typeof form, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }));

  const choose = (next: Method) => { setMethod(next); setError(''); setStep(next === 'aadhaar' ? 'card' : next === 'abha' ? 'abha' : 'mobile'); };

  const readCard = async () => {
    setError(''); setProgress(0);
    try {
      const fields = await extractIdentityFromImages([front, back].filter(Boolean), 'aadhaar', (p) => setProgress(p));
      setForm((prev) => ({
        ...prev,
        fullName: fields.fullName || prev.fullName,
        yearOfBirth: fields.yearOfBirth ? String(fields.yearOfBirth) : prev.yearOfBirth,
        gender: fields.gender || prev.gender,
        address: fields.address || prev.address,
        pincode: fields.pincode || prev.pincode,
      }));
      const matched = places.find((m) => fields.mandal && m.name.toLowerCase().includes(fields.mandal.toLowerCase()));
      if (matched) setForm((prev) => ({ ...prev, mandalId: matched.mandalId }));
      if (fields.aadhaarNumber) setAadhaar(fields.aadhaarNumber.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 '));
    } catch (e: any) { setError(e?.message || t('common.error')); }
    finally { setProgress(null); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!method) return;
    setBusy(true); setError('');
    try {
      const data = await publicApi<any>('/api/v1/patient/easy/register', {
        method,
        fullName: form.fullName.trim(),
        yearOfBirth: Number(form.yearOfBirth),
        gender: form.gender,
        mandalId: form.mandalId,
        village: form.village.trim(),
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
        ...(/^[1-9]\d{5}$/.test(form.pincode) ? { pincode: form.pincode } : {}),
        ...(phoneToken ? { phoneToken } : {}),
        ...(method === 'abha' ? { abhaNumber: abha.replace(/\D/g, '') } : {}),
        consent: true,
        clientMutationId: mutationId.current,
      });
      // Clear card images and Aadhaar digits from memory immediately after registration.
      setFront(''); setBack(''); setAadhaar('');
      setResult({ patientId: data.patientId, auth: { user: data.user, tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken, deviceSessionId: data.deviceSessionId } } });
      setStep('done');
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  const steps: Step[] = method === 'aadhaar' ? ['card', 'details', 'done'] : method === 'abha' ? ['abha', 'details', 'done'] : ['mobile', 'details', 'done'];
  const stepLabel = (s: Step) => (s === 'card' ? t('public.reg.stepCard') : s === 'details' ? t('public.reg.stepDetails') : s === 'done' ? t('public.reg.stepDone') : t('public.reg.stepMobile'));
  const year = new Date().getFullYear();
  const detailsValid = form.fullName.trim().length >= 2 && Number(form.yearOfBirth) >= 1900 && Number(form.yearOfBirth) <= year && form.gender && form.mandalId && form.village.trim();

  return (
    <PublicShell lang={lang} onChangeLang={onChangeLang} t={t} narrow>
      <section className="adp-auth-card adp-auth-wide">
        {step === 'method' ? <a href="#/patient/login" className="adp-link">← {t('public.back')}</a>
          : step !== 'done' && <button type="button" className="adp-link" onClick={() => setStep(step === 'details' ? (method === 'aadhaar' ? 'card' : method === 'abha' ? 'abha' : 'mobile') : 'method')}>← {t('public.back')}</button>}
        <h1>{t('public.reg.title')}</h1>
        {method && step !== 'method' && (
          <ol className="adp-stepper">{steps.map((s, i) => <li key={s} className={steps.indexOf(step) >= i ? 'is-done' : ''}><span>{i + 1}</span>{stepLabel(s)}</li>)}</ol>
        )}

        {step === 'method' && (
          <>
            <p className="adp-auth-sub">{t('public.reg.subtitle')}</p>
            <div className="adp-method-list" role="group" aria-label={t('public.reg.chooseMethod')}>
              {([['mobile', 'phone', t('public.reg.mobile'), t('public.reg.mobileSub')], ['aadhaar', 'file', t('public.reg.aadhaar'), t('public.reg.aadhaarSub')], ['abha', 'shield', t('public.reg.abha'), t('public.reg.abhaSub')]] as const).map(([key, icon, title, sub]) => {
                const IconCmp = Icon[icon];
                return <button key={key} type="button" className="adp-big-choice" onClick={() => choose(key)}><span className="adp-big-icon"><IconCmp size={28} /></span><span><strong>{title}</strong><small>{sub}</small></span><Icon.arrow size={22} /></button>;
              })}
            </div>
          </>
        )}

        {step === 'card' && (
          <div className="adp-auth-form">
            <p className="adp-notice adp-notice-info"><Icon.shield size={18} /> {t('public.reg.privacy')}</p>
            <div className="adp-card-pair">
              <CardCamera t={t} label={t('public.reg.front')} image={front} onImage={setFront} />
              <CardCamera t={t} label={t('public.reg.backSide')} image={back} onImage={setBack} />
            </div>
            <button type="button" className="adp-btn adp-btn-outline adp-btn-xl" disabled={!front || progress !== null} onClick={() => void readCard()}>
              <Icon.scan size={20} />{progress !== null ? t('public.reg.reading', { p: progress }) : t('public.reg.readCard')}
            </button>
            <label className="adp-field adp-field-xl">{t('public.reg.aadhaarNumber')}
              <input inputMode="numeric" autoComplete="off" placeholder="XXXX XXXX XXXX" value={aadhaar} onChange={(e) => setAadhaar(digitsOnly(e.target.value, 12).replace(/(\d{4})(?=\d)/g, '$1 '))} />
            </label>
            {aadhaarDigits.length === 12 && <p className={`adp-notice ${aadhaarOk ? 'adp-notice-success' : 'adp-notice-error'}`}>{aadhaarOk ? t('public.reg.aadhaarValid') : t('public.reg.aadhaarInvalid')}</p>}
            {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
            <button type="button" className="adp-btn adp-btn-primary adp-btn-xl" disabled={!front || !back || !aadhaarOk} onClick={() => setStep('details')}>{t('public.next')}<Icon.arrow size={20} /></button>
          </div>
        )}

        {step === 'abha' && (
          <div className="adp-auth-form">
            <label className="adp-field adp-field-xl">{t('public.reg.abhaLabel')}
              <input inputMode="numeric" placeholder="91-1234-5678-9012" value={abha} onChange={(e) => setAbha(formatAbha(e.target.value))} />
              <small className="adp-hint">{t('public.reg.abhaHint')}</small>
            </label>
            <p className="adp-notice adp-notice-warn">{t('public.reg.abhaMock')}</p>
            <MobileVerify t={t} phoneToken={phoneToken} onVerified={(token) => setPhoneToken(token)} />
            <button type="button" className="adp-btn adp-btn-primary adp-btn-xl" disabled={abha.replace(/\D/g, '').length !== 14 || !phoneToken} onClick={() => setStep('details')}>{t('public.next')}<Icon.arrow size={20} /></button>
          </div>
        )}

        {step === 'mobile' && (
          <div className="adp-auth-form">
            <MobileVerify t={t} phoneToken={phoneToken} onVerified={(token) => setPhoneToken(token)} />
            <button type="button" className="adp-btn adp-btn-primary adp-btn-xl" disabled={!phoneToken} onClick={() => setStep('details')}>{t('public.next')}<Icon.arrow size={20} /></button>
          </div>
        )}

        {step === 'details' && (
          <form className="adp-auth-form" onSubmit={submit}>
            <label className="adp-field adp-field-xl">{t('public.reg.fullName')}<input required autoComplete="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></label>
            <label className="adp-field adp-field-xl">{t('public.reg.yearOfBirth')}<input required inputMode="numeric" placeholder="1965" value={form.yearOfBirth} onChange={(e) => set('yearOfBirth', digitsOnly(e.target.value, 4))} /></label>
            <fieldset className="adp-fieldset"><legend className="adp-legend-xl">{t('public.reg.gender')}</legend>
              <div className="adp-segment">
                {(['female', 'male', 'other'] as const).map((g) => <button key={g} type="button" aria-pressed={form.gender === g} onClick={() => set('gender', g)}>{t(`public.reg.${g}`)}</button>)}
              </div>
            </fieldset>
            <label className="adp-field adp-field-xl">{t('public.reg.mandal')}
              <select required value={form.mandalId} onChange={(e) => { set('mandalId', e.target.value); set('village', ''); set('otherVillage', false); }}>
                <option value="">{t('public.reg.chooseMandal')}</option>
                {places.map((m) => <option key={m.mandalId} value={m.mandalId}>{placeName(m)}</option>)}
              </select>
            </label>
            {mandal && (mandal.villages.length > 0 && !form.otherVillage ? (
              <label className="adp-field adp-field-xl">{t('public.reg.village')}
                <select required value={form.village} onChange={(e) => (e.target.value === '__other' ? (set('otherVillage', true), set('village', '')) : set('village', e.target.value))}>
                  <option value="">{t('public.reg.chooseVillage')}</option>
                  {mandal.villages.map((v) => <option key={v.name} value={v.name}>{placeName(v)}</option>)}
                  <option value="__other">{t('public.reg.otherVillage')}</option>
                </select>
              </label>
            ) : (
              <label className="adp-field adp-field-xl">{t('public.reg.typeVillage')}<input required value={form.village} onChange={(e) => set('village', e.target.value)} /></label>
            ))}
            <label className="adp-field adp-field-xl">{t('public.reg.address')}<input value={form.address} maxLength={500} onChange={(e) => set('address', e.target.value)} /></label>
            {method === 'aadhaar' && <MobileVerify t={t} phoneToken={phoneToken} onVerified={(token) => setPhoneToken(token)} optional />}
            <p className="adp-consent-note"><Icon.shield size={18} />{t('public.reg.consent')}</p>
            {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
            <button type="submit" className="adp-btn adp-btn-primary adp-btn-xl" disabled={!detailsValid || busy}><Icon.check size={22} />{busy ? t('public.reg.submitting') : t('public.reg.submit')}</button>
          </form>
        )}

        {step === 'done' && result && (
          <div className="adp-auth-form adp-done">
            <span className="adp-big-icon adp-done-icon"><Icon.check size={40} /></span>
            <h2>{t('public.reg.doneTitle')}</h2>
            <p className="adp-muted">{t('public.reg.doneId')}</p>
            <p className="adp-done-id">{result.patientId}</p>
            <p>{t('public.reg.doneHint')}</p>
            <button type="button" className="adp-btn adp-btn-primary adp-btn-xl" onClick={() => onRegistered(result.auth)}>{t('public.reg.goDashboard')}<Icon.arrow size={20} /></button>
          </div>
        )}

        {step === 'method' && <p className="adp-auth-switch">{t('public.reg.already')} <a href="#/patient/login">{t('public.reg.loginLink')}</a></p>}
      </section>
    </PublicShell>
  );
};
