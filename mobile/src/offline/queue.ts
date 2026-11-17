import { offlinePayload } from './payload';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';

export type OfflineMutation = { clientMutationId: string; type: 'appointment_request' | 'patient_registration'; payload: Record<string, unknown>; createdAt: string };
const ownerKey = (userId: string) => userId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 28) || 'account';
const indexFor = (userId: string) => `ad_offline_index_${ownerKey(userId)}`;
const keyFor = (userId: string, id: string) => `ad_offline_${ownerKey(userId)}_${id}`;

export async function readOfflineQueue(userId: string): Promise<OfflineMutation[]> {
  const ids = JSON.parse((await SecureStore.getItemAsync(indexFor(userId))) || '[]') as string[];
  const records = await Promise.all(ids.map(async id => {
    const value = await SecureStore.getItemAsync(keyFor(userId, id));
    if (!value) return null;
    try { return JSON.parse(value) as OfflineMutation; } catch { return null; }
  }));
  return records.filter((item): item is OfflineMutation => Boolean(item));
}

export async function queueAppointment(userId: string, clientMutationId: string, payload: Record<string, unknown>) {
  await queueMutation(userId, clientMutationId, 'appointment_request', payload);
}

export async function queueRegistration(userId: string, clientMutationId: string, payload: Record<string, unknown>) {
  await queueMutation(userId, clientMutationId, 'patient_registration', payload);
}

async function queueMutation(userId: string, clientMutationId: string, type: OfflineMutation['type'], payload: Record<string, unknown>) {
  const ids = JSON.parse((await SecureStore.getItemAsync(indexFor(userId))) || '[]') as string[];
  if (ids.includes(clientMutationId)) return;
  if (ids.length >= 500) throw new Error('The secure offline queue is full. Sync queued requests before adding another.');
  const record: OfflineMutation = { clientMutationId, type, payload:offlinePayload(type,clientMutationId,payload), createdAt: new Date().toISOString() };
  await SecureStore.setItemAsync(keyFor(userId, clientMutationId), JSON.stringify(record));
  try { await SecureStore.setItemAsync(indexFor(userId), JSON.stringify([...ids, clientMutationId])); }
  catch (error) { await SecureStore.deleteItemAsync(keyFor(userId, clientMutationId)); throw error; }
}

export async function syncOfflineQueue(userId: string) {
  const queued = await readOfflineQueue(userId);
  if (!queued.length) return { synced: 0, pending: 0 };
  const result = await api<{ results: Array<{ clientMutationId: string; status: string }> }>('/api/v1/sync/batch', {
    method: 'POST',
    body: JSON.stringify({ items: queued.map(({ clientMutationId, type, payload }) => ({ clientMutationId, type, payload })) }),
  });
  const done = new Set(result.results.filter(item => item.status === 'synced' || item.status === 'replayed_without_mutation').map(item => item.clientMutationId));
  const ids = JSON.parse((await SecureStore.getItemAsync(indexFor(userId))) || '[]') as string[];
  await Promise.all([...done].map(id => SecureStore.deleteItemAsync(keyFor(userId, id))));
  await SecureStore.setItemAsync(indexFor(userId), JSON.stringify(ids.filter(id => !done.has(id))));
  return { synced: done.size, pending: ids.length - done.size };
}
