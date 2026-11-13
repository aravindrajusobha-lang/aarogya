import React, { useMemo, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { Card, Empty, Notice, PageHeader, Skeleton } from '../PortalShell';
import { Icon } from '../icons';
import { api, fmtDate, fmtTime, newMutationId, Translate, useApi } from '../lib';

interface Slot {
  slotId: string; startTime: string; endTime: string; durationMinutes: number; status: 'available' | 'booked' | 'past';
  booking: { appointmentId: string; patientName: string; status: string; consultationMode?: string } | null;
}

const DURATIONS = [10, 15, 20, 30, 45, 60];
const GAPS = [0, 5, 10, 15];
const todayIst = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

export const AvailabilityPage: React.FC<{ t: Translate; lang: LanguageCode }> = ({ t, lang }) => {
  const { data, error, loading, reload } = useApi<{ slots: Slot[] }>('/api/v1/consultations/doctor/availability', [], 30_000);
  const [date, setDate] = useState(todayIst());
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('13:00');
  const [duration, setDuration] = useState(20);
  const [gap, setGap] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const previewCount = useMemo(() => {
    const span = toMinutes(end) - toMinutes(start);
    if (span < duration) return 0;
    return Math.floor((span + gap) / (duration + gap));
  }, [start, end, duration, gap]);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      const result = await api<{ created: number }>('/api/v1/consultations/doctor/availability/range', {
        method: 'POST',
        body: JSON.stringify({ date, startTime: start, endTime: end, durationMinutes: duration, breakMinutes: gap, mutationId: newMutationId() }),
      });
      setMessage({ tone: 'success', text: t('avail.published', { n: result.created }) });
      await reload();
    } catch (e) { setMessage({ tone: 'error', text: e instanceof Error ? e.message : t('common.error') }); }
    finally { setBusy(false); }
  };

  const remove = async (slotId: string) => {
    try { await api(`/api/v1/consultations/doctor/availability/${slotId}`, { method: 'DELETE' }); await reload(); }
    catch (e) { setMessage({ tone: 'error', text: e instanceof Error ? e.message : t('common.error') }); }
  };

  const groups = useMemo(() => {
    const map = new Map<string, Slot[]>();
    (data?.slots || []).forEach((slot) => {
      const key = new Date(new Date(slot.startTime).getTime() + 5.5 * 3600000).toISOString().slice(0, 10);
      map.set(key, [...(map.get(key) || []), slot]);
    });
    return [...map.entries()];
  }, [data]);

  return (
    <>
      <PageHeader title={t('avail.title')} subtitle={t('avail.intro')} />
      <Card title={t('avail.publish')} icon="calendar">
        <form className="adp-form-grid adp-avail-form" onSubmit={publish}>
          <label className="adp-field">{t('avail.date')}<input type="date" required min={todayIst()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="adp-field">{t('avail.duration')}
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d} value={d}>{t('avail.minutes', { n: d })}</option>)}</select>
          </label>
          <label className="adp-field">{t('avail.start')}<input type="time" required value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label className="adp-field">{t('avail.end')}<input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <label className="adp-field">{t('avail.gap')}
            <select value={gap} onChange={(e) => setGap(Number(e.target.value))}>{GAPS.map((g) => <option key={g} value={g}>{g === 0 ? t('avail.noGap') : t('avail.minutes', { n: g })}</option>)}</select>
          </label>
          <div className="adp-avail-submit">
            <p className="adp-muted">{t('avail.preview', { n: previewCount })}</p>
            <button type="submit" className="adp-btn adp-btn-primary" disabled={busy || previewCount === 0}><Icon.check size={18} />{busy ? t('avail.publishing') : t('avail.publish')}</button>
          </div>
        </form>
        {message && <div style={{ marginTop: 12 }}><Notice tone={message.tone}>{message.text}</Notice></div>}
      </Card>

      <Card title={t('avail.title')} icon="clock">
        <div className="adp-slot-legend">
          <span className="adp-slot-chip is-available">{t('avail.available')}</span>
          <span className="adp-slot-chip is-booked">{t('avail.booked')}</span>
          <span className="adp-slot-chip is-past">{t('avail.past')}</span>
          <small className="adp-muted">{t('avail.legend')}</small>
        </div>
        {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice> : !groups.length ? <Empty icon="calendar">{t('avail.empty')}</Empty> : (
          <div className="adp-slot-days">
            {groups.map(([day, slots]) => (
              <section key={day}>
                <h3 className="adp-slot-day">{fmtDate(slots[0].startTime, lang)} <small>{slots.filter((s) => s.status === 'available').length} {t('avail.available')} · {slots.filter((s) => s.status === 'booked').length} {t('avail.booked')}</small></h3>
                <div className="adp-slot-grid">
                  {slots.map((slot) => (
                    <div key={slot.slotId} className={`adp-slot-card is-${slot.status}`}>
                      <strong>{fmtTime(slot.startTime, lang)} – {fmtTime(slot.endTime, lang)}</strong>
                      <small>{t('avail.minutes', { n: slot.durationMinutes })}</small>
                      <span className={`adp-slot-chip is-${slot.status}`}>{t(`avail.${slot.status}`)}</span>
                      {slot.booking && <small>{t('avail.bookedBy', { name: slot.booking.patientName })}</small>}
                      {slot.status === 'available' && <button type="button" className="adp-link" onClick={() => void remove(slot.slotId)}>{t('avail.remove')}</button>}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>
    </>
  );
};
