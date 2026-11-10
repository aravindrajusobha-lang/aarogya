import React, { useState, useEffect } from 'react';
import { db } from '../db/aarogyaDb';
import { syncOfflineQueue, MAX_OFFLINE_QUEUE_CAPACITY } from '../offline/cryptoQueue';

interface OfflineStatusIndicatorProps {
  onlineLabel: string;
  offlineLabel: string;
  accessToken?: string | null;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  onlineLabel,
  offlineLabel,
  accessToken,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Track Dexie pending count & conflicts every 2 seconds
    const interval = setInterval(async () => {
      try {
        const encryptedPending = await db.encryptedQueue
          .where('status')
          .anyOf(['pending', 'failed'])
          .count();
        const legacyPending = await db.screenings
          .where('syncStatus')
          .equals('local_pending')
          .count();

        setPendingSyncCount(encryptedPending + legacyPending);

        const conflicts = await db.encryptedQueue
          .where('status')
          .equals('conflict')
          .count();
        setConflictCount(conflicts);
      } catch {
        // Ignored if db not yet opened
      }
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (!accessToken || isSyncing || !isOnline) return;
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const res = await syncOfflineQueue(accessToken);
      setSyncStatusMsg(`Synced ${res.syncedCount} items.`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
    } catch (err: any) {
      setSyncStatusMsg(`Sync error: ${err.message}`);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
        <span style={{ fontSize: '10px', marginRight: '4px' }}>●</span>
        {isOnline ? onlineLabel : offlineLabel}
      </span>

      {pendingSyncCount > 0 && (
        <span
          className="badge"
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            border: '1px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>⏳</span>
          {pendingSyncCount} / {MAX_OFFLINE_QUEUE_CAPACITY} queued actions
        </span>
      )}

      {conflictCount > 0 && (
        <span
          className="badge"
          style={{
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            border: '1px solid #f59e0b',
          }}
        >
          ⚠️ {conflictCount} conflicts pending review
        </span>
      )}

      {isOnline && pendingSyncCount > 0 && accessToken && (
        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="btn btn-outline"
          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      )}

      {syncStatusMsg && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {syncStatusMsg}
        </span>
      )}
    </div>
  );
};
