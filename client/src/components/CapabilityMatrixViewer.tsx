import React, { useState } from 'react';

interface CapabilityMatrixViewerProps {
  currentRole: string | null;
  userCapabilities: string[];
  accessToken: string | null;
}

export const CapabilityMatrixViewer: React.FC<CapabilityMatrixViewerProps> = ({
  currentRole,
  userCapabilities,
  accessToken,
}) => {
  const [testResult, setTestResult] = useState<{ endpoint: string; status: number; allowed: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  const ROLES = [
    { key: 'system_admin', label: 'System Admin' },
    { key: 'admin', label: 'Admin' },
    { key: 'medical_officer', label: 'Medical Officer' },
    { key: 'anm', label: 'ANM' },
    { key: 'asha', label: 'ASHA' },
    { key: 'patient', label: 'Patient' },
  ];

  const CAPABILITIES = [
    { cap: 'screening:create', desc: 'Create oral screening record', roles: ['system_admin', 'medical_officer', 'anm', 'asha'] },
    { cap: 'screening:review', desc: 'Medical review & clinical triage', roles: ['system_admin', 'admin', 'medical_officer'] },
    { cap: 'telemedicine:consult', desc: 'Conduct video tele-consult', roles: ['system_admin', 'medical_officer'] },
    { cap: 'storage:upload', desc: 'Upload private oral cavity photo', roles: ['system_admin', 'medical_officer', 'anm', 'asha'] },
    { cap: 'storage:read_clinical', desc: 'View confidential clinical files', roles: ['system_admin', 'admin', 'medical_officer', 'anm', 'asha'] },
    { cap: 'consent:grant', desc: 'Capture informed patient consent', roles: ['system_admin', 'admin', 'medical_officer', 'anm', 'asha', 'patient'] },
    { cap: 'delegation:create', desc: 'Delegate permissions in live DB', roles: ['system_admin', 'admin', 'medical_officer'] },
    { cap: 'audit:read', desc: 'Inspect append-only audit trail', roles: ['system_admin', 'admin'] },
  ];

  const testEndpoint = async (endpoint: string) => {
    if (!accessToken) return;
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setTestResult({
        endpoint,
        status: res.status,
        allowed: res.status !== 403 && res.status !== 401,
      });
    } catch {
      setTestResult({ endpoint, status: 500, allowed: false });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>🛡️ Central Authorization Matrix</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
            Capability-based access control with live database delegated permission checks.
          </p>
        </div>
        {currentRole && (
          <span className={`role-badge role-badge-${currentRole}`}>
            Logged in as: {currentRole.replace('_', ' ')}
          </span>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>Capability Scope</th>
              {ROLES.map((r) => (
                <th
                  key={r.key}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    background: currentRole === r.key ? 'rgba(28, 114, 147, 0.2)' : 'transparent',
                    color: currentRole === r.key ? 'var(--color-brand-accent)' : 'inherit',
                  }}
                >
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((c) => {
              const userHasCap = userCapabilities.includes(c.cap) || userCapabilities.includes('*');

              return (
                <tr
                  key={c.cap}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: userHasCap ? 'rgba(6, 214, 160, 0.04)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 12px' }}>
                    <code style={{ color: 'var(--color-brand-accent)' }}>{c.cap}</code>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{c.desc}</div>
                  </td>
                  {ROLES.map((r) => {
                    const hasNative = c.roles.includes(r.key);
                    return (
                      <td
                        key={r.key}
                        style={{
                          textAlign: 'center',
                          padding: '8px',
                          background: currentRole === r.key ? 'rgba(28, 114, 147, 0.15)' : 'transparent',
                        }}
                      >
                        {hasNative ? (
                          <span style={{ color: 'var(--color-brand-accent)', fontWeight: 700 }}>✓</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', opacity: 0.3 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {accessToken && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '8px', fontWeight: 600 }}>
            LIVE ENDPOINT ACCESS TESTER (VERIFY 200/404 VS 403 FORBIDDEN):
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={() => testEndpoint('/api/v1/audit/logs')}
              disabled={testing}
            >
              Test GET /audit/logs
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={() => testEndpoint('/api/v1/auth/devices')}
              disabled={testing}
            >
              Test GET /auth/devices
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              onClick={() => testEndpoint('/api/v1/consent/verify?patientId=DEMO&purpose=screening_ai_analysis')}
              disabled={testing}
            >
              Test GET /consent/verify
            </button>
          </div>

          {testResult && (
            <div
              style={{
                marginTop: '10px',
                fontSize: '0.82rem',
                color: testResult.allowed ? 'var(--color-status-success)' : 'var(--color-status-danger)',
              }}
            >
              Result for <code>{testResult.endpoint}</code>: Status <strong>{testResult.status}</strong> —{' '}
              {testResult.allowed ? '✓ ACCESS GRANTED (Not 403)' : '🛑 403 FORBIDDEN (Permission Denied)'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
