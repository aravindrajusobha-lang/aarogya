import { readSession, saveSession, Session } from '../auth/session';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
const envBaseUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const API_URL_KEY = 'aarogya_api_url_v1';
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function getApiBaseUrl() { return envBaseUrl || (await SecureStore.getItemAsync(API_URL_KEY) || '').replace(/\/$/, ''); }
export async function saveApiBaseUrl(value: string) { const normalized=value.trim().replace(/\/$/,''); if(!/^https?:\/\/[^\s]+$/i.test(normalized)) throw new Error('Enter a complete service URL beginning with https://'); if(envBaseUrl) throw new Error('The service address is fixed by EXPO_PUBLIC_API_URL for this build.'); await SecureStore.setItemAsync(API_URL_KEY,normalized); }
let refreshInFlight: Promise<Session | null> | null = null;
async function refreshSession(baseUrl:string,session: Session): Promise<Session | null> {
  if (!session.refreshToken) return null;
  if (!refreshInFlight) refreshInFlight = (async () => {
    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload.data?.accessToken || !payload.data?.refreshToken) return null;
      const updated: Session = { ...session, accessToken: payload.data.accessToken, refreshToken: payload.data.refreshToken, deviceSessionId: payload.data.deviceSessionId || session.deviceSessionId };
      await saveSession(updated); return updated;
    } catch { return null; }
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl=await getApiBaseUrl();
  if (!baseUrl) throw new ApiError('Set the service address in Settings or configure EXPO_PUBLIC_API_URL.', 0);
  const session = await readSession();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !(typeof FormData !== 'undefined' && init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);
  let response: Response;
  try { response = await fetch(`${baseUrl}${path}`, { ...init, headers }); }
  catch { throw new ApiError('Could not reach the service. Check your connection and server address.', 0); }
  let payload = await response.json().catch(() => null);
  if (response.status === 401 && session?.refreshToken && path !== '/api/v1/auth/refresh') {
    const renewed = await refreshSession(baseUrl,session);
    if (renewed) {
      const retryHeaders = new Headers(headers); retryHeaders.set('Authorization', `Bearer ${renewed.accessToken}`);
      try { response = await fetch(`${baseUrl}${path}`, { ...init, headers: retryHeaders }); }
      catch { throw new ApiError('Could not reach the service. Check your connection and server address.', 0); }
      payload = await response.json().catch(() => null);
    }
  }
  if (!response.ok || !payload?.success) throw new ApiError(payload?.error?.message || `Request failed (${response.status})`, response.status);
  return payload.data as T;
}
export const mutationId = () => Crypto.randomUUID();
