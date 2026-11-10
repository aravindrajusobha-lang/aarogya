import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';

export interface RecoveryTicket {
  ticketId: string;
  targetPatientId?: string;
  claimedDemographics: {
    fullName: string;
    gender: string;
    ageEstimated: number;
    villageId: string;
    villageName: string;
    guardianName?: string;
    phone?: string;
    originalAddressText?: string;
  };
  matchedPatientId: string | null;
  matchScore: number;
  status: 'pending_verification' | 'verified' | 'rejected' | 'approved' | 'completed';
  requesterId: string;
  requesterRole: string;
  requestedAt: string;
  verifierId?: string;
  verifierRole?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  verificationEvidence?: string;
  approverId?: string;
  approverRole?: string;
  approvedAt?: string;
  approvalNotes?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface AccountRecoveryManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
}

export const AccountRecoveryManager: React.FC<AccountRecoveryManagerProps> = ({
  accessToken,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'initiate' | 'tickets' | 'claim'>('initiate');

  // Initiate form state
  const [targetPatientId, setTargetPatientId] = useState('PAD-2026-77701');
  const [fullName, setFullName] = useState('Pangi Somulu');
  const [gender, setGender] = useState('male');
  const [ageEstimated, setAgeEstimated] = useState<number>(52);
  const [villageId, setVillageId] = useState('vil_vankachinta_01');
  const [villageName, setVillageName] = useState('Vankachinta');
  const [guardianName, setGuardianName] = useState('Pangi Somanna');
  const [phone, setPhone] = useState('9440188990');
  const [originalAddressText, setOriginalAddressText] = useState(
    'Near Old Water Tank, Vankachinta, Paderu'
  );
  const [initiating, setInitiating] = useState(false);
  const [initiateResult, setInitiateResult] = useState<{
    ticketId: string;
    status: string;
    message: string;
    notice: string;
  } | null>(null);

  // Tickets list state
  const [tickets, setTickets] = useState<RecoveryTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Action states
  const [actionTicketId, setActionTicketId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'verify' | 'approve' | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionEvidence, setActionEvidence] = useState('physical_demographic_crosscheck');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string; token?: string } | null>(null);

  // Claim redemption state
  const [claimTicketId, setClaimTicketId] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchTickets = async () => {
    if (!accessToken) return;
    setLoadingTickets(true);
    setTicketError(null);
    try {
      const res = await fetch('/api/v1/recovery/tickets?limit=50', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch tickets');
      setTickets(json.data?.tickets || []);
    } catch (err: any) {
      setTicketError(err.message || 'Error fetching recovery tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchTickets();
    }
  }, [accessToken, activeTab]);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setInitiating(true);
    setInitiateResult(null);

    try {
      const res = await fetch('/api/v1/recovery/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          targetPatientId: targetPatientId.trim() || undefined,
          claimedDemographics: {
            fullName,
            gender,
            ageEstimated: Number(ageEstimated),
            villageId,
            villageName,
            guardianName: guardianName || undefined,
            phone: phone || undefined,
            originalAddressText: originalAddressText || undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Initiation error');

      setInitiateResult(json.data);
      fetchTickets();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setInitiating(false);
    }
  };

  const handleVerify = async (ticketId: string) => {
    if (!accessToken) return;
    setActionLoading(true);
    setActionFeedback(null);

    try {
      const res = await fetch(`/api/v1/recovery/tickets/${ticketId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          verificationNotes: actionNotes || 'Physical demographic crosscheck confirmed on site',
          verificationEvidence: actionEvidence,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Verification rejected');

      setActionFeedback({
        type: 'success',
        message: 'Frontline verification recorded successfully.',
      });
      setActionTicketId(null);
      setActionType(null);
      fetchTickets();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (ticketId: string) => {
    if (!accessToken) return;
    setActionLoading(true);
    setActionFeedback(null);

    try {
      const res = await fetch(`/api/v1/recovery/tickets/${ticketId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          approvalNotes: actionNotes || 'Administrative authority approved three-party recovery',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Approval rejected');

      setActionFeedback({
        type: 'success',
        message: json.message || 'Recovery ticket approved.',
        token: json.data?.recoveryToken,
      });
      if (json.data?.recoveryToken) {
        setClaimTicketId(ticketId);
        setClaimToken(json.data.recoveryToken);
      }
      setActionTicketId(null);
      setActionType(null);
      fetchTickets();
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setClaiming(true);
    setClaimResult(null);

    try {
      const res = await fetch('/api/v1/recovery/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ticketId: claimTicketId.trim(),
          recoveryToken: claimToken.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Claim redemption failed');

      setClaimResult({
        type: 'success',
        message: 'Account recovery completed! Access credentials restored successfully.',
      });
      fetchTickets();
    } catch (err: any) {
      setClaimResult({ type: 'error', message: err.message });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem', fontFamily: 'inherit' }}>
      {/* Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
          borderRadius: '16px',
          padding: '1.75rem',
          color: '#f8fafc',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🛡️</span>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Account Recovery
            </h2>
            <span
              style={{
                background: '#3b82f6',
                color: '#fff',
                borderRadius: '20px',
                padding: '0.2rem 0.65rem',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              v0.2 Verified Three-Party Flow
            </span>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
            Requester, Verifier, and Approver must be <strong>three different people</strong>. Matching runs against existing patient records.
          </p>
        </div>

        {/* Security Rule Card */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '0.65rem 0.9rem',
            color: '#fca5a5',
            fontSize: '0.8rem',
            maxWidth: '380px',
            lineHeight: 1.4,
          }}
        >
          <strong>🚫 No Password Reset Shortcut:</strong> Generic forgot-password endpoints do not exist.
          Responses are <strong>enumeration resistant</strong> (identical for known & unknown records).
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('initiate')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeTab === 'initiate' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
            background: activeTab === 'initiate' ? '#1d4ed8' : 'rgba(30, 41, 59, 0.6)',
            color: '#fff',
          }}
        >
          📝 1. Initiate Recovery Ticket
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeTab === 'tickets' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
            background: activeTab === 'tickets' ? '#1d4ed8' : 'rgba(30, 41, 59, 0.6)',
            color: '#fff',
          }}
        >
          👥 2. Active Tickets ({tickets.length})
        </button>
        <button
          onClick={() => setActiveTab('claim')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            border: activeTab === 'claim' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
            background: activeTab === 'claim' ? '#1d4ed8' : 'rgba(30, 41, 59, 0.6)',
            color: '#fff',
          }}
        >
          🔑 3. Claim Reissued Access
        </button>
      </div>

      {/* Global Feedback Alert */}
      {actionFeedback && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            background: actionFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: actionFeedback.type === 'success' ? '#34d399' : '#f87171',
          }}
        >
          <div>{actionFeedback.message}</div>
          {actionFeedback.token && (
            <div style={{ marginTop: '0.5rem', background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: '6px', color: '#fbbf24', fontFamily: 'monospace' }}>
              <strong>Single-Use Recovery Claim Token:</strong> {actionFeedback.token}
            </div>
          )}
        </div>
      )}

      {/* TAB 1: INITIATE RECOVERY */}
      {activeTab === 'initiate' && (
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.2rem' }}>
            Claimant Identity Intake (Requester Role)
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Submitting a recovery ticket triggers demographic matching against active patient records.
            Regardless of whether a patient record exists, an identical response is returned to prevent demographic harvesting.
          </p>

          <form onSubmit={handleInitiate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Target Patient ID (if known):
                </label>
                <input
                  type="text"
                  value={targetPatientId}
                  onChange={(e) => setTargetPatientId(e.target.value)}
                  placeholder="PAD-YYYY-XXXXX"
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Claimant Full Name:
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Gender:
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Estimated Age:
                </label>
                <input
                  type="number"
                  value={ageEstimated}
                  onChange={(e) => setAgeEstimated(parseInt(e.target.value, 10))}
                  required
                  min={1}
                  max={120}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Village ID:
                </label>
                <input
                  type="text"
                  value={villageId}
                  onChange={(e) => setVillageId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Village Name:
                </label>
                <input
                  type="text"
                  value={villageName}
                  onChange={(e) => setVillageName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Guardian Name:
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Contact Phone:
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Original Address Text:
                </label>
                <input
                  type="text"
                  value={originalAddressText}
                  onChange={(e) => setOriginalAddressText(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={initiating}
              style={{
                padding: '0.75rem 1.75rem',
                background: initiating ? '#475569' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: initiating ? 'not-allowed' : 'pointer',
              }}
            >
              {initiating ? 'Submitting...' : '🚀 Submit Recovery Intake'}
            </button>
          </form>

          {/* Enumeration-Resistant Result Card */}
          {initiateResult && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#34d399' }}>
                ✓ {initiateResult.message}
              </h4>
              <p style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0', fontSize: '0.9rem' }}>
                <strong>Generated Ticket ID:</strong> <code>{initiateResult.ticketId}</code> (Status: {initiateResult.status})
              </p>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', borderLeft: '3px solid #3b82f6', padding: '0.5rem 0.75rem', color: '#93c5fd', fontSize: '0.85rem', borderRadius: '4px' }}>
                {initiateResult.notice}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE TICKETS */}
      {activeTab === 'tickets' && (
        <div>
          {loadingTickets && <div style={{ color: '#94a3b8', padding: '1rem' }}>Loading tickets...</div>}
          {ticketError && <div style={{ color: '#f87171', padding: '1rem' }}>{ticketError}</div>}

          {!loadingTickets && tickets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              No active recovery tickets found.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tickets.map((t) => {
              const statusColors: Record<string, string> = {
                pending_verification: '#f59e0b',
                verified: '#3b82f6',
                approved: '#10b981',
                rejected: '#ef4444',
                completed: '#8b5cf6',
              };
              const badgeColor = statusColors[t.status] || '#64748b';

              const canVerify =
                t.status === 'pending_verification' &&
                currentUser &&
                currentUser.userId !== t.requesterId;

              const canApprove =
                t.status === 'verified' &&
                currentUser &&
                currentUser.userId !== t.requesterId &&
                currentUser.userId !== t.verifierId &&
                (currentUser.role === 'admin' ||
                  currentUser.role === 'medical_officer' ||
                  currentUser.role === 'system_admin');

              return (
                <div
                  key={t.ticketId}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          background: `${badgeColor}22`,
                          color: badgeColor,
                          border: `1px solid ${badgeColor}55`,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                      <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1.05rem' }}>
                        {t.ticketId} — Claimant: {t.claimedDemographics.fullName} ({t.claimedDemographics.villageName})
                      </h4>
                    </div>

                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Requested: {new Date(t.requestedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Three-Party Role Ledger */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1. REQUESTER (Person 1)</div>
                      <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>
                        {t.requesterId} ({t.requesterRole})
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>2. VERIFIER (Person 2)</div>
                      <div style={{ fontSize: '0.85rem', color: t.verifierId ? '#34d399' : '#64748b', fontWeight: 600 }}>
                        {t.verifierId ? `${t.verifierId} (${t.verifierRole})` : 'Pending Verification'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>3. APPROVER (Person 3)</div>
                      <div style={{ fontSize: '0.85rem', color: t.approverId ? '#60a5fa' : '#64748b', fontWeight: 600 }}>
                        {t.approverId ? `${t.approverId} (${t.approverRole})` : 'Pending Approval'}
                      </div>
                    </div>
                  </div>

                  {/* Status Notes */}
                  {t.rejectionReason && (
                    <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      ✕ Rejection Reason: {t.rejectionReason}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    {canVerify && (
                      <button
                        onClick={() => {
                          setActionTicketId(t.ticketId);
                          setActionType('verify');
                        }}
                        style={{
                          padding: '0.4rem 0.85rem',
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Frontline Verify (Person 2)
                      </button>
                    )}

                    {canApprove && (
                      <button
                        onClick={() => {
                          setActionTicketId(t.ticketId);
                          setActionType('approve');
                        }}
                        style={{
                          padding: '0.4rem 0.85rem',
                          background: '#059669',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Authorize & Issue Claim Token (Person 3)
                      </button>
                    )}
                  </div>

                  {/* Inline Action Form */}
                  {actionTicketId === t.ticketId && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: '#93c5fd' }}>
                        {actionType === 'verify' ? 'Confirm Frontline Verification' : 'Confirm Administrative Approval'}
                      </h5>
                      {actionType === 'verify' && (
                        <select
                          value={actionEvidence}
                          onChange={(e) => setActionEvidence(e.target.value)}
                          style={{
                            width: '100%',
                            background: '#1e293b',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.2)',
                            padding: '0.45rem',
                            borderRadius: '4px',
                            marginBottom: '0.5rem',
                            fontSize: '0.85rem',
                          }}
                        >
                          <option value="physical_demographic_crosscheck">Physical Demographic Crosscheck</option>
                          <option value="ration_card_sighted">Ration Card / Voter ID Sighted</option>
                          <option value="tribal_elder_attestation">Gram Panchayat / Elder Attestation</option>
                        </select>
                      )}
                      <input
                        type="text"
                        placeholder="Audit notes..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        style={{ width: '100%', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.45rem', borderRadius: '4px', marginBottom: '0.5rem' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => (actionType === 'verify' ? handleVerify(t.ticketId) : handleApprove(t.ticketId))}
                          disabled={actionLoading}
                          style={{ padding: '0.4rem 0.85rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          {actionLoading ? 'Processing...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => {
                            setActionTicketId(null);
                            setActionType(null);
                          }}
                          style={{ padding: '0.4rem 0.85rem', background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CLAIM REISSUED ACCESS */}
      {activeTab === 'claim' && (
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '1.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#f8fafc', fontSize: '1.2rem' }}>
            Claim Reissued Access Credentials
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
            Redeem the single-use recovery claim token issued by the Approver after three-party identity verification.
          </p>

          <form onSubmit={handleComplete}>
            <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Recovery Ticket ID:
                </label>
                <input
                  type="text"
                  value={claimTicketId}
                  onChange={(e) => setClaimTicketId(e.target.value)}
                  placeholder="REC-..."
                  required
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Single-Use Recovery Token:
                </label>
                <input
                  type="text"
                  value={claimToken}
                  onChange={(e) => setClaimToken(e.target.value)}
                  placeholder="REC-CLAIM-..."
                  required
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '0.55rem',
                    borderRadius: '6px',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={claiming}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: claiming ? '#475569' : '#059669',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: claiming ? 'not-allowed' : 'pointer',
                }}
              >
                {claiming ? 'Verifying Token...' : '🔓 Finalize Account Recovery'}
              </button>
            </div>
          </form>

          {claimResult && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem',
                borderRadius: '8px',
                background: claimResult.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${claimResult.type === 'success' ? '#10b981' : '#ef4444'}`,
                color: claimResult.type === 'success' ? '#34d399' : '#f87171',
              }}
            >
              {claimResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
