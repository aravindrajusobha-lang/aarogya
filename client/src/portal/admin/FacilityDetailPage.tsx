import React, { useMemo, useState } from 'react';
import { LanguageCode } from '../../i18n';
import { Card, Empty, Notice, PageHeader, Skeleton, StatusPill } from '../PortalShell';
import { Icon } from '../icons';
import { api, fmtDate, fmtDateTime, initials, Translate, useApi } from '../lib';
import { Credentials, CredentialsDialog } from './CredentialsDialog';

type Tab = 'overview' | 'beds' | 'medicines' | 'equipment' | 'doctors' | 'admins';
interface Overview {
  hospital: { hospitalId: string; name: string; type: string; mandal?: string; district?: string; address?: string | null; contactNumber?: string | null };
  beds: { total: number; occupied: number; wards: number };
  medicines: { items: number; lowStock: number; outOfStock: number; expiringSoon: number };
  equipment: { items: number; units: number; needsRepair: number };
  staff: { doctorsVerified: number; doctorsPending: number; facilityAdmins: number };
}
interface Ward { wardId: string; name: string; wardType: string; totalBeds: number; occupiedBeds: number; notes?: string; updatedAt: string }
interface Medicine { itemId: string; name: string; form: string; strength?: string; unit?: string; stock: number; reorderLevel: number; batchNo?: string; expiryDate?: string; updatedAt: string }
interface Movement { movementId: string; change: number; reason: string; note?: string; balanceAfter: number; byName?: string; createdAt: string }
interface Equipment { equipmentId: string; name: string; category: string; quantity: number; functionalCount: number; lastServicedAt?: string; notes?: string }

const WARD_TYPES = ['general', 'emergency', 'maternity', 'pediatric', 'surgical', 'icu', 'isolation', 'dental', 'other'];
const FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'gel', 'mouthwash', 'drops', 'other'];
const CATEGORIES = ['dental', 'diagnostic', 'surgical', 'life_support', 'sterilization', 'imaging', 'other'];
const num = (value: string) => (value === '' ? NaN : Number(value));
const base = (hospitalId: string) => `/api/v1/facility-ops/${encodeURIComponent(hospitalId)}`;

