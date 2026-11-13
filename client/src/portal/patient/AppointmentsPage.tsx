import React, { useEffect, useMemo, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { appointmentTone, Card, Empty, Notice, PageHeader, Skeleton, StatusPill } from '../PortalShell';
import { Icon } from '../icons';
import { api, AppointmentItem, fmtDate, fmtDateTime, fmtDuration, fmtTime, followUpLabel, initials, newMutationId, sessionActive, SessionInfo, Translate, useApi } from '../lib';

interface DoctorOption { userId: string; name: string; hospitalId: string; hospitalName: string; specialization?: string; availableSlotsCount: number; consultationFee?: number | null; experienceYears?: number | null; consultationModes?: string[] }
interface Slot { startTime: string; endTime: string; isAvailable: boolean; status?: 'available' | 'booked' | 'past'; durationMinutes?: number }

const todayKey = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

/* ---------- Session strip (start / end / duration / follow-up) ---------- */
export const SessionStrip: React.FC<{ t: Translate; lang: LanguageCode; session: SessionInfo }> = ({ t, lang, session }) => (
  <div className="adp-session-strip">
    <div><small>{t('session.started')}</small><strong>{fmtTime(session.startedAt, lang)}</strong></div>
    <div><small>{t('session.ended')}</small><strong>{session.endedAt ? fmtTime(session.endedAt, lang) : '—'}</strong></div>
    <div><small>{t('session.duration')}</small><strong>{fmtDuration(session.durationSeconds)}</strong></div>
    <div><small>{t('session.followUp')}</small><strong>{followUpLabel(t, session.followUp)}{session.followUp?.nextFollowUpAt ? ` · ${fmtDate(session.followUp.nextFollowUpAt, lang)}` : ''}</strong></div>
  </div>
);

/* ---------- Appointment row for patients ---------- */
export const PatientAppointmentRow: React.FC<{ t: Translate; lang: LanguageCode; item: AppointmentItem; onChanged: () => void; compact?: boolean }> = ({ t, lang, item, onChanged, compact }) => {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const live = sessionActive(item.session);
  const isOnline = item.consultationMode === 'online';
  const active = ['confirmed', 'rescheduled', 'checked_in'].includes(item.status);
  const proposal = item.proposedReschedule?.status === 'pending' ? item.proposedReschedule : null;

  const act = async (kind: 'cancel' | 'accept' | 'decline') => {
    setBusy(kind); setError('');
    try {
      if (kind === 'cancel') await api(`/api/v1/appointments/${encodeURIComponent(item.appointmentId)}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Cancelled by patient', mutationId: newMutationId() }) });
      else await api(`/api/v1/appointments/${encodeURIComponent(item.appointmentId)}/respond-new-time`, { method: 'PATCH', body: JSON.stringify({ accept: kind === 'accept', mutationId: newMutationId() }) });
      onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setBusy(''); }
  };

  return (
    <article className={`adp-appt${live ? ' is-live' : ''}`}>
      <span className="adp-appt-avatar" aria-hidden="true">{initials(item.assignedDoctorName || 'Dr')}</span>
      <div className="adp-appt-main">
        <div className="adp-appt-title">
          <strong>{item.assignedDoctorName || item.destinationHospitalName || 'Doctor'}</strong>
          {live ? <span className="adp-live">{t('session.live')}</span> : <StatusPill tone={appointmentTone(item.status)}>{t(`appt.status.${item.status}`)}</StatusPill>}
        </div>
        <div className="adp-meta">
          <span><Icon.calendar size={16} />{fmtDate(item.slotStartTime, lang)}</span>
          <span><Icon.clock size={16} />{fmtTime(item.slotStartTime, lang)} – {fmtTime(item.slotEndTime, lang)}</span>
          <span>{isOnline ? <Icon.video size={16} /> : <Icon.clinic size={16} />}{isOnline ? t('common.online') : t('common.inPerson')}</span>
          {!compact && item.destinationHospitalName && <span><Icon.clinic size={16} />{item.destinationHospitalName}</span>}
        </div>
        {proposal && <p className="adp-appt-note">{t('appt.proposed', { time: fmtDateTime(proposal.newSlotStart, lang) })}</p>}
        {!compact && item.session?.startedAt && <SessionStrip t={t} lang={lang} session={item.session} />}
        {!compact && item.session?.followUp?.instructions && <p className="adp-appt-note"><strong>{t('session.instructions')}: </strong>{item.session.followUp.instructions}</p>}
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <div className="adp-appt-actions">
        {isOnline && active && (live
          ? <a className="adp-btn adp-btn-primary adp-btn-sm" href={`#/consultation/webrtc/${encodeURIComponent(item.appointmentId)}`}><Icon.video size={16} />{t('appt.join')}</a>
          : <span style={{ color: 'var(--adp-text-3)', fontSize: '.82rem', alignSelf: 'center' }}>{t('appt.waitDoctor')}</span>)}
        {proposal && <>
          <button type="button" className="adp-btn adp-btn-primary adp-btn-sm" disabled={!!busy} onClick={() => void act('accept')}>{t('appt.acceptTime')}</button>
          <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={!!busy} onClick={() => void act('decline')}>{t('appt.declineTime')}</button>
        </>}
        {!compact && ['requested', 'confirmed', 'rescheduled'].includes(item.status) && !live && (
          <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={!!busy} onClick={() => void act('cancel')}>{busy === 'cancel' ? t('common.loading') : t('appt.cancelAppt')}</button>
        )}
      </div>
    </article>
  );
};

/* ---------- Booking wizard ---------- */
const BookingForm: React.FC<{ t: Translate; lang: LanguageCode; patientId?: string; onBooked: () => void }> = ({ t, lang, patientId, onBooked }) => {
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const [date, setDate] = useState(todayKey());
  const [doctorId, setDoctorId] = useState('');
  const [slot, setSlot] = useState('');
  const [note, setNote] = useState('');
  const share = true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const doctors = useApi<{ doctors: DoctorOption[] }>(`/api/v1/consultations/availability?date=${date}`, [date]);
  const doctor = doctors.data?.doctors.find((item) => item.userId === doctorId) || null;
  const slots = useApi<{ slots: Slot[] }>(doctor ? `/api/v1/consultations/availability/${encodeURIComponent(doctor.userId)}?date=${date}` : null, [doctorId, date]);
  const visibleSlots = useMemo(() => (slots.data?.slots || []).filter((item) => new Date(item.startTime).getTime() > Date.now() && item.status !== 'past'), [slots.data]);
  const openSlots = useMemo(() => visibleSlots.filter((item) => item.isAvailable), [visibleSlots]);
  const screeningId = (() => { try { return sessionStorage.getItem('patient_booking_screening_id') || undefined; } catch { return undefined; } })();

  useEffect(() => { setDoctorId(''); setSlot(''); }, [date]);
  useEffect(() => { setSlot(''); }, [doctorId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const chosen = openSlots.find((item) => item.startTime === slot);
    if (!patientId || !doctor || !chosen) return;
    setBusy(true); setError('');
    try {
      const mutationId = newMutationId();
      await api('/api/v1/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientId, destinationHospitalId: doctor.hospitalId, destinationHospitalName: doctor.hospitalName,
          assignedDoctorId: doctor.userId, assignedDoctorName: doctor.name,
          slotStartTime: chosen.startTime, slotEndTime: chosen.endTime, consultationMode: mode,
          patientNote: note.trim(), mutationId, idempotencyKey: mutationId,
          ...(share && screeningId ? { screeningId } : {}),
          consentGiven: share,
          visitDetails: { shareReport: Boolean(share && screeningId), shareProfile: share, consentGivenAt: share ? new Date().toISOString() : undefined },
          type: 'clinical_consultation',
          reason: `${mode === 'online' ? 'Online' : 'In-person'} consultation appointment request`,
        }),
      });
      setDone(true); setNote(''); setSlot(''); onBooked();
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setBusy(false); }
  };

  return (
    <form className="adp-steps" onSubmit={submit}>
      <div className="adp-step">
        <h3><b>1</b>{t('appt.step1')}</h3>
        <div className="adp-choice-grid" role="group" aria-label={t('appt.step1')}>
          <button type="button" className="adp-choice" aria-pressed={mode === 'online'} onClick={() => setMode('online')}>
            <span className="adp-quick-icon"><Icon.video size={22} /></span><span><strong>{t('appt.online')}</strong><small>{t('appt.onlineHint')}</small></span>
          </button>
          <button type="button" className="adp-choice" aria-pressed={mode === 'offline'} onClick={() => setMode('offline')}>
            <span className="adp-quick-icon"><Icon.clinic size={22} /></span><span><strong>{t('appt.offline')}</strong><small>{t('appt.offlineHint')}</small></span>
          </button>
        </div>
      </div>

      <div className="adp-step">
        <h3><b>2</b>{t('appt.step2')}</h3>
        <label className="adp-field" style={{ maxWidth: 260 }}><span className="sr-only">{t('appt.step2')}</span>
          <input type="date" required min={todayKey()} value={date} onChange={(e) => { setDate(e.target.value); setDone(false); }} />
        </label>
      </div>

      <div className="adp-step">
        <h3><b>3</b>{t('appt.step3')}</h3>
        {doctors.loading ? <Skeleton rows={2} /> : doctors.error ? <Notice tone="error">{doctors.error}</Notice>
          : !doctors.data?.doctors.length ? <Notice tone="info">{t('appt.noDoctors')}</Notice> : (
            <div className="adp-choice-grid">
              {doctors.data.doctors.filter((item) => !item.consultationModes?.length || item.consultationModes.includes(mode)).map((item) => (
                <button key={item.userId} type="button" className="adp-choice" aria-pressed={doctorId === item.userId} onClick={() => { setDoctorId(item.userId); setDone(false); }}>
                  <span className="adp-appt-avatar" style={{ width: 44, height: 44 }}>{initials(item.name)}</span>
                  <span style={{ minWidth: 0 }}><strong>{item.name}</strong><small>{item.specialization || 'General'} · {item.hospitalName}</small><small>{[item.experienceYears != null ? t('admin.years', { n: item.experienceYears }) : '', item.consultationFee != null ? (item.consultationFee === 0 ? t('admin.feeFree') : `₹${item.consultationFee}`) : ''].filter(Boolean).join(' · ')}</small></span>
                  <b>{t('appt.slots', { n: item.availableSlotsCount })}</b>
                </button>
              ))}
            </div>
          )}
      </div>

      {doctor && (
        <div className="adp-step">
          <h3><b>4</b>{t('appt.step4')}</h3>
          {slots.loading ? <Skeleton rows={1} /> : !visibleSlots.length ? <Notice tone="info">{t('appt.noDoctors')}</Notice> : (
            <>
              <div className="adp-slot-legend">
                <span className="adp-slot-chip is-available">{t('avail.available')} ({openSlots.length})</span>
                <span className="adp-slot-chip is-booked">{t('avail.booked')} ({visibleSlots.length - openSlots.length})</span>
              </div>
              <div className="adp-slots" role="group" aria-label={t('appt.chooseTime')}>
                {visibleSlots.map((item) => (
                  <button key={item.startTime} type="button" className="adp-slot" disabled={!item.isAvailable} aria-pressed={slot === item.startTime} onClick={() => setSlot(item.startTime)} title={item.isAvailable ? '' : t('avail.booked')}>
                    {fmtTime(item.startTime, lang)} – {fmtTime(item.endTime, lang)}
                    {!item.isAvailable && <small>{t('avail.booked')}</small>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {doctor && slot && <>
        <label className="adp-field">{t('appt.reason')}
          <textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)} />
        </label>
        <p className="adp-consent-note"><Icon.share size={18} />{t('appt.share')}</p>
      </>}

      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">{t('appt.sent')}</Notice>}
      <div>
        <button type="submit" className="adp-btn adp-btn-primary" disabled={busy || !doctor || !slot}><Icon.check size={18} />{busy ? t('appt.submitting') : t('appt.submit')}</button>
      </div>
    </form>
  );
};

/* ---------- Page ---------- */
export const AppointmentsPage: React.FC<{ t: Translate; lang: LanguageCode; patientId?: string; openBooking?: boolean }> = ({ t, lang, patientId, openBooking }) => {
  const { data, error, loading, reload } = useApi<{ appointments: AppointmentItem[] }>('/api/v1/consultations/appointments/my', [], 15_000);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [showBooking, setShowBooking] = useState(Boolean(openBooking));
  const all = data?.appointments || [];
  const upcoming = all.filter((item) => ['requested', 'confirmed', 'rescheduled', 'checked_in'].includes(item.status)).sort((a, b) => +new Date(a.slotStartTime) - +new Date(b.slotStartTime));
  const past = all.filter((item) => !upcoming.includes(item));
  const visible = tab === 'upcoming' ? upcoming : past;

  return (
    <>
      <PageHeader title={t('appt.title')} action={<button type="button" className="adp-btn adp-btn-primary" onClick={() => setShowBooking((value) => !value)}><Icon.calendar size={18} />{t('appt.book')}</button>} />
      {showBooking && <Card title={t('appt.book')} icon="calendar"><BookingForm t={t} lang={lang} patientId={patientId} onBooked={() => { void reload(); }} /></Card>}
      <Card title={t('nav.appointments')} icon="clock" action={
        <div className="adp-tabs" role="group">
          <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>{t('appt.upcoming')} ({upcoming.length})</button>
          <button type="button" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>{t('appt.past')} ({past.length})</button>
        </div>
      }>
        {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice>
          : !visible.length ? <Empty icon="calendar">{t('appt.none')}</Empty>
          : <div className="adp-list">{visible.map((item) => <PatientAppointmentRow key={item.appointmentId} t={t} lang={lang} item={item} onChanged={() => void reload()} />)}</div>}
      </Card>
    </>
  );
};
