import React, { useEffect, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { HealthCardButton } from '../../components/HealthCardButton';

interface PatientProfilePageProps { currentUser: any; currentLang: LanguageCode; }
interface ReminderPreferences {
  channels: { inApp: boolean; sms: boolean; email: boolean };
  categories: { screening: boolean; referral: boolean; camp: boolean; duplicateAlert: boolean; securityAlert: boolean; advisory: boolean };
  preferredLanguage: 'en' | 'te' | 'hi';
  phone?: string;
  email?: string;
}

const token = () => { try { return JSON.parse(localStorage.getItem('aarogya_tokens') || '{}').accessToken || localStorage.getItem('aarogya_token') || ''; } catch { return localStorage.getItem('aarogya_token') || ''; } };
const uuid = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const defaultReminderPreferences: ReminderPreferences = {
  channels: { inApp: true, sms: false, email: false },
  categories: { screening: true, referral: true, camp: true, duplicateAlert: true, securityAlert: true, advisory: true },
  preferredLanguage: 'en',
};

export const PatientProfilePage: React.FC<PatientProfilePageProps> = ({ currentUser, currentLang }) => {
  const [profile, setProfile] = useState<any>({ ...currentUser, habits: {}, emergencyContact: {}, insurance: {}, allergies: [], currentMedications: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preferences, setPreferences] = useState<ReminderPreferences>(defaultReminderPreferences);
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState('');
  const [preferencesMessage, setPreferencesMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const headers = { Authorization: `Bearer ${token()}` };
    fetch('/api/patient/profile', { headers })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Profile could not be loaded.');
        if (!cancelled) setProfile((previous: any) => ({ ...previous, ...(payload.data?.profile || {}) }));
      })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Profile could not be loaded.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    fetch('/api/v1/notifications/preferences', { headers })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Reminder preferences could not be loaded.');
        if (!cancelled && payload.data?.preferences) setPreferences({ ...defaultReminderPreferences, ...payload.data.preferences, channels: { ...defaultReminderPreferences.channels, ...payload.data.preferences.channels }, categories: { ...defaultReminderPreferences.categories, ...payload.data.preferences.categories } });
      })
      .catch((loadError) => { if (!cancelled) setPreferencesError(loadError instanceof Error ? loadError.message : 'Reminder preferences could not be loaded.'); })
      .finally(() => { if (!cancelled) setPreferencesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const setField = (key: string, value: unknown) => setProfile((previous: any) => ({ ...previous, [key]: value }));
  const setPreference = (section: 'channels' | 'categories', key: string, value: boolean) => setPreferences((previous) => ({ ...previous, [section]: { ...previous[section], [key]: value } }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/patient/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ...profile, mutationId: uuid(), consentGiven: true, allergies: String(profile.allergiesText ?? (profile.allergies || []).join(',')).split(',').map((item: string) => item.trim()).filter(Boolean), currentMedications: String(profile.medicationsText ?? (profile.currentMedications || []).join(',')).split(',').map((item: string) => item.trim()).filter(Boolean), yearOfBirth: profile.yearOfBirth ? Number(profile.yearOfBirth) : undefined }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Profile could not be saved.');
      setProfile(payload.data?.profile || profile); setConsent(false); setMessage('Profile saved.');
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Profile could not be saved.'); }
    finally { setSaving(false); }
  };

  const savePreferences = async (event: React.FormEvent) => {
    event.preventDefault(); setPreferencesSaving(true); setPreferencesError(''); setPreferencesMessage('');
    try {
      const response = await fetch('/api/v1/notifications/preferences', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ...preferences, mutationId: uuid() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Reminder preferences could not be saved.');
      setPreferences(payload.data?.preferences ? { ...defaultReminderPreferences, ...payload.data.preferences } : preferences);
      setPreferencesMessage('Reminder preferences saved.');
    } catch (saveError) { setPreferencesError(saveError instanceof Error ? saveError.message : 'Reminder preferences could not be saved.'); }
    finally { setPreferencesSaving(false); }
  };

  const t = currentLang === 'te'
    ? { title: 'ఆరోగ్య ప్రొఫైల్', save: 'ప్రొఫైల్ సేవ్ చేయండి', consent: 'ఈ వివరాలను నా ఖాతాలో సేవ్ చేయడానికి సమ్మతి ఇస్తున్నాను.' }
    : currentLang === 'hi'
      ? { title: 'स्वास्थ्य प्रोफ़ाइल', save: 'प्रोफ़ाइल सहेजें', consent: 'मैं इन विवरणों को अपने खाते में सहेजने की सहमति देता/देती हूँ।' }
      : { title: 'Health Profile', save: 'Save profile', consent: 'I consent to save these profile details to my account.' };

  return <section className="patient-profile-page" aria-labelledby="patient-profile-title">
    <div className="patient-page-heading"><p className="patient-breadcrumb">Patient Portal / Health Profile</p><h1 id="patient-profile-title">{t.title}</h1><p>Review and update the information used to support your care navigation.</p><HealthCardButton patient={profile} language={currentLang} /></div>
    {loading ? <p role="status">Loading your profile…</p> : <form onSubmit={save} className="patient-profile-form">
      {error && <p role="alert" className="patient-inline-error">{error}</p>}{message && <p role="status">{message}</p>}
      <div className="patient-profile-grid">
        <article className="patient-home-lower-card"><h2>Personal details</h2><label>Full name<input required minLength={2} maxLength={120} value={profile.fullName || ''} onChange={(event) => setField('fullName', event.target.value)} /></label><label>Year of birth<input type="number" min="1900" max={new Date().getFullYear()} value={profile.yearOfBirth || ''} onChange={(event) => setField('yearOfBirth', event.target.value)} /></label><label>Gender<select value={profile.gender || ''} onChange={(event) => setField('gender', event.target.value)}><option value="">Select</option><option value="female">Female</option><option value="male">Male</option><option value="transgender">Transgender</option><option value="other">Other</option></select></label><label>Mobile<input value={profile.phone || ''} maxLength={20} onChange={(event) => setField('phone', event.target.value)} /></label></article>
        <article className="patient-home-lower-card"><h2>Address</h2><label>Address<input maxLength={500} value={profile.address || ''} onChange={(event) => setField('address', event.target.value)} /></label><label>Village<input maxLength={120} value={profile.village || ''} onChange={(event) => setField('village', event.target.value)} /></label><label>Mandal<input maxLength={120} value={profile.mandal || ''} onChange={(event) => setField('mandal', event.target.value)} /></label><label>Pincode<input inputMode="numeric" maxLength={6} value={profile.pincode || ''} onChange={(event) => setField('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} /></label></article>
      </div>
      <label className="patient-context-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />{t.consent}</label>
      <button type="submit" className="dash-btn dash-btn-primary" disabled={saving || !consent}>{saving ? 'Saving…' : t.save}</button>
    </form>}

    <form onSubmit={savePreferences} className="patient-home-lower-card patient-reminder-preferences" aria-labelledby="patient-reminder-preferences-title">
      <p className="patient-home-card-kicker">REMINDERS</p><h2 id="patient-reminder-preferences-title">Reminder preferences</h2>
      {preferencesLoading ? <p role="status">Loading reminder preferences…</p> : <>
        {preferencesError && <p role="alert" className="patient-inline-error">{preferencesError}</p>}{preferencesMessage && <p role="status">{preferencesMessage}</p>}
        <fieldset><legend>Delivery channels</legend><label><input type="checkbox" checked={preferences.channels.inApp} onChange={(event) => setPreference('channels', 'inApp', event.target.checked)} />In-app reminders</label><label><input type="checkbox" checked={preferences.channels.email} onChange={(event) => setPreference('channels', 'email', event.target.checked)} />Email (simulation)</label><label><input type="checkbox" checked={preferences.channels.sms} onChange={(event) => setPreference('channels', 'sms', event.target.checked)} />SMS (simulation only)</label><p className="patient-muted-copy">External delivery is simulated in this demo. WhatsApp and live SMS are unavailable.</p></fieldset>
        <fieldset><legend>Reminder topics</legend>{([['screening', 'Screening'], ['referral', 'Referrals'], ['camp', 'Health camps'], ['advisory', 'Care updates']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(preferences.categories[key])} onChange={(event) => setPreference('categories', key, event.target.checked)} />{label}</label>)}</fieldset>
        <label>Reminder language<select value={preferences.preferredLanguage} onChange={(event) => setPreferences((previous) => ({ ...previous, preferredLanguage: event.target.value as ReminderPreferences['preferredLanguage'] }))}><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label>
        <label>Reminder email<input type="email" maxLength={254} value={preferences.email || ''} onChange={(event) => setPreferences((previous) => ({ ...previous, email: event.target.value }))} /></label>
        <label>Reminder mobile<input inputMode="tel" maxLength={20} value={preferences.phone || ''} onChange={(event) => setPreferences((previous) => ({ ...previous, phone: event.target.value }))} /></label>
        <button type="submit" className="dash-btn dash-btn-primary" disabled={preferencesSaving}>{preferencesSaving ? 'Saving…' : 'Save reminder preferences'}</button>
      </>}
    </form>
    <p className="patient-chat-disclaimer">AI suggestions are not a medical diagnosis; consult a doctor.</p>
  </section>;
};
