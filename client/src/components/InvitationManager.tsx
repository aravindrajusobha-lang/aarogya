import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';

interface Invitation {
  invitationId: string;
  hospitalId: string;
  email: string;
  fullName: string;
  role: string;
  token: string;
  invitationLink: string;
  createdBy: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  acceptedAt?: string;
  createdAt: string;
}

interface InvitationManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
}

export const InvitationManager: React.FC<InvitationManagerProps> = ({ accessToken, currentUser }) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'medical_officer' | 'anm' | 'asha'>('medical_officer');
  const [hospitalId, setHospitalId] = useState(currentUser?.hospitalId || 'hosp_paderu_dh');
  const [generating, setGenerating] = useState(false);

  // Generated Link Output Display
  const [newInviteLink, setNewInviteLink] = useState<{
    link: string;
    token: string;
    expiresAt: string;
    deliveryNote: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Invitation Acceptance Simulator State
  const [testToken, setTestToken] = useState('');
  const [testUsername, setTestUsername] = useState('dr.kavitha.paderu');
  const [testPassword, setTestPassword] = useState('Password@2026');
  const [accepting, setAccepting] = useState(false);
  const [acceptResult, setAcceptResult] = useState<{ status: number; text: string; success: boolean } | null>(null);

  const fetchInvitations = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/invitations', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setInvitations(payload.data?.invitations || []);
      } else {
        throw new Error(payload.error?.message || 'Failed to fetch invitations');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [accessToken]);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setFormMsg({ type: 'error', text: 'You must be authenticated as Admin to generate staff invitations' });
      return;
    }

    setGenerating(true);
    setFormMsg(null);
    setNewInviteLink(null);
    setCopied(false);

    try {
      const res = await fetch('/api/v1/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          role,
          hospitalId,
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success) {
        const fullUrl = `${window.location.origin}${payload.data.invitationLink}`;
        setNewInviteLink({
          link: fullUrl,
          token: payload.data.token,
          expiresAt: payload.data.expiresAt,
          deliveryNote: payload.data.deliveryNote || 'Link shown to the admin to copy; delivery is not claimed.',
        });
        setTestToken(payload.data.token);
        setFormMsg({ type: 'success', text: '72-Hour Invitation generated successfully!' });
        setEmail('');
        setFullName('');
        fetchInvitations();
      } else {
        throw new Error(payload.error?.message || 'Failed to generate invitation');
      }
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!newInviteLink) return;
    navigator.clipboard.writeText(newInviteLink.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Self-Approval Test Trigger
  const handleTriggerSelfInviteTest = () => {
    if (currentUser) {
      setEmail(`${currentUser.username}@paderu.gov.in`);
      setFullName(currentUser.fullName);
    } else {
      setEmail('admin.paderu@paderu.gov.in');
      setFullName('Self Admin Attempt');
    }
  };

  // Accept / Verify Token Simulator
  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccepting(true);
    setAcceptResult(null);

    try {
      const res = await fetch('/api/v1/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: testToken.trim(),
          username: testUsername.trim(),
          password: testPassword,
        }),
      });

      const payload = await res.json();
      setAcceptResult({
        status: res.status,
        success: payload.success,
        text: payload.success
          ? `✓ Account Created: User "${payload.data?.user?.username}" (${payload.data?.user?.role}) onboarded into ${payload.data?.user?.hospitalId}`
          : `[${payload.error?.code || 'ERROR'}] ${payload.error?.message || 'Acceptance rejected'}`,
      });
      fetchInvitations();
    } catch (err: any) {
      setAcceptResult({
        status: 500,
        success: false,
        text: err.message,
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/invitations/${id}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        fetchInvitations();
      }
    } catch (err) {
      // ignore
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(6, 214, 160, 0.15) 0%, rgba(21, 34, 56, 0.8) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.6rem' }}>✉️</span>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>72-Hour Staff Invitations</h2>
          <span className="badge badge-real">Phase 3: Administration</span>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', maxWidth: '800px', margin: 0 }}>
          Generate cryptographic 72-hour onboarding tokens for doctors, specialists, ANMs, and ASHAs. 
          <strong> Note: Delivery is not claimed</strong>; the secure link is displayed directly to the administrator to copy and dispatch via approved departmental channels. Self-approval and token reuse are strictly blocked.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Generator Form */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Create 72-Hour Invitation</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Generates a single-use 256-bit cryptographic link valid for exactly 72 hours.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTriggerSelfInviteTest}
              style={{ fontSize: '0.72rem', padding: '4px 8px' }}
              title="Fill current admin credentials to verify SELF_APPROVAL_BLOCKED guard"
            >
              🧪 Test Self-Invite Block
            </button>
          </div>

          <form onSubmit={handleGenerateInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <div className="form-group">
              <label className="form-label">Staff Work Email / Contact ID</label>
              <input
                type="email"
                className="form-input"
                placeholder="dr.kavitha@paderu.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Dr. Kavitha Rao"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Assigned Role</label>
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="medical_officer">Medical Officer (Doctor)</option>
                  <option value="admin">Hospital Admin</option>
                  <option value="anm">ANM (Auxiliary Nurse)</option>
                  <option value="asha">ASHA Worker</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Affiliated Facility</label>
                <select
                  className="form-select"
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                >
                  <option value="hosp_paderu_dh">hosp_paderu_dh (District Hospital)</option>
                  <option value="hosp_araku_ah">hosp_araku_ah (Area Hospital)</option>
                  <option value="hosp_chintapalli_chc">hosp_chintapalli_chc (CHC)</option>
                  <option value="hosp_hukumpeta_phc">hosp_hukumpeta_phc (PHC)</option>
                </select>
              </div>
            </div>

            {formMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: formMsg.type === 'success' ? 'rgba(6, 214, 160, 0.15)' : 'rgba(230, 57, 70, 0.15)',
                  color: formMsg.type === 'success' ? 'var(--color-brand-accent)' : 'var(--color-status-danger)',
                  fontSize: '0.85rem',
                }}
              >
                {formMsg.text}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={generating}
              style={{ width: '100%', marginTop: '6px' }}
            >
              {generating ? 'Generating 72-Hour Token...' : '🔗 Generate 72-Hour Invitation Link'}
            </button>
          </form>

          {/* Prominent Generated Link Box */}
          {newInviteLink && (
            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(6, 214, 160, 0.08)',
                border: '1.5px solid var(--color-brand-accent)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-brand-accent)', letterSpacing: '0.5px' }}>
                  COPYABLE INVITATION LINK READY (72H TTL)
                </span>
                <span className="badge badge-real" style={{ fontSize: '0.7rem' }}>
                  Single-Use Token
                </span>
              </div>

              {/* Delivery Disclaimer Notice */}
              <div style={{ background: 'rgba(255, 183, 3, 0.12)', borderLeft: '3px solid var(--color-status-warning)', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>
                📢 <strong>Notice:</strong> {newInviteLink.deliveryNote}
              </div>

              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  wordBreak: 'break-all',
                  color: 'var(--color-brand-accent)',
                }}
              >
                {newInviteLink.link}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Expires: {new Date(newInviteLink.expiresAt).toLocaleString()}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={copyToClipboard}
                  style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                >
                  {copied ? '✓ Copied to Clipboard!' : '📋 Copy Invitation Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Onboarding / Token Acceptance Simulator */}
        <div className="card" style={{ borderLeft: '4px solid var(--color-brand-primary)' }}>
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Onboarding & Token Acceptance Simulator
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Test token acceptance, expired token rejection (410), reuse prevention (409), and self-approval blocking (403).
              </p>
            </div>
            <span className="badge badge-mock">Lifecycle Test</span>
          </div>

          <form onSubmit={handleAcceptInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <div className="form-group">
              <label className="form-label">Invitation Token</label>
              <input
                type="text"
                className="form-input"
                placeholder="Paste 64-char hex token or use generated token"
                value={testToken}
                onChange={(e) => setTestToken(e.target.value)}
                required
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Desired Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Desired Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-secondary"
              disabled={accepting}
              style={{ width: '100%', marginTop: '6px' }}
            >
              {accepting ? 'Verifying & Onboarding...' : '🚀 Submit Onboarding / Accept Token'}
            </button>
          </form>

          {acceptResult && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: acceptResult.success ? 'rgba(6, 214, 160, 0.15)' : 'rgba(230, 57, 70, 0.15)',
                border: `1px solid ${acceptResult.success ? 'var(--color-status-success)' : 'var(--color-status-danger)'}`,
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <strong>HTTP {acceptResult.status}</strong>
                <span className="badge" style={{ background: acceptResult.success ? 'var(--color-status-success)' : 'var(--color-status-danger)', color: '#fff' }}>
                  {acceptResult.success ? 'ACCEPTED' : 'REJECTED'}
                </span>
              </div>
              <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                {acceptResult.text}
              </div>
            </div>
          )}

          <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            <strong>Lifecycle Security Guards Implemented:</strong>
            <ul style={{ paddingLeft: '18px', marginTop: '6px', lineHeight: '1.6' }}>
              <li><strong>72-Hour Expiration:</strong> Tokens older than 72h return <code>410 INVITATION_EXPIRED</code>.</li>
              <li><strong>Reused Token:</strong> Tokens once redeemed return <code>409 INVITATION_ALREADY_USED</code>.</li>
              <li><strong>Self-Approval Block:</strong> Creating admin cannot redeem own token (<code>403 SELF_APPROVAL_BLOCKED</code>).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recent Invitations List */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
            Recent Facility Staff Invitations ({invitations.length})
          </h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchInvitations}
            disabled={loading}
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
          >
            🔄 Refresh List
          </button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>Loading invitations...</div>}
        {error && <div style={{ color: 'var(--color-status-danger)', padding: '12px' }}>{error}</div>}

        {!loading && invitations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px', color: 'var(--color-text-secondary)' }}>
            No invitations created yet. Generate an invitation using the form above.
          </div>
        )}

        {invitations.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Role</th>
                  <th>Hospital</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Token Snippet</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const isExpired = new Date(inv.expiresAt).getTime() < Date.now();
                  const effectiveStatus = isExpired && inv.status === 'pending' ? 'expired' : inv.status;

                  return (
                    <tr key={inv.invitationId}>
                      <td>
                        <strong>{inv.fullName}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{inv.email}</div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'rgba(28, 114, 147, 0.4)', color: '#fff' }}>
                          {inv.role.toUpperCase()}
                        </span>
                      </td>
                      <td><code>{inv.hospitalId}</code></td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              effectiveStatus === 'accepted'
                                ? 'var(--color-status-success)'
                                : effectiveStatus === 'expired'
                                ? 'var(--color-status-danger)'
                                : effectiveStatus === 'revoked'
                                ? 'var(--color-text-muted)'
                                : 'var(--color-brand-primary)',
                            color: '#fff',
                          }}
                        >
                          {effectiveStatus.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.78rem' }}>
                          {new Date(inv.expiresAt).toLocaleDateString()} {new Date(inv.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setTestToken(inv.token);
                            const full = `${window.location.origin}${inv.invitationLink}`;
                            navigator.clipboard.writeText(full);
                            alert(`Copied link to clipboard:\n${full}`);
                          }}
                          style={{ fontSize: '0.7rem', padding: '2px 8px', fontFamily: 'monospace' }}
                        >
                          {inv.token.substring(0, 10)}... 📋
                        </button>
                      </td>
                      <td>
                        {inv.status === 'pending' && !isExpired && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleRevoke(inv.invitationId)}
                            style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--color-status-danger)' }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
