import React, { useEffect, useRef, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { AiOralHealthEngine } from '../../components/AiEngine/AiOralHealthEngine';
import { PrescriptionModal } from '../../components/PrescriptionModal';
import { Card, Empty, Notice, PageHeader, Skeleton, StatusPill } from '../PortalShell';
import { accessToken, api, fmtDateTime, newMutationId, Translate, useApi } from '../lib';

interface CareLookup {
  patient: { patientId: string; fullName: string; hospitalId?: string };
  doctor: { userId: string; fullName: string } | null;
  canTreat: boolean; pending: boolean;
}
interface CareList {
  patients: Array<{ patientId: string; fullName: string; currentDoctorId: string | null; appointments: Array<{ consultationMode?: string; slotStartTime: string; status: string }> }>;
  transfers: Array<{ requestId: string; patientId: string; fromDoctorName: string; toDoctorName: string; status: string; incoming: boolean }>;
}
const records = (id: string) => { window.location.hash = `#/doctor/patients?id=${encodeURIComponent(id)}`; };

export const YourPatientsSummary: React.FC<{ t: Translate }> = ({ t }) => {
  const { data, error, loading } = useApi<CareList>('/api/v1/patient-care', [], 30000);
  return <Card title={t('care.title')} icon="users" action={<button className="adp-link" onClick={() => { window.location.hash = '#/doctor/your-patients'; }}>{t('common.viewAll')}</button>}>
    {error ? <Notice tone="error">{error}</Notice> : loading ? <Skeleton rows={2} /> : !data?.patients.length ? <Empty icon="users">{t('care.empty')}</Empty> : data.patients.slice(0, 5).map(p => <div className="adp-mini-row" key={p.patientId}><div><strong>{p.fullName}</strong><small>{p.patientId}</small></div><button className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => records(p.patientId)}>{t('records.open')}</button></div>)}
  </Card>;
};

