import React, { useRef, useState } from 'react';
import { LanguageCode, translations } from '../../i18n';
import { SimulationBanner } from '../../components/SimulationBanner';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { extractIdentityFromImages, IdentityDocumentKind } from '../../services/localIdentityOcr';
import '../../styles/PatientAuth.css';

type AccountMode = 'register' | 'forgot-password';

interface PatientAccountPageProps {
  mode: AccountMode;
  currentLang?: LanguageCode;
  onSelectLang?: (lang: LanguageCode) => void;
  onNavigateToLogin: () => void;
  onRegistrationSuccess: (user: any, tokens: any) => void;
}

type RegistrationDocument = IdentityDocumentKind | 'manual';

function newMutationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.random() * 16 | 0;
    return (char === 'x' ? value : (value & 0x3 | 0x8)).toString(16);
  });
}

function readImageLocally(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image could not be read.'));
    reader.onerror = () => reject(new Error('Image could not be read.'));
    reader.readAsDataURL(file);
  });
}

export const PatientAccountPage: React.FC<PatientAccountPageProps> = ({
  mode,
  currentLang = 'en',
  onSelectLang = () => undefined,
  onNavigateToLogin,
  onRegistrationSuccess,
}) => {
  const labels = (translations[currentLang] as typeof translations.en).patientAuthUi || translations.en.patientAuthUi;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [identityKind, setIdentityKind] = useState<RegistrationDocument>('aadhaar');
  const [identityCaptured, setIdentityCaptured] = useState(false);
  const [scanConsentGiven, setScanConsentGiven] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [yearOfBirth, setYearOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [village, setVillage] = useState('');
  const [mandal, setMandal] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const requestReset = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/v1/patient/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, '').slice(0, 10) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || labels.networkError);
      setResetRequested(true);
      setMessage(payload.data?.message || labels.recoverySent);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : labels.networkError);
    } finally {
      setLoading(false);
    }
  };

  const scanCard = async (files: File[]) => {
    if (!scanConsentGiven || (identityKind !== 'aadhaar' && identityKind !== 'abha')) {
      setError(labels.requiredConsent);
      return;
    }
    if (!files.length) return;

    setLoading(true);
    setScanning(true);
    setError('');
    setMessage(labels.scanning);
    setScanProgress(0);
    try {
      const images = await Promise.all(files.map(readImageLocally));
      const extracted = await extractIdentityFromImages(images, identityKind, setScanProgress);

      // Whitelist only the registration profile fields. Identity values, card
      // images, dates of birth, guardian names and OCR metadata stay local.
      if (extracted.fullName) setFullName(extracted.fullName);
      if (extracted.yearOfBirth) setYearOfBirth(String(extracted.yearOfBirth));
      if (extracted.gender) {
        setGender(extracted.gender === 'transgender' ? 'other' : extracted.gender);
      }
      if (extracted.address) setAddress(extracted.address);
      if (extracted.village) setVillage(extracted.village);
      if (extracted.mandal) setMandal(extracted.mandal);
      if (extracted.pincode && /^[1-9]\d{5}$/.test(extracted.pincode)) setPincode(extracted.pincode);
      extracted.aadhaarNumber = undefined;
      extracted.maskedIdentity = undefined;
      extracted.dob = undefined;
      extracted.guardianName = undefined;
      extracted.fieldSources = undefined;
      setIdentityCaptured(true);
      setMessage(labels.scanSuccess);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : labels.scanFailure);
    } finally {
      setLoading(false);
      setScanning(false);
      setScanProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const phoneNumber = phone.replace(/\D/g, '').slice(0, 10);
      if (mode === 'forgot-password') {
        if (!resetRequested) {
          await requestReset();
          return;
        }
        const response = await fetch('/api/v1/patient/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneNumber, otp, newPassword }),
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || labels.networkError);
        setMessage(labels.passwordResetSuccess);
        window.setTimeout(onNavigateToLogin, 600);
        return;
      }

      if (!consentGiven) throw new Error(labels.requiredConsent);
      if (identityKind !== 'manual' && !identityCaptured) throw new Error(labels.requiredIdentity);
      if (!/^\d{10}$/.test(phoneNumber)) throw new Error(labels.phoneError);

      const response = await fetch('/api/v1/patient/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phoneNumber,
          yearOfBirth: Number(yearOfBirth),
          gender,
          village: village.trim(),
          mandal: mandal.trim(),
          address: address.trim(),
          pincode: /^[1-9]\d{5}$/.test(pincode) ? pincode : undefined,
          consentGiven: true,
          clientMutationId: newMutationId(),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.error?.message || labels.registrationFailed);
      }
      onRegistrationSuccess(payload.data.user, {
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
        deviceSessionId: payload.data.deviceSessionId,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : labels.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  const selectIdentityKind = (kind: RegistrationDocument) => {
    setIdentityKind(kind);
    setIdentityCaptured(kind === 'manual');
    setScanConsentGiven(false);
    setError('');
    setMessage('');
  };

  return (
    <>
      <SimulationBanner />
      <div className="patient-auth-language"><LanguageSwitcher currentLang={currentLang} onSelect={onSelectLang} /></div>
      <main className="patient-auth-page patient-auth-page-register">
        <div className="patient-auth-shell patient-auth-shell-register">
          <aside className="patient-auth-intro" aria-label={labels.portal}>
            <div className="patient-auth-brand-mark" aria-hidden="true">AD</div>
            <p className="patient-auth-eyebrow">{labels.portal}</p>
            <h1>{mode === 'register' ? labels.registerTitle : labels.forgotPassword}</h1>
            <p className="patient-auth-intro-copy">{mode === 'register' ? labels.registerSubtitle : labels.recoverySubtitle}</p>
            <div className="patient-auth-info-note">{labels.privacy}</div>
          </aside>

          <section className="patient-auth-form-panel" aria-labelledby="patient-account-heading">
            <div className="patient-auth-panel-heading">
              <span className="patient-auth-form-kicker">{mode === 'register' ? labels.registerTab : labels.forgotPassword}</span>
              <h2 id="patient-account-heading">{mode === 'register' ? labels.registerTitle : labels.forgotPassword}</h2>
              <p>{mode === 'register' ? labels.registerSubtitle : labels.recoverySubtitle}</p>
            </div>

            {mode === 'register' && (
              <div className="patient-auth-registration-source">
                <p className="patient-auth-section-title">{labels.identityTitle}</p>
                <div className="patient-auth-identity-options" role="group" aria-label={labels.identityTitle}>
                  {(['aadhaar', 'abha', 'manual'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      className={`patient-auth-identity-option ${identityKind === kind ? 'is-selected' : ''}`}
                      aria-pressed={identityKind === kind}
                      onClick={() => selectIdentityKind(kind)}
                    >
                      <span className="patient-auth-identity-icon" aria-hidden="true">{kind === 'aadhaar' ? 'A' : kind === 'abha' ? 'H' : '✎'}</span>
                      <span>{labels[kind]}</span>
                    </button>
                  ))}
                </div>
                <p className="patient-auth-privacy-copy">{labels.privacy}</p>

                {identityKind !== 'manual' && (
                  <div className="patient-auth-scan-box">
                    <label className="patient-auth-consent patient-auth-scan-consent">
                      <input type="checkbox" checked={scanConsentGiven} onChange={(event) => setScanConsentGiven(event.target.checked)} />
                      <span>{labels.scanConsent}</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      className="patient-auth-file-input"
                      id="patient-identity-image"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple={identityKind === 'aadhaar'}
                      aria-label={identityKind === 'aadhaar' ? labels.chooseAadhaarImages : labels.chooseImage}
                      disabled={!scanConsentGiven || loading}
                      onChange={(event) => {
                        const files = Array.from(event.currentTarget.files || []);
                        event.currentTarget.value = '';
                        void scanCard(files);
                      }}
                    />
                    <label className="patient-auth-button patient-auth-button-secondary patient-auth-file-button" aria-disabled={!scanConsentGiven || loading} htmlFor="patient-identity-image">
                      {identityKind === 'aadhaar' ? labels.chooseAadhaarImages : labels.chooseImage}
                    </label>
                    <p className="patient-auth-small-note">{identityKind === 'aadhaar' ? labels.aadhaarSelectHint : labels.abhaSelectHint}</p>
                    {scanning && <div className="patient-auth-progress" role="status"><span>{labels.scanning}</span><progress max="100" value={scanProgress} aria-label={labels.scanProgress} /></div>}
                  </div>
                )}
              </div>
            )}

            <form className="patient-auth-form patient-auth-register-form" onSubmit={submit}>
              {mode === 'register' ? (
                <>
                  <p className="patient-auth-section-title">{labels.profileTitle}</p>
                  <div className="patient-auth-fields-grid">
                    <label>{labels.fullName}<input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" /></label>
                    <label>{labels.yearOfBirth}<input required type="number" min="1900" max={new Date().getFullYear()} value={yearOfBirth} onChange={(event) => setYearOfBirth(event.target.value)} /></label>
                    <label>{labels.gender}<select required value={gender} onChange={(event) => setGender(event.target.value)}><option value="">{labels.selectGender}</option><option value="female">{labels.female}</option><option value="male">{labels.male}</option><option value="other">{labels.other}</option></select></label>
                    <label>{labels.mobile}<div className="patient-auth-mobile-row patient-auth-register-mobile"><span aria-hidden="true">+91</span><input required type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} autoComplete="tel-national" /></div></label>
                    <label>{labels.village}<input required value={village} onChange={(event) => setVillage(event.target.value)} /></label>
                    <label>{labels.mandal}<input required value={mandal} onChange={(event) => setMandal(event.target.value)} /></label>
                    <label className="patient-auth-field-wide">{labels.address}<input value={address} maxLength={500} onChange={(event) => setAddress(event.target.value)} /></label>
                    <label>{labels.pincode}<input inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={pincode} onChange={(event) => setPincode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
                  </div>
                  <label className="patient-auth-consent"><input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} required /><span>{labels.consent}</span></label>
                </>
              ) : (
                <>
                  <label>{labels.mobile}<input required type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} autoComplete="tel-national" /></label>
                  {resetRequested && <><label>{labels.otp}<input name="otp" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><label>{labels.newPassword}<input name="newPassword" required type="password" minLength={6} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label></>}
                </>
              )}

              {message && <div className="patient-auth-message" role="status">{message}</div>}
              {error && <div className="patient-auth-error" role="alert">{error}</div>}
              <button
                type="submit"
                className="patient-auth-button patient-auth-button-primary patient-auth-submit"
                disabled={loading || scanning || (mode === 'register' && (!consentGiven || (identityKind !== 'manual' && !identityCaptured)))}
              >
                {loading ? labels.loading : mode === 'register' ? labels.createAccount : resetRequested ? labels.resetPassword : labels.sendRecoveryCode}
              </button>
            </form>

            <div className="patient-auth-links">
              <button type="button" onClick={onNavigateToLogin}>{labels.registerHelp}</button>
            </div>
          </section>
        </div>
        <p className="patient-auth-footer">{labels.safetyFooter}</p>
      </main>
    </>
  );
};
