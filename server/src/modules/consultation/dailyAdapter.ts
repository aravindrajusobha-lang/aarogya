const DAILY_API = 'https://api.daily.co/v1';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { DailyProviderConfig } from './dailyProviderConfigModel.js';

interface DailyConfig {
  apiKey: string;
  domain: string;
  source: 'admin' | 'environment';
}

function normalizedDomain(value: string) {
  const candidate = value.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  let url: URL;
  try { url = new URL(`https://${candidate}`); } catch { throw Object.assign(new Error('Enter a valid Daily domain, such as your-team.daily.co.'), { statusCode: 400, code: 'DAILY_DOMAIN_INVALID' }); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.port) {
    throw Object.assign(new Error('Enter a Daily hostname only, without a path or port.'), { statusCode: 400, code: 'DAILY_DOMAIN_INVALID' });
  }
  return url.hostname.toLowerCase();
}

function encryptionKey() {
  const encoded = process.env.VIDEO_CONFIG_ENCRYPTION_KEY?.trim() || '';
  if (!/^[a-f0-9]{64}$/i.test(encoded)) {
    throw Object.assign(new Error('Set VIDEO_CONFIG_ENCRYPTION_KEY to a persistent 32-byte hex key before saving provider credentials.'), { statusCode: 503, code: 'VIDEO_CONFIG_ENCRYPTION_UNAVAILABLE' });
  }
  return Buffer.from(encoded, 'hex');
}

function encryptApiKey(apiKey: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return { encryptedApiKey: encrypted.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}

function decryptApiKey(record: { encryptedApiKey: string; iv: string; authTag: string }) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(record.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(record.encryptedApiKey, 'base64')), decipher.final()]).toString('utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'VIDEO_CONFIG_ENCRYPTION_UNAVAILABLE') throw error;
    throw Object.assign(new Error('Saved Daily credentials cannot be decrypted. Verify VIDEO_CONFIG_ENCRYPTION_KEY.'), { statusCode: 503, code: 'VIDEO_CONFIG_DECRYPTION_FAILED' });
  }
}

async function getConfig(): Promise<DailyConfig> {
  if (mongoose.connection.readyState === 1) {
    const stored: any = await DailyProviderConfig.findOne({ provider: 'daily' }).select('+encryptedApiKey +iv +authTag').lean();
    if (stored) return { apiKey: decryptApiKey(stored), domain: normalizedDomain(stored.domain), source: 'admin' };
  }

  const apiKey = process.env.DAILY_API_KEY?.trim();
  const rawDomain = process.env.DAILY_DOMAIN?.trim();
  if (!apiKey || !rawDomain) {
    throw Object.assign(new Error('Configure Daily in Admin Settings or set DAILY_API_KEY and DAILY_DOMAIN on the server.'), { statusCode: 503, code: 'VIDEO_PROVIDER_BLOCKED' });
  }
  return { apiKey, domain: normalizedDomain(rawDomain), source: 'environment' };
}

async function daily<T>(config: DailyConfig, path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${DAILY_API}${path}`, { ...init, headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', ...init.headers } });
  } catch {
    throw Object.assign(new Error('Daily.co could not be reached. Check the server network connection and try again.'), { statusCode: 502, code: 'VIDEO_PROVIDER_UNAVAILABLE' });
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Daily.co rejected the API key. Verify the key and its account domain.'), { statusCode: 502, code: 'VIDEO_PROVIDER_INVALID_CREDENTIALS' });
    throw Object.assign(new Error(`Daily.co request failed with status ${response.status}.`), { statusCode: 502, code: 'VIDEO_PROVIDER_ERROR' });
  }
  return response.json() as Promise<T>;
}
export class DailyAdapter {
  static canStoreAdminCredentials() {
    return /^[a-f0-9]{64}$/i.test(process.env.VIDEO_CONFIG_ENCRYPTION_KEY?.trim() || '');
  }

  static async getStatus() {
    try {
      const config = await getConfig();
      await daily(config, '/rooms?limit=1');
      return { status: 'CONNECTED' as const, source: config.source, domain: config.domain, message: 'Daily provider connection verified.' };
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === 'VIDEO_PROVIDER_BLOCKED') return { status: 'MISSING_CONFIGURATION' as const, source: 'none', domain: '', message: err.message };
      if (err.code === 'VIDEO_PROVIDER_INVALID_CREDENTIALS') return { status: 'INVALID_CREDENTIALS' as const, source: 'configured', domain: '', message: err.message };
      if (err.code === 'VIDEO_CONFIG_ENCRYPTION_UNAVAILABLE' || err.code === 'VIDEO_CONFIG_DECRYPTION_FAILED') return { status: 'ENCRYPTION_ERROR' as const, source: 'admin', domain: '', message: err.message };
      return { status: 'UNAVAILABLE' as const, source: 'configured', domain: '', message: err.message || 'Daily provider could not be reached.' };
    }
  }

  static async validateCredentials(apiKey: string, domain: string) {
    const normalized = normalizedDomain(domain);
    const key = apiKey.trim();
    if (key.length < 10 || key.length > 500) throw Object.assign(new Error('Enter a valid Daily API key.'), { statusCode: 400, code: 'DAILY_API_KEY_INVALID' });
    const config = { apiKey: key, domain: normalized, source: 'admin' as const };
    await daily(config, '/rooms?limit=1');
    return normalized;
  }

  static async saveAdminCredentials(apiKey: string, domain: string, configuredBy: string) {
    if (!this.canStoreAdminCredentials()) throw Object.assign(new Error('Admin credential storage is unavailable. Set VIDEO_CONFIG_ENCRYPTION_KEY on the server and restart it.'), { statusCode: 503, code: 'VIDEO_CONFIG_ENCRYPTION_UNAVAILABLE' });
    const normalized = await this.validateCredentials(apiKey, domain);
    const encrypted = encryptApiKey(apiKey.trim());
    const configuredAt = new Date();
    await DailyProviderConfig.findOneAndUpdate({ provider: 'daily' }, { $set: { ...encrypted, domain: normalized, configuredBy, configuredAt } }, { upsert: true, new: true, runValidators: true });
    return { domain: normalized, configuredAt };
  }

  static async createRoom(exp: number) {
    const config = await getConfig();
    const room = await daily<{ name: string; url: string }>(config, '/rooms', { method: 'POST', body: JSON.stringify({ privacy: 'private', properties: { max_participants: 2, exp, eject_at_room_exp: true, enforce_unique_user_ids: true, enable_recording: false, start_video_off: false, start_audio_off: false } }) });
    return { ...room, url: room.url || `https://${config.domain}/${room.name}` };
  }
  static async createMeetingToken(roomName: string, userId: string, userName: string, exp: number, isOwner: boolean) {
    const config = await getConfig();
    const result = await daily<{ token: string }>(config, '/meeting-tokens', { method: 'POST', body: JSON.stringify({ properties: { room_name: roomName, user_id: userId.slice(0, 36), user_name: userName.slice(0, 64), exp, is_owner: isOwner } }) });
    return result.token;
  }
  static async closeRoom(roomName: string) {
    try { const config = await getConfig(); await daily(config, `/rooms/${encodeURIComponent(roomName)}`, { method: 'DELETE' }); } catch { /* expired or already removed; database remains authoritative */ }
  }
  static async setRoomExpiry(roomName: string, exp: number) {
    const config = await getConfig();
    await daily(config, `/rooms/${encodeURIComponent(roomName)}`, { method: 'POST', body: JSON.stringify({ properties: { exp, eject_at_room_exp: true } }) });
  }
}
