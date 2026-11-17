import * as SecureStore from 'expo-secure-store';
export type SessionUser = { userId: string; fullName: string; role: string; patientId?: string; hospitalId?: string };
export type Session = { accessToken: string; refreshToken?: string; deviceSessionId?: string; user: SessionUser };
const KEY = 'aarogya_session_v1';
export async function saveSession(session: Session) { await SecureStore.setItemAsync(KEY, JSON.stringify(session)); }
export async function readSession(): Promise<Session | null> { const value = await SecureStore.getItemAsync(KEY); return value ? JSON.parse(value) as Session : null; }
export async function clearSession() { await SecureStore.deleteItemAsync(KEY); }