/* ---------- Overview ---------- */
const OverviewTab: React.FC<{ t: Translate; data: Overview }> = ({ t, data }) => {
  const pct = data.beds.total ? Math.round((data.beds.occupied / data.beds.total) * 100) : 0;
  return (
    <>
      <div className="adp-stats">
        <div className={`adp-stat ${pct >= 90 ? 'is-live' : ''}`}><span><Icon.home size={22} /></span><div><strong>{data.beds.occupied}/{data.beds.total}</strong><small>{t('facility.overview.beds')} · {t('facility.overview.freeBeds', { n: data.beds.total - data.beds.occupied })}</small></div></div>
        <div className={`adp-stat ${data.medicines.lowStock ? 'is-alert' : ''}`}><span><Icon.pill size={22} /></span><div><strong>{data.medicines.items}</strong><small>{t('facility.overview.medicines')} · {t('facility.overview.lowStock', { n: data.medicines.lowStock })}</small></div></div>
        <div className={`adp-stat ${data.equipment.needsRepair ? 'is-alert' : ''}`}><span><Icon.stethoscope size={22} /></span><div><strong>{data.equipment.units}</strong><small>{t('facility.overview.equipment')} · {t('facility.overview.needsRepair', { n: data.equipment.needsRepair })}</small></div></div>
        <div className="adp-stat"><span><Icon.users size={22} /></span><div><strong>{data.staff.doctorsVerified}</strong><small>{t('facility.overview.doctors')} · {t('facility.overview.doctorsPending', { n: data.staff.doctorsPending })}</small></div></div>
      </div>
      <div className="adp-grid-2">
        <Card title={t('facility.overview.beds')} icon="home">
          <div className="adp-bed-meter" role="img" aria-label={`${pct}%`}><span style={{ width: `${pct}%` }} className={pct >= 90 ? 'is-full' : pct >= 70 ? 'is-busy' : ''} /></div>
          <p className="adp-muted" style={{ marginTop: 8 }}>{pct}% · {t('facility.overview.wards', { n: data.beds.wards })}</p>
          {(data.medicines.outOfStock > 0 || data.medicines.expiringSoon > 0) && (
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              {data.medicines.outOfStock > 0 && <Notice tone="error">{t('facility.overview.outOfStock', { n: data.medicines.outOfStock })}</Notice>}
              {data.medicines.expiringSoon > 0 && <Notice tone="warn">{t('facility.overview.expiring', { n: data.medicines.expiringSoon })}</Notice>}
            </div>
          )}
        </Card>
        <Card title={t('facility.overview.info')} icon="clinic">
          <dl className="adp-doc-grid">
            <div><dt>{t('admin.facility')}</dt><dd>{data.hospital.name}</dd></div>
            <div><dt>{t('facility.overview.type')}</dt><dd>{t(`admin.type.${data.hospital.type}`)}</dd></div>
            <div><dt>{t('facility.overview.mandal')}</dt><dd>{data.hospital.mandal || '—'}</dd></div>
            <div><dt>{t('facility.overview.contact')}</dt><dd>{data.hospital.contactNumber || '—'}</dd></div>
            <div><dt>{t('facility.overview.address')}</dt><dd>{data.hospital.address || data.hospital.district || '—'}</dd></div>
            <div><dt>{t('facility.overview.admins')}</dt><dd>{data.staff.facilityAdmins}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
};

/* ---------- Beds ---------- */
const BedsTab: React.FC<{ t: Translate; hospitalId: string; onChanged: () => void }> = ({ t, hospitalId, onChanged }) => {
  const { data, loading, error, reload } = useApi<{ wards: Ward[] }>(`${base(hospitalId)}/wards`, [hospitalId]);
  const [form, setForm] = useState({ name: '', wardType: 'general', totalBeds: '', occupiedBeds: '0' });
  const [editing, setEditing] = useState<string | null>(null);
  const [editTotal, setEditTotal] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = async () => { await reload(); onChanged(); };
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMessage(''); try { await fn(); await refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(false); } };

  const add = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    await api(`${base(hospitalId)}/wards`, { method: 'POST', body: JSON.stringify({ name: form.name.trim(), wardType: form.wardType, totalBeds: num(form.totalBeds), occupiedBeds: num(form.occupiedBeds) || 0 }) });
    setForm({ name: '', wardType: 'general', totalBeds: '', occupiedBeds: '0' });
  }); };
  const patch = (ward: Ward, body: Partial<Ward>) => run(() => api(`${base(hospitalId)}/wards/${ward.wardId}`, { method: 'PATCH', body: JSON.stringify(body) }));

  return (
    <>
      <Card title={t('facility.beds.add')} icon="home">
        <form className="adp-form-grid adp-inline-form" onSubmit={add}>
          <label className="adp-field">{t('facility.beds.name')}<input required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="General Ward A" /></label>
          <label className="adp-field">{t('facility.beds.type')}<select value={form.wardType} onChange={(e) => setForm({ ...form, wardType: e.target.value })}>{WARD_TYPES.map((w) => <option key={w} value={w}>{t(`facility.beds.types.${w}`)}</option>)}</select></label>
          <label className="adp-field">{t('facility.beds.total')}<input required type="number" min={0} max={5000} value={form.totalBeds} onChange={(e) => setForm({ ...form, totalBeds: e.target.value })} /></label>
          <label className="adp-field">{t('facility.beds.occupied')}<input type="number" min={0} max={5000} value={form.occupiedBeds} onChange={(e) => setForm({ ...form, occupiedBeds: e.target.value })} /></label>
          <div className="adp-inline-submit"><button type="submit" className="adp-btn adp-btn-primary" disabled={busy}><Icon.check size={18} />{t('facility.beds.save')}</button></div>
        </form>
        {message && <div style={{ marginTop: 10 }}><Notice tone="error">{message}</Notice></div>}
      </Card>
      <Card>
        {loading ? <Skeleton rows={2} /> : error ? <Notice tone="error">{error}</Notice> : !data?.wards.length ? <Empty icon="home">{t('facility.beds.empty')}</Empty> : (
          <div className="adp-ops-grid">
            {data.wards.map((ward) => {
              const free = ward.totalBeds - ward.occupiedBeds;
              const pct = ward.totalBeds ? Math.round((ward.occupiedBeds / ward.totalBeds) * 100) : 0;
              return (
                <article key={ward.wardId} className="adp-ops-card">
                  <div className="adp-appt-title"><strong>{ward.name}</strong><StatusPill tone={free === 0 ? 'red' : pct >= 80 ? 'amber' : 'green'}>{free === 0 ? t('facility.beds.full') : `${free} ${t('facility.beds.free')}`}</StatusPill></div>
                  <small className="adp-muted">{t(`facility.beds.types.${ward.wardType}`)}</small>
                  <div className="adp-big-count"><strong>{ward.occupiedBeds}</strong><span>/ {ward.totalBeds}</span></div>
                  <div className="adp-bed-meter"><span style={{ width: `${pct}%` }} className={pct >= 90 ? 'is-full' : pct >= 70 ? 'is-busy' : ''} /></div>
                  <div className="adp-ops-actions">
                    <button type="button" className="adp-btn adp-btn-outline adp-btn-sm" disabled={busy || free === 0} onClick={() => void patch(ward, { occupiedBeds: ward.occupiedBeds + 1 })}>{t('facility.beds.admit')}</button>
                    <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={busy || ward.occupiedBeds === 0} onClick={() => void patch(ward, { occupiedBeds: ward.occupiedBeds - 1 })}>{t('facility.beds.discharge')}</button>
                  </div>
                  {editing === ward.wardId ? (
                    <div className="adp-ops-actions">
                      <label className="adp-field" style={{ flex: 1 }}><span className="sr-only">{t('facility.beds.total')}</span><input type="number" min={ward.occupiedBeds} max={5000} value={editTotal} onChange={(e) => setEditTotal(e.target.value)} /></label>
                      <button type="button" className="adp-btn adp-btn-primary adp-btn-sm" disabled={busy || Number.isNaN(num(editTotal))} onClick={() => { void patch(ward, { totalBeds: num(editTotal) }); setEditing(null); }}>{t('facility.beds.save')}</button>
                      <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => setEditing(null)}>{t('facility.beds.cancel')}</button>
                    </div>
                  ) : (
                    <div className="adp-ops-actions">
                      <button type="button" className="adp-link" onClick={() => { setEditing(ward.wardId); setEditTotal(String(ward.totalBeds)); }}>{t('facility.beds.edit')} · {t('facility.beds.total')}</button>
                      <button type="button" className="adp-link adp-link-danger" disabled={busy} onClick={() => void run(() => api(`${base(hospitalId)}/wards/${ward.wardId}`, { method: 'DELETE' }))}>{t('facility.beds.remove')}</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
};

/* ---------- Medicines ---------- */
const MedicineRow: React.FC<{ t: Translate; lang: LanguageCode; hospitalId: string; item: Medicine; onChanged: () => void }> = ({ t, lang, hospitalId, item, onChanged }) => {
  const [mode, setMode] = useState<'' | 'in' | 'out'>('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('received');
  const [note, setNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const history = useApi<{ movements: Movement[] }>(showHistory ? `${base(hospitalId)}/medicines/${item.itemId}/movements` : null, [showHistory, item.stock]);
  const expiry = item.expiryDate ? new Date(item.expiryDate).getTime() : null;
  const expired = expiry !== null && expiry < Date.now();
  const expiringSoon = expiry !== null && !expired && expiry < Date.now() + 60 * 86400000;
  const status = item.stock === 0 ? ['red', t('facility.meds.out')] : expired ? ['red', t('facility.meds.expired')] : item.stock <= item.reorderLevel ? ['amber', t('facility.meds.low')] : expiringSoon ? ['amber', t('facility.meds.expiring')] : ['green', t('facility.meds.inStock')];

  const open = (next: 'in' | 'out') => { setMode(next); setReason(next === 'in' ? 'received' : 'dispensed'); setQty(''); setNote(''); setError(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api(`${base(hospitalId)}/medicines/${item.itemId}/stock`, { method: 'POST', body: JSON.stringify({ quantity: num(qty), direction: mode, reason, ...(note.trim() ? { note: note.trim() } : {}) }) });
      setMode(''); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(false); }
  };

  return (
    <article className="adp-ops-row">
      <div className="adp-ops-row-main">
        <div style={{ minWidth: 0 }}>
          <div className="adp-appt-title"><strong>{item.name}</strong>{item.strength && <span className="adp-muted">{item.strength}</span>}<StatusPill tone={status[0] as any}>{status[1]}</StatusPill></div>
          <small className="adp-muted">{t(`facility.meds.forms.${item.form}`)}{item.batchNo ? ` · ${item.batchNo}` : ''}{item.expiryDate ? ` · ${t('facility.meds.expiry').replace(/\s*\(.*\)/, '')}: ${fmtDate(item.expiryDate, lang)}` : ''} · {t('facility.meds.reorder')}: {item.reorderLevel}</small>
        </div>
        <div className="adp-big-count"><strong>{item.stock}</strong><span>{item.unit || ''}</span></div>
        <div className="adp-ops-actions">
          <button type="button" className="adp-btn adp-btn-outline adp-btn-sm" onClick={() => open('in')}>+ {t('facility.meds.receive')}</button>
          <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={item.stock === 0} onClick={() => open('out')}>− {t('facility.meds.issue')}</button>
          <button type="button" className="adp-link" onClick={() => setShowHistory((v) => !v)}>{showHistory ? t('facility.meds.hideHistory') : t('facility.meds.history')}</button>
        </div>
      </div>
      {mode && (
        <form className="adp-ops-stock-form" onSubmit={submit}>
          <label className="adp-field">{t('facility.meds.quantity')}<input required type="number" min={1} max={mode === 'out' ? item.stock : 10000000} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></label>
          <label className="adp-field">{t('facility.meds.reason')}
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {(mode === 'in' ? ['received', 'adjustment'] : ['dispensed', 'expired', 'damaged', 'adjustment']).map((r) => <option key={r} value={r}>{t(`facility.meds.reasons.${r}`)}</option>)}
            </select>
          </label>
          <label className="adp-field">{t('facility.meds.note')}<input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="adp-inline-submit" style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="adp-btn adp-btn-primary adp-btn-sm" disabled={busy || !(num(qty) > 0)}>{t('facility.meds.confirm')}</button>
            <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" onClick={() => setMode('')}>{t('facility.beds.cancel')}</button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
        </form>
      )}
      {showHistory && (
        <div className="adp-ops-history">
          {history.loading ? <Skeleton rows={1} /> : !history.data?.movements.length ? <p className="adp-muted">{t('facility.meds.noHistory')}</p> : (
            <table className="adp-table" style={{ minWidth: 520 }}>
              <tbody>
                {history.data.movements.map((m) => (
                  <tr key={m.movementId}>
                    <td>{fmtDateTime(m.createdAt, lang)}</td>
                    <td style={{ color: m.change > 0 ? 'var(--adp-primary-strong)' : 'var(--adp-red)', fontWeight: 800 }}>{m.change > 0 ? `+${m.change}` : m.change}</td>
                    <td>{t(`facility.meds.reasons.${m.reason}`)}{m.note ? <small>{m.note}</small> : null}</td>
                    <td>= {m.balanceAfter}</td>
                    <td><small>{m.byName || ''}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </article>
  );
};

const MedicinesTab: React.FC<{ t: Translate; lang: LanguageCode; hospitalId: string; onChanged: () => void }> = ({ t, lang, hospitalId, onChanged }) => {
  const { data, loading, error, reload } = useApi<{ medicines: Medicine[] }>(`${base(hospitalId)}/medicines`, [hospitalId]);
  const empty = { name: '', form: 'tablet', strength: '', unit: 'tablets', stock: '', reorderLevel: '', batchNo: '', expiryDate: '' };
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = async () => { await reload(); onChanged(); };
  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api(`${base(hospitalId)}/medicines`, { method: 'POST', body: JSON.stringify({ name: form.name.trim(), form: form.form, strength: form.strength.trim(), unit: form.unit.trim() || 'units', stock: num(form.stock) || 0, reorderLevel: num(form.reorderLevel) || 0, ...(form.batchNo.trim() ? { batchNo: form.batchNo.trim() } : {}), ...(form.expiryDate ? { expiryDate: form.expiryDate } : {}) }) });
      setForm(empty); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(false); }
  };
  const list = (data?.medicines || []).filter((m) => !query.trim() || m.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <>
      <Card title={t('facility.meds.add')} icon="pill">
        <form className="adp-form-grid adp-inline-form" onSubmit={add}>
          <label className="adp-field">{t('facility.meds.name')}<input required minLength={2} maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Amoxicillin" /></label>
          <label className="adp-field">{t('facility.meds.form')}<select value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })}>{FORMS.map((f) => <option key={f} value={f}>{t(`facility.meds.forms.${f}`)}</option>)}</select></label>
          <label className="adp-field">{t('facility.meds.strength')}<input maxLength={60} value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} placeholder="500 mg" /></label>
          <label className="adp-field">{t('facility.meds.unit')}<input maxLength={30} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
          <label className="adp-field">{t('facility.meds.stock')}<input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
          <label className="adp-field">{t('facility.meds.reorder')}<input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></label>
          <label className="adp-field">{t('facility.meds.batch')}<input maxLength={60} value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} /></label>
          <label className="adp-field">{t('facility.meds.expiry')}<input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></label>
          <div className="adp-inline-submit"><button type="submit" className="adp-btn adp-btn-primary" disabled={busy}><Icon.check size={18} />{t('facility.meds.save')}</button></div>
        </form>
        {message && <div style={{ marginTop: 10 }}><Notice tone="error">{message}</Notice></div>}
      </Card>
      <Card>
        <div className="adp-toolbar"><label className="adp-field adp-search"><span className="sr-only">{t('facility.meds.search')}</span><input type="search" placeholder={t('facility.meds.search')} value={query} onChange={(e) => setQuery(e.target.value)} /></label></div>
        {loading ? <Skeleton rows={3} /> : error ? <Notice tone="error">{error}</Notice> : !list.length ? <Empty icon="pill">{t('facility.meds.empty')}</Empty>
          : <div className="adp-list">{list.map((item) => <MedicineRow key={item.itemId} t={t} lang={lang} hospitalId={hospitalId} item={item} onChanged={() => void refresh()} />)}</div>}
      </Card>
    </>
  );
};

/* ---------- Equipment ---------- */
const EquipmentTab: React.FC<{ t: Translate; lang: LanguageCode; hospitalId: string; onChanged: () => void }> = ({ t, lang, hospitalId, onChanged }) => {
  const { data, loading, error, reload } = useApi<{ equipment: Equipment[] }>(`${base(hospitalId)}/equipment`, [hospitalId]);
  const empty = { name: '', category: 'dental', quantity: '', functionalCount: '', lastServicedAt: '' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = async () => { await reload(); onChanged(); };
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMessage(''); try { await fn(); await refresh(); } catch (e) { setMessage(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(false); } };
  const add = (event: React.FormEvent) => { event.preventDefault(); void run(async () => {
    await api(`${base(hospitalId)}/equipment`, { method: 'POST', body: JSON.stringify({ name: form.name.trim(), category: form.category, quantity: num(form.quantity), functionalCount: num(form.functionalCount), ...(form.lastServicedAt ? { lastServicedAt: form.lastServicedAt } : {}) }) });
    setForm(empty);
  }); };
  const patch = (item: Equipment, body: Partial<Equipment>) => run(() => api(`${base(hospitalId)}/equipment/${item.equipmentId}`, { method: 'PATCH', body: JSON.stringify(body) }));
  return (
    <>
      <Card title={t('facility.equip.add')} icon="stethoscope">
        <form className="adp-form-grid adp-inline-form" onSubmit={add}>
          <label className="adp-field">{t('facility.equip.name')}<input required minLength={2} maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dental chair" /></label>
          <label className="adp-field">{t('facility.equip.category')}<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(`facility.equip.categories.${c}`)}</option>)}</select></label>
          <label className="adp-field">{t('facility.equip.quantity')}<input required type="number" min={0} max={10000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
          <label className="adp-field">{t('facility.equip.working')}<input required type="number" min={0} max={10000} value={form.functionalCount} onChange={(e) => setForm({ ...form, functionalCount: e.target.value })} /></label>
          <label className="adp-field">{t('facility.equip.serviced')}<input type="date" value={form.lastServicedAt} onChange={(e) => setForm({ ...form, lastServicedAt: e.target.value })} /></label>
          <div className="adp-inline-submit"><button type="submit" className="adp-btn adp-btn-primary" disabled={busy}><Icon.check size={18} />{t('facility.equip.save')}</button></div>
        </form>
        {message && <div style={{ marginTop: 10 }}><Notice tone="error">{message}</Notice></div>}
      </Card>
      <Card>
        {loading ? <Skeleton rows={2} /> : error ? <Notice tone="error">{error}</Notice> : !data?.equipment.length ? <Empty icon="stethoscope">{t('facility.equip.empty')}</Empty> : (
          <div className="adp-ops-grid">
            {data.equipment.map((item) => {
              const broken = item.quantity - item.functionalCount;
              return (
                <article key={item.equipmentId} className="adp-ops-card">
                  <div className="adp-appt-title"><strong>{item.name}</strong><StatusPill tone={broken > 0 ? 'amber' : 'green'}>{broken > 0 ? t('facility.equip.needsRepair', { n: broken }) : t('facility.equip.allWorking')}</StatusPill></div>
                  <small className="adp-muted">{t(`facility.equip.categories.${item.category}`)}{item.lastServicedAt ? ` · ${fmtDate(item.lastServicedAt, lang)}` : ''}</small>
                  <div className="adp-big-count"><strong>{item.functionalCount}</strong><span>/ {item.quantity} {t('facility.equip.working').toLowerCase()}</span></div>
                  <div className="adp-ops-actions">
                    <button type="button" className="adp-btn adp-btn-outline adp-btn-sm" disabled={busy || item.functionalCount >= item.quantity} onClick={() => void patch(item, { functionalCount: item.functionalCount + 1 })}>+1 {t('facility.equip.working').toLowerCase()}</button>
                    <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={busy || item.functionalCount === 0} onClick={() => void patch(item, { functionalCount: item.functionalCount - 1 })}>−1 {t('facility.equip.working').toLowerCase()}</button>
                  </div>
                  <div className="adp-ops-actions">
                    <button type="button" className="adp-link" disabled={busy} onClick={() => void patch(item, { quantity: item.quantity + 1 })}>+1 {t('facility.equip.quantity').toLowerCase()}</button>
                    <button type="button" className="adp-link adp-link-danger" disabled={busy} onClick={() => void run(() => api(`${base(hospitalId)}/equipment/${item.equipmentId}`, { method: 'DELETE' }))}>{t('facility.beds.remove')}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {message && <div style={{ marginTop: 10 }}><Notice tone="error">{message}</Notice></div>}
      </Card>
    </>
  );
};

/* ---------- Doctors at this facility ---------- */
const DoctorsTab: React.FC<{ t: Translate; hospitalId: string }> = ({ t, hospitalId }) => {
  const { data, loading, error } = useApi<{ doctors: Array<{ userId: string; doctorCode: string | null; fullName: string; departmentName: string | null; verificationStatus: string; experienceYears: number | null; consultationFee: number | null }> }>(`/api/v1/admin/doctors?hospitalId=${encodeURIComponent(hospitalId)}`, [hospitalId]);
  return (
    <Card title={t('facility.tabs.doctors')} icon="users" action={<a className="adp-btn adp-btn-primary adp-btn-sm" href={`#/admin/add-doctor?hospital=${encodeURIComponent(hospitalId)}`}><Icon.user size={16} />{t('facility.addDoctorHere')}</a>}>
      {loading ? <Skeleton rows={2} /> : error ? <Notice tone="error">{error}</Notice> : !data?.doctors.length ? <Empty icon="users">{t('admin.noDoctors')}</Empty> : (
        <div className="adp-list">
          {data.doctors.map((d) => (
            <div key={d.userId} className="adp-mini-row">
              <span className="adp-appt-avatar" style={{ width: 40, height: 40, borderRadius: 12 }}>{initials(d.fullName)}</span>
              <div style={{ flex: 1, minWidth: 0 }}><strong>{d.fullName}</strong><small>{[d.doctorCode, d.departmentName, d.experienceYears != null ? t('admin.years', { n: d.experienceYears }) : '', d.consultationFee != null ? (d.consultationFee === 0 ? t('admin.feeFree') : `₹${d.consultationFee}`) : ''].filter(Boolean).join(' · ')}</small></div>
              <StatusPill tone={d.verificationStatus === 'verified' ? 'green' : d.verificationStatus === 'rejected' ? 'red' : 'amber'}>{t(`admin.status.${d.verificationStatus}`)}</StatusPill>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

/* ---------- Facility admins (system admin) ---------- */
const AdminsTab: React.FC<{ t: Translate; lang: LanguageCode; hospitalId: string; hospitalName: string; isSystemAdmin: boolean; onChanged: () => void }> = ({ t, lang, hospitalId, hospitalName, isSystemAdmin, onChanged }) => {
  const { data, loading, error, reload } = useApi<{ admins: Array<{ userId: string; username: string; fullName: string; phone?: string; status: string; createdAt: string }> }>(`${base(hospitalId)}/admins`, [hospitalId]);
  const empty = { fullName: '', phone: '', email: '', username: '', password: '' };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [issued, setIssued] = useState<{ credentials: Credentials; name: string; reset: boolean } | null>(null);
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const res = await api<{ credentials: Credentials }>(`${base(hospitalId)}/admins`, { method: 'POST', body: JSON.stringify({ fullName: form.fullName.trim(), phone: form.phone.trim(), ...(form.email.trim() ? { email: form.email.trim() } : {}), ...(form.username.trim() ? { username: form.username.trim().toLowerCase() } : {}), ...(form.password ? { password: form.password } : {}) }) });
      setIssued({ credentials: res.credentials, name: `${form.fullName.trim()} — ${hospitalName}`, reset: false });
      setForm(empty); await reload(); onChanged();
    } catch (e) { setMessage(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(false); }
  };
  const reset = async (userId: string, name: string) => {
    setBusy(true); setMessage('');
    try { const res = await api<{ credentials: Credentials }>(`${base(hospitalId)}/admins/${userId}/reset-password`, { method: 'POST' }); setIssued({ credentials: res.credentials, name, reset: true }); }
    catch (e) { setMessage(e instanceof Error ? e.message : t('common.error')); } finally { setBusy(false); }
  };
  return (
    <>
      {isSystemAdmin ? (
        <Card title={t('facility.admins.add')} icon="shield">
          <p className="adp-muted" style={{ marginBottom: 12 }}>{t('facility.admins.intro')}</p>
          <form className="adp-form-grid" onSubmit={create}>
            <label className="adp-field">{t('facility.admins.fullName')}<input required minLength={3} maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label className="adp-field">{t('facility.admins.phone')}<input required type="tel" pattern="\+?[0-9 ]{10,15}" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></label>
            <label className="adp-field">{t('facility.admins.email')}<input type="email" maxLength={120} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="adp-field">{t('facility.admins.loginId')}<input pattern="[A-Za-z0-9._\-]{3,40}" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /><small className="adp-hint">{t('facility.admins.loginIdHint')}</small></label>
            <label className="adp-field">{t('facility.admins.password')}<input type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><small className="adp-hint">{t('facility.admins.passwordHint')}</small></label>
            <div className="adp-inline-submit"><button type="submit" className="adp-btn adp-btn-primary" disabled={busy}><Icon.check size={18} />{t('facility.admins.create')}</button></div>
          </form>
          {message && <div style={{ marginTop: 10 }}><Notice tone="error">{message}</Notice></div>}
        </Card>
      ) : <Notice tone="info">{t('facility.admins.onlySystem')}</Notice>}
      <Card title={t('facility.tabs.admins')} icon="users">
        {loading ? <Skeleton rows={2} /> : error ? <Notice tone="error">{error}</Notice> : !data?.admins.length ? <Empty icon="users">{t('facility.admins.empty')}</Empty> : (
          <div className="adp-list">
            {data.admins.map((a) => (
              <div key={a.userId} className="adp-mini-row">
                <span className="adp-appt-avatar" style={{ width: 40, height: 40, borderRadius: 12 }}>{initials(a.fullName)}</span>
                <div style={{ flex: 1, minWidth: 0 }}><strong>{a.fullName}</strong><small>{t('admin.loginId')}: {a.username}{a.phone ? ` · ${a.phone}` : ''} · {fmtDate(a.createdAt, lang)}</small></div>
                {isSystemAdmin && <button type="button" className="adp-btn adp-btn-ghost adp-btn-sm" disabled={busy} onClick={() => void reset(a.userId, a.fullName)}>{t('facility.admins.reset')}</button>}
              </div>
            ))}
          </div>
        )}
      </Card>
      {issued && <CredentialsDialog t={t} credentials={issued.credentials} doctorName={issued.name} reset={issued.reset} onClose={() => setIssued(null)} />}
    </>
  );
};

/* ---------- Page ---------- */
export const FacilityDetailPage: React.FC<{ t: Translate; lang: LanguageCode; hospitalId: string; isSystemAdmin: boolean; initialTab?: string; showBack: boolean }> = ({ t, lang, hospitalId, isSystemAdmin, initialTab, showBack }) => {
  const [tab, setTab] = useState<Tab>((['overview', 'beds', 'medicines', 'equipment', 'doctors', 'admins'] as Tab[]).includes(initialTab as Tab) ? initialTab as Tab : 'overview');
  const overview = useApi<Overview>(`${base(hospitalId)}/overview`, [hospitalId]);
  const tabs = useMemo(() => (['overview', 'beds', 'medicines', 'equipment', 'doctors', 'admins'] as Tab[]), []);
  const refresh = () => void overview.reload();
  const name = overview.data?.hospital.name || hospitalId;

  return (
    <>
      {showBack && <a className="adp-link" href="#/admin/facilities">← {t('admin.facilitiesTitle')}</a>}
      <PageHeader title={name} subtitle={overview.data ? `${t(`admin.type.${overview.data.hospital.type}`)}${overview.data.hospital.mandal ? ` · ${overview.data.hospital.mandal}` : ''}` : undefined} />
      <div className="adp-tabs adp-facility-tabs" role="tablist">
        {tabs.map((key) => <button key={key} type="button" role="tab" aria-selected={tab === key} aria-pressed={tab === key} onClick={() => setTab(key)}>{t(`facility.tabs.${key}`)}</button>)}
      </div>
      {overview.error && <Notice tone="error">{overview.error}</Notice>}
      {tab === 'overview' && (overview.loading ? <Skeleton rows={3} /> : overview.data ? <OverviewTab t={t} data={overview.data} /> : null)}
      {tab === 'beds' && <BedsTab t={t} hospitalId={hospitalId} onChanged={refresh} />}
      {tab === 'medicines' && <MedicinesTab t={t} lang={lang} hospitalId={hospitalId} onChanged={refresh} />}
      {tab === 'equipment' && <EquipmentTab t={t} lang={lang} hospitalId={hospitalId} onChanged={refresh} />}
      {tab === 'doctors' && <DoctorsTab t={t} hospitalId={hospitalId} />}
      {tab === 'admins' && <AdminsTab t={t} lang={lang} hospitalId={hospitalId} hospitalName={name} isSystemAdmin={isSystemAdmin} onChanged={refresh} />}
    </>
  );
};
