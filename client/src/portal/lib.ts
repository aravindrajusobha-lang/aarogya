import { useCallback, useEffect, useRef, useState } from 'react';
import { LanguageCode, translations } from '../i18n';

/* ---------- Auth token ---------- */
export function accessToken(): string {
  try {
    return JSON.parse(localStorage.getItem('aarogya_tokens') || '{}').accessToken || localStorage.getItem('aarogya_token') || '';
  } catch {
    try { return localStorage.getItem('aarogya_token') || ''; } catch { return ''; }
  }
}

/* ---------- API (standard envelope) ---------- */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken()}`, ...(init.headers as Record<string, string> || {}) };
  if (init.body && !(init.body instanceof FormData) && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new ApiError(payload?.error?.message || payload?.message || `Request failed (${response.status})`, response.status, payload?.error?.code);
  }
  return payload.data as T;
}

export const newMutationId = () => (crypto as any).randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

/* ---------- Data hook ---------- */
export function useApi<T>(path: string | null, deps: unknown[] = [], pollMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    try {
      const next = await api<T>(path);
      if (alive.current) { setData(next); setError(''); }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => {
    alive.current = true;
    setLoading(Boolean(path));
    void load();
    const timer = pollMs ? window.setInterval(() => void load(), pollMs) : undefined;
    return () => { alive.current = false; if (timer) window.clearInterval(timer); };
  }, [load, pollMs, path]);
  return { data, error, loading, reload: load, setData };
}

/* ---------- i18n (portal.* keys, English fallback) ---------- */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

function lookup(dict: any, key: string): string | undefined {
  const value = key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);
  return typeof value === 'string' ? value : undefined;
}

export function makeT(lang: LanguageCode): Translate {
  const dict = (translations[lang] as any)?.portal;
  const fallback = (translations.en as any).portal;
  return (key, vars) => {
    let text = lookup(dict, key) ?? lookup(fallback, key) ?? key;
    if (vars) for (const [name, value] of Object.entries(vars)) text = text.split(`{${name}}`).join(String(value));
    return text;
  };
}

/* ---------- Formatting ---------- */
const localeFor = (lang: LanguageCode) => (lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN');
export const fmtDate = (value: string | Date | null | undefined, lang: LanguageCode) =>
  value ? new Date(value).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const fmtTime = (value: string | Date | null | undefined, lang: LanguageCode) =>
  value ? new Date(value).toLocaleTimeString(localeFor(lang), { hour: 'numeric', minute: '2-digit' }) : '—';
export const fmtDateTime = (value: string | Date | null | undefined, lang: LanguageCode) =>
  value ? `${fmtDate(value, lang)} · ${fmtTime(value, lang)}` : '—';

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

export function initials(name?: string | null) {
  return (name || '?').replace(/^(dr\.?\s+)/i, '').split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

export const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ---------- Shared domain types ---------- */
export interface FollowUp { frequency: string; intervalDays: number | null; nextFollowUpAt: string | null; plannedSessions: number | null; instructions: string }
export interface SessionInfo { consultationId: string; status: string; consultationMode: 'online' | 'offline' | null; startedAt: string | null; endedAt: string | null; durationSeconds: number | null; patientWaiting: boolean; followUp: FollowUp | null }
export interface AppointmentItem {
  appointmentId: string; appointmentCode?: string; patientId: string; patientName?: string; assignedDoctorName?: string; destinationHospitalName?: string;
  consultationMode?: 'online' | 'offline'; slotStartTime: string; slotEndTime: string; status: string; patientNote?: string; reason?: string; department?: string;
  proposedReschedule?: { newSlotStart: string; status?: string };
  session?: SessionInfo | null; patientWaiting?: boolean;
}

export const sessionActive = (session?: SessionInfo | null) => Boolean(session?.startedAt) && !session?.endedAt && !['COMPLETED', 'MISSED', 'CANCELLED'].includes(session?.status || '');

export function followUpLabel(t: Translate, followUp?: FollowUp | null) {
  if (!followUp) return '—';
  if (followUp.frequency === 'custom') return t('session.freq.custom', { d: followUp.intervalDays ?? '?' });
  return t(`session.freq.${followUp.frequency}`);
}

/* ---------- Live elapsed timer ---------- */
export function useElapsed(startedAt: string | null | undefined, running: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
}
