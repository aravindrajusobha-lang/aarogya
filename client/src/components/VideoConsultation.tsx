import React, { useEffect, useRef, useState } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { getClientTranslation, translations, type LanguageCode } from '../i18n';

type Role = 'patient' | 'doctor';
const accessToken = () => { try { return JSON.parse(localStorage.getItem('aarogya_tokens') || '{}').accessToken || localStorage.getItem('aarogya_token') || ''; } catch { return localStorage.getItem('aarogya_token') || ''; } };
const isDemoSession = () => /^(demo_|mock_|offline_)/i.test(accessToken());
const openLiveSignIn = (role: Role) => {
  const returnRoute = window.location.hash.startsWith('#/consultation/') ? window.location.hash : role === 'doctor' ? '#/doctor' : '#/patient';
  sessionStorage.setItem('aarogya_post_login_route', returnRoute);
  window.location.hash = '#/login?liveVideo=true';
};
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken()}` });
let refreshInFlight: Promise<string | null> | null = null;
async function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const stored = JSON.parse(localStorage.getItem('aarogya_tokens') || '{}');
        if (!stored.refreshToken) return null;
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: stored.refreshToken }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success || !payload.data?.accessToken || !payload.data?.refreshToken) return null;
        const nextTokens = { ...stored, accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken, deviceSessionId: payload.data.deviceSessionId || stored.deviceSessionId };
        localStorage.setItem('aarogya_tokens', JSON.stringify(nextTokens));
        localStorage.setItem('aarogya_token', nextTokens.accessToken);
        return nextTokens.accessToken as string;
      } catch {
        return null;
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
async function api(path: string, init: RequestInit = {}) {
  if (isDemoSession()) throw new Error('DEMO_LOGIN_ONLY');
  const send = (token: string) => fetch(`/api/v1/consultations${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  let response = await send(accessToken());
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) response = await send(refreshedToken);
  }
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    if (response.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error(payload.error?.message || 'Consultation service is unavailable.');
  }
  return payload.data;
}

