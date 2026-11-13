import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AuthUser } from '../../components/AuthPanel';
import {
  analyzeMucosalLesion,
  evaluateImageQualityClient,
  generateCombinedReport,
  ImageQualityCheckResult,
  IMucosalLesionResult,
} from '../../services/aiEngineService';
import { getClientTranslation, LanguageCode, translations } from '../../i18n';
import { PrescriptionCardView } from '../../components/PrescriptionCardView';
import { ConsultationPortalPanel } from '../../components/VideoConsultation';
import { PatientProfilePage } from '../patient/PatientProfilePage';
import { PatientHomeOverview } from '../../components/PatientHomeOverview';
import { HealthCardButton } from '../../components/HealthCardButton';
import '../../styles/Dashboard.css';

export interface PatientDashboardProps {
  currentUser: AuthUser | null;
  onNavigateTab?: (tab: string) => void;
  currentLang?: LanguageCode;
  onOpenLanguageModal?: () => void;
  onToggleAIAssistant?: () => void;
  initialTab?: 'home' | 'profile' | 'screening' | 'assessment' | 'consultation' | 'appointments' | 'referrals' | 'prescriptions' | 'history' | 'hospitals' | 'education' | 'care-team' | 'reports' | 'treatment' | 'reminders' | 'help' | 'report-detail';
  initialResourceId?: string;
}

type PatientDashboardTab = NonNullable<PatientDashboardProps['initialTab']>;

function getPatientAccessToken(): string {
  try {
    const tokens = JSON.parse(localStorage.getItem('aarogya_tokens') || '{}');
    return tokens.accessToken || localStorage.getItem('aarogya_token') || '';
  } catch { return localStorage.getItem('aarogya_token') || ''; }
}

function createPatientMutationId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const value = Math.random() * 16 | 0;
      return (char === 'x' ? value : (value & 0x3 | 0x8)).toString(16);
    });
}

const PATIENT_SCREENING_LABEL = 'DEMO AI screening support';
const PATIENT_SCREENING_NOTE = 'Automated screening observation recorded for clinician review.';
const PATIENT_ORAL_EDUCATION_FALLBACK = {
  explanation: 'This is an automated description of an image, not a diagnosis. Different causes can look similar in a photo, so a qualified health worker needs to examine the area and consider your symptoms and health history.',
  possibleCauses: [
    'Similar-looking mouth sores can follow accidental cheek biting or irritation from a rough tooth or dental appliance.',
    'A burn from hot food or drink, some foods, or certain medicines can also irritate the mouth.',
    'A photo cannot show which cause applies to you; an in-person examination is needed.',
  ],
  whatToTellClinician: [
    'When you first noticed it and whether it is changing or returning.',
    'Any pain, bleeding, difficulty eating or swallowing, or other symptoms.',
    'Medicines you take and any tobacco or alcohol use, if relevant.',
  ],
  whenToSeekReview: [
    'Arrange a health-worker or dental review if it lasts longer than 3 weeks, gets worse, keeps returning, or bleeds.',
    'Seek prompt in-person care for rapidly worsening swelling or difficulty breathing or swallowing.',
  ],
  sources: [
    { label: 'NHS: Mouth ulcers', url: 'https://www.nhs.uk/conditions/mouth-ulcers/' },
    { label: 'WHO: Oral health', url: 'https://www.who.int/news-room/fact-sheets/detail/oral-health' },
  ],
};

function sanitizePatientScreeningRecord(record: any): any {
  return {
    ...record,
    label: PATIENT_SCREENING_LABEL,
    notes: record.advice || record.notes || PATIENT_SCREENING_NOTE,
    riskLevel: record.triageCategory || record.riskLevel || 'Pending clinician review',
  };
}

function prescriptionAsText(rx: any, patientName: string, patientId: string): string {
  return [
    'Aarogya-Drishti Prescription',
    `Prescription ID: ${rx.prescriptionId || '—'}`,
    `Patient: ${rx.patientName || patientName}`,
    `Patient ID: ${rx.patientId || patientId}`,
    `Doctor: ${rx.doctorName || '—'}`,
    `Hospital: ${rx.hospitalName || '—'}`,
    `Date: ${rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : '—'}`,
    `Clinician assessment: ${rx.diagnosisImpression || '—'}`,
    `Clinical observations: ${rx.clinicalObservations || '—'}`,
    'Prescribed medicines:',
    ...(rx.medicines || []).map((medicine: any, index: number) => `${index + 1}. ${medicine.medicineName || 'Medicine'} | Dosage: ${medicine.dosage || '—'} | Frequency: ${medicine.frequency || '—'} | Duration: ${medicine.durationDays ?? '—'} days | Instructions: ${medicine.instructions || '—'}`),
    `Follow-up: ${rx.followUpDate ? new Date(rx.followUpDate).toLocaleDateString() : '—'}`,
    'SIMULATION — DEMO DATA ONLY — NOT FOR CLINICAL USE',
  ].join('\n');
}

function prescriptionSpeechText(rx: any): string {
  const medicines = (rx.medicines || []).map((medicine: any) => {
    const precautions = medicine.instructions ? ` Precautions: ${medicine.instructions}.` : '';
    return `${medicine.medicineName || 'Medicine'}. Dose: ${medicine.dosage || 'as written on the prescription'}. Timing: ${medicine.frequency || 'as written on the prescription'}.${precautions}`;
  });
  return `Prescription ${rx.prescriptionId || ''}. Read the clinician-issued instructions exactly as written. ${medicines.join(' ')} Do not change any medicine or dose without speaking with your clinician.`;
}

interface PatientReportChatProps {
  screeningId: string;
  reportContext: string;
  currentLang: LanguageCode;
}

const PatientReportChat: React.FC<PatientReportChatProps> = ({ screeningId, reportContext, currentLang }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [shareProfileContext, setShareProfileContext] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [urgentCare, setUrgentCare] = useState(false);
  const [pendingMutationId, setPendingMutationId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch(`/api/patient/screenings/${encodeURIComponent(screeningId)}/chat`, {
          headers: { Authorization: `Bearer ${getPatientAccessToken()}` },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Chat history is not available right now.');
        if (!cancelled) setMessages(payload.data?.messages || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Chat history is not available right now.');
      } finally { if (!cancelled) setLoadingHistory(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [screeningId]);

  const send = async (text = message) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const mutationId = pendingMutationId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (char) => { const value = Math.random() * 16 | 0; return (char === 'x' ? value : (value & 0x3 | 0x8)).toString(16); }));
    setPendingMutationId(mutationId);
    setSending(true); setError(''); setMessage('');
    if (/trouble breathing|difficulty breathing|cannot breathe|trouble swallowing|difficulty swallowing|uncontrolled bleeding|rapid swelling/i.test(trimmed)) setUrgentCare(true);
    try {
      const response = await fetch(`/api/patient/screenings/${encodeURIComponent(screeningId)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getPatientAccessToken()}` },
        body: JSON.stringify({ mutationId, message: trimmed, language: currentLang, reportContext, shareProfileContext }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Message could not be sent.');
      setMessages((previous) => [...previous, ...(payload.data?.messages || [])]);
      setPendingMutationId(null);
    } catch (sendError) {
      setMessage(trimmed);
      setError(sendError instanceof Error ? sendError.message : 'Message could not be sent.');
    } finally { setSending(false); }
  };

  const suggestions = currentLang === 'te'
    ? ['ఈ ఫలితం అంటే ఏమిటి?', 'వైద్యుడిని ఎప్పుడు సంప్రదించాలి?']
    : currentLang === 'hi'
      ? ['इस परिणाम का क्या अर्थ है?', 'डॉक्टर से कब संपर्क करें?']
      : ['What does this report wording mean?', 'When should I speak with a clinician?'];

  return (
    <section className="patient-report-chat" aria-labelledby="report-chat-title">
      <header><span className="patient-home-eyebrow">DEMO AI · REPORT SUPPORT</span><h2 id="report-chat-title">{currentLang === 'te' ? 'మీ నివేదిక గురించి అడగండి' : currentLang === 'hi' ? 'अपनी रिपोर्ट के बारे में पूछें' : 'Ask about your report'}</h2></header>
      <div className="patient-report-chat-messages" aria-live="polite">
        {loadingHistory && <p className="patient-inline-state">Loading saved conversation…</p>}
        {!loadingHistory && messages.length === 0 && <p className="patient-inline-state">{currentLang === 'te' ? 'నివేదిక పదాలను సులభంగా అర్థం చేసుకోవడానికి ప్రశ్న అడగండి.' : currentLang === 'hi' ? 'रिपोर्ट के शब्दों को समझने के लिए प्रश्न पूछें।' : 'Ask a question to understand the report wording in plain language.'}</p>}
        {messages.map((item, index) => <div key={item.messageId || index} className={`patient-chat-bubble ${item.role === 'user' ? 'patient' : 'assistant'}`}>{item.content}</div>)}
        {sending && <div className="patient-chat-bubble assistant" role="status">Preparing a safe explanation…</div>}
      </div>
      {urgentCare && <div className="patient-urgent-banner" role="alert"><strong>Urgent care:</strong> Breathing or swallowing difficulty, uncontrolled bleeding, or rapidly worsening swelling needs prompt in-person care. Contact local emergency services or go to the nearest health facility.</div>}
      <div className="patient-chat-suggestions">{suggestions.map((item) => <button key={item} type="button" onClick={() => void send(item)} disabled={sending}>{item}</button>)}</div>
      <label className="patient-context-consent"><input type="checkbox" checked={shareProfileContext} onChange={(event) => setShareProfileContext(event.target.checked)} />{currentLang === 'te' ? 'ఈ సంభాషణ కోసం నా ఆరోగ్య ప్రొఫైల్ వివరాలను పంచుకోవడానికి సమ్మతి' : currentLang === 'hi' ? 'इस बातचीत के लिए मेरी स्वास्थ्य प्रोफ़ाइल साझा करने की सहमति' : 'I consent to share relevant health profile details for this chat.'}</label>
      {error && <p className="patient-inline-error" role="alert">{error}</p>}
      <form className="patient-chat-form" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label className="sr-only" htmlFor={`patient-report-chat-${screeningId}`}>Ask a question about this report</label>
        <input id={`patient-report-chat-${screeningId}`} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder={currentLang === 'te' ? 'మీ ప్రశ్నను టైప్ చేయండి' : currentLang === 'hi' ? 'अपना प्रश्न लिखें' : 'Type your question'} />
        <button type="submit" className="dash-btn dash-btn-primary" disabled={sending || !message.trim()}>{currentLang === 'te' ? 'పంపండి' : currentLang === 'hi' ? 'भेजें' : 'Send'}</button>
      </form>
      <p className="patient-chat-disclaimer">AI suggestions are not a medical diagnosis; consult a doctor.</p>
    </section>
  );
};

const PatientSupportPanel: React.FC<{ currentLang: LanguageCode; onOpenAssistant?: () => void }> = ({ currentLang, onOpenAssistant }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('technical');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const loadTickets = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/patient/support-tickets', { headers: { Authorization: `Bearer ${getPatientAccessToken()}` } });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Support requests could not be loaded.');
      setTickets(payload.data?.tickets || []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Support requests could not be loaded.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadTickets(); }, []);

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const mutationId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => { const value = Math.random() * 16 | 0; return (char === 'x' ? value : (value & 0x3 | 0x8)).toString(16); });
      const response = await fetch('/api/patient/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getPatientAccessToken()}` },
        body: JSON.stringify({ mutationId, category, subject, description }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Support request could not be submitted.');
      setSubject(''); setDescription(''); await loadTickets();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Support request could not be submitted.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="patient-help-grid">
      <section className="patient-home-lower-card">
        <p className="patient-home-card-kicker">HELP &amp; SUPPORT</p><h2>Common questions</h2>
        <details><summary>What does DEMO AI mean?</summary><p>It is a screening support feature for demonstration. A qualified clinician reviews personal health concerns.</p></details>
        <details><summary>How do I arrange an appointment?</summary><p>Use Consultation or Appointments in the patient navigation to view available booking options.</p></details>
        <details><summary>Can I join a video consultation?</summary><p>Video and voice streaming are blocked until a real teleconsultation adapter is available. Staff can use text case discussion.</p></details>
        <button type="button" className="dash-btn dash-btn-outline" onClick={onOpenAssistant} disabled={!onOpenAssistant}>Ask Drishti AI assistant</button>
        <p className="patient-help-emergency"><strong>Urgent help:</strong> Call 104 or visit the nearest health facility.</p>
      </section>
      <section className="patient-home-lower-card">
        <p className="patient-home-card-kicker">SUPPORT REQUEST</p><h2>Contact support</h2>
        <form className="patient-support-form" onSubmit={(event) => void submitTicket(event)}>
          <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="technical">Technical help</option><option value="appointment">Appointment</option><option value="report">Report</option><option value="account">Account</option><option value="other">Other</option></select></label>
          <label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={120} required /></label>
          <label>How can we help?<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={5} maxLength={2000} rows={4} required /></label>
          {error && <p className="patient-inline-error" role="alert">{error}</p>}
          <button type="submit" className="dash-btn dash-btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit support request'}</button>
        </form>
        <h3>{currentLang === 'te' ? 'మీ అభ్యర్థనలు' : currentLang === 'hi' ? 'आपके अनुरोध' : 'Your requests'}</h3>
        {loading ? <p role="status">Loading support requests…</p> : error && tickets.length === 0 ? <p className="patient-inline-error" role="alert">{error}</p> : tickets.length === 0 ? <p className="patient-inline-state">No support requests yet.</p> : <div className="patient-ticket-list">{tickets.map((ticket) => <article key={ticket.ticketId}><div><strong>{ticket.subject}</strong><small>{ticket.ticketId} · {new Date(ticket.createdAt).toLocaleDateString()}</small></div><span className="patient-ticket-status">{ticket.status.replace('_', ' ')}</span></article>)}</div>}
      </section>
    </div>
  );
};

interface DiseaseInfo {
  title: Record<LanguageCode, string>;
  riskLevel: 'DEMO_AI_SUPPORT';
  riskBadge: Record<LanguageCode, string>;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  icon: string;
  description: Record<LanguageCode, string>;
  nextSteps: Record<LanguageCode, string[]>;
  preparation: Record<LanguageCode, string[]>;
  clinicalAction: Record<LanguageCode, string>;
}

