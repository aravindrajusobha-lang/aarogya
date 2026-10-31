import React, { useState, useEffect } from 'react';
import { db } from '../db/aarogyaDb';

interface OfflineStatusIndicatorProps {
  onlineLabel: string;
  offlineLabel: string;
}

export const OfflineStatusIndicator: React.FC<OfflineStatusIndicatorProps> = ({
  onlineLabel,
  offlineLabel,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Track Dexie pending count
    const interval = setInterval(async () => {
      try {
        const count = await db.screenings.where('syncStatus').equals('local_pending').count();
        setPendingSyncCount(count);
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
        <span style={{ fontSize: '10px' }}>●</span>
        {isOnline ? onlineLabel : offlineLabel}
      </span>
      {pendingSyncCount > 0 && (
        <span className="badge badge-mock">
          {pendingSyncCount} queued locally (Dexie)
        </span>
      )}
    </div>
  );
};
