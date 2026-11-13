import React, { useEffect, useMemo, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { Card, Empty, Notice, PageHeader, PortalNavItem, PortalShell, Skeleton, StatusPill } from '../PortalShell';
import { Icon } from '../icons';
import { accessToken, api, fmtDate, initials, makeT, Translate, useApi } from '../lib';
import { NotificationsPage } from '../SharedPages';
import { Credentials, CredentialsDialog } from './CredentialsDialog';
import { FacilityDetailPage } from './FacilityDetailPage';

/* ---------- Types ---------- */
interface Facility { hospitalId: string; name: string; type: string; mandal?: string }
interface Department { code: string; name: string; group: string; typicalQualification: string }
interface Reference { facilities: Facility[]; departments: Department[]; qualifications: string[]; councils: string[]; languages: string[]; source: string }
interface Doctor {
  userId: string; doctorCode: string | null; username: string; fullName: string; phone: string | null; email: string | null;
  hospitalId: string; hospitalName: string; verificationStatus: 'pending_verification' | 'verified' | 'rejected';
  departmentName: string | null; specialization: string | null; qualifications: string[]; experienceYears: number | null; consultationFee: number | null;
  languages: string[]; consultationModes: string[]; councilName: string | null; councilRegistrationNumber: string | null;
  qualificationDocuments: Array<{ documentId: string }>; rejectionReason: string | null; createdAt: string;
}
interface DoctorList { doctors: Doctor[]; counts: { total: number; verified: number; pending: number; rejected: number } }

interface AdminPortalProps { currentUser: any; lang: LanguageCode; onChangeLang: (lang: LanguageCode) => void; route: string; onLogout: () => void }

const go = (path: string) => { window.location.hash = `#/admin${path ? `/${path}` : ''}`; };
const STATUS_TONE = { verified: 'green', pending_verification: 'amber', rejected: 'red' } as const;

/* ---------- Doctor card with review actions ---------- */
const DoctorCard: React.FC<{ t: Translate; lang: LanguageCode; doctor: Doctor; onChanged: () => void; onCredentials: (c: Credentials, name: string) => void; startOpen?: boolean }> = ({ t, lang, doctor, onChanged, onCredentials, startOpen }) => {
  const [open, setOpen] = useState(Boolean(startOpen));
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const pending = doctor.verificationStatus === 'pending_verification';

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(''); } };
  const verify = () => run('verify', async () => { await api(`/api/v1/admin/doctors/${encodeURIComponent(doctor.userId)}/verify`, { method: 'POST' }); onChanged(); });
  const reject = () => run('reject', async () => { await api(`/api/v1/admin/doctors/${encodeURIComponent(doctor.userId)}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) }); setRejecting(false); onChanged(); });
  const reset = () => run('reset', async () => { const data = await api<{ credentials: Credentials }>(`/api/v1/admin/doctors/${encodeURIComponent(doctor.userId)}/reset-password`, { method: 'POST' }); onCredentials(data.credentials, doctor.fullName); });
  const openDocument = (documentId: string) => run('doc', async () => {
    const res = await fetch(`/api/v1/storage/files/${encodeURIComponent(documentId)}`, { headers: { Authorization: `Bearer ${accessToken()}` } });
    if (!res.ok) throw new Error(t('common.error'));
    const url = URL.createObjectURL(await res.blob());
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  });

  const fee = doctor.consultationFee === null ? '—' : doctor.consultationFee === 0 ? t('admin.feeFree') : `₹${doctor.consultationFee}`;
  return (
    <article className="adp-doc-card">
      <div className="adp-doc-head">
        <span className="adp-appt-avatar" aria-hidden="true">{initials(doctor.fullName)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="adp-appt-title"><strong>{doctor.fullName}</strong><StatusPill tone={STATUS_TONE[doctor.verificationStatus]}>{t(`admin.status.${doctor.verificationStatus}`)}</StatusPill></div>
          <div className="adp-meta">
            {doctor.doctorCode && <span className="adp-code-tag">{doctor.doctorCode}</span>}
            <span><Icon.stethoscope size={16} />{doctor.departmentName || '—'}</span>
            <span><Icon.clinic size={16} />{doctor.hospitalName}</span>
          </div>
        </div>
        <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? t('admin.hide') : t('admin.details')}</button>
      </div>

      {open && (
        <div className="adp-doc-body">
          <dl className="adp-doc-grid">
            <div><dt>{t('admin.loginId')}</dt><dd>{doctor.username}</dd></div>
            <div><dt>{t('admin.qualifications')}</dt><dd>{doctor.qualifications.join(', ') || '—'}</dd></div>
            <div><dt>{t('admin.experience')}</dt><dd>{doctor.experienceYears !== null ? t('admin.years', { n: doctor.experienceYears }) : '—'}</dd></div>
            <div><dt>{t('admin.fee')}</dt><dd>{fee}</dd></div>
            <div><dt>{t('admin.modes')}</dt><dd>{doctor.consultationModes.map((mode) => (mode === 'online' ? t('common.online') : t('common.inPerson'))).join(', ') || '—'}</dd></div>
            <div><dt>{t('admin.languages')}</dt><dd>{doctor.languages.join(', ') || '—'}</dd></div>
            <div><dt>{t('admin.council')}</dt><dd>{doctor.councilName || '—'}</dd></div>
            <div><dt>{t('admin.councilNumber')}</dt><dd>{doctor.councilRegistrationNumber || '—'}</dd></div>
            <div><dt>{t('admin.contact')}</dt><dd>{[doctor.phone, doctor.email].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div><dt>{t('admin.facility')}</dt><dd>{doctor.hospitalName} · {fmtDate(doctor.createdAt, lang)}</dd></div>
          </dl>
          {doctor.specialization && doctor.specialization !== doctor.departmentName && <p className="adp-muted">{doctor.specialization}</p>}
          {doctor.rejectionReason && doctor.verificationStatus === 'rejected' && <Notice tone="error">{t('admin.rejectedBecause', { reason: doctor.rejectionReason })}</Notice>}

          <div className="adp-doc-actions">
            {doctor.qualificationDocuments.map((document) => (
              <button key={document.documentId} type="button" className="adp-btn adp-btn-outline adp-btn-sm" disabled={busy === 'doc'} onClick={() => void openDocument(document.documentId)}><Icon.file size={16} />{t('admin.viewDocument')}</button>
            ))}
            <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={!!busy} onClick={() => void reset()}><Icon.shield size={16} />{t('admin.resetPassword')}</button>
          </div>

          {pending && !rejecting && (
            <div className="adp-review-box">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="adp-btn adp-btn-primary adp-btn-sm" disabled={!!busy} onClick={() => void verify()}><Icon.check size={16} />{busy === 'verify' ? t('common.loading') : t('admin.verify')}</button>
                <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={!!busy} onClick={() => setRejecting(true)}>{t('admin.reject')}</button>
              </div>
            </div>
          )}
          {rejecting && (
            <div className="adp-review-box">
              <label className="adp-field">{t('admin.rejectReason')}<textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="adp-btn adp-btn-danger adp-btn-sm" disabled={reason.trim().length < 5 || !!busy} onClick={() => void reject()}>{t('admin.confirmReject')}</button>
                <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => setRejecting(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </article>
  );
};

/* ---------- Dashboard ---------- */
const DashboardPage: React.FC<{ t: Translate; lang: LanguageCode; user: any; reference: Reference | null; onCredentials: (c: Credentials, name: string) => void }> = ({ t, lang, user, reference, onCredentials }) => {
  const pending = useApi<DoctorList>('/api/v1/admin/doctors?status=pending', [], 30_000);
  const all = useApi<DoctorList>('/api/v1/admin/doctors?status=all', [], 30_000);
  const counts = all.data?.counts;
  const stats: Array<{ icon: keyof typeof Icon; label: string; value: number | string; tone?: string }> = [
    { icon: 'users', label: t('admin.stats.total'), value: counts?.total ?? '–' },
    { icon: 'check', label: t('admin.stats.verified'), value: counts?.verified ?? '–' },
    { icon: 'clock', label: t('admin.stats.pending'), value: counts?.pending ?? '–', tone: counts?.pending ? 'is-alert' : '' },
    { icon: 'clinic', label: t('admin.stats.facilities'), value: reference?.facilities.length ?? '–' },
  ];
  const reload = () => { void pending.reload(); void all.reload(); };
  return (
    <>
      <PageHeader title={t('admin.greeting', { name: String(user?.fullName || '').replace(/\s*\(.*\)\s*/, '') })} subtitle={t('admin.subtitle')}
        action={<button type="button" className="adp-btn adp-btn-primary" onClick={() => go('add-doctor')}><Icon.user size={18} />{t('admin.nav.addDoctor')}</button>} />
      <div className="adp-stats">
        {stats.map((item) => { const IconCmp = Icon[item.icon]; return <div key={item.label} className={`adp-stat ${item.tone || ''}`}><span><IconCmp size={22} /></span><div><strong>{item.value}</strong><small>{item.label}</small></div></div>; })}
      </div>
      <div className="adp-grid-2">
        <Card title={t('admin.pendingTitle')} icon="clock" action={<button type="button" className="adp-link" onClick={() => go('doctors?status=pending')}>{t('common.viewAll')} <Icon.arrow size={16} /></button>}>
          {pending.loading ? <Skeleton rows={2} /> : pending.error ? <Notice tone="error">{pending.error}</Notice>
            : !pending.data?.doctors.length ? <Empty icon="check">{t('admin.noPending')}</Empty>
            : <div className="adp-list">{pending.data.doctors.slice(0, 5).map((doctor) => <DoctorCard key={doctor.userId} t={t} lang={lang} doctor={doctor} onChanged={reload} onCredentials={onCredentials} />)}</div>}
        </Card>
        <Card title={t('admin.recentTitle')} icon="users">
          {all.loading ? <Skeleton rows={3} /> : !all.data?.doctors.length ? <Empty icon="users">{t('admin.noDoctors')}</Empty> : (
            <div className="adp-list">
              {all.data.doctors.slice(0, 6).map((doctor) => (
                <div key={doctor.userId} className="adp-mini-row">
                  <span className="adp-appt-avatar" style={{ width: 40, height: 40, borderRadius: 12 }}>{initials(doctor.fullName)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}><strong>{doctor.fullName}</strong><small>{[doctor.doctorCode, doctor.departmentName].filter(Boolean).join(' · ')}</small></div>
                  <StatusPill tone={STATUS_TONE[doctor.verificationStatus]}>{t(`admin.status.${doctor.verificationStatus}`)}</StatusPill>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
};

/* ---------- Doctors list ---------- */
const DoctorsPage: React.FC<{ t: Translate; lang: LanguageCode; initialStatus: string; onCredentials: (c: Credentials, name: string) => void }> = ({ t, lang, initialStatus, onCredentials }) => {
  const [status, setStatus] = useState(['pending', 'verified', 'rejected'].includes(initialStatus) ? initialStatus : 'all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const id = window.setTimeout(() => setDebounced(query.trim()), 300); return () => window.clearTimeout(id); }, [query]);
  const { data, error, loading, reload } = useApi<DoctorList>(`/api/v1/admin/doctors?status=${status}${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}`, [status, debounced]);
  return (
    <>
      <PageHeader title={t('admin.nav.doctors')} action={<button type="button" className="adp-btn adp-btn-primary" onClick={() => go('add-doctor')}><Icon.user size={18} />{t('admin.nav.addDoctor')}</button>} />
      <Card>
        <div className="adp-toolbar">
          <label className="adp-field adp-search"><span className="sr-only">{t('admin.search')}</span><input type="search" placeholder={t('admin.search')} value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <div className="adp-tabs" role="group">
            {(['all', 'pending', 'verified', 'rejected'] as const).map((key) => (
              <button key={key} type="button" aria-pressed={status === key} onClick={() => setStatus(key)}>
                {t(`admin.filter.${key}`)}{data?.counts && key !== 'all' ? ` (${data.counts[key]})` : data?.counts ? ` (${data.counts.total})` : ''}
              </button>
            ))}
          </div>
        </div>
        {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice> : !data?.doctors.length ? <Empty icon="users">{t('admin.noDoctors')}</Empty>
          : <div className="adp-list">{data.doctors.map((doctor) => <DoctorCard key={doctor.userId} t={t} lang={lang} doctor={doctor} onChanged={() => void reload()} onCredentials={onCredentials} />)}</div>}
      </Card>
    </>
  );
};

/* ---------- Add doctor ---------- */
const AddDoctorPage: React.FC<{ t: Translate; reference: Reference | null; referenceError: string; onCreated: (c: Credentials, name: string) => void; presetHospitalId?: string }> = ({ t, reference, referenceError, onCreated, presetHospitalId }) => {
  const empty = { hospitalId: presetHospitalId || '', department: '', fullName: '', phone: '', email: '', specialization: '', experienceYears: '', consultationFee: '', councilName: '', councilRegistrationNumber: '', username: '', password: '' };
  const [form, setForm] = useState(empty);
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>(['Telugu']);
  const [modes, setModes] = useState<string[]>(['online', 'offline']);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const toggle = (list: string[], setter: (v: string[]) => void, value: string) => setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const facilities = reference?.facilities || [];
  const groups = useMemo(() => {
    const map = new Map<string, Department[]>();
    (reference?.departments || []).forEach((item) => map.set(item.group, [...(map.get(item.group) || []), item]));
    return [...map.entries()];
  }, [reference]);
  const department = reference?.departments.find((item) => item.code === form.department);

  useEffect(() => { if (facilities.length === 1 && !form.hospitalId) setForm((prev) => ({ ...prev, hospitalId: facilities[0].hospitalId })); }, [facilities, form.hospitalId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setError(t('admin.form.document')); return; }
    if (!qualifications.length || !modes.length) { setError(t('common.error')); return; }
    setBusy(true); setError('');
    try {
      const upload = new FormData();
      upload.append('hospitalId', form.hospitalId);
      upload.append('file', file, file.name);
      const document = await api<{ fileId: string }>('/api/v1/admin/doctors/documents', { method: 'POST', body: upload });
      const data = await api<{ credentials: Credentials }>('/api/v1/admin/doctors', {
        method: 'POST',
        body: JSON.stringify({
          hospitalId: form.hospitalId, department: form.department, fullName: form.fullName.trim(), phone: form.phone.trim(),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.specialization.trim() ? { specialization: form.specialization.trim() } : {}),
          qualifications, languages, consultationModes: modes,
          experienceYears: Number(form.experienceYears), consultationFee: Number(form.consultationFee),
          councilName: form.councilName, councilRegistrationNumber: form.councilRegistrationNumber.trim(),
          ...(form.username.trim() ? { username: form.username.trim().toLowerCase() } : {}),
          ...(form.password ? { password: form.password } : {}),
          qualificationDocumentId: document.fileId,
        }),
      });
      const name = form.fullName.trim();
      setForm({ ...empty, hospitalId: form.hospitalId }); setQualifications([]); setFile(null);
      onCreated(data.credentials, name);
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setBusy(false); }
  };

  if (referenceError) return <Notice tone="error">{referenceError}</Notice>;
  if (!reference) return <Skeleton rows={4} />;

  return (
    <>
      <PageHeader title={t('admin.form.title')} subtitle={t('admin.form.intro')} />
      <form className="adp-form" onSubmit={submit}>
        <Card title={t('admin.form.sectionPractice')} icon="clinic">
          <div className="adp-form-grid">
            <label className="adp-field">{t('admin.facility')}
              <select required value={form.hospitalId} onChange={set('hospitalId')}>
                <option value="">{t('admin.form.chooseFacility')}</option>
                {facilities.map((item) => <option key={item.hospitalId} value={item.hospitalId}>{item.name}{item.mandal ? ` — ${item.mandal}` : ''}</option>)}
              </select>
            </label>
            <label className="adp-field">{t('admin.department')}
              <select required value={form.department} onChange={set('department')}>
                <option value="">{t('admin.form.chooseDepartment')}</option>
                {groups.map(([group, items]) => <optgroup key={group} label={group}>{items.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</optgroup>)}
              </select>
              <small className="adp-hint">{department ? department.typicalQualification : t('admin.form.departmentHint')}</small>
            </label>
            <label className="adp-field adp-span-2">{t('admin.form.specialization')}<input value={form.specialization} maxLength={120} onChange={set('specialization')} /></label>
          </div>
        </Card>

        <Card title={t('admin.form.sectionPersonal')} icon="user">
          <div className="adp-form-grid">
            <label className="adp-field">{t('admin.form.fullName')}<input required minLength={3} maxLength={120} value={form.fullName} onChange={set('fullName')} placeholder="Dr. " /></label>
            <label className="adp-field">{t('admin.form.phone')}<input required type="tel" inputMode="tel" pattern="\+?[0-9 ]{10,15}" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" /></label>
            <label className="adp-field adp-span-2">{t('admin.form.email')}<input type="email" maxLength={120} value={form.email} onChange={set('email')} /></label>
          </div>
        </Card>

        <Card title={t('admin.form.sectionProfessional')} icon="stethoscope">
          <div className="adp-form-grid">
            <fieldset className="adp-fieldset adp-span-2"><legend>{t('admin.qualifications')}</legend>
              <div className="adp-chip-toggle">{reference.qualifications.map((item) => <button key={item} type="button" aria-pressed={qualifications.includes(item)} onClick={() => toggle(qualifications, setQualifications, item)}>{item}</button>)}</div>
            </fieldset>
            <label className="adp-field">{t('admin.form.experience')}<input required type="number" min={0} max={60} value={form.experienceYears} onChange={set('experienceYears')} /></label>
            <label className="adp-field">{t('admin.form.fee')}<input required type="number" min={0} max={100000} step={10} value={form.consultationFee} onChange={set('consultationFee')} /><small className="adp-hint">{t('admin.form.feeHint')}</small></label>
            <fieldset className="adp-fieldset"><legend>{t('admin.modes')}</legend>
              <div className="adp-chip-toggle">
                <button type="button" aria-pressed={modes.includes('online')} onClick={() => toggle(modes, setModes, 'online')}><Icon.video size={16} />{t('admin.form.online')}</button>
                <button type="button" aria-pressed={modes.includes('offline')} onClick={() => toggle(modes, setModes, 'offline')}><Icon.clinic size={16} />{t('admin.form.offline')}</button>
              </div>
            </fieldset>
            <fieldset className="adp-fieldset"><legend>{t('admin.languages')}</legend>
              <div className="adp-chip-toggle">{reference.languages.map((item) => <button key={item} type="button" aria-pressed={languages.includes(item)} onClick={() => toggle(languages, setLanguages, item)}>{item}</button>)}</div>
            </fieldset>
            <label className="adp-field">{t('admin.council')}
              <select required value={form.councilName} onChange={set('councilName')}>
                <option value="">{t('admin.form.chooseCouncil')}</option>
                {reference.councils.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="adp-field">{t('admin.councilNumber')}<input required minLength={3} maxLength={60} value={form.councilRegistrationNumber} onChange={set('councilRegistrationNumber')} /></label>
          </div>
        </Card>

        <Card title={t('admin.form.sectionLogin')} icon="shield">
          <div className="adp-form-grid">
            <label className="adp-field">{t('admin.form.loginId')}<input pattern="[A-Za-z0-9._\-]{3,40}" autoComplete="off" value={form.username} onChange={set('username')} /><small className="adp-hint">{t('admin.form.loginIdHint')}</small></label>
            <label className="adp-field">{t('admin.form.password')}<input type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={set('password')} /><small className="adp-hint">{t('admin.form.passwordHint')}</small></label>
          </div>
        </Card>

        <Card title={t('admin.form.sectionDocument')} icon="file">
          <label className="adp-dropzone" style={{ minHeight: 120 }}>
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} aria-label={t('admin.form.document')} />
            <span style={{ display: 'grid', justifyItems: 'center', gap: 8, color: 'var(--adp-text-2)' }}>
              <span className="adp-quick-icon"><Icon.file size={22} /></span>
              <strong>{file ? file.name : t('admin.form.document')}</strong>
            </span>
          </label>
        </Card>

        {error && <Notice tone="error">{error}</Notice>}
        <div><button type="submit" className="adp-btn adp-btn-primary" disabled={busy}><Icon.check size={18} />{busy ? t('admin.form.submitting') : t('admin.form.submit')}</button></div>
      </form>
    </>
  );
};

/* ---------- Facilities ---------- */
const FacilitiesPage: React.FC<{ t: Translate; reference: Reference | null }> = ({ t, reference }) => {
  const { data } = useApi<DoctorList>('/api/v1/admin/doctors?status=all', []);
  if (!reference) return <Skeleton rows={3} />;
  const byFacility = (id: string, status: Doctor['verificationStatus']) => (data?.doctors || []).filter((d) => d.hospitalId === id && d.verificationStatus === status).length;
  return (
    <>
      <PageHeader title={t('admin.facilitiesTitle')} />
      <div className="adp-facility-grid">
        {reference.facilities.map((item) => (
          <a key={item.hospitalId} className="adp-facility-link" href={`#/admin/facilities/${encodeURIComponent(item.hospitalId)}`}><Card>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="adp-quick-icon"><Icon.clinic size={22} /></span>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: '1rem' }}>{item.name}</strong>
                <small className="adp-muted">{t(`admin.type.${item.type}`)}{item.mandal ? ` · ${item.mandal}` : ''}</small>
                <p style={{ marginTop: 8, fontWeight: 600, color: 'var(--adp-text-2)' }}>{t('admin.facilityDoctors', { verified: byFacility(item.hospitalId, 'verified'), pending: byFacility(item.hospitalId, 'pending_verification') })}</p>
              </div>
            </div>
          </Card></a>
        ))}
      </div>
    </>
  );
};

