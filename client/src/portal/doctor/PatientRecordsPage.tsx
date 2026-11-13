import React, { useEffect, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { appointmentTone, Card, Empty, Notice, PageHeader, Skeleton, StatusPill } from '../PortalShell';
import { Icon } from '../icons';
import { accessToken, api, fmtDate, fmtDateTime, fmtDuration, followUpLabel, SessionInfo, Translate } from '../lib';

interface RecordScreening {
  screeningId: string; createdAt: string; riskLevel: 'low' | 'moderate' | 'high'; analysisSource: string; imageRef: string | null;
  summary: string | null; findingTypeLabel: string | null; anatomicalSite: string | null; visualFindings: string[]; possibleConditions: string[];
  confidence: number | null; performedBy: string | null; clinicianReview: { status: string };
}
interface Records {
  access: { reason: string; consentedShare: boolean; canPrescribe: boolean };
  patient: { patientId: string; fullName: string; gender: string | null; age: number | null; phone: string | null; village: string | null; mandal: string | null; address: string | null; registeredAt: string | null };
  screenings: RecordScreening[];
  prescriptions: Array<{ prescriptionId: string; doctorName: string; createdAt: string; medicines: Array<{ medicineName: string; dosage: string; frequency: string; durationDays: number }>; followUpDate?: string }>;
  appointments: Array<{ appointmentId: string; slotStartTime: string; status: string; consultationMode?: string; assignedDoctorName?: string }>;
  consultations: Array<SessionInfo & { appointmentId: string; doctorName: string | null }>;
  notes: Array<{ noteId: string; clinicianName: string; text: string; version: number; updatedAt: string }>;
  captures: Array<{ captureId: string; fileId: string; doctorName: string | null; note: string; aiScreeningId: string | null; createdAt: string }>;
  activity: Array<{ type: string; at: string; by: string; role: string; doctorCode: string | null }>;
}

const RISK_TONE = { low: 'green', moderate: 'amber', high: 'red' } as const;

/** Loads a patient image through the scope-checked doctor records proxy. */
const RecordImage: React.FC<{ patientId: string; fileId: string; alt: string }> = ({ patientId, fileId, alt }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let url = ''; let alive = true;
    fetch(`/api/v1/patient-records/${encodeURIComponent(patientId)}/files/${encodeURIComponent(fileId)}`, { headers: { Authorization: `Bearer ${accessToken()}` } })
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then((blob) => { if (alive && blob.type.startsWith('image/')) { url = URL.createObjectURL(blob); setSrc(url); } })
      .catch(() => undefined);
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [patientId, fileId]);
  return src ? <img className="adp-record-img" src={src} alt={alt} draggable={false} /> : <div className="adp-record-img adp-record-img-empty"><Icon.camera size={22} /></div>;
};

