import React, { useEffect, useMemo, useState } from 'react';

export interface PatientAppointmentSummary {
  appointmentId: string;
  appointmentCode?: string;
  patientName?: string;
  assignedDoctorName?: string;
  assignedDoctorId?: string;
  department?: string;
  destinationHospitalName?: string;
  slotStartTime: string;
  slotEndTime?: string;
  status: string;
  consultationMode?: 'online' | 'offline';
  proposedReschedule?: { status?: string; newSlotStart?: string; reason?: string };
  amountPaid?: number;
  payment?: { amountPaid?: number; status?: string };
}

export interface PatientAvailableDoctor {
  userId: string;
  name: string;
  specialization?: string;
  hospitalId: string;
  hospitalName: string;
  availableSlotsCount: number;
}

export interface PatientRecentReport {
  id?: string;
  label?: string;
  date?: string;
  time?: string;
  notes?: string;
}

interface PatientHomeOverviewProps {
  patientName: string;
  patientId: string;
  currentLang: string;
  appointments: PatientAppointmentSummary[];
  appointmentsLoading: boolean;
  appointmentsError: string;
  doctors: PatientAvailableDoctor[];
  doctorsLoading: boolean;
  doctorsError: string;
  profileCompletion: number;
  recentReports: PatientRecentReport[];
  treatmentProgress: number;
  hasPrescription: boolean;
  hasTreatmentActivity: boolean;
  remindersCount: number | null;
  nextReminderTitle: string;
  onNavigate: (tab: 'profile' | 'screening' | 'assessment' | 'consultation' | 'appointments' | 'history' | 'treatment' | 'reminders' | 'help') => void;
  onOpenReport: (report: PatientRecentReport, index: number) => void;
  onListenReport: (report: PatientRecentReport) => void;
}