const PATIENT_SCREENING_INFO: DiseaseInfo = {
  title: { en: 'Screening observation recorded', te: 'Screening observation recorded', hi: 'Screening observation recorded', ta: 'Screening observation recorded', kn: 'Screening observation recorded', ml: 'Screening observation recorded' },
  riskLevel: 'DEMO_AI_SUPPORT',
  riskBadge: { en: 'DEMO AI - screening support only', te: 'DEMO AI - screening support only', hi: 'DEMO AI - screening support only', ta: 'DEMO AI - screening support only', kn: 'DEMO AI - screening support only', ml: 'DEMO AI - screening support only' },
  badgeColor: 'var(--warning-text)',
  badgeBg: 'var(--warning-bg)',
  badgeBorder: 'var(--warning-text)',
  icon: '◉',
  description: {
    en: 'An automated screening tool recorded an image observation. This is DEMO AI screening support, not a medical diagnosis. A qualified clinician should review it with your health information.',
    te: 'An automated screening tool recorded an image observation. This is DEMO AI screening support, not a medical diagnosis. A qualified clinician should review it with your health information.',
    hi: 'An automated screening tool recorded an image observation. This is DEMO AI screening support, not a medical diagnosis. A qualified clinician should review it with your health information.',
    ta: 'An automated screening tool recorded an image observation. This is DEMO AI screening support, not a medical diagnosis.',
    kn: 'An automated screening tool recorded an image observation. This is DEMO AI screening support, not a medical diagnosis.',
    ml: 'An automated screening tool recorded an image observation. This is DEMO AI screening support, not a medical diagnosis.',
  },
  nextSteps: {
    en: ['Discuss this report with a qualified health worker.', 'Only a clinician can review the image with your health history.'],
    te: ['Discuss this report with a qualified health worker.', 'Only a clinician can review the image with your health history.'],
    hi: ['Discuss this report with a qualified health worker.', 'Only a clinician can review the image with your health history.'],
    ta: ['Discuss this report with a qualified health worker.'], kn: ['Discuss this report with a qualified health worker.'], ml: ['Discuss this report with a qualified health worker.'],
  },
  preparation: {
    en: ['Bring this report to your appointment.', 'Continue any instructions already given by your clinician.'],
    te: ['Bring this report to your appointment.', 'Continue any instructions already given by your clinician.'],
    hi: ['Bring this report to your appointment.', 'Continue any instructions already given by your clinician.'],
    ta: ['Bring this report to your appointment.'], kn: ['Bring this report to your appointment.'], ml: ['Bring this report to your appointment.'],
  },
  clinicalAction: {
    en: 'You can book a consultation to discuss this screening observation.',
    te: 'You can book a consultation to discuss this screening observation.',
    hi: 'You can book a consultation to discuss this screening observation.',
    ta: 'You can book a consultation to discuss this screening observation.',
    kn: 'You can book a consultation to discuss this screening observation.',
    ml: 'You can book a consultation to discuss this screening observation.',
  },
};

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  currentUser,
  onNavigateTab,
  currentLang = 'en',
  onOpenLanguageModal,
  onToggleAIAssistant,
  initialTab = 'home',
  initialResourceId,
}) => {
  const [activeTab, setActiveTab] = useState<PatientDashboardTab>((initialTab as any) || 'home');
  const treatmentLogMutationIdRef = useRef<string | null>(null);
  const treatmentPhotoMutationIdRef = useRef<string | null>(null);

  useEffect(() => {
    try { localStorage.removeItem('aarogya_gemini_api_key'); } catch {}
  }, []);

  const switchTab = (tab: PatientDashboardTab) => {
    const paths: Record<PatientDashboardTab, string> = {
      home: 'dashboard', profile: 'profile', screening: 'screening', assessment: 'assessment',
      consultation: 'consult', appointments: 'consult', referrals: 'assessment', prescriptions: 'prescriptions',
      history: 'history', hospitals: 'hospitals', education: 'help', 'care-team': 'help', reports: 'reports',
      treatment: 'treatment', reminders: 'reminders', help: 'help', 'report-detail': 'reports',
    };
    if ((tab === 'appointments' || tab === 'consultation') && initialResourceId && (activeTab === 'assessment' || activeTab === 'report-detail')) {
      try { sessionStorage.setItem('patient_booking_screening_id', initialResourceId); } catch {}
    }
    window.location.hash = `#/patient/${paths[tab]}`;
    setActiveTab(tab);
  };

  useEffect(() => {
    const currentState = window.history.state;
    if (!currentState?.patientDashboardTab) {
      window.history.replaceState(
        { ...(currentState && typeof currentState === 'object' ? currentState : {}), patientDashboardTab: activeTab },
        '',
        window.location.href
      );
    }

    const handleBackForward = (event: PopStateEvent) => {
      const previousTab = event.state?.patientDashboardTab as PatientDashboardTab | undefined;
      if (previousTab) setActiveTab(previousTab);
    };

    window.addEventListener('popstate', handleBackForward);
    return () => window.removeEventListener('popstate', handleBackForward);
  }, []);

  // Live video is blocked until a real teleconsultation adapter is configured.
  const isDoctorCallActive = false;

  // Real-Time Patient Identifier
  const patientId = currentUser?.patientId || '';
  const patientName = currentUser?.fullName || 'Beneficiary';
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [appointmentRefreshVersion, setAppointmentRefreshVersion] = useState(0);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [unreadReminderCount, setUnreadReminderCount] = useState<number | null>(null);
  const [nextReminderTitle, setNextReminderTitle] = useState('');
  const [patientReminders, setPatientReminders] = useState<any[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState('');

  useEffect(() => {
    const token = getPatientAccessToken();
    if (!token) {
      setAppointmentsLoading(false);
      setAppointmentsError('Sign in to load your appointment details.');
      return;
    }
    let cancelled = false;
    const headers = { Authorization: `Bearer ${token}` };
    const loadPatientSummary = async () => {
      try {
        const response = await fetch('/api/v1/consultations/appointments/my', { headers });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Appointments are unavailable.');
        if (!cancelled) setPatientAppointments(payload.data?.appointments || []);
      } catch (error) {
        if (!cancelled) setAppointmentsError(error instanceof Error ? error.message : 'Appointments are unavailable.');
      } finally { if (!cancelled) setAppointmentsLoading(false); }
      try {
        if (activeTab === 'reminders') setRemindersLoading(true);
        const response = await fetch('/api/v1/notifications?limit=30', { headers });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error('Reminders are unavailable.');
        if (!cancelled) {
          setUnreadReminderCount(Number(payload.data?.unreadCount || 0));
          const notifications = payload.data?.notifications || [];
          setPatientReminders(notifications);
          setNextReminderTitle(notifications.find((notification: any) => !notification.read)?.title || '');
        }
      } catch (error) {
        if (!cancelled) { setUnreadReminderCount(null); setRemindersError(error instanceof Error ? error.message : 'Reminders are unavailable.'); }
      } finally { if (!cancelled) setRemindersLoading(false); }
    };
    void loadPatientSummary();
    return () => { cancelled = true; };
  }, [patientId, activeTab, appointmentRefreshVersion]);

  useEffect(() => {
    const refresh = () => setAppointmentRefreshVersion((version) => version + 1);
    window.addEventListener('patient-appointments-refresh', refresh);
    return () => window.removeEventListener('patient-appointments-refresh', refresh);
  }, []);

  // Digital Prescription Viewer Modal State (Module 6 & 7) - Loaded from real patient records
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [textFormatPrescriptionId, setTextFormatPrescriptionId] = useState<string | null>(null);
  const [prescriptionsList, setPrescriptionsList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem(`aarogya_prescriptions_${patientId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [treatmentLogs, setTreatmentLogs] = useState<any[]>([]);
  const [selectedTreatmentPlanId, setSelectedTreatmentPlanId] = useState('');
  const [treatmentLoading, setTreatmentLoading] = useState(true);
  const [treatmentSaving, setTreatmentSaving] = useState(false);
  const [treatmentError, setTreatmentError] = useState('');
  const [remoteMedicineChecks, setRemoteMedicineChecks] = useState<Record<string, boolean>>({});
  const [screeningHistoryLoading, setScreeningHistoryLoading] = useState(true);
  const [screeningHistoryError, setScreeningHistoryError] = useState('');
  const visiblePrescriptions = initialResourceId
    ? prescriptionsList.filter((prescription) => prescription.prescriptionId === initialResourceId || prescription._id === initialResourceId)
    : prescriptionsList;
  const [symptomNote, setSymptomNote] = useState('');

  // Referrals List State (Module 5) - Loaded from real patient referrals
  const [referralsList, setReferralsList] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem(`aarogya_referrals_${patientId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [availablePatientDoctors, setAvailablePatientDoctors] = useState<any[]>([]);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');
  const [painScore, setPainScore] = useState<number | ''>('');
  const [symptomSeverity, setSymptomSeverity] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none');
  const [treatmentPhotoFile, setTreatmentPhotoFile] = useState<File | null>(null);
  const [treatmentPhotoConsent, setTreatmentPhotoConsent] = useState(false);
  const [treatmentPhotoHash, setTreatmentPhotoHash] = useState('');
  const [treatmentPhotoUrls, setTreatmentPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];
    const fileIds = [...new Set(treatmentLogs.map((log) => log.photoProgress?.fileId).filter(Boolean))] as string[];
    void Promise.all(fileIds.map(async (fileId) => {
      const response = await fetch(`/api/v1/storage/files/${encodeURIComponent(fileId)}`, { headers: { Authorization: `Bearer ${getPatientAccessToken()}` } });
      if (!response.ok) return null;
      const url = URL.createObjectURL(await response.blob());
      createdUrls.push(url);
      return [fileId, url] as const;
    })).then((entries) => {
      if (cancelled) { createdUrls.forEach((url) => URL.revokeObjectURL(url)); return; }
      setTreatmentPhotoUrls(Object.fromEntries(entries.filter(Boolean) as Array<readonly [string, string]>));
    }).catch(() => { if (!cancelled) setTreatmentPhotoUrls({}); });
    return () => { cancelled = true; createdUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [treatmentLogs]);

  useEffect(() => {
    const token = getPatientAccessToken();
    if (!token || !currentUser?.patientId) return;
    let cancelled = false;
    fetch(`/api/v1/referrals/patient/${encodeURIComponent(currentUser.patientId)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Referral history is unavailable.');
        if (!cancelled) setReferralsList(payload.data?.referrals || []);
      }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [currentUser?.patientId]);

  useEffect(() => {
    if (activeTab !== 'assessment' && activeTab !== 'home') return;
    const token = getPatientAccessToken();
    if (!token) { setAssessmentError('Sign in to load doctor availability.'); return; }
    let cancelled = false;
    const date = new Date();
    date.setDate(date.getDate() + 1);
    if (date.getDay() === 0) date.setDate(date.getDate() + 1);
    setAssessmentLoading(true); setAssessmentError('');
    fetch(`/api/v1/consultations/availability?date=${date.toISOString().slice(0, 10)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Doctor availability is unavailable.');
        if (!cancelled) setAvailablePatientDoctors(payload.data?.doctors || []);
      }).catch((error) => {
        if (!cancelled) setAssessmentError(error instanceof Error ? error.message : 'Doctor availability is unavailable.');
      }).finally(() => { if (!cancelled) setAssessmentLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  // Real-time Uploaded Oral Screening History
  const [screeningHistory, setScreeningHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!patientId) return;
    try {
      localStorage.setItem(`aarogya_screenings_${patientId}`, JSON.stringify(screeningHistory.map(sanitizePatientScreeningRecord)));
    } catch {}
  }, [patientId, screeningHistory]);

  useEffect(() => {
    const token = getPatientAccessToken();
    if (!token || !currentUser?.patientId) { setScreeningHistoryLoading(false); return; }
    let cancelled = false;
    fetch(`/api/ai/screenings?patientId=${encodeURIComponent(currentUser.patientId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Screening history is unavailable.');
      const remoteRecords = (Array.isArray(payload.data) ? payload.data : []).map((record: any) => ({
        id: record.screeningId,
        label: PATIENT_SCREENING_LABEL,
        createdAt: record.createdAt,
        date: record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '',
        time: record.createdAt ? new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        notes: record.advice || PATIENT_SCREENING_NOTE,
        riskLevel: record.triageCategory || 'Pending clinician review',
        clinicianReviewStatus: record.clinicianReviewStatus || 'PENDING',
        source: record.source,
        remote: true,
      }));
      if (!cancelled) setScreeningHistory((previous) => {
        const localIds = new Set(previous.map((record) => record.id).filter(Boolean));
        return [...previous, ...remoteRecords.filter((record: any) => !localIds.has(record.id)).map(sanitizePatientScreeningRecord)]
          .sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
      });
    }).catch((error) => {
      if (!cancelled) setScreeningHistoryError(error instanceof Error ? error.message : 'Screening history is unavailable.');
    }).finally(() => { if (!cancelled) setScreeningHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [currentUser?.patientId]);

  useEffect(() => {
    const token = getPatientAccessToken();
    if (!token || !currentUser?.patientId) { setTreatmentLoading(false); return; }
    let cancelled = false;
    const headers = { Authorization: `Bearer ${token}` };
    const loadPatientRecords = async () => {
      setTreatmentLoading(true);
      try {
        const [prescriptionResponse, planResponse] = await Promise.all([
          fetch(`/api/v1/prescriptions/patient/${encodeURIComponent(currentUser.patientId!)}`, { headers }),
          fetch('/api/patient/treatment-plans', { headers }),
        ]);
        const [prescriptionPayload, planPayload] = await Promise.all([prescriptionResponse.json(), planResponse.json()]);
        if (!prescriptionResponse.ok || !prescriptionPayload?.success) throw new Error(prescriptionPayload?.error?.message || 'Prescription history is unavailable.');
        if (!planResponse.ok || !planPayload?.success) throw new Error(planPayload?.error?.message || 'Treatment tracking is unavailable.');
        if (!cancelled) {
          const remotePrescriptions = prescriptionPayload.data?.prescriptions || [];
          setPrescriptionsList((previous) => {
            const byId = new Map(previous.map((item) => [item.prescriptionId || item._id, item]));
            remotePrescriptions.forEach((item: any) => byId.set(item.prescriptionId || item._id, item));
            return [...byId.values()];
          });
          const plans = planPayload.data?.plans || [];
          setTreatmentPlans(plans);
          const selected = plans.find((plan: any) => plan.status === 'active') || plans[0];
          if (selected) setSelectedTreatmentPlanId(selected.treatmentPlanId);
        }
      } catch (error) {
        if (!cancelled) setTreatmentError(error instanceof Error ? error.message : 'Patient records are unavailable.');
      } finally { if (!cancelled) setTreatmentLoading(false); }
    };
    void loadPatientRecords();
    return () => { cancelled = true; };
  }, [currentUser?.patientId]);

  const activeTreatmentPlan = treatmentPlans.find((plan) => plan.treatmentPlanId === selectedTreatmentPlanId)
    || treatmentPlans.find((plan) => plan.status === 'active')
    || treatmentPlans[0];

  useEffect(() => {
    const token = getPatientAccessToken();
    if (!token || !activeTreatmentPlan?.treatmentPlanId) return;
    let cancelled = false;
    const loadLogs = async () => {
      try {
        const response = await fetch(`/api/patient/treatment-plans/${encodeURIComponent(activeTreatmentPlan.treatmentPlanId)}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Treatment history is unavailable.');
        const today = new Date().toISOString().slice(0, 10);
        const log = (payload.data?.logs || []).find((item: any) => new Date(item.date).toISOString().slice(0, 10) === today);
        if (!cancelled) {
          setTreatmentLogs(payload.data?.logs || []);
          setRemoteMedicineChecks(Object.fromEntries((log?.medicineLogs || []).map((item: any) => [item.medicineId, Boolean(item.taken)])));
          if (log?.notes) setSymptomNote(log.notes);
        }
      } catch (error) {
        if (!cancelled) setTreatmentError(error instanceof Error ? error.message : 'Treatment history is unavailable.');
      }
    };
    void loadLogs();
    return () => { cancelled = true; };
  }, [activeTreatmentPlan?.treatmentPlanId]);

  const startTreatmentTracking = async (prescription: any) => {
    const token = getPatientAccessToken();
    if (!token) { setTreatmentError('Sign in to start treatment tracking.'); return; }
    setTreatmentSaving(true); setTreatmentError('');
    try {
      const response = await fetch('/api/patient/treatment-plans/from-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mutationId: createPatientMutationId(), prescriptionId: prescription.prescriptionId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Treatment tracking could not be started.');
      const plan = payload.data?.plan;
      if (plan) {
        setTreatmentPlans((previous) => [plan, ...previous.filter((item) => item.treatmentPlanId !== plan.treatmentPlanId)]);
        setSelectedTreatmentPlanId(plan.treatmentPlanId);
        setRemoteMedicineChecks({});
      }
      setActiveTab('treatment');
      window.location.hash = '#/patient/treatment';
    } catch (error) { setTreatmentError(error instanceof Error ? error.message : 'Treatment tracking could not be started.'); }
    finally { setTreatmentSaving(false); }
  };

  const saveTreatmentLog = async (checks: Record<string, boolean>, note?: string, photoFile?: File, pain?: number | '') => {
    if (!activeTreatmentPlan?.treatmentPlanId) return;
    const token = getPatientAccessToken();
    if (!token) { setTreatmentError('Sign in to save treatment check-ins.'); return; }
    setTreatmentSaving(true); setTreatmentError('');
    try {
      let photoProgress: any;
      if (photoFile) {
        if (!treatmentPhotoConsent) throw new Error('Consent to securely store and share this progress photo with your treating clinician first.');
        const form = new FormData();
        form.append('photo', photoFile);
        treatmentPhotoMutationIdRef.current ||= createPatientMutationId();
        form.append('mutationId', treatmentPhotoMutationIdRef.current);
        form.append('consentGiven', 'true');
        const photoResponse = await fetch(`/api/patient/treatment-plans/${encodeURIComponent(activeTreatmentPlan.treatmentPlanId)}/photos`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
        });
        const photoPayload = await photoResponse.json();
        if (!photoResponse.ok || !photoPayload?.success) throw new Error(photoPayload?.error?.message || 'Progress photo could not be saved.');
        photoProgress = photoPayload.data?.photoProgress;
        setTreatmentPhotoHash(photoPayload.data?.sha256Hash || '');
      }
      const response = await fetch('/api/patient/treatment-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mutationId: treatmentLogMutationIdRef.current || (treatmentLogMutationIdRef.current = createPatientMutationId()),
          treatmentPlanId: activeTreatmentPlan.treatmentPlanId,
          date: new Date().toISOString().slice(0, 10),
          medicineLogs: (activeTreatmentPlan.medicines || []).map((medicine: any) => ({ medicineId: medicine.medicineId, taken: Boolean(checks[medicine.medicineId]) })),
          ...(note ? { symptomLog: { symptoms: [], severity: symptomSeverity, notes: note } } : {}),
          ...(pain !== '' && pain !== undefined ? { painLog: { score: Number(pain), notes: note || undefined } } : {}),
          ...(photoProgress ? { photoProgress } : {}),
          ...(note ? { notes: note } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Treatment check-in could not be saved.');
      if (payload.data?.log) setTreatmentLogs((previous) => [payload.data.log, ...previous.filter((item) => new Date(item.date).toISOString().slice(0, 10) !== new Date(payload.data.log.date).toISOString().slice(0, 10))]);
      treatmentLogMutationIdRef.current = null;
      if (photoFile) treatmentPhotoMutationIdRef.current = null;
      if (photoFile) { setTreatmentPhotoFile(null); setTreatmentPhotoConsent(false); }
    } catch (error) { setTreatmentError(error instanceof Error ? error.message : 'Treatment check-in could not be saved.'); }
    finally { setTreatmentSaving(false); }
  };
  const activeReport = screeningHistory.find((record) => record.id === initialResourceId)
    || (activeTab === 'report-detail' ? screeningHistory[0] : null);

  const removeScreeningRecord = (recordId: string | undefined, recordIndex: number) => {
    const shouldRemove = window.confirm('Delete this screening photo and its record from this device?');
    if (!shouldRemove) return;
    setScreeningHistory((previous) => {
      const updated = previous.filter((record, index) =>
        recordId ? record.id !== recordId : index !== recordIndex
      );
      try {
        localStorage.setItem(`aarogya_screenings_${patientId}`, JSON.stringify(updated));
      } catch {
        window.alert('Could not update the saved records on this device.');
        return previous;
      }
      return updated;
    });
  };

  const printMedicalRecords = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.alert('Allow pop-ups for this site to print or save your medical records as PDF.');
      return;
    }
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;',
    }[char] || char));
    const historyRows = screeningHistory.map((record) => `<li><strong>${escapeHtml(record.date)} ${escapeHtml(record.time || '')}</strong> — ${escapeHtml(record.label || 'Screening record')}<br>${escapeHtml(record.notes || '')}</li>`).join('');
    const prescriptionRows = prescriptionsList.map((record) => `<li>${escapeHtml(record.prescriptionId || 'Prescription')} — ${escapeHtml(record.doctorName || '')} (${escapeHtml(record.hospitalName || '')})</li>`).join('');
    const referralRows = referralsList.map((record) => `<li>${escapeHtml(record.referralId || 'Referral')} — ${escapeHtml(record.destinationHospital || record.hospitalName || '')}</li>`).join('');
    printWindow.document.write(`<!doctype html><html><head><title>Medical Records - ${escapeHtml(patientId)}</title><style>body{font:15px Arial,sans-serif;margin:32px;color:#17202a}h1,h2{color:#14532d}li{margin:10px 0}small{color:#555}</style></head><body><h1>Aarogya-Drishti Medical Records</h1><p>Patient: ${escapeHtml(patientName)}<br>Patient ID: ${escapeHtml(patientId)}<br><strong>SIMULATION — DEMO DATA ONLY — NOT FOR CLINICAL USE</strong></p><h2>Screening history</h2><ul>${historyRows || '<li>No screening records saved on this device.</li>'}</ul><h2>Prescriptions</h2><ul>${prescriptionRows || '<li>No prescription records saved on this device.</li>'}</ul><h2>Referrals</h2><ul>${referralRows || '<li>No referral records saved on this device.</li>'}</ul><small>Use your browser print dialog to print or save this page as PDF.</small></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  };

  // Voice Guidance (Module 11) - Web Speech API
  const speakText = (text: string, options?: { language?: 'en' | 'te' | 'hi'; rate?: number }) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const language = options?.language || currentLang;
      if (language === 'te') {
        utterance.lang = 'te-IN';
      } else if (language === 'hi') {
        utterance.lang = 'hi-IN';
      } else {
        utterance.lang = 'en-IN';
      }
      utterance.rate = options?.rate || 1;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };
  
  // Real-Time Camera & Upload Studio States
  const [activeInputMode, setActiveInputMode] = useState<'camera' | 'upload'>('upload');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraDeviceCount, setCameraDeviceCount] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);
  const [pendingCaptureFile, setPendingCaptureFile] = useState<File | null>(null);
  const [pendingCapturePreview, setPendingCapturePreview] = useState<string | null>(null);
  const [pendingPhotoQuality, setPendingPhotoQuality] = useState<ImageQualityCheckResult | null>(null);
  const [isCheckingPhotoQuality, setIsCheckingPhotoQuality] = useState(false);
  const cameraText = (key: string, fallback: string) => {
    const path = `patientCamera.${key}`;
    const translated = getClientTranslation(translations[currentLang] || translations.en, path);
    if (translated !== path) return translated;
    const english = getClientTranslation(translations.en, path);
    return english === path ? fallback : english;
  };
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [liveScreeningResult, setLiveScreeningResult] = useState<IMucosalLesionResult | null>(null);
  const [screeningDate, setScreeningDate] = useState<string>(() => new Date().toLocaleDateString());

  const [prescriptionSpeechRate, setPrescriptionSpeechRate] = useState(1);
  const [prescriptionSpeechLanguage, setPrescriptionSpeechLanguage] = useState<'en' | 'te' | 'hi'>(currentLang === 'te' || currentLang === 'hi' ? currentLang : 'en');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const pendingPreviewUrlRef = useRef<string | null>(null);
  const analysisRunRef = useRef(0);
  const currentAnalysisEntryIdRef = useRef<string | null>(null);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);

  // Daily Habits Tracker
  const [habitChecked, setHabitChecked] = useState<{ morningBrush: boolean; eveningBrush: boolean; salineRinse: boolean }>({
    morningBrush: true,
    eveningBrush: false,
    salineRinse: true,
  });

  const stopCameraStream = (updateUi = true) => {
    cameraRequestIdRef.current += 1;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (updateUi) {
      setIsCameraActive(false);
      setCameraLoading(false);
      setCameraReady(false);
    }
  };

  const attachVideoElement = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    if (video && mediaStreamRef.current) {
      video.srcObject = mediaStreamRef.current;
      void video.play().catch(() => {
        setCameraError(cameraText('previewFailed', 'Camera preview could not start. Please upload a photo instead.'));
        stopCameraStream();
      });
    }
  }, [currentLang]);

  useEffect(() => {
    return () => {
      stopCameraStream(false);
      if (pendingPreviewUrlRef.current) URL.revokeObjectURL(pendingPreviewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'screening') stopCameraStream();
  }, [activeTab]);

  useEffect(() => {
    const stopForLogout = () => stopCameraStream();
    window.addEventListener('aarogya:stop-camera', stopForLogout);
    return () => window.removeEventListener('aarogya:stop-camera', stopForLogout);
  }, []);

  useEffect(() => {
    if (!pendingCaptureFile) {
      setPendingPhotoQuality(null);
      setIsCheckingPhotoQuality(false);
      return;
    }

    let cancelled = false;
    const imageUrl = URL.createObjectURL(pendingCaptureFile);
    const image = new Image();
    setPendingPhotoQuality(null);
    setIsCheckingPhotoQuality(true);
    image.onload = () => {
      try {
        const maxDimension = 1200;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const quality = evaluateImageQualityClient(canvas, context);
        if (!cancelled) setPendingPhotoQuality(quality);
      } catch {
        if (!cancelled) setPendingPhotoQuality({ ok: false, reason: null, blurScore: 0, brightness: 0 });
      } finally {
        if (!cancelled) setIsCheckingPhotoQuality(false);
        URL.revokeObjectURL(imageUrl);
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setPendingPhotoQuality({ ok: false, reason: null, blurScore: 0, brightness: 0 });
        setIsCheckingPhotoQuality(false);
      }
      URL.revokeObjectURL(imageUrl);
    };
    image.src = imageUrl;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(imageUrl);
    };
  }, [pendingCaptureFile]);

  const cameraErrorMessage = (error: unknown): string => {
    const name = typeof error === 'object' && error && 'name' in error ? String((error as { name?: string }).name || '') : '';
    console.warn('[patient-camera] getUserMedia failed', { name: name || 'UnknownError', message: error instanceof Error ? error.message : String(error) });
    const key = name === 'NotAllowedError' ? 'permissionDenied'
      : name === 'InsecureContextError' ? 'notSecure'
      : name === 'SecurityError' ? 'permissionDenied'
      : name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'noCamera'
      : name === 'NotReadableError' || name === 'TrackStartError' ? 'cameraBusy'
      : name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError' ? 'constraints'
      : name === 'TypeError' || name === 'NotSupportedError' ? 'unsupported'
      : 'general';
    return cameraText(key, 'Could not start the camera. Check camera permissions or upload a photo instead.');
  };
  const startCameraStream = async (targetFacing: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);
    setCameraLoading(true);
    const requestId = cameraRequestIdRef.current;
    try {
      if (!window.isSecureContext) {
        throw Object.assign(new TypeError('Camera access requires a secure context (HTTPS or localhost).'), { name: 'InsecureContextError' });
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new TypeError('navigator.mediaDevices.getUserMedia is unavailable');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: targetFacing }, audio: false });
      } catch (preferredError) {
        const preferredName = typeof preferredError === 'object' && preferredError && 'name' in preferredError ? String((preferredError as { name?: string }).name || '') : '';
        if (!['OverconstrainedError', 'ConstraintNotSatisfiedError'].includes(preferredName)) throw preferredError;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
      setFacingMode(targetFacing);
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      setCameraDeviceCount(devices.filter((device) => device.kind === 'videoinput').length);
    } catch (error) {
      if (requestId === cameraRequestIdRef.current) setCameraError(cameraErrorMessage(error));
    } finally {
      if (requestId === cameraRequestIdRef.current) setCameraLoading(false);
    }
  };

  const handleToggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startCameraStream(nextFacing);
  };

  // Run Real-Time AI Inference on Canvas
  const processCanvasImage = async (canvas: HTMLCanvasElement) => {
    if (!patientId) {
      setScreeningHistoryError('Your patient record is not linked to this login. Please contact support.');
      return;
    }
    const analysisRunId = ++analysisRunRef.current;
    analysisAbortControllerRef.current?.abort();
    analysisAbortControllerRef.current = new AbortController();
    setIsAnalyzing(true);
    setScreeningHistoryError('');
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedImagePreview(dataUrl);
      const token = getPatientAccessToken();
      const result = await analyzeMucosalLesion(canvas, patientId, currentUser?.hospitalId, token, true, currentLang);
      if (analysisRunRef.current !== analysisRunId) return;
      setLiveScreeningResult(result);
      const currentDateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      setScreeningDate(currentDateStr);

      let recordId = result.screeningId;
      let notes = result.geminiAnalysis?.answerText || result.label || PATIENT_SCREENING_NOTE;
      let recordStatus = 'Saved for clinician review';
      if (result.source === 'on-device') {
        const offlineReport = await generateCombinedReport(
          patientId, currentUser?.hospitalId, result, undefined, undefined, token, undefined, undefined, true
        );
        recordId = offlineReport.screeningId || offlineReport.clientId;
        notes = offlineReport.combinedRecommendation.advice;
        recordStatus = 'Saved offline; sync pending';
      }

      // Record in live screening history
      const newHistoryEntry = {
        id: recordId || `pending-${Date.now()}`,
        date: currentDateStr,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        label: 'DEMO AI screening support',
        confidence: Math.round(result.confidence * 100),
        observation: result.geminiAnalysis?.observedCondition || result.label,
        geminiAnalysis: result.geminiAnalysis,
        imageQuality: result.imageQuality,
        status: recordStatus,
        notes,
        triageCategory: result.referToSpecialist ? 'URGENT_SPECIALIST' : 'SCREENING_SUPPORT',
        source: result.source,
        createdAt: new Date().toISOString(),
      };
      currentAnalysisEntryIdRef.current = newHistoryEntry.id;

      setScreeningHistory((prev) => {
        const updated = [newHistoryEntry, ...prev];
        try {
          localStorage.setItem(`aarogya_screenings_${patientId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      if (analysisRunRef.current === analysisRunId) currentAnalysisEntryIdRef.current = null;
    } catch (err) {
      console.error('Error running oral screening inference:', err);
      if (analysisRunRef.current === analysisRunId) {
        setCapturedImagePreview(null);
        setLiveScreeningResult(null);
        setScreeningHistoryError(err instanceof Error ? err.message : 'Screening could not be completed. Please retry.');
      }
    } finally {
      if (analysisRunRef.current === analysisRunId) setIsAnalyzing(false);
    }
  };

  const cancelImageAnalysis = () => {
    analysisRunRef.current += 1;
    analysisAbortControllerRef.current?.abort();
    analysisAbortControllerRef.current = null;
    const entryId = currentAnalysisEntryIdRef.current;
    currentAnalysisEntryIdRef.current = null;
    if (entryId) {
      setScreeningHistory((previous) => {
        const updated = previous.filter((record) => record.id !== entryId);
        try {
          localStorage.setItem(`aarogya_screenings_${patientId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
    stopCameraStream();
    setIsAnalyzing(false);
    clearPendingCapture();
    setCapturedImagePreview(null);
    setLiveScreeningResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const setPendingCapture = (file: File) => {
    if (pendingPreviewUrlRef.current) URL.revokeObjectURL(pendingPreviewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    pendingPreviewUrlRef.current = previewUrl;
    setPendingCaptureFile(file);
    setPendingCapturePreview(previewUrl);
  };

  const clearPendingCapture = () => {
    if (pendingPreviewUrlRef.current) URL.revokeObjectURL(pendingPreviewUrlRef.current);
    pendingPreviewUrlRef.current = null;
    setPendingCaptureFile(null);
    setPendingCapturePreview(null);
  };

  // Capture a still frame, then require the patient to review it before analysis.
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCameraStream();
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError('The camera photo could not be created. Please try again or upload a photo.');
        return;
      }
      setPendingCapture(new File([blob], `oral-screening-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.9);
  };

  const handleRetakePhoto = () => {
    clearPendingCapture();
    setCapturedImagePreview(null);
    setLiveScreeningResult(null);
    if (activeInputMode === 'camera') void startCameraStream(facingMode);
    else if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleUseCapturedPhoto = async () => {
    const file = pendingCaptureFile;
    if (!file || !canvasRef.current) return;
    if (!patientId) {
      setScreeningHistoryError('Your patient record is not linked to this login. Please contact support.');
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not read this image. Choose another photo.'));
        image.src = imageUrl;
      });
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
      const canvas = canvasRef.current;
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable in this browser.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = evaluateImageQualityClient(canvas, context);
      if (!quality.ok) {
        setPendingPhotoQuality(quality);
        return;
      }
      clearPendingCapture();
      await processCanvasImage(canvas);
    } catch (error) {
      setScreeningHistoryError(error instanceof Error ? error.message : 'Could not use this photo. Choose another image.');
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  // Handle Image File Upload (Clicked Photos / Gallery)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScreeningHistoryError('Choose an image file (JPG, PNG, or HEIC), not a document or video.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setScreeningHistoryError('Choose a photo smaller than 12 MB so it can be checked clearly.');
      return;
    }

    setActiveInputMode('upload');
    setCameraError(null);
    setScreeningHistoryError('');
    stopCameraStream();
    setPendingCapture(file);
  };

  // Get active disease knowledge block
  const diseaseInfo = PATIENT_SCREENING_INFO;
  const geminiEducation = liveScreeningResult?.geminiAnalysis;
  const screeningEngineLabel = geminiEducation?.analyzedByModel
    ? `Gemini · ${geminiEducation.analyzedByModel}`
    : liveScreeningResult?.source === 'on-device'
      ? 'On-device ONNX (offline)'
      : liveScreeningResult?.modelVersion || 'Server screening model';
  const screeningExplanation = geminiEducation?.patientExplanation?.trim()
    || geminiEducation?.answerText?.trim()
    || PATIENT_ORAL_EDUCATION_FALLBACK.explanation;
  const possibleCauses = geminiEducation?.possibleCauses?.length
    ? geminiEducation.possibleCauses
    : PATIENT_ORAL_EDUCATION_FALLBACK.possibleCauses;
  const clinicianTalkingPoints = geminiEducation?.whatToTellClinician?.length
    ? geminiEducation.whatToTellClinician
    : PATIENT_ORAL_EDUCATION_FALLBACK.whatToTellClinician;
  const reviewGuidance = geminiEducation?.whenToSeekReview?.length
    ? geminiEducation.whenToSeekReview
    : PATIENT_ORAL_EDUCATION_FALLBACK.whenToSeekReview;
  const oralHealthSources = geminiEducation?.informationSources?.length
    ? geminiEducation.informationSources
    : PATIENT_ORAL_EDUCATION_FALLBACK.sources;
  const patientEducationCards = [
    {
      title: currentLang === 'te' ? 'సాధ్యమైన సాధారణ కారణాలు' : currentLang === 'hi' ? 'संभावित सामान्य कारण' : 'Possible causes (general information)',
      items: possibleCauses,
    },
    {
      title: currentLang === 'te' ? 'వైద్య సిబ్బందికి చెప్పాల్సినవి' : currentLang === 'hi' ? 'स्वास्थ्यकर्मी को बताने योग्य बातें' : 'What to tell your health worker',
      items: clinicianTalkingPoints,
    },
    {
      title: currentLang === 'te' ? 'ఎప్పుడు వైద్య సమీక్ష తీసుకోవాలి' : currentLang === 'hi' ? 'कब स्वास्थ्यकर्मी से मिलें' : 'When to seek an in-person review',
      items: reviewGuidance,
    },
  ];
  const profileValues = [currentUser?.fullName, currentUser?.yearOfBirth, currentUser?.gender, currentUser?.phone, currentUser?.address, currentUser?.village, currentUser?.mandal];
  const profileCompletion = Math.round((profileValues.filter(Boolean).length / profileValues.length) * 100);
  const prescribedMedicineItems: Array<{ key: string; medicine: any }> = (activeTreatmentPlan?.medicines || []).map((medicine: any) => ({ key: String(medicine.medicineId), medicine }));
  const weekStart = new Date(); weekStart.setUTCDate(weekStart.getUTCDate() - 6); weekStart.setUTCHours(0, 0, 0, 0);
  const recentTreatmentLogs = treatmentLogs.filter((log) => new Date(log.date).getTime() >= weekStart.getTime());
  const medicinesTakenThisWeek = recentTreatmentLogs.reduce((count, log) => count + (log.medicineLogs || []).filter((entry: any) => entry.taken).length, 0);
  const medicinesScheduledThisWeek = prescribedMedicineItems.length * 7;
  const dailyCareProgress = medicinesScheduledThisWeek ? Math.round((medicinesTakenThisWeek / medicinesScheduledThisWeek) * 100) : 0;
  const adherenceChart = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const dateKey = date.toISOString().slice(0, 10);
    const log = treatmentLogs.find((item) => new Date(item.date).toISOString().slice(0, 10) === dateKey);
    return { day: date.toLocaleDateString(currentLang, { weekday: 'short', timeZone: 'UTC' }), percentage: Number(log?.adherencePercentage || 0) };
  });


  return (
    <div className="patient-dashboard-root patient-dashboard-layout patient-dashboard-layout-fullwidth">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <aside className="patient-dashboard-sidebar" aria-label={currentLang === 'te' ? 'రోగి నావిగేషన్' : currentLang === 'hi' ? 'रोगी नेविगेशन' : 'Patient navigation'}>
        <div className="patient-sidebar-brand"><span aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M3.5 16s4.4-8 12.5-8 12.5 8 12.5 8-4.4 8-12.5 8S3.5 16 3.5 16Z" stroke="currentColor" strokeWidth="2"/><circle cx="16" cy="16" r="3.5" fill="currentColor"/><path d="M22.5 5.5c-4.7 0-7.4 1.9-7.4 5.4 0 1 .3 1.8.8 2.5 1.9-2.6 4.1-4.4 7.2-5.6l-.6-2.3Z" fill="#4b8c73"/></svg></span><strong>Aarogya Drishti</strong><small>Patient Portal</small></div>
        <div className="patient-sidebar-heading">
          <span className="patient-sidebar-avatar" aria-hidden="true">{patientName.slice(0, 1).toUpperCase()}</span>
          <div><strong>{patientName}</strong><span>{currentLang === 'te' ? 'రోగి పోర్టల్' : currentLang === 'hi' ? 'रोगी पोर्टल' : 'Patient portal'}</span></div>
        </div>
        <p className="patient-sidebar-section-label">{currentLang === 'te' ? 'రోగి సేవలు' : currentLang === 'hi' ? 'रोगी सेवाएँ' : 'Patient tools'}</p>
        <nav className="patient-sidebar-nav">
          {([
            ['home', '⌂', currentLang === 'te' ? 'డాష్‌బోర్డ్' : currentLang === 'hi' ? 'डैशबोर्ड' : 'Dashboard'],
            ['profile', '◉', currentLang === 'te' ? 'ఆరోగ్య ప్రొఫైల్' : currentLang === 'hi' ? 'स्वास्थ्य प्रोफ़ाइल' : 'Health Profile'],
            ['screening', '◎', currentLang === 'te' ? 'నోటి స్క్రీనింగ్' : currentLang === 'hi' ? 'मुख स्क्रीनिंग' : 'Oral Screening'],
            ['assessment', '✳', currentLang === 'te' ? 'DEMO AI అంచనా' : currentLang === 'hi' ? 'DEMO AI आकलन' : 'AI Assessment'],
            ['consultation', '▦', currentLang === 'te' ? 'సంప్రదింపులు' : currentLang === 'hi' ? 'परामर्श' : 'Consultation'],
            ['history', '◷', currentLang === 'te' ? 'నివేదికలు & చరిత్ర' : currentLang === 'hi' ? 'रिपोर्ट और इतिहास' : 'Reports & History'],
            ['treatment', '＋', currentLang === 'te' ? 'చికిత్స ట్రాకింగ్' : currentLang === 'hi' ? 'उपचार ट्रैकिंग' : 'Treatment'],
          ] as [PatientDashboardTab, string, string][]).map(([tab, icon, label], index) => (
            <button key={`${index}-${tab}`} type="button" className={`patient-sidebar-item${activeTab === tab ? ' active' : ''}`} aria-current={activeTab === tab ? 'page' : undefined} onClick={() => switchTab(tab)}>
              <span className="patient-sidebar-number">{index + 1}</span><span className="patient-sidebar-icon" aria-hidden="true">{icon}</span><span className="patient-sidebar-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="patient-sidebar-tools">
          <p className="patient-sidebar-ai-note">DEMO AI screening support. Report chat uses the server configured Gemini service when available.</p>
          <button type="button" className="patient-sidebar-key" onClick={onOpenLanguageModal}>
            <span aria-hidden="true">文</span><span>{currentLang === 'te' ? 'భాష' : currentLang === 'hi' ? 'भाषा' : 'Language'}</span>
          </button>

        </div>
      </aside>

      <main className="patient-dashboard-content">
      <div className="patient-demo-banner" role="status">{'\u26a0\ufe0f SIMULATION SYSTEM \u2014 DEMO DATA ONLY \u2014 NOT FOR CLINICAL USE'}</div>
      {activeTab === 'home' && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}><HealthCardButton patient={currentUser} language={currentLang} /></div>}
      <nav className="patient-global-breadcrumb" aria-label="Breadcrumb"><button type="button" onClick={() => switchTab('home')}>Patient Portal</button><span aria-hidden="true">/</span><span>{activeTab === 'report-detail' ? 'Oral Screening / Report' : activeTab.replace('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</span></nav>
      {activeTab !== 'home' && activeTab !== 'report-detail' && <header className="patient-route-title"><h1>{({ profile: 'Health Profile', screening: 'Oral Screening', assessment: 'AI Assessment & Referrals', consultation: 'Consultation', appointments: 'Consultation', history: 'Reports & History', treatment: 'Treatment Tracking', reminders: 'Consultation', help: 'Consultation', referrals: 'Referral Tracking', prescriptions: 'Treatment', reports: 'Medical Reports', hospitals: 'Hospitals', education: 'Health Education', 'care-team': 'Care Team' } as Record<string, string>)[activeTab] || 'Patient Portal'}</h1></header>}
      {currentUser?.verificationStatus === 'UNVERIFIED' && (
        <div role="status" style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--warning-text)', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 700, fontSize: '0.84rem' }}>
          {currentLang === 'te' ? 'ఆరోగ్య కార్యకర్త ధృవీకరణ కోసం వేచి ఉంది'
            : currentLang === 'hi' ? 'स्वास्थ्य कार्यकर्ता द्वारा सत्यापन लंबित'
              : 'Pending verification by health worker'}
        </div>
      )}
      {/* Active Tab View with In-Place Switch Transition */}
      <div key={activeTab} className="tab-pane-transition">
        {activeTab === 'report-detail' && (
          <section className="patient-report-page" aria-labelledby="patient-report-title">
            <div className="patient-page-heading">
              <button type="button" className="patient-back-button" onClick={() => switchTab('history')}>← {currentLang === 'te' ? 'చరిత్రకు తిరిగి వెళ్లండి' : currentLang === 'hi' ? 'इतिहास पर वापस जाएँ' : 'Back to reports & history'}</button>
              <p className="patient-breadcrumb">{currentLang === 'te' ? 'స్క్రీనింగ్ / నివేదిక' : currentLang === 'hi' ? 'स्क्रीनिंग / रिपोर्ट' : 'Oral Screening / Report'}</p>
              <h1 id="patient-report-title">{currentLang === 'te' ? 'స్క్రీనింగ్ నివేదిక' : currentLang === 'hi' ? 'स्क्रीनिंग रिपोर्ट' : 'Screening report'}</h1>
            </div>
            {!activeReport ? (
              <div className="patient-empty-state"><span aria-hidden="true">▤</span><h2>{currentLang === 'te' ? 'నివేదిక కనుగొనబడలేదు' : currentLang === 'hi' ? 'रिपोर्ट नहीं मिली' : 'Report not found'}</h2><p>{currentLang === 'te' ? 'ఈ పరికరంలో ఈ నివేదిక సేవ్ కాలేదు.' : currentLang === 'hi' ? 'यह रिपोर्ट इस डिवाइस पर उपलब्ध नहीं है।' : 'This report is not available on this device.'}</p><button type="button" className="dash-btn dash-btn-primary" onClick={() => switchTab('history')}>Open history</button></div>
            ) : (
              <div className="patient-report-grid">
                <article className="patient-report-summary">
                  {activeReport.imageUrl ? <img className="patient-report-photo" src={activeReport.imageUrl} alt="Patient uploaded screening image" /> : <div className="patient-report-photo-placeholder">Image not available on this device</div>}
                  <div className="patient-report-meta"><span className="patient-report-badge">DEMO AI OUTPUT - NOT FOR CLINICAL USE</span><span className="patient-report-risk">{activeReport.geminiAnalysis?.riskCategory || 'low'} risk category</span><span>{activeReport.date}{activeReport.time ? ` · ${activeReport.time}` : ''}</span></div>
                  <h2>Image quality and review</h2><p>{activeReport.imageQuality?.ok === false ? 'Retake recommended' : 'Image quality passed'} · <strong>Pending doctor review</strong></p>
                  <h2>Image observation</h2><p className="patient-report-finding">{activeReport.geminiAnalysis?.imageObservation || `The photo appears to show ${activeReport.observation || 'an area recorded for clinician review'}.`}</p><p>This description may be inaccurate.</p>
                  <h3>Possible conditions to discuss with a doctor</h3><p>These are possible, not a diagnosis.</p><div className="patient-chip-list">{(activeReport.geminiAnalysis?.possibleConditions || ['Mouth ulcer', 'Oral irritation']).slice(0, 3).map((item: string) => <a key={item} href={`#/patient/education?condition=${encodeURIComponent(item)}`} className="patient-chip">{item}</a>)}</div>
                  <h3>Risk factors</h3><div className="patient-chip-list">{Object.entries((currentUser as any)?.habits || {}).filter(([, value]) => Boolean(value)).map(([key]) => <span className="patient-chip" key={key}>{key.replace(/([A-Z])/g, ' $1')}</span>)}{(activeReport.geminiAnalysis?.riskFactors || []).map((item: string) => <span className="patient-chip" key={item}>{item}</span>)}{!Object.values((currentUser as any)?.habits || {}).some(Boolean) && !(activeReport.geminiAnalysis?.riskFactors || []).length && <span className="patient-chip">No recorded factors</span>}</div>
                  <h3>Possible causes</h3><ul>{(activeReport.geminiAnalysis?.possibleCauses || ['Irritation from a rough tooth, accidental biting, hot food or drink can sometimes cause a similar appearance.']).slice(0, 4).map((item: string) => <li key={item}>{item}</li>)}</ul>
                  <h3>Things to avoid and oral hygiene</h3><ul>{(activeReport.geminiAnalysis?.thingsToAvoid || ['Avoid tobacco, gutkha, areca nut, alcohol, very spicy or hot foods, picking or biting the area, and harsh mouthwash.', 'Brush gently twice daily with a soft toothbrush and keep the mouth clean.']).slice(0, 4).map((item: string) => <li key={item}>{item}</li>)}</ul>
                  <h3>When to consult a doctor</h3><ul>{(activeReport.geminiAnalysis?.whenToConsult || ['Arrange a review if it does not settle within 1 to 2 weeks.', 'Seek urgent in-person care for bleeding, a hard lump, a white or red patch, trouble swallowing or opening the mouth, or tobacco, gutkha, or areca use.']).slice(0, 4).map((item: string) => <li key={item}>{item}</li>)}</ul>
                  <div className="patient-report-disclaimer">This automated observation is not a medical diagnosis and does not replace review by a qualified clinician.</div>
                  <div className="patient-assessment-actions"><button type="button" className="dash-btn dash-btn-primary" onClick={() => switchTab('consultation')}>Book Consultation</button><button type="button" className="dash-btn dash-btn-outline" onClick={() => (window.location.hash = `#/patient/assessment/${encodeURIComponent(activeReport.id || initialResourceId || '')}`)}>Specialist Directory</button></div>
                </article>
                {activeReport.remote || activeReport.source === 'server' ? <PatientReportChat
                  screeningId={activeReport.id || initialResourceId || ''}
                  reportContext={`DEMO AI screening support. Record summary: ${activeReport.notes || 'Review pending'}. Recorded ${activeReport.date || 'recently'}.`}
                  currentLang={currentLang}
                /> : <aside className="patient-report-summary"><h2>Saved on this device</h2><p>This record can use report chat after it syncs to your health record.</p></aside>}
              </div>
            )}
          </section>
        )}
        {activeTab === 'profile' && <PatientProfilePage currentUser={currentUser} currentLang={currentLang} />}
        {activeTab === 'assessment' && (
          <section className="patient-home-lower-card"><p className="patient-home-card-kicker">DEMO AI · CARE NAVIGATION</p><h2>AI assessment</h2><p className="patient-home-note">DEMO AI screening support can help organize next steps. A qualified clinician reviews screening information and makes care decisions.</p><div className="patient-assessment-actions"><button type="button" className="dash-btn dash-btn-outline" onClick={() => switchTab('hospitals')}>Find hospitals and specialists</button><button type="button" className="dash-btn dash-btn-primary" onClick={() => switchTab('consultation')}>Book a consultation</button></div><h3>Verified doctors with available times</h3>{assessmentLoading ? <p role="status">Loading doctor availability…</p> : assessmentError ? <p className="patient-inline-error" role="alert">{assessmentError}</p> : availablePatientDoctors.length === 0 ? <p className="patient-inline-state">No available doctor times were returned. Open Consultation to choose another date.</p> : <div className="patient-doctor-cards">{availablePatientDoctors.map((doctor) => <article key={doctor.userId} className="patient-home-lower-card"><strong>{doctor.name}</strong><span>{doctor.specialization || 'Clinical consultation'}</span><small>{doctor.hospitalName} · {doctor.availableSlotsCount} available times</small><button type="button" className="dash-btn dash-btn-primary" onClick={() => { if (initialResourceId) { try { sessionStorage.setItem('patient_booking_screening_id', initialResourceId); } catch {} } window.location.hash = `#/patient/consult/${encodeURIComponent(doctor.userId)}`; }}>Consult this doctor</button></article>)}</div>}</section>
        )}
        {activeTab === 'treatment' && (
          <section className="patient-home-lower-card patient-treatment-page">
            <p className="patient-home-card-kicker">TREATMENT TRACKING</p>
            <h2>Daily medicine check-in</h2>
            <p className="patient-home-note">Follow only the clinician-issued prescription. This tracker records check-ins and does not change medicine or dose instructions.</p>
            {treatmentLoading ? <p role="status">Loading treatment records...</p> : treatmentError && !activeTreatmentPlan ? <p className="patient-inline-error" role="alert">{treatmentError}</p> : !activeTreatmentPlan ? (
              <div className="patient-empty-state">
                <span aria-hidden="true">+</span><h3>No treatment plan started</h3><p>Start tracking from a clinician-issued prescription.</p>
                {prescriptionsList.length ? prescriptionsList.map((prescription) => <button key={prescription.prescriptionId} type="button" className="dash-btn dash-btn-primary" disabled={treatmentSaving} onClick={() => void startTreatmentTracking(prescription)}>Start tracking {prescription.prescriptionId}</button>) : <button type="button" className="dash-btn dash-btn-outline" onClick={() => switchTab('prescriptions')}>View prescriptions</button>}
              </div>
            ) : (
              <>
                <div className="patient-treatment-toolbar">
                  {treatmentPlans.length > 1 && <label>Plan<select value={activeTreatmentPlan.treatmentPlanId} onChange={(event) => setSelectedTreatmentPlanId(event.target.value)}>{treatmentPlans.map((plan) => <option key={plan.treatmentPlanId} value={plan.treatmentPlanId}>{plan.prescriptionId} - {plan.status}</option>)}</select></label>}
                  <strong>{dailyCareProgress}% check-ins this week</strong>
                </div>
                <progress value={dailyCareProgress} max="100" aria-label={`Weekly treatment check-in progress ${dailyCareProgress}%`} />
                <div className="patient-adherence-chart" role="img" aria-label="Daily medicine adherence over the last seven days">
                  {adherenceChart.map((day, index) => <div className="patient-adherence-day" key={`${day.day}-${index}`}><span>{day.percentage}%</span><div className="patient-adherence-track"><i style={{ height: `${day.percentage}%` }} /></div><small>{day.day}</small></div>)}
                </div>
                <div className="patient-treatment-list">
                  {prescribedMedicineItems.map(({ key, medicine }) => <label key={key} className="patient-treatment-item"><input type="checkbox" checked={Boolean(remoteMedicineChecks[key])} disabled={treatmentSaving} onChange={(event) => { const updated = { ...remoteMedicineChecks, [key]: event.target.checked }; setRemoteMedicineChecks(updated); void saveTreatmentLog(updated); }} /><span><strong>{medicine.medicineName}</strong><span>{medicine.dosage} - {medicine.frequency}</span>{medicine.instructions && <small>{medicine.instructions}</small>}</span></label>)}
                </div>
                <div className="patient-symptom-grid">
                  <label className="patient-symptom-label">Symptom or pain note<textarea value={symptomNote} maxLength={500} rows={3} onChange={(event) => setSymptomNote(event.target.value)} placeholder="Optional note for your own tracking" /></label>
                  <label className="patient-symptom-label">Symptom severity<select value={symptomSeverity} onChange={(event) => setSymptomSeverity(event.target.value as typeof symptomSeverity)}><option value="none">Not recorded</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label>
                  <label className="patient-symptom-label">Pain score (0-10)<input type="number" min="0" max="10" value={painScore} onChange={(event) => setPainScore(event.target.value === '' ? '' : Math.min(10, Math.max(0, Number(event.target.value))))} /></label>
                </div>
                <label className="patient-symptom-label">Progress photo<input key={treatmentPhotoFile ? 'selected-photo' : 'empty-photo'} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && file.size > 5 * 1024 * 1024) { setTreatmentError('Choose a photo smaller than 5 MB.'); event.target.value = ''; return; } setTreatmentPhotoFile(file); setTreatmentPhotoConsent(false); setTreatmentPhotoHash(''); setTreatmentError(''); }} /></label>
                {treatmentPhotoFile && <><p className="patient-muted-copy">Selected: {treatmentPhotoFile.name}</p><label className="patient-context-consent"><input type="checkbox" checked={treatmentPhotoConsent} onChange={(event) => setTreatmentPhotoConsent(event.target.checked)} />I consent to securely store this photo with my treatment record for review by my treating clinician.</label></>}
                {treatmentPhotoHash && <p className="patient-muted-copy" role="status">Photo saved securely. SHA-256: {treatmentPhotoHash.slice(0, 16)}...</p>}
                <button type="button" className="dash-btn dash-btn-outline" disabled={treatmentSaving || (!symptomNote.trim() && painScore === '' && symptomSeverity === 'none' && !treatmentPhotoFile)} onClick={() => void saveTreatmentLog(remoteMedicineChecks, symptomNote.trim() || undefined, treatmentPhotoFile || undefined, painScore)}>{treatmentSaving ? 'Saving...' : 'Save daily entry'}</button>
                {treatmentError && <p className="patient-inline-error" role="alert">{treatmentError}</p>}
                {recentTreatmentLogs.some((log) => log.photoProgress?.photoId) && <div className="patient-photo-progress-list"><h3>Saved progress photos</h3>{recentTreatmentLogs.filter((log) => log.photoProgress?.photoId).slice(0, 5).map((log) => <article key={log.logId}><p>{new Date(log.date).toLocaleDateString()} - {log.photoProgress.photoId}</p>{log.photoProgress.fileId && (treatmentPhotoUrls[log.photoProgress.fileId] ? <img src={treatmentPhotoUrls[log.photoProgress.fileId]} alt="Saved treatment progress photo" /> : <p role="status">Loading private photo...</p>)}</article>)}</div>}
              </>
            )}
          </section>
        )}
        {activeTab === 'reminders' && (
          <section className="patient-home-lower-card"><p className="patient-home-card-kicker">APPOINTMENTS &amp; REMINDERS</p><h2>Your reminders</h2>{remindersLoading ? <p role="status">Loading reminders…</p> : remindersError ? <p className="patient-inline-error" role="alert">{remindersError}</p> : patientReminders.length === 0 ? <div className="patient-empty-state"><span aria-hidden="true">◷</span><h3>You’re up to date</h3><p>New in-app reminders will appear here.</p></div> : <div className="patient-ticket-list">{patientReminders.map((reminder) => <article key={reminder.notificationId}><div><strong>{reminder.title}</strong><small>{reminder.body}</small><small>{new Date(reminder.createdAt).toLocaleString()}</small></div><span className={`patient-ticket-status ${reminder.read ? '' : 'unread'}`}>{reminder.read ? 'Read' : 'Unread'}</span></article>)}</div>}<button type="button" className="dash-btn dash-btn-outline" onClick={() => switchTab('appointments')}>Manage appointments</button></section>
        )}
        {activeTab === 'help' && <PatientSupportPanel currentLang={currentLang} onOpenAssistant={onToggleAIAssistant} />}
        {activeTab === 'home' && (
          <PatientHomeOverview
            patientName={patientName}
            patientId={patientId}
            currentLang={currentLang}
            appointments={patientAppointments}
            appointmentsLoading={appointmentsLoading}
            appointmentsError={appointmentsError}
            doctors={availablePatientDoctors}
            doctorsLoading={assessmentLoading}
            doctorsError={assessmentError}
            profileCompletion={profileCompletion}
            recentReports={screeningHistory}
            treatmentProgress={dailyCareProgress}
            hasPrescription={prescribedMedicineItems.length > 0}
            hasTreatmentActivity={recentTreatmentLogs.length > 0 || Object.values(habitChecked).some(Boolean)}
            remindersCount={unreadReminderCount}
            nextReminderTitle={nextReminderTitle}
            onNavigate={(tab) => switchTab(tab === 'appointments' || tab === 'reminders' || tab === 'help' ? 'consultation' : tab)}
            onOpenReport={(report, index) => { const id = report.id || `screening-${index}`; window.location.hash = `#/patient/screening/${encodeURIComponent(id)}/report`; }}
            onListenReport={(report) => speakText(`${report.label || 'Screening record'}. ${report.notes || 'DEMO AI screening support only.'}`)}
          />
        )}        {/* -------------------- TAB: OVERVIEW & REAL-TIME SCREENING STUDIO -------------------- */}
          {activeTab === 'screening' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* REAL-TIME SCREENING STUDIO CARD (Clean, Simple, High-Contrast) */}
          <div
            className="dash-panel"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '18px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="dash-panel-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '18px' }}>
              <div>
                <h3 className="dash-panel-title" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  <span>📸</span>
                  <span>Oral screening support</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>Capture or upload a photo to save a DEMO AI screening support record for review by qualified health staff.</p>
              </div>
            </div>

            <p className="patient-muted-copy" style={{ marginBottom: '16px' }}>Photo-capture consent is recorded during registration. Uploads are checked against that consent before analysis.</p>
            <p className="patient-muted-copy" style={{ marginBottom: '16px' }}>{cameraText('clarityGuidance', 'Photos are checked for clarity before DEMO AI screening support. You can retake any photo before using it.')}</p>
            {screeningHistoryError && <p className="patient-inline-error" role="alert">{screeningHistoryError}</p>}

            {/* Input Switcher: Camera vs. File Upload */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveInputMode('camera');
                  startCameraStream(facingMode);
                }}
                style={{
                  background: activeInputMode === 'camera' && isCameraActive ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                  color: activeInputMode === 'camera' && isCameraActive ? '#022c22' : '#ffffff',
                  border: '1.5px solid ' + (activeInputMode === 'camera' && isCameraActive ? '#10b981' : 'rgba(255, 255, 255, 0.2)'),
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.18s ease',
                }}
              >
                <span>📷</span>
                <span>
                  {cameraLoading
                    ? (currentLang === 'te' ? 'కెమెరా ప్రారంభమవుతోంది...' : 'Starting Camera...')
                    : (currentLang === 'te' ? 'కెమెరా ఉపయోగించండి (Live Camera)' : currentLang === 'hi' ? 'कैमरा शुरू करें' : 'Open Camera (Live Video)')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveInputMode('upload');
                  stopCameraStream();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                  }
                }}
                style={{
                  background: activeInputMode === 'upload' && !isCameraActive ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1.5px solid ' + (activeInputMode === 'upload' && !isCameraActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'),
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.18s ease',
                }}
              >
                <span>🖼️</span>
                <span>{currentLang === 'te' ? 'ఫోటో అప్‌లోడ్ చేయండి (Upload Clicked Image)' : currentLang === 'hi' ? 'फोटो अपलोड करें' : 'Upload Clicked Photo / Gallery'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              />
            </div>

            {/* LIVE CAMERA VIEWFINDER */}
            {isCameraActive && (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '560px',
                  margin: '0 auto 20px auto',
                  background: '#000000',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '2px solid #10b981',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                }}
              >
                <video
                  ref={attachVideoElement}
                  playsInline
                  autoPlay
                  muted
                  onPlaying={() => setCameraReady(Boolean(videoRef.current?.videoWidth && videoRef.current?.videoHeight))}
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '420px', objectFit: 'cover' }}
                />

                {/* Target Focus Guide for Mouth */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '220px',
                    height: '140px',
                    border: '2px dashed rgba(52, 211, 153, 0.85)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                    background: 'rgba(0, 0, 0, 0.15)',
                    padding: '8px',
                  }}
                >
                  {currentLang === 'te' ? 'నోరు లేదా చిగురును ఇక్కడ ఉంచండి' : currentLang === 'hi' ? 'मुंह को इस घेरे में रखें' : 'Align mouth or gums inside'}
                </div>

                {/* Camera Bottom Controls */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    alignItems: 'center',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleToggleCameraFacing}
                    aria-label={facingMode === 'environment' ? cameraText('switchFront', 'Switch to front camera') : cameraText('switchBack', 'Switch to back camera')}
                    hidden={cameraDeviceCount < 2}
                    style={{
                      background: 'rgba(0, 0, 0, 0.65)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {facingMode === 'environment' ? cameraText('switchFront', 'Switch to front camera') : cameraText('switchBack', 'Switch to back camera')}
                  </button>

                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    disabled={!cameraReady}
                    style={{
                      background: cameraReady ? '#10b981' : '#64748b',
                      color: '#022c22',
                      border: '3px solid #ffffff',
                      padding: '12px 28px',
                      borderRadius: '30px',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.6)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    {cameraText('capturePhoto', 'Capture photo')}
                  </button>

                  <button
                    type="button"
                    onClick={() => stopCameraStream()}
                    style={{
                      background: 'rgba(239, 68, 68, 0.75)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ {currentLang === 'te' ? 'మూసివేయి' : 'Close'}
                  </button>
                </div>
              </div>
            )}

            {pendingCaptureFile && pendingCapturePreview && (
              <div className="patient-camera-photo-review" aria-live="polite">
                <img src={pendingCapturePreview} alt={cameraText('photoAlt', 'Preview of the oral screening photo')} />
                <div>
                  <h4>{cameraText('reviewTitle', 'Review your photo')}</h4>
                  <p>{cameraText('reviewHelp', 'Choose whether to use this photo or take/select another.')}</p>
                  {isCheckingPhotoQuality && <p role="status">{cameraText('checkingClarity', 'Checking photo clarity…')}</p>}
                  {!isCheckingPhotoQuality && pendingPhotoQuality && (
                    <p role={pendingPhotoQuality.ok ? 'status' : 'alert'} style={{ color: pendingPhotoQuality.ok ? 'var(--success-text)' : 'var(--danger-text)' }}>
                      {pendingPhotoQuality.ok
                        ? cameraText('clarityGood', 'Photo clarity looks okay.')
                        : `${cameraText('clarityPoor', 'This photo may be blurry, too dark, or unclear. Retake it in good light and hold the camera steady.')}${pendingPhotoQuality.reason ? ` ${pendingPhotoQuality.reason}` : ''}`}
                    </p>
                  )}
                  <div className="patient-camera-photo-actions">
                    <button type="button" className="dash-btn dash-btn-outline" onClick={handleRetakePhoto}>
                      {cameraText('retake', 'Retake / Choose another')}
                    </button>
                    <button type="button" className="dash-btn dash-btn-primary" disabled={isCheckingPhotoQuality || !pendingPhotoQuality?.ok} onClick={() => void handleUseCapturedPhoto()}>
                      {cameraText('usePhoto', 'Use photo')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Camera Error Message */}
            {cameraError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: '#fca5a5',
                  fontSize: '0.86rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {cameraError}
              </div>
            )}

            {cameraError && (
              <div className="patient-camera-fallback">
                <p>{cameraText('fallbackHelp', 'If live capture is unavailable, choose a photo from your device camera or gallery.')}</p>
                <label className="patient-camera-fallback-input">
                  <span>{cameraText('uploadPhoto', 'Upload a photo')}</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} />
                </label>
              </div>
            )}

            {/* Analyzing Progress State */}
            {isAnalyzing && (
              <div
                style={{
                  background: 'rgba(2, 132, 199, 0.18)',
                  border: '1.5px solid #38bdf8',
                  borderRadius: '14px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '18px',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '8px', animation: 'spin 1s infinite linear' }}>⚙️</div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#38bdf8', fontWeight: 700 }}>
                  {currentLang === 'te' ? 'ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ విశ్లేషిస్తోంది...' : currentLang === 'hi' ? 'एआई मॉडल फोटो का विश्लेषण कर रहा है...' : 'Running Real-Time AI Inference...'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#cbd5e1' }}>
                  Testing with on-device ONNX WebAssembly neural weights &amp; mucosal colorimetric filters.
                </p>
                <button
                  type="button"
                  onClick={cancelImageAnalysis}
                  style={{
                    marginTop: '14px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #dc2626',
                    background: 'rgba(220, 38, 38, 0.12)',
                    color: '#b91c1c',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Delete photo and cancel analysis
                </button>
              </div>
            )}

            {/* REAL-TIME COMPREHENSIVE RESULT CARD OR AWAITING UPLOAD STATE */}
            {pendingCaptureFile ? null : !capturedImagePreview && !liveScreeningResult ? (
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1.5px dashed var(--border)',
                  borderRadius: '16px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📸</div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                  {currentLang === 'te'
                    ? 'నిజ-సమయ ఓరల్ ఫోటో స్క్రీనింగ్ కోసం వేచి చూస్తున్నాము'
                    : currentLang === 'hi'
                    ? 'रीयल-टाइम ओरल फोटो स्क्रीनिंग की प्रतीक्षा है'
                    : 'Awaiting Real-Time Oral Photo Upload'}
                </h4>
                <p style={{ margin: '0 auto', maxWidth: '440px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {currentLang === 'te'
                    ? 'పై కెమెరా వీక్షణ ద్వారా ప్రత్యక్ష ఫోటో తీయండి లేదా మీ గ్యాలరీ నుండి ఫోటో ఎంచుకోండి. ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ మరియు జెమినీ మల్టీమోడల్ విశ్లేషణ ఇక్కడ స్వయంచాలకంగా కనిపిస్తాయి.'
                    : currentLang === 'hi'
                    ? 'ऊपर दिए गए कैमरे से लाइव फोटो लें या अपनी गैलरी से फोटो चुनें। एआई और जेमिनी मल्टीमॉडल विश्लेषण यहां दिखाई देगा।'
                    : 'Use a live camera view or choose a photo from your gallery. DEMO AI screening support runs on this device; report chat uses the server Gemini service when configured.'}
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: diseaseInfo.badgeBg,
                  border: `1.5px solid ${diseaseInfo.badgeBorder}`,
                  borderRadius: '16px',
                  padding: '22px',
                  color: 'var(--text-primary)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                }}
              >
              {/* Result Header & Risk Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '14px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.6rem' }}>{diseaseInfo.icon}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.25rem', color: diseaseInfo.badgeColor, fontWeight: 800 }}>
                        {diseaseInfo.title[currentLang] || diseaseInfo.title.en}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Screening ID: <code>{liveScreeningResult?.imageRef || 'Local screening record'}</code> • Date: {screeningDate} • Engine: {screeningEngineLabel}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span
                    style={{
                      background: diseaseInfo.badgeColor,
                      color: 'var(--surface)',
                      padding: '8px 18px',
                      borderRadius: '24px',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      letterSpacing: '0.02em',
                      boxShadow: `0 4px 12px ${diseaseInfo.badgeBorder}`,
                    }}
                  >
                    {diseaseInfo.riskBadge[currentLang] || diseaseInfo.riskBadge.en}
                  </span>
                </div>
              </div>

              {/* Image Preview & Description */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: capturedImagePreview ? '140px 1fr' : '1fr',
                  gap: '18px',
                  alignItems: 'center',
                  marginBottom: '20px',
                }}
              >
                {capturedImagePreview && (
                  <div
                    style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: `2px solid ${diseaseInfo.badgeColor}`,
                    }}
                  >
                    <img
                      src={capturedImagePreview}
                      alt="Captured Screening"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {currentLang === 'te' ? 'పరిస్థితి వివరణ (What this looks like):' : currentLang === 'hi' ? 'स्थिति का विवरण:' : 'What this means:'}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.94rem', lineHeight: 1.55, color: 'var(--text-primary)' }}>
                    {screeningExplanation}
                  </p>
                  {geminiEducation?.observedCondition && (
                    <p style={{ margin: '10px 0 0', fontSize: '0.88rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                      <strong>{currentLang === 'te' ? 'చిత్రంలో కనిపించినది (స్క్రీనింగ్ పరిశీలన): ' : currentLang === 'hi' ? 'तस्वीर में दिखा अवलोकन: ' : 'Image observation (screening support): '}</strong>
                      {geminiEducation.observedCondition}
                    </p>
                  )}
                </div>
              </div>

              {!geminiEducation && (
                <p role="status" style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: '10px', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontSize: '0.84rem', lineHeight: 1.45 }}>
                  {currentLang === 'te'
                    ? 'ఈ స్క్రీనింగ్‌లో Gemini వివరణ అందుబాటులో లేదు. క్రింద ఉన్నది సాధారణ ఆరోగ్య సమాచారం మాత్రమే.'
                    : currentLang === 'hi'
                      ? 'इस स्क्रीनिंग के लिए Gemini की व्याख्या उपलब्ध नहीं थी। नीचे केवल सामान्य स्वास्थ्य जानकारी है।'
                      : 'Gemini was not used for this result. The information below is general oral-health guidance, not image analysis.'}
                </p>
              )}

              {/* Patient education: potential causes, appointment notes and review timing */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                {patientEducationCards.map((card) => (
                  <section key={card.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                    <h5 style={{ margin: '0 0 10px', color: 'var(--text-primary)', fontSize: '0.92rem', lineHeight: 1.4 }}>{card.title}</h5>
                    <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {card.items.map((item, idx) => <li key={`${card.title}-${idx}`}>{item}</li>)}
                    </ul>
                  </section>
                ))}
              </div>

              <div style={{ marginBottom: '18px', fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                <strong>{currentLang === 'te' ? 'ఆరోగ్య సమాచారం మూలాలు: ' : currentLang === 'hi' ? 'स्वास्थ्य जानकारी के स्रोत: ' : 'Health information sources: '}</strong>
                {oralHealthSources.map((source, index) => (
                  <React.Fragment key={source.url}>
                    {index > 0 && ' · '}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{source.label}</a>
                  </React.Fragment>
                ))}
              </div>

              {/* Clinical Next Steps & Action Banner */}
              <div
                style={{
                  background: 'var(--info-bg)',
                  border: '1px solid var(--info-text)',
                  color: 'var(--info-text)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--info-text)', fontSize: '0.88rem', marginBottom: '2px' }}>
                    🏥 {currentLang === 'te' ? 'సిఫార్సు చేయబడిన తదుపరి చర్య (Clinical Next Steps):' : currentLang === 'hi' ? 'अगला चिकित्सीय कदम:' : 'Next step:'}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                    {diseaseInfo.clinicalAction[currentLang] || diseaseInfo.clinicalAction.en}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('appointments')}
                      style={{
                        background: '#10b981',
                        color: '#022c22',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      📅 {currentLang === 'te' ? 'పాడేరు దంత క్లినిక్‌లో అపాయింట్‌మెంట్ తీసుకోండి' : currentLang === 'hi' ? 'अस्पताल अपॉइंटमेंट बुक करें' : 'Book Dental OPD Visit'}
                    </button>
                  )}
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('specialists')}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                      }}
                    >
                      👩‍⚕️ {currentLang === 'te' ? 'వైద్యుల డైరెక్టరీ' : currentLang === 'hi' ? 'विशेषज्ञ सूची' : 'Specialist Directory'}
                    </button>
                  )}

                </div>
              </div>

              {/* Safety Non-Diagnosis Banner (Invariant 1 Compliance) */}
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#94a3b8',
                  lineHeight: 1.4,
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingTop: '10px',
                }}
              >
                ⚠️ <strong>DEMO AI screening support only.</strong> This automated observation is not a medical diagnosis and does not replace review by a qualified clinician.
              </div>
            </div>
            )}
          </div>

          {/* Daily Oral Hygiene Progress & Habits Card */}
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                <span>🌿</span>
                <span>{currentLang === 'te' ? 'రోజువారీ నోటి సంరక్షణ పురోగతి & అలవాట్లు' : currentLang === 'hi' ? 'दैनिक ओरल देखभाल एवं आदतें' : 'Treatment Progress & Daily Hygiene Tracker'}</span>
              </h3>
              <span className="dash-status-pill status-completed">DAILY TRACKER</span>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5, marginBottom: '14px' }}>
              {currentLang === 'te'
                ? 'పాడేరు దంత వైద్యాధికారి సిఫార్సు చేసిన ఈ రోజువారీ అలవాట్లను పూర్తి చేయండి:'
                : 'Follow these simple daily habits recommended by your CHC dental officer for optimal oral recovery:'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={habitChecked.morningBrush}
                  onChange={(e) => setHabitChecked({ ...habitChecked, morningBrush: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span
                  style={{
                    textDecoration: habitChecked.morningBrush ? 'line-through' : 'none',
                    color: habitChecked.morningBrush ? '#94a3b8' : '#ffffff',
                    fontWeight: 500,
                  }}
                >
                  🪥 {currentLang === 'te' ? 'ఉదయం మృదువైన బ్రష్‌తో 2 నిమిషాలు పళ్ళు తోమడం' : 'Morning gentle tooth brushing with soft bristles (2 minutes)'}
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={habitChecked.salineRinse}
                  onChange={(e) => setHabitChecked({ ...habitChecked, salineRinse: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span
                  style={{
                    textDecoration: habitChecked.salineRinse ? 'line-through' : 'none',
                    color: habitChecked.salineRinse ? '#94a3b8' : '#ffffff',
                    fontWeight: 500,
                  }}
                >
                  💧 {currentLang === 'te' ? 'మధ్యాహ్న భోజనం తర్వాత గోరువెచ్చని ఉప్పునీటి పుక్కిలింత' : 'Warm salt-water mouth gargle after noon meal'}
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={habitChecked.eveningBrush}
                  onChange={(e) => setHabitChecked({ ...habitChecked, eveningBrush: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span
                  style={{
                    textDecoration: habitChecked.eveningBrush ? 'line-through' : 'none',
                    color: habitChecked.eveningBrush ? '#94a3b8' : '#ffffff',
                    fontWeight: 500,
                  }}
                >
                  🌙 {currentLang === 'te' ? 'రాత్రి నిద్రపోయే ముందు బ్రష్ చేసుకోవడం' : 'Evening brushing before sleep (removes dinner plaque)'}
                </span>
              </label>
            </div>

            <div
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.82rem',
                color: '#e0f2fe',
                lineHeight: 1.5,
              }}
            >
              💡 <strong>Follow-up Reminder:</strong> Routine in-person clinical checkup at CHC Paderu. ASHA frontline staff can assist with transportation navigation.
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: UPCOMING APPOINTMENTS -------------------- */}
      {(activeTab === 'appointments' || activeTab === 'consultation') && (
        <div className="dash-panel">
          <div className="patient-call-demo-notice" role="note"><strong>DEMO VIDEO CONSULTATION</strong><span>When your confirmed online appointment is ready, your doctor starts the call. The <b>Join video consultation</b> button appears here automatically. Allow camera and microphone access to join.</span></div>
          <ConsultationPortalPanel role="patient" patientId={currentUser?.patientId || currentUser?.userId} currentLang={currentLang} initialDoctorId={activeTab === 'consultation' ? initialResourceId : undefined} screeningId={(() => { try { return sessionStorage.getItem('patient_booking_screening_id') || undefined; } catch { return undefined; } })()} />
          <div className="patient-appointments-legacy">
          <div className="dash-panel-header">
            <h3 className="dash-panel-title">
              <span>📅</span>
              <span>
                {currentLang === 'te'
                  ? 'నా షెడ్యూల్ చేయబడిన వైద్య సంప్రదింపులు'
                  : currentLang === 'hi'
                  ? 'मेरे निर्धारित परामर्श'
                  : 'My Scheduled OPD & Telemedicine Appointments'}
              </span>
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {/* Appointment Card 1: Dedicated Online Video Consultation with Treating Doctor */}
            <div
              style={{
                background: isDoctorCallActive
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isDoctorCallActive
                  ? '2px solid #10b981'
                  : '1.5px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '16px',
                padding: '22px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: isDoctorCallActive ? '0 8px 24px rgba(16, 185, 129, 0.25)' : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                    {currentLang === 'te'
                      ? 'డాక్టర్ కె. సోమశేఖర్, BDS, MDS (ఓరల్ మెడిసిన్ & డెంటల్ సర్జన్)'
                      : 'Dr. K. Somasekhar, BDS, MDS (Oral Medicine & Dental Surgeon)'}
                  </span>
                  <span
                    className="dash-status-pill"
                    style={{
                      background: isDoctorCallActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      border: isDoctorCallActive ? '1px solid #10b981' : '1px solid #f59e0b',
                      color: isDoctorCallActive ? '#34d399' : '#fbbf24',
                      fontWeight: 700,
                    }}
                  >
                    {isDoctorCallActive
                      ? currentLang === 'te'
                        ? '🟢 డాక్టర్ ఆన్‌లైన్‌లో ఉన్నారు'
                        : '🟢 DOCTOR ONLINE'
                      : currentLang === 'te'
                      ? '🕒 వైద్యుల కోసం వేచి ఉంది'
                      : 'VIDEO CALL BLOCKED'}
                  </span>
                </div>

                <div style={{ fontSize: '0.86rem', color: '#cbd5e1', marginBottom: '6px' }}>
                  🏥 <strong>{currentLang === 'te' ? 'కమ్యూనిటీ హెల్త్ సెంటర్ (CHC) పాడేరు' : 'Community Health Centre (CHC) Paderu'}</strong> • {currentLang === 'te' ? 'టెలిమెడిసిన్ కన్సల్టేషన్ డెస్క్' : 'Telemedicine Room 02'}
                </div>

                <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600, marginBottom: '8px' }}>
                  📅 <strong>{currentLang === 'te' ? 'నేడు ఉదయం 10:30 AM' : 'Today at 10:30 AM'}</strong> • {currentLang === 'te' ? 'ఆన్‌లైన్ వీడియో సంప్రదింపు' : 'Online Video Consultation'}
                </div>

                <div
                  style={{
                    fontSize: '0.76rem',
                    color: isDoctorCallActive ? '#a7f3d0' : '#94a3b8',
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {isDoctorCallActive
                    ? currentLang === 'te'
                      ? '✓ మీ చికిత్సా వైద్యులు డాక్టర్ సోమశేఖర్ సెషన్‌ను ప్రారంభించారు. దయచేసి క్రింది బటన్ నొక్కి కాల్లో చేరండి.'
                      : '✓ Your treating doctor Dr. Somasekhar has started the call. Please join now.'
                    : currentLang === 'te'
                      ? '🔒 నిబంధన: మీ చికిత్సా వైద్యులు కాల్ ప్రారంభించినప్పుడు మాత్రమే మీరు చేరగలరు. రోగులు స్వయంగా కాల్ ప్రారంభించలేరు.'
                      : 'Live video is blocked. Open the text-based case discussion instead.'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('teleconsultation')}
                  style={{
                    background: isDoctorCallActive
                      ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                      : 'rgba(56, 189, 248, 0.15)',
                    color: '#ffffff',
                    border: isDoctorCallActive ? 'none' : '1px solid #38bdf8',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: isDoctorCallActive ? '0 4px 18px rgba(16, 185, 129, 0.4)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{isDoctorCallActive ? '📹' : '🔒'}</span>
                  <span>
                    {isDoctorCallActive
                      ? currentLang === 'te'
                        ? 'కాల్లో చేరండి (Join Call)'
                        : 'Open Text Discussion'
                      : currentLang === 'te'
                        ? 'వేచి ఉండే గది (Waiting Lobby)'
                        : 'Open Text Discussion'}
                  </span>
                </button>

                {/* Simulation Trigger Toggle for Testing */}
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('teleconsultation')}
                  style={{
                    background: 'transparent',
                    border: '1px dashed rgba(255, 255, 255, 0.25)',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                  }}
                  title="Simulate doctor starting or ending the consultation room"
                >
                  {isDoctorCallActive
                    ? currentLang === 'te'
                      ? '🔄 డెమో: డాక్టర్ కాల్ ఆపివేయండి (End Call)'
                      : currentLang === 'hi'
                      ? '🔄 डेमो: डॉक्टर कॉल समाप्त करें (End Call)'
                      : '🔄 Demo: Simulate Doctor End Call'
                    : currentLang === 'te'
                      ? '⚡ డెమో: డాక్టర్ కాల్ ప్రారంభించినట్లు చేయండి (Doctor Join)'
                      : currentLang === 'hi'
                      ? '⚡ डेमो: डॉक्टर कॉल शुरू करें (Doctor Join)'
                      : '⚡ Demo: Simulate Doctor Join Call'}
                </button>
              </div>
            </div>

            {/* Appointment Card 2: Completed In-Person Visit */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
                opacity: 0.9,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {currentLang === 'te'
                      ? 'డాక్టర్ రమేష్ కుమార్, MBBS (మెడికల్ ఆఫీసర్)'
                      : 'Dr. Ramesh Kumar, MBBS (Medical Officer)'}
                  </span>
                  <span className="dash-status-pill status-completed">
                    {currentLang === 'te' ? 'పూర్తయింది' : 'VISIT COMPLETED'}
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  🏥 {currentLang === 'te' ? 'సీహెచ్‌సీ పాడేరు • జనరల్ ఓపీడీ తనిఖీ' : 'CHC Paderu • General OPD Checkup'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  📅 04 Nov 2026 • {currentLang === 'te' ? 'నోటి శ్లేష్మ తనిఖీ పూర్తయింది. గోరువెచ్చని ఉప్పునీటి పుక్కిలింత సూచించబడింది.' : 'Verified no mucosal ulcerations. Prescribed warm saline gargle.'}
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: MY MEDICAL REPORTS -------------------- */}
      {activeTab === 'reports' && (
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3 className="dash-panel-title">
              <span>📄</span>
              <span>My Medical Records</span>
            </h3>
            <span className="dash-status-pill status-completed">Saved on this device</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.96rem', marginBottom: '4px' }}>
                  Screening history: {screeningHistory.length} record{screeningHistory.length === 1 ? '' : 's'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Patient: <code>{patientName}</code> • Patient ID: <code>{patientId}</code>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Includes locally saved screening photos, prescriptions, and referrals when available.
                </div>
              </div>
              <button
                type="button"
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid #10b981',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
                onClick={printMedicalRecords}
              >
                🖨️ Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: ORAL HEALTH EDUCATION -------------------- */}
      {activeTab === 'education' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="dash-panel">
            <h4 style={{ color: '#34d399', fontSize: '1.05rem', margin: '0 0 10px 0' }}>
              {currentLang === 'te' ? '🪥 1. సరైన బ్రషింగ్ విధానం' : '🪥 1. Proper Brushing Technique'}
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
              {currentLang === 'te'
                ? 'చిగుళ్ళ అంచు వద్ద 45 డిగ్రీల కోణంలో బ్రష్‌ను పట్టుకోండి. అటుఇటు గట్టిగా రుద్దకుండా గుండ్రంగా సున్నితంగా తిప్పండి. ప్రతి దంతం వెలుపలి, లోపలి మరియు నమిలే భాగాలను క్రమం తప్పకుండా శుభ్రం చేయండి.'
                : 'Hold the brush at a 45-degree angle towards the gumline. Use gentle, small circular motions rather than scrubbing side to side. Clean outer, inner, and chewing surfaces of every tooth.'}
            </p>
          </div>

          <div className="dash-panel">
            <h4 style={{ color: '#fbbf24', fontSize: '1.05rem', margin: '0 0 10px 0' }}>
              {currentLang === 'te' ? '🧂 2. గోరువెచ్చని ఉప్పునీటి పుక్కిలింత ప్రయోజనాలు' : '🧂 2. Benefits of Warm Saline Gargles'}
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
              {currentLang === 'te'
                ? 'గోరువెచ్చని ఉప్పునీటితో పుక్కిలించడం వల్ల నోటిలోని బ్యాక్టీరియా నశిస్తుంది, చిగుళ్ళ వాపు తగ్గుతుంది మరియు నోటి శ్లేష్మ పొర సహజంగా త్వరగా కోలుకుంటుంది.'
                : 'Warm salt-water rinsing reduces bacterial swelling, cleanses food debris from dental pockets, and creates an alkaline oral environment that speeds mucosal healing naturally.'}
            </p>
          </div>

          <div className="dash-panel">
            <h4 style={{ color: '#ef4444', fontSize: '1.05rem', margin: '0 0 10px 0' }}>
              {currentLang === 'te' ? '🚫 3. పొగాకు మరియు గుట్కా విముక్తి' : '🚫 3. Tobacco & Gutka De-Addiction'}
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
              {currentLang === 'te'
                ? 'తమలపాకులు, వక్కపొడి, గుట్కా మరియు ఖైనీ నమలడం వల్ల నోరు తెరుచుకోకపోవడం (OSMF) మరియు తీవ్రమైన మార్పులు వస్తాయి. సీహెచ్‌సీ పాడేరులో ఉచిత కౌన్సెలింగ్ మరియు నికోటిన్ నివారణ సహాయం అందుబాటులో ఉంది.'
                : 'Areca nut and processed tobacco contain chemical irritants that restrict mouth opening (OSMF) and alter mucosa. Free counseling and nicotine-replacement support are available at CHC Paderu.'}
            </p>
          </div>
        </div>
      )}

      {/* -------------------- TAB: DOCTOR & ASHA CARE TEAM -------------------- */}
      {activeTab === 'care-team' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="dash-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                🩺
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1rem' }}>Dr. K. Srinivas, BDS, MDS</h4>
                <div style={{ color: '#38bdf8', fontSize: '0.82rem' }}>Senior Dental Officer • CHC Paderu</div>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45 }}>
              {currentLang === 'te'
                ? 'ఓపీడీ రోజులు: సోమ, బుధ, శుక్రవారాలు (ఉదయం 09:00 – మధ్యాహ్నం 01:30). నోటి శ్లేష్మ వ్యాధులు మరియు దంత చికిత్సలను పర్యవేక్షిస్తారు.'
                : 'Available OPD Days: Monday, Wednesday, Friday (09:00 AM – 01:30 PM). Handles advanced oral mucosal triage and restorations.'}
            </p>
          </div>

          <div className="dash-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                👩‍⚕️
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1rem' }}>
                  {currentLang === 'te' ? 'లక్ష్మీ దేవి, ఆశా కార్యకర్త' : 'Lakshmi Devi, ASHA Staff'}
                </h4>
                <div style={{ color: '#34d399', fontSize: '0.82rem' }}>
                  {currentLang === 'te' ? 'డుంబ్రిగుడ గిరిజన ఆవాస సెక్టార్ 02' : 'Dumbriguda Tribal Habitation Sector 02'}
                </div>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45 }}>
              {currentLang === 'te'
                ? 'మీ ప్రాంత ఫ్రంట్‌లైన్ ఆరోగ్య కార్యకర్త. ఇంటింటి తనిఖీలు, స్క్రీనింగ్ ఫాలో-అప్ మరియు సీహెచ్‌సీ పాడేరు ఆసుపత్రికి తోడుగా రావడంలో సహాయపడతారు.'
                : 'Your designated frontline health worker. Assists with home visits, screening follow-up, and accompaniment to CHC Paderu on OPD days.'}
            </p>
          </div>
        </div>
      )}

      {/* -------------------- TAB: NEARBY HOSPITALS -------------------- */}
      {activeTab === 'hospitals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <h4 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: '1.05rem' }}>
              🏥 {currentLang === 'te' ? 'కమ్యూనిటీ హెల్త్ సెంటర్ (CHC) పాడేరు' : 'Community Health Centre (CHC) Paderu'}
            </h4>
            <div style={{ color: '#38bdf8', fontSize: '0.84rem', marginBottom: '8px' }}>
              {currentLang === 'te' ? 'గిరిజన ప్రాంత ప్రాథమిక రిఫరల్ ఆసుపత్రి • దూరం: 8.4 కి.మీ' : 'Primary Referral Centre for Tribal Agency Area • Distance: 8.4 km from Dumbriguda'}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45, margin: 0 }}>
              {currentLang === 'te'
                ? 'దంత చికిత్సాలయం, డిజిటల్ రేడియోగ్రఫీ, అత్యవసర చికిత్స మరియు మైనర్ సర్జికల్ వార్డు సౌకర్యాలు ఉన్నాయి. 24/7 అత్యవసర సేవలు అందుబాటులో ఉంటాయి.'
                : 'Equipped with Dental Clinic, Digital Radiography, Emergency Care, and Minor Surgical Ward. Open 24/7 for emergency casualty.'}
            </p>
          </div>

          <div className="dash-panel">
            <h4 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: '1.05rem' }}>
              🏥 {currentLang === 'te' ? 'ఏరియా హాస్పిటల్ అరకు లోయ' : 'Area Hospital Araku Valley'}
            </h4>
            <div style={{ color: '#38bdf8', fontSize: '0.84rem', marginBottom: '8px' }}>
              {currentLang === 'te' ? 'ద్వితీయ శ్రేణి ప్రభుత్వ ఆసుపత్రి • దూరం: పాడేరు నుండి 24 కి.మీ' : 'Secondary Hospital Centre • Distance: 24 km from Paderu'}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45, margin: 0 }}>
              {currentLang === 'te'
                ? 'ఈఎన్‌టీ స్పెషలిస్ట్, ముఖ మరియు దవడ శస్త్రచికిత్స, సాధారణ శస్త్రచికిత్స మరియు కింగ్ జార్జ్ హాస్పిటల్ (KGH) విశాఖపట్నంతో టెలిమెడిసిన్ లింక్ కలిగి ఉంది.'
                : 'Specialist ENT, Maxillofacial, General Surgery, and Tele-medicine Consultation Link with King George Hospital (KGH) Visakhapatnam.'}
            </p>
          </div>
          <div className="dash-panel">
            <h4 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Hospital referral network</h4>
            <p style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5 }}>
              Community Health Centre Paderu connects patients to Area Hospital Araku Valley and King George Hospital, Visakhapatnam, for clinician-directed referrals. Live video calling is unavailable; text-based case discussion is available to clinical staff.
            </p>
            <button
              type="button"
              className="dash-btn dash-btn-outline"
              onClick={() => onNavigateTab?.('specialists')}
            >
              View specialist directory
            </button>
          </div>
        </div>
      )}

      {/* -------------------- TAB: MY REFERRALS (Module 5) -------------------- */}
      {activeTab === 'referrals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                  {currentLang === 'te'
                    ? '🔄 నా స్పెషలిస్ట్ రిఫరల్స్ (Specialist Hospital Referrals)'
                    : currentLang === 'hi'
                    ? '🔄 मेरे विशेषज्ञ रेफरल (Specialist Hospital Referrals)'
                    : '🔄 My Specialist Hospital Referrals'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '2px' }}>
                  {currentLang === 'te'
                    ? 'పాడేరు CHC లేదా విశాఖ KGH ఆసుపత్రులకు వైద్యులు జారీ చేసిన అధికారిక రిఫరల్స్ మరియు స్థితి.'
                    : currentLang === 'hi'
                    ? 'पाडेरु सीएचसी या विशाखा केजीएच अस्पतालों के लिए डॉक्टरों द्वारा जारी आधिकारिक रेफरल और स्थिति।'
                    : 'Official specialist referrals issued by doctors to CHC Paderu or KGH Visakhapatnam.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => speakText(
                  currentLang === 'te'
                    ? 'మీకు కింగ్ జార్జ్ హాస్పిటల్ విశాఖపట్నంకు ఓరల్ సర్జరీ రిఫరల్ షెడ్యూల్ చేయబడింది. దయచేసి నిర్ణీత తేదీకి వెళ్లండి.'
                    : 'You have a referral to King George Hospital Visakhapatnam for specialist evaluation.'
                )}
                style={{ background: 'rgba(236, 72, 153, 0.2)', border: '1px solid #ec4899', color: '#f472b6', padding: '6px 12px', borderRadius: '16px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}
              >
                🔊 {currentLang === 'te' ? 'వినండి' : currentLang === 'hi' ? 'सुनें' : 'Listen'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              {referralsList.map((ref, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🏥</span>
                      <strong style={{ color: '#ffffff', fontSize: '1rem' }}>{ref.destinationHospitalName}</strong>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: ref.status === 'SCHEDULED' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: ref.status === 'SCHEDULED' ? '#38bdf8' : '#34d399',
                        border: `1px solid ${ref.status === 'SCHEDULED' ? '#0284c7' : '#10b981'}`,
                      }}
                    >
                      ● {ref.status === 'SCHEDULED'
                        ? (currentLang === 'te' ? 'అపాయింట్‌మెంట్ షెడ్యూల్ అయింది' : currentLang === 'hi' ? 'अपॉइंटमेंट निर्धारित है' : 'Appointment Scheduled')
                        : (currentLang === 'te' ? 'హాజరయ్యారు' : currentLang === 'hi' ? 'उपस्थित हुए' : 'Attended')}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {currentLang === 'te' ? 'స్పెషాలిటీ:' : currentLang === 'hi' ? 'विशेषज्ञता:' : 'Specialty:'}{' '}
                    <strong style={{ color: '#f472b6' }}>{ref.specialty}</strong> •{' '}
                    {currentLang === 'te' ? 'రిఫర్ చేసిన వైద్యులు:' : currentLang === 'hi' ? 'रेफर करने वाले डॉक्टर:' : 'Referring Doctor:'}{' '}
                    {ref.referringDoctorName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {currentLang === 'te' ? 'కారణం:' : currentLang === 'hi' ? 'कारण:' : 'Reason:'} {ref.reasonForReferral}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '2px' }}>
                    📅 {currentLang === 'te' ? 'షెడ్యూల్ తేదీ:' : currentLang === 'hi' ? 'निर्धारित तिथि:' : 'Scheduled Date:'}{' '}
                    {new Date(ref.scheduledFollowUpDate).toLocaleDateString(currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN')} •{' '}
                    {currentLang === 'te' ? 'రిఫరల్ కోడ్:' : currentLang === 'hi' ? 'रेफरल कोड:' : 'Referral Code:'}{' '}
                    <code style={{ fontWeight: 700 }}>{ref.referralId}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: MY PRESCRIPTIONS (Module 6 & 7) -------------------- */}
      {activeTab === 'prescriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                  {currentLang === 'te'
                    ? '💊 నా డిజిటల్ మందుల చీటీలు (My Prescriptions)'
                    : currentLang === 'hi'
                    ? '💊 मेरे डिजिटल नुस्खे (My Prescriptions)'
                    : '💊 My Digital Prescriptions'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '2px' }}>
                  {currentLang === 'te'
                    ? 'వైద్యులు ధృవీకరించి సూచించిన మందులు, మోతాదు మరియు జీవనశైలి మార్గదర్శకాలు.'
                    : currentLang === 'hi'
                    ? 'डॉक्टरों द्वारा प्रमाणित और निर्धारित दवाएं, खुराक और जीवनशैली दिशानिर्देश।'
                    : 'Doctor-verified prescribed medications, dosages, and lifestyle care instructions.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visiblePrescriptions.length === 0 && <div className="patient-empty-state"><span aria-hidden="true">▤</span><h3>{initialResourceId ? 'Prescription not found' : 'No prescriptions available'}</h3><p>{initialResourceId ? 'This prescription is not available on this device.' : 'A prescription written by a clinician will appear here.'}</p><button type="button" className="dash-btn dash-btn-primary" onClick={() => switchTab('appointments')}>View appointments</button></div>}
              {visiblePrescriptions.map((rx, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1.5px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem' }}>
                        {rx.diagnosisImpression}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        {currentLang === 'te' ? 'చీటీ సంఖ్య:' : currentLang === 'hi' ? 'पर्चा सं.:' : 'Rx ID:'}{' '}
                        <code style={{ color: '#38bdf8', fontWeight: 700 }}>{rx.prescriptionId}</code> •{' '}
                        {currentLang === 'te' ? 'వైద్యులు:' : currentLang === 'hi' ? 'डॉक्टर:' : 'Doctor:'} {rx.doctorName} ({rx.hospitalName})
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setSelectedPrescription(rx)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        background: '#059669',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                      }}
                    >
                      {currentLang === 'te'
                        ? '🖨️ పూర్తి చీటీ చూడండి (View & Print Rx)'
                        : currentLang === 'hi'
                        ? '🖨️ पूरा पर्चा देखें (View & Print Rx)'
                        : '🖨️ View & Print Prescription (Rx)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTextFormatPrescriptionId(textFormatPrescriptionId === (rx.prescriptionId || String(idx)) ? null : (rx.prescriptionId || String(idx)))}
                      style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                      {currentLang === 'te' ? 'పాఠ్య రూపం' : currentLang === 'hi' ? 'टेक्स्ट प्रारूप' : 'Text format'}
                    </button>
                    </div>
                  </div>

                  {/* Medicines Summary */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 700, marginBottom: '6px' }}>
                      {currentLang === 'te' ? 'సూచించిన మందులు (Medicines):' : currentLang === 'hi' ? 'निर्धारित दवाएं (Medicines):' : 'Prescribed Medicines:'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {rx.medicines.map((m: any, mIdx: number) => (
                        <div
                          key={mIdx}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontSize: '0.78rem',
                            color: '#f8fafc',
                          }}
                        >
                          <strong>{m.medicineName}</strong> • <span style={{ color: '#38bdf8' }}>{m.dosage}</span> ({m.frequency})
                        </div>
                      ))}
                    </div>
                  </div>
                  <section className="patient-prescription-voice" aria-label="Prescription read aloud">
                    <div className="patient-prescription-voice-copy">
                      <p className="patient-home-card-kicker">PRESCRIPTION VOICE-OVER</p>
                      <h4>Read the prescription aloud</h4>
                      <p>This reads the clinician’s prescription wording verbatim. It does not change medicines or doses.</p>
                      <div className="patient-prescription-transcript"><strong>Transcript</strong><p>{prescriptionSpeechText(rx)}</p></div>
                    </div>
                    <div className="patient-prescription-voice-controls">
                      <label>Language<select value={prescriptionSpeechLanguage} onChange={(event) => setPrescriptionSpeechLanguage(event.target.value as 'en' | 'te' | 'hi')}><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option></select></label>
                      <label>Speed<select value={prescriptionSpeechRate} onChange={(event) => setPrescriptionSpeechRate(Number(event.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option></select></label>
                      <div className="patient-prescription-voice-buttons">
                        <button type="button" onClick={() => speakText(prescriptionSpeechText(rx), { language: prescriptionSpeechLanguage, rate: prescriptionSpeechRate })}>Play</button>
                        <button type="button" onClick={() => window.speechSynthesis?.pause()}>Pause</button>
                        <button type="button" onClick={() => window.speechSynthesis?.cancel()}>Stop</button>
                      </div>
                      <button type="button" className="patient-home-text-link" onClick={() => void startTreatmentTracking(rx)} disabled={treatmentSaving}>Start treatment tracking →</button>
                    </div>
                  </section>
                  {textFormatPrescriptionId === (rx.prescriptionId || String(idx)) && (
                    <div style={{ marginTop: 8, padding: 12, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <strong>{currentLang === 'te' ? 'ప్రిస్క్రిప్షన్ — పాఠ్య రూపం' : currentLang === 'hi' ? 'प्रिस्क्रिप्शन — टेक्स्ट प्रारूप' : 'Prescription — Text Format'}</strong>
                        <button type="button" onClick={() => void navigator.clipboard?.writeText(prescriptionAsText(rx, patientName, patientId))} style={{ cursor: 'pointer' }}>
                          {currentLang === 'te' ? 'పాఠ్యాన్ని కాపీ చేయండి' : currentLang === 'hi' ? 'टेक्स्ट कॉपी करें' : 'Copy text'}
                        </button>
                      </div>
                      <pre style={{ margin: 0, padding: 10, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: '0.84rem', color: 'var(--text-primary)' }}>{prescriptionAsText(rx, patientName, patientId)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: HEALTH HISTORY (Module 1 & 6) -------------------- */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <h3 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '1.2rem', fontWeight: 800 }}>
              {currentLang === 'te'
                ? '📜 నా వైద్య & స్క్రీనింగ్ చరిత్ర (Medical History Timeline)'
                : currentLang === 'hi'
                ? '📜 मेरा चिकित्सा एवं स्क्रीनिंग इतिहास (Medical History Timeline)'
                : '📜 My Medical & Screening History Timeline'}
            </h3>
            {screeningHistoryLoading && <p role="status">Loading saved reports…</p>}
            {screeningHistoryError && <p className="patient-inline-error" role="alert">{screeningHistoryError}</p>}
            {screeningHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📂</div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '1rem', marginBottom: '4px' }}>
                  {currentLang === 'te' ? 'ఇంకా ఎటువంటి స్క్రీనింగ్ ఫోటోలు అప్‌లోడ్ చేయలేదు' : 'No Screening Photos Uploaded Yet'}
                </div>
                <p style={{ margin: '0 auto', maxWidth: '440px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                  {currentLang === 'te'
                    ? 'హోమ్ ట్యాబ్‌లో కెమెరా ద్వారా లైవ్ ఫోటో తీయండి లేదా ఫోటో అప్‌లోడ్ చేయండి. మీ నిజ-సమయ స్క్రీనింగ్ ఫలితాలు ఇక్కడ రికార్డ్ అవుతాయి.'
                    : 'Capture a live oral photo or choose a photo on the Health Home tab. Real-time screening inferences and doctor findings will be saved to your timeline.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {screeningHistory.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderLeft: '4px solid #10b981',
                      display: 'flex',
                      gap: '16px',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt="Uploaded screening thumbnail"
                        style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                        <span>📅 {item.date} {item.time ? `• ${item.time}` : ''}</span>
                        <span style={{ color: '#10b981', fontWeight: 700 }}>● {item.status || 'AI Analyzed'}</span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '4px', fontSize: '0.95rem' }}>
                        {item.label ? `Oral Triage: ${item.label.toUpperCase()}` : 'Oral Mucosa Visual Screening'}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#cbd5e1' }}>
                        {item.notes || 'Real-time uploaded oral image evaluated.'}
                      </p>
                      {item.confidence && (
                        <div style={{ fontSize: '0.74rem', color: '#38bdf8', marginTop: '6px' }}>
                          Model Confidence: <strong>{item.confidence}%</strong>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="dash-btn dash-btn-outline"
                      onClick={() => {
                        const reportId = item.id || `screening-${idx}`;
                        window.location.hash = `#/patient/screening/${encodeURIComponent(reportId)}/report`;
                      }}
                    >
                      {currentLang === 'te' ? 'నివేదిక చూడండి' : currentLang === 'hi' ? 'रिपोर्ट देखें' : 'View report'}
                    </button>
                    {!item.remote && <button
                      type="button"
                      aria-label={`Delete screening record from this device: ${item.date || item.id || idx + 1}`}
                      onClick={() => removeScreeningRecord(item.id, idx)}
                      style={{
                        border: '1px solid #dc2626',
                        background: 'rgba(220, 38, 38, 0.12)',
                        color: '#b91c1c',
                        borderRadius: '8px',
                        padding: '7px 11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WEBRTC LIVE VIDEO CONSULTATION MODAL (Module 4) */}
      {/* PRINTABLE DIGITAL PRESCRIPTION CARD VIEW (Module 6 & 7) */}
      {selectedPrescription && (
        <PrescriptionCardView
          prescription={selectedPrescription}
          currentLang={currentLang}
          onClose={() => setSelectedPrescription(null)}
        />
      )}

      </div>
      <footer className="patient-global-footer">AI suggestions are not a medical diagnosis; consult a doctor.</footer>
      </main>
    </div>
  );
};

export default PatientDashboard;