export const PatientRecordsPage: React.FC<{ t: Translate; lang: LanguageCode; currentUser: any; initialPatientId?: string }> = ({ t, lang, initialPatientId }) => {
  const [query, setQuery] = useState(initialPatientId || '');
  const [records, setRecords] = useState<Records | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const open = async (patientId: string) => {
    if (!patientId.trim()) return;
    setLoading(true); setError(''); setRecords(null);
    try { setRecords(await api<Records>(`/api/v1/patient-records/${encodeURIComponent(patientId.trim())}`)); }
    catch (e: any) { setError(e?.status === 404 ? t('records.notFound') : e instanceof Error ? e.message : t('common.error')); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (initialPatientId) void open(initialPatientId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [initialPatientId]);

  const p = records?.patient;
  return (
    <>
      <PageHeader title={t('records.title')} subtitle={t('records.intro')} />
      <Notice>{t('care.readOnly')}</Notice>
      <Card>
        <form className="adp-records-search" onSubmit={(e) => { e.preventDefault(); void open(query); }}>
          <label className="adp-field" style={{ flex: 1 }}><span className="sr-only">{t('records.patientId')}</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('records.patientId')} maxLength={100} autoComplete="off" />
          </label>
          <button type="submit" className="adp-btn adp-btn-primary" disabled={loading || !query.trim()}><Icon.file size={18} />{t('records.open')}</button>
        </form>
      </Card>

      {loading && <Skeleton rows={4} />}
      {error && <Notice tone="error">{error}</Notice>}

      {records && p && (
        <>
          <Card>
            <div className="adp-record-head">
              <span className="adp-appt-avatar" style={{ width: 64, height: 64, fontSize: '1.2rem' }}>{p.fullName.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: '1.3rem' }}>{p.fullName}</h2>
                <div className="adp-meta">
                  <span className="adp-code-tag">{p.patientId}</span>
                  <StatusPill tone="blue">{records.access.reason === 'facility_patient' ? t('records.facilityPatient') : records.access.consentedShare ? t('records.shared') : t('records.networkPatient')}</StatusPill>
                </div>
              </div>
            </div>
            <dl className="adp-doc-grid" style={{ marginTop: 16 }}>
              <div><dt>{t('records.age')}</dt><dd>{p.age ?? '—'}</dd></div>
              <div><dt>{t('records.gender')}</dt><dd>{p.gender || '—'}</dd></div>
              <div><dt>{t('records.phone')}</dt><dd>{p.phone || '—'}</dd></div>
              <div><dt>{t('records.village')}</dt><dd>{[p.village, p.mandal].filter(Boolean).join(', ') || '—'}</dd></div>
              <div><dt>{t('records.registered')}</dt><dd>{fmtDate(p.registeredAt, lang)}</dd></div>
            </dl>
          </Card>

          <div className="adp-grid-2">
            <Card title={`${t('records.screenings')} (${records.screenings.length})`} icon="scan">
              {!records.screenings.length ? <Empty icon="scan">{t('records.none')}</Empty> : (
                <div className="adp-list">
                  {records.screenings.map((s) => (
                    <article key={s.screeningId} className="adp-record-item">
                      {s.imageRef ? <RecordImage patientId={p.patientId} fileId={s.imageRef} alt={s.screeningId} /> : <div className="adp-record-img adp-record-img-empty"><Icon.scan size={22} /></div>}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="adp-appt-title"><strong>{fmtDateTime(s.createdAt, lang)}</strong><StatusPill tone={RISK_TONE[s.riskLevel]}>{t(`result.${s.riskLevel}`)}</StatusPill><span className="adp-tag-demo">{t('common.demoAi')}</span></div>
                        {s.findingTypeLabel && <p style={{ fontWeight: 600 }}>{s.findingTypeLabel}{s.anatomicalSite ? ` · ${s.anatomicalSite}` : ''}</p>}
                        {s.summary && <p className="adp-muted">{s.summary}</p>}
                        {s.possibleConditions.length > 0 && <div className="adp-chips" style={{ marginTop: 6 }}>{s.possibleConditions.map((c) => <span key={c} className="adp-chip">{c}</span>)}</div>}
                        <small className="adp-muted">{s.performedBy ? t('records.performedBy', { name: s.performedBy }) : ''}{s.confidence !== null ? ` · ${Math.round(s.confidence * 100)}%` : ''} · {s.clinicianReview.status === 'PENDING' ? t('result.reviewPending') : t('result.reviewDone')}</small>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>

            <Card title={t('records.activity')} icon="history">
              {!records.activity.length ? <Empty icon="history">{t('records.none')}</Empty> : (
                <ol className="adp-timeline">
                  {records.activity.map((a, index) => (
                    <li key={`${a.type}-${a.at}-${index}`}>
                      <strong>{t(`records.${a.type}`)}</strong>
                      <span>{t('records.by', { name: a.by })}{a.doctorCode ? ` (${a.doctorCode})` : ''}</span>
                      <small>{fmtDateTime(a.at, lang)}</small>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <Card title={`${t('records.captures')} (${records.captures.length})`} icon="camera">
            {!records.captures.length ? <Empty icon="camera">{t('records.none')}</Empty> : (
              <div className="adp-capture-grid">
                {records.captures.map((c) => (
                  <figure key={c.captureId}>
                    <RecordImage patientId={p.patientId} fileId={c.fileId} alt={c.note || c.captureId} />
                    <figcaption><strong>{fmtDateTime(c.createdAt, lang)}</strong>{c.doctorName && <small>{t('records.by', { name: c.doctorName })}</small>}{c.note && <small>{c.note}</small>}{c.aiScreeningId && <span className="adp-tag-demo">{t('common.demoAi')} ✓</span>}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </Card>

          <div className="adp-grid-2">
            <Card title={`${t('records.prescriptions')} (${records.prescriptions.length})`} icon="pill">
              {!records.prescriptions.length ? <Empty icon="pill">{t('records.none')}</Empty> : records.prescriptions.map((rx) => (
                <article key={rx.prescriptionId} className="adp-record-rx">
                  <div className="adp-appt-title"><strong>{rx.doctorName}</strong><small className="adp-muted">{fmtDate(rx.createdAt, lang)}</small></div>
                  <ul className="adp-bullets">{rx.medicines.map((m, i) => <li key={i}>{m.medicineName} — {m.dosage}, {m.frequency}, {m.durationDays} d</li>)}</ul>
                </article>
              ))}
            </Card>
            <Card title={`${t('records.consultations')} (${records.consultations.length})`} icon="video">
              {!records.consultations.length ? <Empty icon="video">{t('records.none')}</Empty> : (
                <div className="adp-list">
                  {records.consultations.map((c) => (
                    <div key={c.appointmentId} className="adp-mini-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{c.doctorName || '—'} · {c.consultationMode === 'online' ? t('common.online') : t('common.inPerson')}</strong>
                        <small>{fmtDateTime(c.startedAt, lang)} · {t('session.duration')} {fmtDuration(c.durationSeconds)} · {followUpLabel(t, c.followUp)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="adp-grid-2">
            <Card title={`${t('records.notes')} (${records.notes.length})`} icon="file">
              {!records.notes.length ? <Empty icon="file">{t('records.none')}</Empty> : records.notes.map((n) => (
                <article key={n.noteId} className="adp-record-rx">
                  <div className="adp-appt-title"><strong>{n.clinicianName}</strong><small className="adp-muted">{fmtDateTime(n.updatedAt, lang)} · {t('records.version', { n: n.version })}</small></div>
                  <p style={{ whiteSpace: 'pre-wrap', color: 'var(--adp-text-2)' }}>{n.text}</p>
                </article>
              ))}
            </Card>
            <Card title={`${t('records.appointments')} (${records.appointments.length})`} icon="calendar">
              {!records.appointments.length ? <Empty icon="calendar">{t('records.none')}</Empty> : (
                <div className="adp-list">
                  {records.appointments.map((a) => (
                    <div key={a.appointmentId} className="adp-mini-row">
                      <div style={{ flex: 1, minWidth: 0 }}><strong>{fmtDateTime(a.slotStartTime, lang)}</strong><small>{a.assignedDoctorName || '—'} · {a.consultationMode === 'online' ? t('common.online') : t('common.inPerson')}</small></div>
                      <StatusPill tone={appointmentTone(a.status)}>{t(`appt.status.${a.status}`)}</StatusPill>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}

    </>
  );
};