const copy = {
  en: {
    tools: 'PATIENT PORTAL', welcome: 'Welcome back', subtitle: 'Your appointments and care records, together in one place.', profile: 'Profile', complete: 'complete',
    bookHeadline: 'Need to find a doctor? Go online with us!', bookSub: 'Choose an available clinician and request an appointment.', book: 'Book appointment', illustration: 'Illustration placeholder',
    total: 'Total bookings', successful: 'Successful bookings', cancelled: 'Cancelled bookings', paid: 'Paid amount', noPayment: 'No payment records',
    upcoming: 'Upcoming appointments', latest: 'Latest appointment', earliest: 'Earliest appointment', profileCol: 'Patient / clinician', service: 'Service', dateTime: 'Date & time', action: 'Actions',
    noAppointments: 'No upcoming appointments', noAppointmentsSub: 'Appointments you book will appear here.', search: 'Search appointments and doctors', clearDate: 'Clear date filter',
    available: 'Available doctors', noDoctors: 'No clinicians with availability right now.', noDoctorsErr: 'Clinician availability could not be loaded.', slots: 'available times', choose: 'Book',
    date: 'Date', selected: 'Selected appointment', noneSelected: 'Select an appointment date to see its details.', open: 'View details', cancel: 'Cancel appointment', accept: 'Accept new time',
    online: 'Online consultation', offline: 'Clinic visit', requested: 'Requested', confirmed: 'Confirmed', rescheduled: 'Rescheduled', completed: 'Completed', checked_in: 'Checked in', cancelledStatus: 'Cancelled', declined: 'Declined', noShow: 'No show',
    openSuccess: 'Appointment details selected.', cancelSuccess: 'Appointment cancelled.', acceptSuccess: 'New appointment time accepted.', actionError: 'The appointment could not be updated.', cancelPrompt: 'Please tell us why you are cancelling this appointment.', previous: 'Previous month', next: 'Next month', goToday: 'Today',
    reports: 'Recent reports', viewAll: 'View all', reportEmpty: 'No reports are saved on this device yet.', listen: 'Listen', openReport: 'Open', careJourney: 'Your care journey', screening: 'Screening', assessment: 'DEMO AI review', consultation: 'Consultation', prescription: 'Prescription', treatment: 'Treatment', current: 'Current step', upcomingStep: 'Upcoming', done: 'Done',
    quickSearch: 'Search', notifications: 'Notifications', careDisclaimer: 'AI suggestions are not a medical diagnosis; consult a doctor.',
    join: 'Join call',
  },
  te: {
    tools: 'రోగి పోర్టల్', welcome: 'తిరిగి స్వాగతం', subtitle: 'మీ అపాయింట్‌మెంట్‌లు మరియు ఆరోగ్య రికార్డులు ఒకే చోట.', profile: 'ప్రొఫైల్', complete: 'పూర్తి',
    bookHeadline: 'వైద్యుడిని సంప్రదించాలా? ఆన్‌లైన్‌లో బుక్ చేయండి.', bookSub: 'అందుబాటులో ఉన్న వైద్యుడిని ఎంచుకుని అపాయింట్‌మెంట్ కోరండి.', book: 'అపాయింట్‌మెంట్ బుక్ చేయండి', illustration: 'చిత్రం కోసం స్థలం',
    total: 'మొత్తం అపాయింట్‌మెంట్‌లు', successful: 'పూర్తైనవి', cancelled: 'రద్దైనవి', paid: 'చెల్లించిన మొత్తం', noPayment: 'చెల్లింపు రికార్డులు లేవు',
    upcoming: 'రాబోయే అపాయింట్‌మెంట్‌లు', latest: 'తాజా అపాయింట్‌మెంట్', earliest: 'ముందరి అపాయింట్‌మెంట్', profileCol: 'రోగి / వైద్యుడు', service: 'సేవ', dateTime: 'తేదీ & సమయం', action: 'చర్యలు',
    noAppointments: 'రాబోయే అపాయింట్‌మెంట్‌లు లేవు', noAppointmentsSub: 'మీరు బుక్ చేసే అపాయింట్‌మెంట్‌లు ఇక్కడ కనిపిస్తాయి.', search: 'అపాయింట్‌మెంట్‌లు, వైద్యులను వెతకండి', clearDate: 'తేదీ ఫిల్టర్ తొలగించండి',
    available: 'అందుబాటులో ఉన్న వైద్యులు', noDoctors: 'ప్రస్తుతం అందుబాటులో ఉన్న వైద్యులు లేరు.', noDoctorsErr: 'వైద్యుల వివరాలు లోడ్ కాలేదు.', slots: 'సమయాలు అందుబాటులో', choose: 'బుక్ చేయండి',
    date: 'తేదీ', selected: 'ఎంచుకున్న అపాయింట్‌మెంట్', noneSelected: 'వివరాల కోసం అపాయింట్‌మెంట్ తేదీని ఎంచుకోండి.', open: 'వివరాలు చూడండి', cancel: 'రద్దు చేయండి', accept: 'కొత్త సమయాన్ని అంగీకరించండి',
    online: 'ఆన్‌లైన్ సంప్రదింపు', offline: 'క్లినిక్ సందర్శన', requested: 'కోరబడింది', confirmed: 'నిర్ధారించబడింది', rescheduled: 'సమయం మార్చబడింది', completed: 'పూర్తయింది', checked_in: 'చెక్-ఇన్ అయింది', cancelledStatus: 'రద్దయింది', declined: 'తిరస్కరించబడింది', noShow: 'హాజరు కాలేదు',
    openSuccess: 'అపాయింట్‌మెంట్ వివరాలు ఎంచుకున్నారు.', cancelSuccess: 'అపాయింట్‌మెంట్ రద్దయింది.', acceptSuccess: 'కొత్త సమయం అంగీకరించబడింది.', actionError: 'అపాయింట్‌మెంట్‌ను అప్‌డేట్ చేయలేకపోయాం.', cancelPrompt: 'ఈ అపాయింట్‌మెంట్‌ను రద్దు చేయడానికి కారణం చెప్పండి.', previous: 'గత నెల', next: 'తదుపరి నెల', goToday: 'ఈ రోజు',
    reports: 'ఇటీవలి నివేదికలు', viewAll: 'అన్నీ చూడండి', reportEmpty: 'ఈ పరికరంలో నివేదికలు లేవు.', listen: 'వినండి', openReport: 'తెరవండి', careJourney: 'మీ సంరక్షణ ప్రయాణం', screening: 'స్క్రీనింగ్', assessment: 'DEMO AI సమీక్ష', consultation: 'సంప్రదింపు', prescription: 'ప్రిస్క్రిప్షన్', treatment: 'చికిత్స', current: 'ప్రస్తుత దశ', upcomingStep: 'తదుపరి', done: 'పూర్తయింది',
    quickSearch: 'వెతకండి', notifications: 'నోటిఫికేషన్‌లు', careDisclaimer: 'AI సూచనలు వైద్య నిర్ధారణ కావు; వైద్యుడిని సంప్రదించండి.',
    join: 'కాల్‌లో చేరండి',
  },
  hi: {
    tools: 'रोगी पोर्टल', welcome: 'वापसी पर स्वागत है', subtitle: 'आपकी अपॉइंटमेंट और स्वास्थ्य रिकॉर्ड एक ही जगह।', profile: 'प्रोफ़ाइल', complete: 'पूर्ण',
    bookHeadline: 'डॉक्टर ढूँढ रहे हैं? ऑनलाइन अपॉइंटमेंट लें।', bookSub: 'उपलब्ध चिकित्सक चुनें और अपॉइंटमेंट का अनुरोध करें।', book: 'अपॉइंटमेंट बुक करें', illustration: 'चित्र के लिए स्थान',
    total: 'कुल अपॉइंटमेंट', successful: 'पूरी हुई अपॉइंटमेंट', cancelled: 'रद्द अपॉइंटमेंट', paid: 'भुगतान राशि', noPayment: 'भुगतान रिकॉर्ड नहीं',
    upcoming: 'आगामी अपॉइंटमेंट', latest: 'नवीनतम अपॉइंटमेंट', earliest: 'सबसे पहले अपॉइंटमेंट', profileCol: 'रोगी / चिकित्सक', service: 'सेवा', dateTime: 'तारीख और समय', action: 'कार्रवाई',
    noAppointments: 'कोई आगामी अपॉइंटमेंट नहीं', noAppointmentsSub: 'बुक की गई अपॉइंटमेंट यहाँ दिखेंगी।', search: 'अपॉइंटमेंट और डॉक्टर खोजें', clearDate: 'तारीख फ़िल्टर हटाएँ',
    available: 'उपलब्ध चिकित्सक', noDoctors: 'अभी कोई चिकित्सक उपलब्ध नहीं है।', noDoctorsErr: 'चिकित्सक उपलब्धता लोड नहीं हुई।', slots: 'उपलब्ध समय', choose: 'बुक करें',
    date: 'तारीख', selected: 'चुनी गई अपॉइंटमेंट', noneSelected: 'विवरण देखने के लिए अपॉइंटमेंट की तारीख चुनें।', open: 'विवरण देखें', cancel: 'अपॉइंटमेंट रद्द करें', accept: 'नया समय स्वीकारें',
    online: 'ऑनलाइन परामर्श', offline: 'क्लिनिक भेंट', requested: 'अनुरोध किया', confirmed: 'पुष्टि हुई', rescheduled: 'समय बदला', completed: 'पूरी हुई', checked_in: 'चेक-इन हुआ', cancelledStatus: 'रद्द हुई', declined: 'अस्वीकार हुई', noShow: 'नहीं आए',
    openSuccess: 'अपॉइंटमेंट विवरण चुना गया।', cancelSuccess: 'अपॉइंटमेंट रद्द हुई।', acceptSuccess: 'नया समय स्वीकार हुआ।', actionError: 'अपॉइंटमेंट अपडेट नहीं हुई।', cancelPrompt: 'अपॉइंटमेंट रद्द करने का कारण बताएँ।', previous: 'पिछला महीना', next: 'अगला महीना', goToday: 'आज',
    reports: 'हाल की रिपोर्ट', viewAll: 'सभी देखें', reportEmpty: 'इस डिवाइस पर कोई रिपोर्ट नहीं है।', listen: 'सुनें', openReport: 'खोलें', careJourney: 'आपकी देखभाल यात्रा', screening: 'स्क्रीनिंग', assessment: 'DEMO AI समीक्षा', consultation: 'परामर्श', prescription: 'प्रिस्क्रिप्शन', treatment: 'देखभाल', current: 'वर्तमान चरण', upcomingStep: 'आगामी', done: 'पूरा',
    quickSearch: 'खोजें', notifications: 'सूचनाएँ', careDisclaimer: 'AI सुझाव चिकित्सा निदान नहीं हैं; डॉक्टर से सलाह लें।',
    join: 'कॉल में जुड़ें',
  },
} as const;
type DashboardCopy = Record<keyof typeof copy.en, string>;

