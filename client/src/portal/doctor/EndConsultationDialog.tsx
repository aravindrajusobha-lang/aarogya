import React, { useEffect, useRef, useState } from 'react';
import { api, fmtDuration, newMutationId, SessionInfo, Translate, useElapsed } from '../lib';
import '../portal.css';

const FREQUENCIES = ['none', 'weekly', 'biweekly', 'monthly', 'quarterly', 'custom'] as const;

interface Props {
  t: Translate;
  appointmentId: string;
  patientName?: string;
  startedAt?: string | null;
  onClose: () => void;
  onEnded: (session: SessionInfo) => void;
}

/** Doctor ends a consultation: saves versioned notes, end time and follow-up frequency. */
export const EndConsultationDialog: React.FC<Props> = ({ t, appointmentId, patientName, startedAt, onClose, onEnded }) => {
  const [notes, setNotes] = useState('');
  const [frequency, setFrequency] = useState<typeof FREQUENCIES[number]>('none');
  const [customDays, setCustomDays] = useState('10');
  const [planned, setPlanned] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mutationId = useRef(newMutationId());
  const firstField = useRef<HTMLTextAreaElement>(null);
  const elapsed = useElapsed(startedAt, true);

  useEffect(() => {
    firstField.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await api<{ session: SessionInfo }>(`/api/v1/consultation-sessions/${encodeURIComponent(appointmentId)}/end`, {
        method: 'POST',
        body: JSON.stringify({
          clientMutationId: mutationId.current,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          followUp: {
            frequency,
            ...(frequency === 'custom' ? { intervalDays: Number(customDays) } : {}),
            ...(frequency !== 'none' && planned ? { plannedSessions: Number(planned) } : {}),
            ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
          },
        }),
      });
      onEnded(data.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
      setBusy(false);
    }
  };

  return (
    <div className="adp-root adp-dialog-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div className="adp-dialog" role="dialog" aria-modal="true" aria-labelledby="adp-end-title">
        <h2 id="adp-end-title">{t('doctor.endTitle')}</h2>
        <p style={{ color: 'var(--adp-text-2)' }}>{patientName}{startedAt ? ` · ${t('doctor.runningFor')} ${fmtDuration(elapsed)}` : ''}</p>
        <form onSubmit={submit}>
          <label className="adp-field">{t('doctor.notes')}
            <textarea ref={firstField} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={9000} rows={4} />
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="adp-field" style={{ marginBottom: 8 }}>{t('doctor.followUpFreq')}</legend>
            <div className="adp-freq" role="group" aria-label={t('doctor.followUpFreq')}>
              {FREQUENCIES.map((item) => (
                <button key={item} type="button" aria-pressed={frequency === item} onClick={() => setFrequency(item)}>
                  {item === 'custom' ? t('session.freq.custom', { d: '…' }) : t(`session.freq.${item}`)}
                </button>
              ))}
            </div>
          </fieldset>
          {frequency === 'custom' && (
            <label className="adp-field">{t('doctor.customDays')}
              <input type="number" min={1} max={365} required value={customDays} onChange={(e) => setCustomDays(e.target.value)} />
            </label>
          )}
          {frequency !== 'none' && (
            <label className="adp-field">{t('doctor.planned')}
              <input type="number" min={1} max={52} value={planned} onChange={(e) => setPlanned(e.target.value)} />
            </label>
          )}
          <label className="adp-field">{t('doctor.instructions')}
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} rows={2} />
          </label>
          {error && <p className="adp-notice adp-notice-error" role="alert">{error}</p>}
          <div className="adp-dialog-actions">
            <button type="button" className="adp-btn adp-btn-ghost" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="adp-btn adp-btn-danger" disabled={busy}>{busy ? t('common.loading') : t('doctor.confirmEnd')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