/* ---------- Portal ---------- */
export const AdminPortal: React.FC<AdminPortalProps> = ({ currentUser, lang, onChangeLang, route, onLogout }) => {
  const t = useMemo(() => makeT(lang), [lang]);
  const [pathPart, queryPart = ''] = route.replace(/^#\/admin\/?/, '').split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const page = segments[0] || 'dashboard';
  const isSystemAdmin = String(currentUser?.role || '').toLowerCase() === 'system_admin';
  const ownHospitalId: string | undefined = currentUser?.hospitalId;
  const query = new URLSearchParams(queryPart);
  const reference = useApi<Reference>('/api/v1/admin/doctors/reference', []);
  const notifications = useApi<{ unreadCount: number }>('/api/v1/notifications?limit=1', [], 30_000);
  const unread = Number(notifications.data?.unreadCount || 0);
  const [issued, setIssued] = useState<{ credentials: Credentials; name: string; reset: boolean } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const nav: PortalNavItem[] = [
    { key: 'dashboard', label: t('admin.nav.dashboard'), icon: 'home', mobile: true },
    { key: 'doctors', label: t('admin.nav.doctors'), icon: 'users', mobile: true },
    { key: 'add-doctor', label: t('admin.nav.addDoctor'), icon: 'user', mobile: true },
    isSystemAdmin || !ownHospitalId
      ? { key: 'facilities', label: t('admin.nav.facilities'), icon: 'clinic', mobile: true }
      : { key: 'my-facility', label: t('facility.myFacility'), icon: 'clinic', mobile: true },
    { key: 'notifications', label: t('admin.nav.notifications'), icon: 'bell', badge: unread },
  ];
  const active = page === 'facilities' && !isSystemAdmin && ownHospitalId ? 'my-facility' : nav.some((item) => item.key === page) ? page : 'dashboard';
  const facilityId = page === 'my-facility' ? ownHospitalId : page === 'facilities' ? segments[1] : undefined;
  const showCredentials = (reset: boolean) => (credentials: Credentials, name: string) => setIssued({ credentials, name, reset });

  let content: React.ReactNode;
  switch (active) {
    case 'doctors': content = <DoctorsPage key={`${queryPart}-${refreshKey}`} t={t} lang={lang} initialStatus={query.get('status') || 'all'} onCredentials={showCredentials(true)} />; break;
    case 'add-doctor': content = <AddDoctorPage key={queryPart} t={t} reference={reference.data} referenceError={reference.error} onCreated={showCredentials(false)} presetHospitalId={query.get('hospital') || undefined} />; break;
    case 'facilities': case 'my-facility': content = facilityId
      ? <FacilityDetailPage key={facilityId} t={t} lang={lang} hospitalId={facilityId} isSystemAdmin={isSystemAdmin} initialTab={query.get('tab') || undefined} showBack={isSystemAdmin} />
      : <FacilitiesPage t={t} reference={reference.data} />; break;
    case 'notifications': content = <NotificationsPage t={t} lang={lang} onChanged={() => void notifications.reload()} />; break;
    default: content = <DashboardPage key={refreshKey} t={t} lang={lang} user={currentUser} reference={reference.data} onCredentials={showCredentials(true)} />;
  }

  return (
    <PortalShell
      t={t} lang={lang} onChangeLang={onChangeLang}
      userName={currentUser?.fullName || currentUser?.username || 'Admin'} userRole={String(currentUser?.role || 'admin').replace(/_/g, ' ')}
      nav={nav} active={active} onNavigate={(key) => go(key === 'dashboard' ? '' : key === 'my-facility' && ownHospitalId ? `facilities/${encodeURIComponent(ownHospitalId)}` : key)} onLogout={onLogout}
      notificationCount={unread} onOpenNotifications={() => go('notifications')}
    >
      {content}
      {issued && <CredentialsDialog t={t} credentials={issued.credentials} doctorName={issued.name} reset={issued.reset} onClose={() => { const wasNew = !issued.reset; setIssued(null); setRefreshKey((k) => k + 1); if (wasNew) go('doctors?status=pending'); }} />}
    </PortalShell>
  );
};