const iconPaths: Record<string, React.ReactNode> = {
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  check: <><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/></>,
  close: <><path d="m7 7 10 10M17 7 7 17"/><circle cx="12" cy="12" r="9"/></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18m-5 6h2"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4 4"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.5"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  left: <path d="m15 18-6-6 6-6"/>,
  right: <path d="m9 18 6-6-6-6"/>,
  leaf: <><path d="M20 4c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 10-6 9-16Z"/><path d="M4 20c3-5 7-8 12-11"/></>,
  inbox: <><path d="M4 4h16v16H4zM4 13h4l2 3h4l2-3h4"/></>,
};

const Icon: React.FC<{ name: keyof typeof iconPaths; size?: number }> = ({ name, size = 20 }) => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{iconPaths[name]}</svg>;
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const statusText = (status: string, labels: DashboardCopy) => ({ requested: labels.requested, confirmed: labels.confirmed, rescheduled: labels.rescheduled, completed: labels.completed, checked_in: labels.checked_in, cancelled: labels.cancelledStatus, declined: labels.declined, no_show: labels.noShow }[status.toLowerCase()] || status.replace(/_/g, ' '));

export const PatientHomeOverview: React.FC<PatientHomeOverviewProps> = (props) => {
  const { patientName, patientId, currentLang, appointments, appointmentsLoading, appointmentsError, doctors, doctorsLoading, doctorsError, profileCompletion, recentReports, treatmentProgress, hasPrescription, hasTreatmentActivity, remindersCount, nextReminderTitle, onNavigate, onOpenReport, onListenReport } = props;
  const labels: DashboardCopy = copy[currentLang as keyof typeof copy] || copy.en;
  const locale = currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'latest' | 'earliest'>('latest');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim().toLocaleLowerCase()), 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { const timer = window.setInterval(() => setClockNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  const upcoming = useMemo(() => appointments.filter((item) => ['requested', 'confirmed', 'rescheduled', 'checked_in'].includes(item.status.toLowerCase()) && new Date(item.slotStartTime).getTime() >= Date.now()), [appointments]);
  const matchingAppointments = useMemo(() => upcoming.filter((item) => {
    const searchable = `${item.assignedDoctorName || ''} ${item.department || ''} ${item.destinationHospitalName || ''} ${item.consultationMode || ''} ${item.appointmentCode || ''}`.toLocaleLowerCase();
    return (!query || searchable.includes(query)) && (!selectedDate || dateKey(new Date(item.slotStartTime)) === selectedDate);
  }).sort((a, b) => sortOrder === 'latest' ? new Date(b.slotStartTime).getTime() - new Date(a.slotStartTime).getTime() : new Date(a.slotStartTime).getTime() - new Date(b.slotStartTime).getTime()), [upcoming, query, selectedDate, sortOrder]);
  const matchingDoctors = useMemo(() => doctors.filter((doctor) => `${doctor.name} ${doctor.specialization || ''} ${doctor.hospitalName}`.toLocaleLowerCase().includes(query)), [doctors, query]);
  const completedCount = appointments.filter((item) => item.status.toLowerCase() === 'completed').length;
  const cancelledCount = appointments.filter((item) => ['cancelled', 'declined'].includes(item.status.toLowerCase())).length;
  const paidAmount = appointments.reduce((sum, item) => sum + Number(item.payment?.amountPaid ?? item.amountPaid ?? 0), 0);
  const hasPaymentData = appointments.some((item) => item.payment?.amountPaid !== undefined || item.amountPaid !== undefined);
  const selectedAppointment = selectedDate
    ? upcoming.find((item) => dateKey(new Date(item.slotStartTime)) === selectedDate && (!selectedAppointmentId || item.appointmentId === selectedAppointmentId)) || upcoming.find((item) => dateKey(new Date(item.slotStartTime)) === selectedDate)
    : upcoming.find((item) => item.appointmentId === selectedAppointmentId) || upcoming[0];

  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const mondayOffset = (first.getDay() + 6) % 7;
    return [...Array(mondayOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  }, [month]);
  const appointmentsByDate = useMemo(() => new Set(upcoming.map((item) => dateKey(new Date(item.slotStartTime)))), [upcoming]);

  const actOnAppointment = async (appointment: PatientAppointmentSummary, action: 'cancel' | 'accept', reason?: string) => {
    setActionError('');
    try {
      const token = (() => { try { return JSON.parse(localStorage.getItem('aarogya_tokens') || '{}').accessToken || localStorage.getItem('aarogya_token') || ''; } catch { return localStorage.getItem('aarogya_token') || ''; } })();
      const mutationId = crypto.randomUUID();
      const response = await fetch(`/api/v1/appointments/${encodeURIComponent(appointment.appointmentId)}/${action === 'cancel' ? 'cancel' : 'respond-new-time'}`, {
        method: action === 'cancel' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(action === 'cancel' ? { reason: reason || labels.cancelPrompt, mutationId } : { accept: true, mutationId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || labels.actionError);
      setToast(action === 'cancel' ? labels.cancelSuccess : labels.acceptSuccess);
      window.dispatchEvent(new CustomEvent('patient-appointments-refresh'));
    } catch (error) { setActionError(error instanceof Error ? error.message : labels.actionError); }
  };

  const handleCancel = (appointment: PatientAppointmentSummary) => {
    const reason = window.prompt(labels.cancelPrompt);
    if (reason?.trim()) void actOnAppointment(appointment, 'cancel', reason.trim());
  };

  const goToDoctorBooking = (doctor: PatientAvailableDoctor) => {
    try { sessionStorage.setItem('patient_booking_doctor_id', doctor.userId); } catch { /* storage can be unavailable */ }
    window.location.hash = `#/patient/consult/${encodeURIComponent(doctor.userId)}`;
  };

  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (value: string) => new Date(value).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const displayName = (name?: string) => name || (currentLang === 'te' ? 'వైద్యుడు కేటాయించలేదు' : currentLang === 'hi' ? 'चिकित्सक निर्धारित नहीं' : 'Doctor to be confirmed');
  const canJoinSelected = Boolean(selectedAppointment?.consultationMode === 'online' && ['confirmed', 'rescheduled', 'checked_in'].includes(selectedAppointment.status.toLowerCase()) && clockNow >= new Date(selectedAppointment.slotStartTime).getTime() - 15 * 60_000 && clockNow <= new Date(selectedAppointment.slotEndTime || selectedAppointment.slotStartTime).getTime() + 60 * 60_000);
  const canJoinAppointment = (appointment: PatientAppointmentSummary) => appointment.consultationMode === 'online' && ['confirmed', 'rescheduled', 'checked_in'].includes(appointment.status.toLowerCase()) && clockNow >= new Date(appointment.slotStartTime).getTime() - 15 * 60_000 && clockNow <= new Date(appointment.slotEndTime || appointment.slotStartTime).getTime() + 60 * 60_000;
  const journeySteps = [
    { label: labels.screening, done: recentReports.length > 0 },
    { label: labels.assessment, done: recentReports.length > 0 },
    { label: labels.consultation, done: appointments.some((item) => item.status.toLowerCase() === 'completed') },
    { label: labels.prescription, done: hasPrescription },
    { label: labels.treatment, done: hasTreatmentActivity },
  ];
  const currentJourneyStep = Math.max(0, journeySteps.findIndex((step) => !step.done));

  return <section className="patient-home-v2" aria-labelledby="patient-home-title">
    <header className="patient-v2-topbar">
      <div><span className="patient-v2-kicker">{labels.tools}</span><p>{currentLang === 'te' ? `నమస్కారం, ${patientName}` : currentLang === 'hi' ? `नमस्ते, ${patientName}` : `Hi ${patientName}`}</p><h1 id="patient-home-title">{labels.welcome}</h1><small>{labels.subtitle}</small></div>
      <div className="patient-v2-top-actions">
        <label className="patient-v2-search"><Icon name="search" /><span className="sr-only">{labels.quickSearch}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} /></label>
        <button type="button" className="patient-v2-bell" aria-label={labels.notifications} title={nextReminderTitle || labels.notifications} onClick={() => onNavigate('reminders')}><Icon name="bell" />{remindersCount ? <span>{remindersCount}</span> : null}</button>
      </div>
    </header>

    <div className="patient-v2-profile-progress"><div><span>{labels.profile}</span><strong>{profileCompletion}% {labels.complete}</strong></div><progress value={profileCompletion} max="100" aria-label={`${labels.profile} ${profileCompletion}% ${labels.complete}`} /><small>{patientId}</small></div>

    <p className="patient-v2-demo-call-notice" role="note"><strong>DEMO VIDEO CONSULTATION</strong> — Join an online appointment during its scheduled window after the doctor starts the call. Camera and microphone access are required.</p>
    <section className="patient-v2-hero" aria-label={labels.bookHeadline}>
      <div><p className="patient-v2-kicker">{labels.tools}</p><h2>{labels.bookHeadline}</h2><p>{labels.bookSub}</p><button type="button" onClick={() => onNavigate('appointments')}>{labels.book}<Icon name="chevron" size={18} /></button></div>
      <div className="patient-v2-hero-placeholder" role="img" aria-label={labels.illustration}><span className="patient-v2-hero-orbit" /><span className="patient-v2-hero-cross">+</span><span className="patient-v2-hero-eye"><Icon name="leaf" size={46} /></span><small>{labels.illustration}</small></div>
    </section>

    <section className="patient-v2-stats" aria-label={labels.tools}>
      {appointmentsLoading ? [...Array(4)].map((_, index) => <div className="patient-v2-stat patient-v2-skeleton" key={index} aria-label="Loading summary" />) : <>
        <article className="patient-v2-stat stat-total"><span><Icon name="calendar" /></span><div><strong>{appointmentsError ? '—' : appointments.length}</strong><small>{labels.total}</small></div></article>
        <article className="patient-v2-stat stat-success"><span><Icon name="check" /></span><div><strong>{appointmentsError ? '—' : completedCount}</strong><small>{labels.successful}</small></div></article>
        <article className="patient-v2-stat stat-cancelled"><span><Icon name="close" /></span><div><strong>{appointmentsError ? '—' : cancelledCount}</strong><small>{labels.cancelled}</small></div></article>
        <article className="patient-v2-stat stat-paid"><span><Icon name="wallet" /></span><div><strong>{appointmentsError || !hasPaymentData ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paidAmount)}</strong><small>{hasPaymentData ? labels.paid : labels.noPayment}</small></div></article>
      </>}
    </section>

    <div className="patient-v2-main-grid">
      <div className="patient-v2-left-column">
        <section className="patient-v2-card patient-v2-appointments" aria-labelledby="patient-v2-appointments-title">
          <div className="patient-v2-card-header"><div><span className="patient-v2-kicker">{labels.tools}</span><h2 id="patient-v2-appointments-title">{labels.upcoming}</h2></div><label className="patient-v2-sort"><span className="sr-only">{labels.latest}</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'latest' | 'earliest')}><option value="latest">{labels.latest}</option><option value="earliest">{labels.earliest}</option></select></label></div>
          {selectedDate && <button type="button" className="patient-v2-clear-filter" onClick={() => setSelectedDate('')}>{labels.clearDate} · {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(locale)}</button>}
          {appointmentsLoading ? <div className="patient-v2-table-skeleton" role="status"><span /><span /><span /></div> : appointmentsError ? <div className="patient-v2-empty" role="alert">{appointmentsError}</div> : matchingAppointments.length === 0 ? <div className="patient-v2-empty"><span aria-hidden="true"><Icon name="calendar" size={28} /></span><strong>{labels.noAppointments}</strong><p>{labels.noAppointmentsSub}</p><button type="button" onClick={() => onNavigate('appointments')}>{labels.book}</button></div> : <div className="patient-v2-table-wrap"><table className="patient-v2-table"><thead><tr><th>{labels.profileCol}</th><th>{labels.service}</th><th>{labels.dateTime}</th><th>{labels.action}</th></tr></thead><tbody>{matchingAppointments.map((appointment) => {
            const active = selectedAppointment?.appointmentId === appointment.appointmentId;
            return <tr key={appointment.appointmentId} className={active ? 'selected' : ''}>
              <td data-label={labels.profileCol}><div className="patient-v2-person"><span>{displayName(appointment.assignedDoctorName).split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{displayName(appointment.assignedDoctorName)}</strong><small className={`patient-v2-status status-${appointment.status.toLowerCase()}`}>{statusText(appointment.status, labels)}</small></div></div></td>
              <td data-label={labels.service}><strong>{appointment.department || labels.online}</strong><small>{appointment.consultationMode === 'online' ? labels.online : labels.offline}</small></td>
              <td data-label={labels.dateTime}><strong>{formatDate(appointment.slotStartTime)}</strong><small>{formatTime(appointment.slotStartTime)}</small></td>
              <td data-label={labels.action}><div className="patient-v2-row-actions"><button type="button" aria-label={`${labels.open}: ${displayName(appointment.assignedDoctorName)}`} title={labels.open} onClick={() => { setSelectedAppointmentId(appointment.appointmentId); setToast(labels.openSuccess); }}><Icon name="eye" size={17} /></button>{canJoinAppointment(appointment) && <button type="button" className="patient-v2-join-button" onClick={() => { window.location.hash = `#/consultation/webrtc/${encodeURIComponent(appointment.appointmentId)}`; }}>{labels.join}</button>}<button type="button" aria-label={`${labels.cancel}: ${displayName(appointment.assignedDoctorName)}`} title={labels.cancel} onClick={() => handleCancel(appointment)}><Icon name="close" size={17} /></button>{appointment.proposedReschedule?.status === 'pending' ? <button type="button" aria-label={labels.accept} title={labels.accept} onClick={() => void actOnAppointment(appointment, 'accept')}><Icon name="check" size={17} /></button> : <button type="button" className="is-disabled" aria-label={labels.accept} title={labels.accept} disabled><Icon name="check" size={17} /></button>}</div></td>
            </tr>;
          })}</tbody></table></div>}
          {actionError && <p className="patient-v2-error" role="alert">{actionError}</p>}
          {toast && <p className="patient-v2-toast" role="status" aria-live="polite">{toast}</p>}
        </section>

        <section className="patient-v2-card" aria-labelledby="patient-v2-doctors-title">
          <div className="patient-v2-card-header"><div><span className="patient-v2-kicker">{labels.tools}</span><h2 id="patient-v2-doctors-title">{labels.available}</h2></div><button type="button" className="patient-v2-link-button" onClick={() => onNavigate('assessment')}>{labels.viewAll}<Icon name="chevron" size={17} /></button></div>
          {doctorsLoading ? <div className="patient-v2-doctor-skeletons" role="status"><span /><span /><span /></div> : doctorsError ? <p className="patient-v2-error" role="alert">{labels.noDoctorsErr}</p> : matchingDoctors.length === 0 ? <div className="patient-v2-empty"><p>{labels.noDoctors}</p></div> : <div className="patient-v2-doctor-row">{matchingDoctors.slice(0, 6).map((doctor) => <article className="patient-v2-doctor" key={doctor.userId}><span className="patient-v2-doctor-avatar">{doctor.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><strong>{doctor.name}</strong><small>{doctor.specialization || labels.service}</small><small>{doctor.hospitalName}</small><span className="patient-v2-availability">{doctor.availableSlotsCount} {labels.slots}</span><button type="button" onClick={() => goToDoctorBooking(doctor)}>{labels.choose}</button></article>)}</div>}
        </section>

        <section className="patient-v2-card patient-v2-reports"><div className="patient-v2-card-header"><h2>{labels.reports}</h2><button type="button" className="patient-v2-link-button" onClick={() => onNavigate('history')}>{labels.viewAll}<Icon name="chevron" size={17} /></button></div>{recentReports.length === 0 ? <p className="patient-v2-empty-copy">{labels.reportEmpty}</p> : recentReports.slice(0, 3).map((report, index) => <article className="patient-v2-report-row" key={report.id || `${report.date}-${index}`}><div><strong>{report.label || labels.screening}</strong><small>{report.date || ''} {report.time || ''}</small></div><div><button type="button" onClick={() => onOpenReport(report, index)}>{labels.openReport}</button><button type="button" onClick={() => onListenReport(report)}>{labels.listen}</button></div></article>)}</section>
        <section className="patient-v2-card patient-v2-journey"><div className="patient-v2-card-header"><div><span className="patient-v2-kicker">{labels.tools}</span><h2>{labels.careJourney}</h2></div></div><ol>{journeySteps.map((step, index) => <li key={step.label} className={step.done ? 'done' : index === currentJourneyStep ? 'current' : 'upcoming'}><span>{step.done ? '✓' : index + 1}</span><div><strong>{step.label}</strong><small>{step.done ? labels.done : index === currentJourneyStep ? labels.current : labels.upcomingStep}</small></div></li>)}</ol></section>
      </div>

      <aside className="patient-v2-right-column">
        <section className="patient-v2-card patient-v2-calendar" aria-label={labels.date}>
          <div className="patient-v2-calendar-heading"><span className="patient-v2-kicker">{labels.date}</span><div><h2>{month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h2><div><button type="button" aria-label={labels.previous} onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><Icon name="left" /></button><button type="button" aria-label={labels.next} onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><Icon name="right" /></button></div></div></div>
          <div className="patient-v2-calendar-grid" role="grid" aria-label={month.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span role="columnheader" key={day}>{new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(`2024-01-${day === 'Mon' ? '01' : day === 'Tue' ? '02' : day === 'Wed' ? '03' : day === 'Thu' ? '04' : day === 'Fri' ? '05' : day === 'Sat' ? '06' : '07'}T12:00:00`)).slice(0, 2)}</span>)}{monthCells.map((day, index) => {
            if (!day) return <span key={`blank-${index}`} aria-hidden="true" />;
            const date = new Date(month.getFullYear(), month.getMonth(), day);
            const key = dateKey(date); const today = key === dateKey(new Date()); const chosen = selectedDate === key;
            return <button type="button" role="gridcell" key={key} aria-label={date.toLocaleDateString(locale, { dateStyle: 'full' })} aria-selected={chosen} className={`${today ? 'today' : ''}${chosen ? ' chosen' : ''}${appointmentsByDate.has(key) ? ' has-appointment' : ''}`} onClick={() => { setSelectedDate(key); const appointment = upcoming.find((item) => dateKey(new Date(item.slotStartTime)) === key); if (appointment) setSelectedAppointmentId(appointment.appointmentId); }}><span>{day}</span>{appointmentsByDate.has(key) && <i aria-hidden="true" />}</button>;
          })}</div>
          <div className="patient-v2-calendar-divider" />
          <div className="patient-v2-selected-card"><div className="patient-v2-selected-icon"><Icon name="calendar" /></div><div className="patient-v2-selected-content"><span>{labels.selected}</span>{selectedAppointment ? <><strong>{selectedAppointment.slotStartTime ? new Date(selectedAppointment.slotStartTime).toLocaleDateString(locale, { weekday: 'long' }) : ''}, {selectedAppointment.slotStartTime ? new Date(selectedAppointment.slotStartTime).getDate() : ''}</strong><p>{displayName(selectedAppointment.assignedDoctorName)}</p><small>{selectedAppointment.department || labels.online}</small><span className="patient-v2-time-chip">{formatTime(selectedAppointment.slotStartTime)} · {statusText(selectedAppointment.status, labels)}</span>{canJoinSelected && <button type="button" className="patient-v2-join-button" onClick={() => { window.location.hash = `#/consultation/webrtc/${encodeURIComponent(selectedAppointment.appointmentId)}`; }}>{labels.join}</button>}</> : <p>{labels.noneSelected}</p>}</div>{selectedAppointment && <button type="button" aria-label={labels.open} onClick={() => setSelectedAppointmentId(selectedAppointment.appointmentId)}><Icon name="chevron" /></button>}</div>
          {appointmentsLoading && <div className="patient-v2-calendar-loading" role="status">{labels.upcoming}…</div>}{appointmentsError && <p className="patient-v2-error" role="alert">{appointmentsError}</p>}
        </section>

        <section className="patient-v2-card patient-v2-progress"><div className="patient-v2-card-header"><h2>{labels.treatment}</h2><button type="button" className="patient-v2-link-button" onClick={() => onNavigate('treatment')}>{labels.viewAll}<Icon name="chevron" size={17} /></button></div><div className="patient-v2-progress-value">{treatmentProgress}%</div><progress value={treatmentProgress} max="100" aria-label={`${labels.treatment} ${treatmentProgress}%`} /><p>{labels.careDisclaimer}</p></section>
      </aside>
    </div>
  </section>;
};