export const PatientCarePage: React.FC<{ t: Translate; lang: LanguageCode; user: any; screening?: boolean; initialPatientId?: string }> = ({ t, lang, user, screening = false, initialPatientId = '' }) => {
  const { data, loading, error: listError, reload } = useApi<CareList>('/api/v1/patient-care', [], 15000);
  const prescriptions = useApi<{ prescriptions: Array<{ prescriptionId: string; patientId: string; patientName: string; doctorName: string; createdAt: string; medicines: Array<{ medicineName: string; dosage: string; frequency: string; durationDays: number }> }> }>('/api/v1/prescriptions/doctor/mine', [], 15000);
  const [query, setQuery] = useState(initialPatientId);
  const [selected, setSelected] = useState<CareLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [prescribing, setPrescribing] = useState(false);
  const lookupVersion = useRef(0);
  const lookup = async (id: string) => {
    const version = ++lookupVersion.current;
    setBusy(true); setSelected(null); setError(''); setMessage(''); setPrescribing(false);
    try {
      const result = await api<CareLookup>(`/api/v1/patient-care/${encodeURIComponent(id.trim())}`);
      if (lookupVersion.current === version) setSelected(result);
    } catch (e) { if (lookupVersion.current === version) setError(e instanceof Error ? e.message : t('common.error')); }
    finally { if (lookupVersion.current === version) setBusy(false); }
  };
  useEffect(() => { if (initialPatientId) { setQuery(initialPatientId); void lookup(initialPatientId); } return () => { lookupVersion.current += 1; }; }, [initialPatientId]);
  const selectedId = selected?.patient.patientId;
  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    const version = lookupVersion.current;
    void api<CareLookup>(`/api/v1/patient-care/${encodeURIComponent(selectedId)}`).then(result => {
      if (alive && version === lookupVersion.current) setSelected(result);
    }).catch(() => { /* A foreground action always rechecks permission on the server. */ });
    return () => { alive = false; };
  }, [data, selectedId]);
  const mutate = async (patientId: string, action: string, requestId?: string) => {
    lookupVersion.current += 1;
    setBusy(true); setError(''); setMessage('');
    try {
      await api(`/api/v1/patient-care/${encodeURIComponent(patientId)}/${action}`, { method: 'POST', body: JSON.stringify({ mutationId: newMutationId(), requestId }) });
      if (selected?.patient.patientId === patientId) setSelected(await api<CareLookup>(`/api/v1/patient-care/${encodeURIComponent(patientId)}`));
      await reload(); setMessage(t(`care.${action}Done`));
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setBusy(false); }
  };
  return <>
    <PageHeader title={t(screening ? 'nav.aiReview' : 'care.title')} subtitle={t('care.intro')} />
    <Card title={t('care.select')}>
      <form className="adp-records-search" onSubmit={e => { e.preventDefault(); void lookup(query); }}>
        <label className="adp-field" style={{ flex: 1 }}><span>{t('records.patientId')}</span><input value={query} disabled={busy} maxLength={100} onChange={e => { setQuery(e.target.value); setSelected(null); setPrescribing(false); lookupVersion.current += 1; }} /></label>
        <button className="adp-btn adp-btn-primary" disabled={busy || !query.trim()}>{t('care.select')}</button>
      </form>
      {selected && <div style={{ marginTop: 16 }}>
        <strong>{selected.patient.fullName}</strong> <span className="adp-code-tag">{selected.patient.patientId}</span>
        <p>{t('care.current')}: {selected.doctor?.fullName || t('care.unassigned')}</p>
        {selected.canTreat ? <StatusPill tone="green">{t('care.access')}</StatusPill> : selected.pending ? <Notice>{t('care.pending')}</Notice> : <button className="adp-btn adp-btn-primary" disabled={busy} onClick={() => void mutate(selected.patient.patientId, selected.doctor ? 'request' : 'claim')}>{t(selected.doctor ? 'care.request' : 'care.claim')}</button>}
        {selected.canTreat && !screening && <button className="adp-btn adp-btn-outline" style={{ marginLeft: 12 }} onClick={() => { window.location.hash = `#/doctor/ai-screening?id=${encodeURIComponent(selected.patient.patientId)}`; }}>{t('care.screen')}</button>}
      </div>}
    </Card>
    {(error || listError) && <Notice tone="error">{error || listError}</Notice>}
    {message && <Notice>{message}</Notice>}
    {screening && selected?.canTreat && <>
      <Card><button className="adp-btn adp-btn-outline" onClick={() => setPrescribing(true)}>{t('records.prescribe')}</button></Card>
      <AiOralHealthEngine key={selected.patient.patientId} patientId={selected.patient.patientId} patientName={selected.patient.fullName} hospitalId={user.hospitalId} userRole={user.role} token={accessToken()} currentLang={lang} />
      {prescribing && <PrescriptionModal patientId={selected.patient.patientId} patientName={selected.patient.fullName} doctorName={user.fullName} currentLang={lang} onClose={() => setPrescribing(false)} onPrescriptionCreated={() => { setPrescribing(false); void prescriptions.reload(); }} />}
    </>}
    {!screening && <>
      <Card title={t('care.requests')}>
        {!data?.transfers.length ? <Empty icon="users">{t('care.noRequests')}</Empty> : data.transfers.map(r => <div className="adp-mini-row" key={r.requestId} style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: 1 }}><strong>{r.patientId}</strong><small>{r.fromDoctorName} → {r.toDoctorName}</small><StatusPill tone={r.status === 'approved' ? 'green' : 'amber'}>{t(`care.status.${r.status}`)}</StatusPill></div>
          {r.incoming && r.status === 'pending' && <><button className="adp-btn adp-btn-primary adp-btn-sm" disabled={busy} onClick={() => void mutate(r.patientId, 'approve', r.requestId)}>{t('care.approve')}</button><button className="adp-btn adp-btn-outline adp-btn-sm" disabled={busy} onClick={() => void mutate(r.patientId, 'reject', r.requestId)}>{t('care.reject')}</button></>}
        </div>)}
      </Card>
      <Card title={t('care.appointmentPatients')}>
        {loading ? <Skeleton rows={3} /> : !data?.patients.length ? <Empty icon="users">{t('care.empty')}</Empty> : data.patients.map(p => <div className="adp-mini-row" key={p.patientId} style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: 1 }}><strong>{p.fullName}</strong><small>{p.patientId}</small><small>{[...new Set(p.appointments.map(a => t(a.consultationMode === 'online' ? 'common.online' : 'common.inPerson')))].join(' · ')}</small>{p.appointments[0] && <small>{fmtDateTime(p.appointments[0].slotStartTime, lang)}</small>}</div>
          <button className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => records(p.patientId)}>{t('records.open')}</button>
          <button className="adp-btn adp-btn-ghost adp-btn-sm" disabled={busy} onClick={() => { setQuery(p.patientId); void lookup(p.patientId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{t('care.select')}</button>
        </div>)}
      </Card>
      <Card title={t('records.prescriptions')}>
        {prescriptions.error ? <Notice tone="error">{prescriptions.error}</Notice> : prescriptions.loading ? <Skeleton rows={2} /> : !prescriptions.data?.prescriptions.length ? <Empty icon="pill">{t('records.none')}</Empty> : prescriptions.data.prescriptions.map(rx => <article className="adp-record-rx" key={rx.prescriptionId}><div className="adp-appt-title"><strong>{rx.patientName} · {rx.patientId}</strong><small>{fmtDateTime(rx.createdAt, lang)} · {rx.prescriptionId}</small></div><ul className="adp-bullets">{rx.medicines.map((m,i) => <li key={i}>{m.medicineName} — {m.dosage}, {m.frequency}, {m.durationDays} d</li>)}</ul><button className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => records(rx.patientId)}>{t('records.open')}</button></article>)}
      </Card>
    </>}
  </>;
};