export const ConsultationPortalPanel: React.FC<{ role: Role; patientId?: string; currentLang?: string; initialDoctorId?: string; screeningId?: string }> = ({ role, patientId, currentLang = 'en', initialDoctorId, screeningId }) => {
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const [link, setLink] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]); const [doctorId, setDoctorId] = useState(initialDoctorId || '');
  const [consultationMode, setConsultationMode] = useState<'online' | 'offline'>('offline'); const [shareRecords, setShareRecords] = useState(false);
  const [bookDate, setBookDate] = useState(() => new Date().toISOString().slice(0, 10)); const [slots, setSlots] = useState<any[]>([]); const [slot, setSlot] = useState(''); const [booked, setBooked] = useState('');
  const [patientNote, setPatientNote] = useState('');
  const language = (['en', 'te', 'hi', 'ta', 'kn', 'ml'].includes(currentLang) ? currentLang : 'en') as LanguageCode;
  const t = (key: string) => getClientTranslation(translations[language], `teleconsultation.${key}`);
  const load = async () => { try { const data = await api(role === 'patient' ? '/appointments/my' : '/doctor/appointments'); setItems(data.appointments || []); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load appointments.'); } };
  const waitingCount = items.filter(item => role === 'doctor' && item.patientWaiting).length;
  useEffect(() => { if (isDemoSession()) { setError('DEMO_LOGIN_ONLY'); return; } void load(); const timer = window.setInterval(load, 5000); return () => window.clearInterval(timer); }, [role]);
  useEffect(() => { if (isDemoSession() || role !== 'patient' || !bookDate) return; fetch(`/api/v1/consultations/availability?date=${encodeURIComponent(bookDate)}`, { headers: headers() }).then(r => r.json()).then(p => { if (!p?.success) throw new Error(p?.error?.message || 'Doctor availability is unavailable.'); const availableDoctors = p.data?.doctors || []; setDoctors(availableDoctors); setDoctorId(initialDoctorId && availableDoctors.some((doctor: any) => doctor.userId === initialDoctorId) ? initialDoctorId : ''); setSlots([]); setSlot(''); }).catch(e => setError(e instanceof Error ? e.message : 'Doctor availability is unavailable.')); }, [role, bookDate, initialDoctorId]);
  const selectedDoctor = doctors.find(d => d.userId === doctorId);
  useEffect(() => { if (!selectedDoctor || !bookDate) { setSlots([]); return; } fetch(`/api/v1/consultations/availability/${encodeURIComponent(selectedDoctor.userId)}?date=${encodeURIComponent(bookDate)}`, { headers: headers() }).then(r => r.json()).then(p => { setSlots((p?.data?.slots || []).filter((s: any) => s.isAvailable && new Date(s.startTime).getTime() > Date.now())); setSlot(''); }).catch(() => setError('Available times are unavailable.')); }, [doctorId, bookDate]);
  const book = async (event: React.FormEvent) => { event.preventDefault(); const chosenSlot = slots.find(item => item.startTime === slot); if (!patientId || !selectedDoctor || !chosenSlot?.endTime) { setError('Choose a currently available doctor slot with a start and end time.'); return; } setBusy('booking'); setError(''); try { const mutationId = crypto.randomUUID(); const response = await fetch('/api/v1/appointments', { method: 'POST', headers: headers(), body: JSON.stringify({ patientId, destinationHospitalId: selectedDoctor.hospitalId, destinationHospitalName: selectedDoctor.hospitalName, assignedDoctorId: selectedDoctor.userId, assignedDoctorName: selectedDoctor.name, slotStartTime: chosenSlot.startTime, slotEndTime: chosenSlot.endTime, consultationMode, patientNote: patientNote.trim(), mutationId, ...(shareRecords && screeningId ? { screeningId } : {}), consentGiven: shareRecords, visitDetails: { shareReport: Boolean(shareRecords && screeningId), shareProfile: shareRecords, consentGivenAt: shareRecords ? new Date().toISOString() : undefined }, type: 'clinical_consultation', reason: `${consultationMode === 'online' ? 'Online' : 'Offline'} consultation appointment request`, idempotencyKey: mutationId }) }); const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error?.message || 'Appointment could not be booked.'); setBooked(data.data.appointment.appointmentId); setPatientNote(''); setSlot(''); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Appointment could not be booked.'); } finally { setBusy(''); } };
  const sendLink = async (id: string) => { setBusy(id); try { const data = await api(`/${encodeURIComponent(id)}/send-link`, { method: 'POST' }); setLink(data.link); await navigator.clipboard?.writeText(data.link).catch(() => undefined); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send the link.'); } finally { setBusy(''); } };
  const openLink = () => { if (link) window.location.hash = `#/consultation/join/${encodeURIComponent(new URL(link).hash.split('/').pop() || '')}`; };
  const joinAppointment = (id: string) => { window.location.hash = `#/consultation/webrtc/${encodeURIComponent(id)}`; };
  return <section className="consultation-portal">
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><h3 style={{ marginTop: 0 }}>{role === 'patient' ? 'Book a consultation' : 'Consultation appointments'}</h3>{role === 'doctor' && <strong role="status" aria-live="polite" style={{ padding: '6px 10px', borderRadius: 8, background: waitingCount ? '#dcfce7' : '#f1f5f9', color: waitingCount ? '#166534' : '#475569' }}>{waitingCount} patient{waitingCount === 1 ? '' : 's'} waiting</strong>}</header><p>Choose a date and verified doctor with free times. The appointment is submitted to the selected facility for confirmation.</p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error === 'SESSION_EXPIRED' ? t('directCallSessionExpired') : error === 'DEMO_LOGIN_ONLY' ? t('directCallDemoLogin') : error}</p>}{['SESSION_EXPIRED', 'DEMO_LOGIN_ONLY'].includes(error) && <button type="button" className="dash-btn dash-btn-outline" onClick={() => openLiveSignIn(role)}>{t('directCallSignIn')}</button>}{link && role === 'doctor' && <div><p>Link sent to the patient in-app and copied when clipboard access is available. SMS/email remain blocked by the simulation system.</p><button type="button" className="dash-btn dash-btn-primary" onClick={openLink}>Open consultation</button> <button type="button" className="dash-btn dash-btn-outline" onClick={() => navigator.clipboard?.writeText(link)}>Copy link</button></div>}
    {role === 'patient' && <div className="consultation-booking-flow"><label>1. Select a future date <input required type="date" value={bookDate} min={new Date().toISOString().slice(0,10)} onChange={e => { setBookDate(e.target.value); setBooked(''); }} /></label><div role="group" className="consultation-mode-picker" aria-label="Consultation mode"><button type="button" aria-pressed={consultationMode === 'offline'} onClick={() => setConsultationMode('offline')}>In-person</button><button type="button" aria-pressed={consultationMode === 'online'} onClick={() => setConsultationMode('online')}>Online video / audio</button></div>{consultationMode === 'online' && <p role="status">Camera and microphone are requested only in the doctor-confirmed appointment room.</p>}<div className="consultation-doctor-picker"><strong>2. Choose a doctor · {doctors.length} with free times</strong>{doctors.map(d => <button key={d.userId} type="button" onClick={() => { setDoctorId(d.userId); setBooked(''); }} aria-pressed={doctorId === d.userId}><span><strong>{d.name}</strong><small>{d.specialization || 'Clinical consultation'} · {d.hospitalName}</small></span><b>{d.availableSlotsCount} slots</b></button>)}</div>{selectedDoctor && <form onSubmit={book} className="consultation-booking-form"><label>3. Start and end time<select required value={slot} onChange={e => setSlot(e.target.value)} disabled={!slots.length}><option value="">Choose a time</option>{slots.map(s => <option key={s.startTime} value={s.startTime}>{new Date(s.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} – {new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</option>)}</select></label><label className="consultation-patient-note">Reason for consultation<textarea aria-label="Reason for consultation" value={patientNote} onChange={event => setPatientNote(event.target.value)} rows={2} maxLength={2000} /></label><label className="consultation-share-consent"><input type="checkbox" checked={shareRecords} onChange={e => setShareRecords(e.target.checked)} /> Share my profile and screening report with this doctor</label><button type="submit" className="dash-btn dash-btn-primary" disabled={busy === 'booking' || !slots.length}>{busy === 'booking' ? 'Booking…' : 'Send appointment request'}</button>{booked && <span role="status">Request sent. The doctor can accept, reschedule, or decline it.</span>}</form>}</div>}
    {!items.length && <p>No appointments are available here yet.</p>}
    {items.map(item => <article key={item.appointmentId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', padding: '12px 0' }}>
      <div><strong>{role === 'doctor' ? (item.patientName || `Patient ${String(item.patientId).slice(-5)}`) : (item.assignedDoctorName || item.destinationHospitalName || 'Assigned care team')}</strong><div>{new Date(item.slotStartTime).toLocaleString()} – {new Date(item.slotEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.status} · {item.consultationStatus || 'No video link yet'}</div>{role === 'doctor' && item.patientWaiting && <strong style={{ color: '#047857' }}>Patient waiting</strong>}</div>
      {role === 'doctor' ? <>
        {item.status === 'requested' && <button type="button" className="dash-btn dash-btn-primary" disabled={busy === item.appointmentId} onClick={async () => { setBusy(item.appointmentId); try { const response = await fetch(`/api/v1/appointments/${encodeURIComponent(item.appointmentId)}/confirm`, { method: 'POST', headers: headers() }); const payload = await response.json(); if (!response.ok || !payload.success) throw new Error(payload.error?.message || 'Appointment response failed.'); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Appointment response failed.'); } finally { setBusy(''); } }}>{busy === item.appointmentId ? 'Accepting…' : 'Accept Appointment'}</button>}
        {item.consultationMode === 'online' && ['confirmed','rescheduled','checked_in'].includes(item.status) && Date.now() >= new Date(item.slotStartTime).getTime() - 15 * 60_000 && Date.now() <= new Date(item.slotEndTime).getTime() + 60 * 60_000 && <button type="button" className="dash-btn dash-btn-primary" onClick={() => joinAppointment(item.appointmentId)}>Start video consultation</button>}
        {item.consultationMode !== 'online' && ['confirmed','rescheduled','checked_in'].includes(item.status) && !item.consultationStatus && <button type="button" className="dash-btn dash-btn-primary" disabled={busy === item.appointmentId} onClick={() => void sendLink(item.appointmentId)}>{busy === item.appointmentId ? 'Sending link…' : 'Send Video Link'}</button>}
        {item.consultationStatus === 'LINK_SENT' && <span role="status">Video link sent · waiting for patient</span>}
        {item.patientWaiting && ['WAITING','IN_CALL'].includes(item.consultationStatus) && <button type="button" className="dash-btn dash-btn-primary" disabled={busy === item.appointmentId} onClick={() => joinAppointment(item.appointmentId)}>{item.consultationStatus === 'IN_CALL' ? 'Rejoin Video Call' : 'Join Video Call'}</button>}
      </> : item.consultationMode === 'online' && item.consultationStarted && ['confirmed','rescheduled','checked_in'].includes(item.status) ? <button type="button" className="dash-btn dash-btn-primary" onClick={() => joinAppointment(item.appointmentId)}>Join video consultation</button> : role === 'patient' && item.consultationMode === 'online' && ['confirmed','rescheduled','checked_in'].includes(item.status) ? <span role="status">{item.consultationStatus === 'LINK_SENT' ? 'Your doctor will start the video consultation shortly.' : 'Your doctor will start the video consultation at the appointment time.'}</span> : role === 'patient' && ['confirmed','rescheduled','checked_in'].includes(item.status) && !item.consultationStatus && Date.now() >= new Date(item.slotStartTime).getTime() ? <button type="button" className="dash-btn dash-btn-primary" onClick={async () => { setBusy(item.appointmentId); try { await api(`/${encodeURIComponent(item.appointmentId)}/waiting`, { method: 'POST' }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Waiting room is unavailable.'); } finally { setBusy(''); } }}>{busy === item.appointmentId ? 'Opening…' : 'Enter Waiting Room'}</button> : role === 'patient' && item.consultationStatus && <span>{item.consultationStatus}</span>}
    </article>)}
  </section>;
};

interface DirectCallItem {
  callId: string;
  status: string;
  expiresAt: string;
  doctorName?: string;
  patientId?: string;
  patientName?: string;
  patientWaiting?: boolean;
}

export const DirectVideoCallPanel: React.FC<{ role: Role; currentLang?: string }> = ({ role, currentLang = 'en' }) => {
  const [providerStatus, setProviderStatus] = useState<'checking' | 'configured' | 'blocked' | 'unavailable' | 'demo'>('checking');
  const [patients, setPatients] = useState<Array<{ patientId: string; name: string }>>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [outgoingCalls, setOutgoingCalls] = useState<DirectCallItem[]>([]);
  const [incomingCalls, setIncomingCalls] = useState<DirectCallItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const language = (['en', 'te', 'hi', 'ta', 'kn', 'ml'].includes(currentLang) ? currentLang : 'en') as LanguageCode;
  const t = (key: string) => getClientTranslation(translations[language], `teleconsultation.${key}`);
  const openCall = (callId: string) => { window.location.hash = `#/consultation/direct/${encodeURIComponent(callId)}`; };

  useEffect(() => {
    if (isDemoSession()) { setProviderStatus('demo'); setError('DEMO_LOGIN_ONLY'); return; }
    let active = true;
    api('/provider-status').then((data) => {
      if (!active) return;
      const liveStatus = data.liveVideo?.status;
      setProviderStatus(liveStatus === 'CONNECTED' ? 'configured' : liveStatus === 'MISSING_CONFIGURATION' ? 'blocked' : 'unavailable');
      if (liveStatus !== 'CONNECTED' && liveStatus !== 'MISSING_CONFIGURATION' && data.liveVideo?.message) setError(data.liveVideo.message);
    }).catch((e) => { if (active) { setProviderStatus('unavailable'); setError(e instanceof Error ? e.message : 'Live video status unavailable.'); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isDemoSession()) return;
    let active = true;
    const refresh = async () => {
      try {
        const data = await api(role === 'patient' ? '/direct-calls/incoming' : '/direct-calls/outgoing');
        if (active && role === 'patient') setIncomingCalls(data.calls || []);
        if (active && role === 'doctor') setOutgoingCalls(data.calls || []);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not refresh direct calls.'); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [role]);

  useEffect(() => {
    if (isDemoSession() || role !== 'doctor') return;
    let active = true;
    api('/direct-calls/patients').then((data) => { if (active) setPatients(data.patients || []); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not load patients.'); });
    return () => { active = false; };
  }, [role]);

  const startCall = async () => {
    if (!selectedPatientId || providerStatus !== 'configured') return;
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await api('/direct-calls', { method: 'POST', body: JSON.stringify({ patientId: selectedPatientId, clientMutationId: crypto.randomUUID() }) });
      setMessage(t('directCallSent'));
      setOutgoingCalls((current) => [{ callId: data.callId, status: 'LINK_SENT', expiresAt: data.expiresAt, patientId: data.patientId, patientName: patients.find((patient) => patient.patientId === data.patientId)?.name }, ...current.filter((call) => call.callId !== data.callId)]);
      setSelectedPatientId('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the video call.'); }
    finally { setBusy(false); }
  };

  const rejectCall = async (callId: string) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api(`/direct-calls/${encodeURIComponent(callId)}/reject`, { method: 'POST', body: JSON.stringify({ clientMutationId: crypto.randomUUID() }) });
      setIncomingCalls((current) => current.filter((call) => call.callId !== callId));
      setMessage(t('directCallRejected'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not reject the call.'); }
    finally { setBusy(false); }
  };

  const availabilityKey = providerStatus === 'checking' ? 'liveVideoChecking' : providerStatus === 'configured' ? 'liveVideoReady' : providerStatus === 'blocked' ? 'liveVideoBlocked' : providerStatus === 'demo' ? 'directCallDemoLogin' : 'liveVideoUnavailable';
  return <section style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, margin: '12px 0', background: 'var(--surface-card, #fff)' }}>
    <h3 style={{ marginTop: 0 }}>{t('directCallTitle')}</h3>
    <p role="status" aria-live="polite" style={{ color: providerStatus === 'configured' ? '#166534' : providerStatus === 'blocked' || providerStatus === 'unavailable' || providerStatus === 'demo' ? '#9a3412' : 'inherit' }}>{t(availabilityKey)}</p>
    {error && error !== 'DEMO_LOGIN_ONLY' && <p role="alert" style={{ color: '#b91c1c' }}>{error === 'SESSION_EXPIRED' ? t('directCallSessionExpired') : error}</p>}
    {['SESSION_EXPIRED', 'DEMO_LOGIN_ONLY'].includes(error) && <button type="button" onClick={() => openLiveSignIn(role)}>{t('directCallSignIn')}</button>}
    {message && <p role="status">{message}</p>}
    {role === 'doctor' ? <>
      <label>{t('directCallPatient')} <select value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)} disabled={providerStatus !== 'configured' || busy}>
        <option value="">{t('directCallChoosePatient')}</option>
        {patients.map((patient) => <option key={patient.patientId} value={patient.patientId}>{patient.name}</option>)}
      </select></label>
      {!patients.length && <p>{t('directCallNoPatients')}</p>}
      <button type="button" onClick={() => void startCall()} disabled={!selectedPatientId || providerStatus !== 'configured' || busy} style={{ marginInlineStart: 8 }}>{busy ? t('directCallCalling') : t('directCallStart')}</button>
      <h4>{t('directCallOutgoing')}</h4>
      {!outgoingCalls.length && <p>{t('directCallNoOutgoing')}</p>}
      {outgoingCalls.map((call) => <div key={call.callId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', padding: '10px 0' }}>
        <span>{call.patientName || call.patientId} · {call.status === 'IN_CALL' ? t('directCallConnected') : call.patientWaiting ? t('directCallPatientReady') : t('directCallWaiting')}</span>
        {call.patientWaiting && <button type="button" onClick={() => openCall(call.callId)}>{t('directCallOpen')}</button>}
      </div>)}
    </> : <>
      <h4>{t('directCallIncoming')}</h4>
      {!incomingCalls.length && <p>{t('directCallNoIncoming')}</p>}
      {incomingCalls.map((call) => <div key={call.callId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', padding: '10px 0' }}>
        <span>{call.doctorName} · {new Date(call.expiresAt).toLocaleTimeString()}</span>
        <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => openCall(call.callId)} disabled={providerStatus !== 'configured' || busy}>{t('directCallAnswer')}</button><button type="button" onClick={() => void rejectCall(call.callId)} disabled={busy}>{t('directCallReject')}</button></div>
      </div>)}
    </>}
  </section>;
};

export const DailyConsultationPage: React.FC<{ token?: string; directCallId?: string; appointmentId?: string; role: Role; currentLang?: string; onClose: () => void }> = ({ token, directCallId, appointmentId: routeAppointmentId, role, currentLang = 'en', onClose }) => {
  const host = useRef<HTMLDivElement>(null); const call = useRef<DailyCall | null>(null); const [state, setState] = useState('Verifying private consultation link…'); const [remaining, setRemaining] = useState<number | null>(null); const [notes, setNotes] = useState(''); const [err, setErr] = useState(''); const [switchingCamera, setSwitchingCamera] = useState(false);
  const language = (['en', 'te', 'hi', 'ta', 'kn', 'ml'].includes(currentLang) ? currentLang : 'en') as LanguageCode;
  const t = (key: string) => getClientTranslation(translations[language], `teleconsultation.${key}`);
  const appointmentId = useRef(''); const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    let alive = true; let poll: number | undefined; let clock: number | undefined;
    const start = async () => {
      try {
        const data = directCallId
          ? await api(`/direct-calls/${encodeURIComponent(directCallId)}/join`, { method: 'POST', body: JSON.stringify({ clientMutationId: crypto.randomUUID() }) })
          : routeAppointmentId
          ? await api(`/${encodeURIComponent(routeAppointmentId)}/doctor-join`, { method: 'POST' })
          : await api(`/join/${encodeURIComponent(token || '')}`, { method: 'POST' });
        if (!alive) return; appointmentId.current = data.appointmentId || routeAppointmentId || '';
        setState(data.status === 'IN_CALL' ? 'Consultation in progress' : role === 'patient' ? 'Waiting for the doctor to start the consultation' : 'Join the room to start the consultation');
        const frame = DailyIframe.createFrame(host.current!, { showLeaveButton: false, showFullscreenButton: true, iframeStyle: { width: '100%', height: 'min(68vh, 620px)', border: '0', borderRadius: '12px' } }); call.current = frame;
        frame.iframe()?.setAttribute('allow', 'camera; microphone; autoplay; fullscreen');
        frame.on('joined-meeting', async () => { if (role === 'doctor') { try { await api(directCallId ? `/direct-calls/${encodeURIComponent(directCallId)}/start` : `/${encodeURIComponent(data.appointmentId)}/start`, { method: 'POST', ...(directCallId ? { body: JSON.stringify({ clientMutationId: crypto.randomUUID() }) } : {}) }); setState('Consultation in progress'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not start consultation.'); } } });
        frame.on('error', (e: any) => setErr(e?.errorMsg || 'Video connection failed. Check camera and microphone permissions.'));
        frame.on('left-meeting', () => closeRef.current());
        await frame.join({ url: data.roomUrl, token: data.meetingToken });
        const check = async () => { try { const status = await api(directCallId ? `/direct-calls/${encodeURIComponent(directCallId)}/status` : `/${encodeURIComponent(data.appointmentId)}/status`); if (!alive) return; if (status.startedAt) { const seconds = Math.max(0, 1800 - Math.floor((Date.now() - new Date(status.startedAt).getTime()) / 1000)); setRemaining(seconds); setState('Consultation in progress'); if (seconds <= 0) { await frame.leave(); closeRef.current(); } } else if (role === 'patient') setState(status.patientWaiting ? 'Waiting for the doctor to start the consultation' : 'Waiting for your appointment link'); if (['COMPLETED','MISSED','CANCELLED'].includes(status.status)) { setState('This consultation has ended.'); await frame.leave(); } } catch (e) { setErr(e instanceof Error ? e.message : 'Could not refresh consultation status.'); } };
        await check(); poll = window.setInterval(check, 5000); clock = window.setInterval(() => setRemaining(value => value === null ? null : Math.max(0, value - 1)), 1000);
      } catch (e) { if (alive) setErr(e instanceof Error ? e.message : 'Could not join consultation.'); }
    };
    void start(); return () => { alive = false; if (poll) window.clearInterval(poll); if (clock) window.clearInterval(clock); void call.current?.leave().catch(() => undefined); call.current?.destroy(); call.current = null; };
  }, [token, directCallId, routeAppointmentId, role]);
  const end = async () => { try { if (directCallId) await api(`/direct-calls/${encodeURIComponent(directCallId)}/${role === 'doctor' ? 'end' : 'leave'}`, { method: 'POST', body: JSON.stringify({ ...(role === 'doctor' ? { notes } : {}), clientMutationId: crypto.randomUUID() }) }); else if (role === 'doctor' && appointmentId.current) await api(`/${encodeURIComponent(appointmentId.current)}/end`, { method: 'POST', body: JSON.stringify({ notes }) }); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not end consultation on server.'); return; } await call.current?.leave(); closeRef.current(); };
  const flipCamera = async () => { if (!call.current || switchingCamera) return; setSwitchingCamera(true); try { await call.current.cycleCamera({ preferDifferentFacingMode: true }); setErr(''); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not switch camera. Check that another camera is available.'); } finally { setSwitchingCamera(false); } };
  const saveNotes = async () => { try { if (!appointmentId.current && !directCallId) throw new Error('Join the consultation first.'); await api(directCallId ? `/direct-calls/${encodeURIComponent(directCallId)}/notes` : `/${encodeURIComponent(appointmentId.current)}/notes`, { method: 'PUT', body: JSON.stringify({ notes, ...(directCallId ? { clientMutationId: crypto.randomUUID() } : {}) }) }); setErr('Notes saved as a hashed, versioned clinical record.'); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save notes.'); } };
  return <main style={{ position: 'fixed', inset: 0, overflow: 'auto', zIndex: 10000, background: '#f8fafc', padding: 20 }}><header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div><h2>Secure Video Consultation</h2><p>{state}</p></div><strong>{remaining === null ? 'Waiting for doctor' : `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')} remaining`}</strong></header>{remaining !== null && remaining <= 300 && remaining > 0 && <p role="alert">5 minutes remaining</p>}<div ref={host} style={{ minHeight: 320, height: 'min(68vh, 620px)' }} />{err && <p role="alert" style={{ color: '#b91c1c' }}>{err === 'SESSION_EXPIRED' ? t('directCallSessionExpired') : err === 'DEMO_LOGIN_ONLY' ? t('directCallDemoLogin') : err}</p>}{['SESSION_EXPIRED', 'DEMO_LOGIN_ONLY'].includes(err) && <button type="button" onClick={() => openLiveSignIn(role)}>{t('directCallSignIn')}</button>}<footer style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><button type="button" disabled={switchingCamera || !call.current} onClick={() => void flipCamera()}>{switchingCamera ? 'Switching camera…' : 'Flip camera'}</button><button type="button" onClick={() => call.current?.setLocalVideo(!call.current.localVideo())}>Camera on/off</button><button type="button" onClick={() => call.current?.setLocalAudio(!call.current.localAudio())}>Mic on/off</button><button type="button" onClick={end}>{role === 'doctor' ? 'End Consultation' : 'Leave Call'}</button></footer>{role === 'doctor' && <section style={{ maxWidth: 900, marginTop: 14 }}><label htmlFor="consult-notes">Consultation notes</label><textarea id="consult-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} style={{ display: 'block', width: '100%' }} /><button type="button" onClick={saveNotes}>Save notes</button></section>}</main>;
};
