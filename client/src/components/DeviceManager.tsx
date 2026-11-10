import React, { useState, useEffect } from 'react';

interface DeviceItem {
  sessionId: string;
  deviceId: string;
  deviceName: string;
  userAgent: string;
  ip: string;
  status: 'active' | 'revoked';
  lastActiveAt: string;
  isCurrentDevice: boolean;
  createdAt: string;
}

interface DeviceManagerProps {
  accessToken: string;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({ accessToken }) => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/devices', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const env = await res.json();
      if (env.success) {
        setDevices(env.data.devices);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [accessToken]);

  const handleRevokeSingle = async (deviceId: string) => {
    try {
      const res = await fetch(`/api/v1/auth/devices/${deviceId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const env = await res.json();
      if (env.success) {
        setActionMsg(`Device ${deviceId} revoked successfully`);
        fetchDevices();
      }
    } catch (err: any) {
      setActionMsg(`Failed to revoke device: ${err.message}`);
    }
  };

  const handleRevokeOthers = async () => {
    try {
      const res = await fetch('/api/v1/auth/devices/revoke-others', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const env = await res.json();
      if (env.success) {
        setActionMsg(`Revoked ${env.data.revokedCount} other active device(s)`);
        fetchDevices();
      }
    } catch (err: any) {
      setActionMsg(`Failed to revoke other devices: ${err.message}`);
    }
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📱 Registered Device Sessions</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
            Central device authorization list with live token revocation & replay attack defense.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            onClick={fetchDevices}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <button
            type="button"
            className="btn btn-danger"
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            onClick={handleRevokeOthers}
          >
            🛑 Revoke All Others
          </button>
        </div>
      </div>

      {actionMsg && (
        <div style={{ color: 'var(--color-brand-accent)', fontSize: '0.85rem', marginBottom: '10px' }}>
          ✓ {actionMsg}
        </div>
      )}

      {loading && devices.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Loading device sessions...</p>
      ) : (
        <div className="device-grid">
          {devices.map((d) => (
            <div
              key={d.sessionId}
              className={`device-card ${d.isCurrentDevice ? 'current' : ''} ${
                d.status === 'revoked' ? 'revoked' : ''
              }`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.deviceName}</div>
                <div>
                  {d.isCurrentDevice && (
                    <span
                      style={{
                        background: 'var(--color-brand-accent)',
                        color: '#000',
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        marginRight: '6px',
                      }}
                    >
                      CURRENT
                    </span>
                  )}
                  <span
                    style={{
                      background: d.status === 'active' ? 'rgba(6,214,160,0.2)' : 'rgba(230,57,70,0.2)',
                      color: d.status === 'active' ? 'var(--color-status-success)' : 'var(--color-status-danger)',
                      fontSize: '0.65rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    {d.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                <div>IP: <code>{d.ip}</code></div>
                <div>ID: <code>{d.deviceId}</code></div>
                <div>Last Seen: {new Date(d.lastActiveAt).toLocaleTimeString()}</div>
              </div>

              {!d.isCurrentDevice && d.status === 'active' && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    marginTop: '10px',
                    width: '100%',
                    borderColor: 'rgba(230,57,70,0.4)',
                    color: 'var(--color-status-danger)',
                  }}
                  onClick={() => handleRevokeSingle(d.deviceId)}
                >
                  Revoke Access
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
