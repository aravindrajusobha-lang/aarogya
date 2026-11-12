import React, { useCallback, useEffect, useRef, useState } from 'react';

interface DoctorAppointment {
  appointmentId: string;
  appointmentCode?: string;
  patientName?: string;
  patientNote?: string;
  destinationHospitalName?: string;
  department?: string;
  consultationMode?: 'online' | 'offline';
  slotStartTime: string;
  slotEndTime: string;
  status: string;
  reason?: string;
  visitDetails?: { patientSharingConsent?: { granted?: boolean; report?: boolean; profile?: boolean } };
}

const token = () => {
  try { return JSON.parse(localStorage.getItem('aarogya_tokens') || '{}').accessToken || localStorage.getItem('aarogya_token') || ''; }
  catch { return localStorage.getItem('aarogya_token') || ''; }
};

export const DoctorAppointmentsPanel: React.FC<{ onOpenRoom: (appointmentId: string) => void }> = ({ onOpenRoom }) => {
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<'all' | 'requested' | 'confirmed'>('all');
  const appointmentsRef = useRef<DoctorAppointment[]>([]);
  const firstLoadRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/consultations/doctor/appointments', { headers: { Authorization: `Bearer ${token()}` } });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'Appointments could not be loaded.');
      const nextAppointments: DoctorAppointment[] = payload.data?.appointments || [];
      if (!firstLoadRef.current) {
        const priorIds = new Set(appointmentsRef.current.map((item) => item.appointmentId));
        if (nextAppointments.some((item) => item.status === 'requested' && !priorIds.has(item.appointmentId))) setToast('New appointment request assigned to you.');
      }
      firstLoadRef.current = false;
      appointmentsRef.current = nextAppointments;
      setAppointments(nextAppointments);
      setError('');
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Appointments could not be loaded.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 12_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer); }, [toast]);

  const respond = async (appointment: DoctorAppointment, decision: 'accept' | 'decline') => {
    const declineReason = decision === 'decline' ? window.prompt('Reason for declining this appointment?')?.trim() : undefined;
    if (decision === 'decline' && !declineReason) return;
    setBusyId(appointment.appointmentId); setError('');
    try {
      const response = await fetch(`/api/v1/appointments/${encodeURIComponent(appointment.appointmentId)}/doctor-response`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ mutationId: crypto.randomUUID(), decision, ...(declineReason ? { declineReason } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'The appointment could not be updated.');
      setToast(decision === 'accept' ? 'Appointment accepted. The patient was notified.' : 'Appointment declined. The patient was notified.');
      await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'The appointment could not be updated.'); }
    finally { setBusyId(''); }
  };

  const markCheckedIn = async (appointment: DoctorAppointment) => {
    setBusyId(appointment.appointmentId); setError('');
    try {
      const response = await fetch(`/api/v1/appointments/${encodeURIComponent(appointment.appointmentId)}/check-in`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ mutationId: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'The appointment status could not be updated.');
      setToast('Patient checked in.'); await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'The appointment status could not be updated.'); }
    finally { setBusyId(''); }
  };

  const reschedule = async (appointment: DoctorAppointment) => {
    const suggested = new Date(appointment.slotStartTime).toISOString().slice(0, 16);
    const nextStart = window.prompt('New start time (YYYY-MM-DDTHH:mm)', suggested)?.trim();
    if (!nextStart) return;
    const nextEnd = window.prompt('New end time (YYYY-MM-DDTHH:mm)', new Date(appointment.slotEndTime).toISOString().slice(0, 16))?.trim();
    const reason = window.prompt('Reason for rescheduling?')?.trim();
    if (!nextEnd || !reason) return;
    const startAt = new Date(nextStart); const endAt = new Date(nextEnd);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt <= startAt || startAt <= new Date()) { setError('Choose a valid future start and end time.'); return; }
    setBusyId(appointment.appointmentId); setError('');
    try {
      const response = await fetch(`/api/v1/appointments/${encodeURIComponent(appointment.appointmentId)}/reschedule`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ newSlotStartTime: startAt.toISOString(), newSlotEndTime: endAt.toISOString(), reason }) });
      const payload = await response.json(); if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'The appointment could not be rescheduled.');
      setToast('A new time was sent to the patient for confirmation.'); await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'The appointment could not be rescheduled.'); }
    finally { setBusyId(''); }
  };

  const completeVisit = async (appointment: DoctorAppointment) => {
    setBusyId(appointment.appointmentId); setError('');
    try {
      const response = await fetch(`/api/v1/appointments/${encodeURIComponent(appointment.appointmentId)}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ mutationId: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || 'The appointment could not be completed.');
      setToast('Appointment completed and patient notified.'); await load();
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'The appointment could not be completed.'); }
    finally { setBusyId(''); }
  };

  const visible = appointments.filter((appointment) => filter === 'all' || appointment.status === (filter === 'requested' ? 'requested' : 'confirmed') || (filter === 'confirmed' && appointment.status === 'checked_in'));
  const canJoin = (appointment: DoctorAppointment) => appointment.consultationMode === 'online' && ['confirmed', 'rescheduled', 'checked_in'].includes(appointment.status) && Date.now() >= new Date(appointment.slotStartTime).getTime() - 15 * 60_000 && Date.now() <= new Date(appointment.slotEndTime).getTime() + 60 * 60_000;

  return <section className="doctor-appointments-panel" aria-labelledby="doctor-appointments-title">
    <header className="doctor-appointments-heading"><div><p>APPOINTMENTS</p><h2 id="doctor-appointments-title">Appointment requests and schedule</h2><span>Only appointments assigned to your account and facility appear here.</span></div><div className="doctor-appointments-filters" role="group" aria-label="Filter appointments">{(['all', 'requested', 'confirmed'] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item === 'requested' ? 'Requests' : 'Confirmed'}</button>)}</div></header>
    {error && <p role="alert" className="doctor-appointments-error">{error}</p>}
    {toast && <p role="status" aria-live="polite" className="doctor-appointments-toast">{toast}</p>}
    {loading ? <div className="doctor-appointment-list" role="status"><article className="doctor-appointment-skeleton" /><article className="doctor-appointment-skeleton" /></div> : visible.length === 0 ? <div className="doctor-appointments-empty"><strong>No appointments in this view</strong><p>New requests assigned to you will appear here.</p></div> : <div className="doctor-appointment-list">{visible.map((appointment) => {
      const pending = appointment.status === 'requested' || appointment.status === 'rescheduled';
      const consent = appointment.visitDetails?.patientSharingConsent;
      const startsAt = new Date(appointment.slotStartTime);
      return <article className="doctor-appointment-card" key={appointment.appointmentId}>
        <div className="doctor-appointment-card-head"><span className="doctor-patient-avatar">{(appointment.patientName || 'P').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><strong>{appointment.patientName || 'Patient'}</strong><small>{appointment.appointmentCode || appointment.appointmentId}</small></div><span className={`doctor-appointment-status status-${appointment.status}`}>{appointment.status.replace(/_/g, ' ')}</span></div>
        <div className="doctor-appointment-meta"><span>{startsAt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {startsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – {new Date(appointment.slotEndTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span><span>{appointment.consultationMode === 'online' ? 'Online' : 'In-person'} · {appointment.department || 'Clinical consultation'}</span><span>{appointment.destinationHospitalName || 'Facility'}</span></div>
        {appointment.patientNote && <p className="doctor-patient-note"><strong>Patient note</strong>{appointment.patientNote}</p>}
        {consent?.granted && <p className="doctor-record-consent" role="status">Patient consented to share {consent.report && consent.profile ? 'the screening report and profile' : consent.report ? 'the screening report' : 'the profile'} for this appointment.</p>}
        {appointment.reason && <p className="doctor-appointment-reason">{appointment.reason}</p>}
        <div className="doctor-appointment-actions">{pending && <><button type="button" className="doctor-response-accept" disabled={busyId === appointment.appointmentId} onClick={() => void respond(appointment, 'accept')}>{busyId === appointment.appointmentId ? 'Saving…' : 'Accept request'}</button><button type="button" disabled={busyId === appointment.appointmentId} onClick={() => void reschedule(appointment)}>Reschedule</button><button type="button" className="doctor-response-decline" disabled={busyId === appointment.appointmentId} onClick={() => void respond(appointment, 'decline')}>Decline</button></>}{appointment.status === 'confirmed' && appointment.consultationMode === 'offline' && <button type="button" disabled={busyId === appointment.appointmentId} onClick={() => void markCheckedIn(appointment)}>{busyId === appointment.appointmentId ? 'Saving…' : 'Mark checked in'}</button>}{appointment.status === 'checked_in' && appointment.consultationMode !== 'online' && <button type="button" className="doctor-response-accept" disabled={busyId === appointment.appointmentId} onClick={() => void completeVisit(appointment)}>{busyId === appointment.appointmentId ? 'Saving…' : 'Complete visit'}</button>}{canJoin(appointment) && <button type="button" className="doctor-response-accept" onClick={() => onOpenRoom(appointment.appointmentId)}>Start consultation</button>}</div>
      </article>;
    })}</div>}
  </section>;
};
