import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';


interface VillageGroupManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
}

interface VillageGroup {
  groupId: string;
  groupName: string;
  villageId: string;
  villageName: string;
  mandal: string;
  normalizedAddress: string;
  sampleAddressText: string;
  memberPatientIds: string[];
  patientCount: number;
  status: 'pending_approval' | 'active' | 'inactive' | 'rejected' | 'deleted';
  autoCreated: boolean;
  autoTriggerBlocked: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

interface SuppressedCount {
  count: number | null;
  displayValue: string;
  isSuppressed: boolean;
  suppressionReason?: string;
}

interface AggregatesData {
  summary: {
    totalGroups: number;
    activeGroups: number;
    pendingGroups: number;
    inactiveGroups: number;
    rejectedGroups: number;
    totalPatients: SuppressedCount;
  };
  villageBreakdown: Array<{
    villageId: string;
    villageName: string;
    mandal: string;
    groupCount: number;
    patientCount: SuppressedCount;
  }>;
  mandalBreakdown: Array<{
    mandal: string;
    groupCount: number;
    patientCount: SuppressedCount;
  }>;
  privacyPolicy: {
    cellSuppressionThreshold: number;
    rule: string;
  };
}

export const VillageGroupManager: React.FC<VillageGroupManagerProps> = ({
  accessToken,
  currentUser,
}) => {
  const [groups, setGroups] = useState<VillageGroup[]>([]);
  const [aggregates, setAggregates] = useState<AggregatesData | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Reject Modal / Form state
  const [rejectingGroupId, setRejectingGroupId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  // Simulation test state
  const [simVillageId, setSimVillageId] = useState<string>('VILLAGE_ARAKU_01');
  const [simAddress, setSimAddress] = useState<string>('Habitation North, Ward 3');
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const fetchGroups = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const url = statusFilter === 'all'
        ? '/api/v1/village-groups'
        : `/api/v1/village-groups?status=${statusFilter}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setGroups(json.data.items || []);
      }
    } catch {
      // Ignore network errors in demo
    } finally {
      setLoading(false);
    }
  };

  const fetchAggregates = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/v1/village-groups/aggregates', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAggregates(json.data);
      }
    } catch {
      // Ignore network errors in demo
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchAggregates();
  }, [accessToken, statusFilter]);

  const handleApprove = async (groupId: string) => {
    if (!accessToken) return;
    setActionLoading(groupId);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/village-groups/${groupId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: `Village group ${groupId} approved successfully!`, type: 'success' });
        await fetchGroups();
        await fetchAggregates();
      } else {
        setMessage({ text: json.error?.message || 'Failed to approve group', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (groupId: string) => {
    if (!accessToken) return;
    setActionLoading(groupId);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/village-groups/${groupId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ rejectionReason: rejectionReason || 'Administrative decision' }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          text: `Village group rejected. Automatic creation blocked for this village until admin unblocks.`,
          type: 'success',
        });
        setRejectingGroupId(null);
        setRejectionReason('');
        await fetchGroups();
        await fetchAggregates();
      } else {
        setMessage({ text: json.error?.message || 'Failed to reject group', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async (groupId: string) => {
    if (!accessToken) return;
    setActionLoading(groupId);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/village-groups/${groupId}/unblock-auto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          text: `Auto-trigger unblocked for village! Future registrations will trigger group formation again.`,
          type: 'success',
        });
        await fetchGroups();
        await fetchAggregates();
      } else {
        setMessage({ text: json.error?.message || 'Failed to unblock auto-trigger', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  // Run simulation of 2 simultaneous registrations
  const handleSimulateConcurrent = async () => {
    if (!accessToken) return;
    setSimLoading(true);
    setMessage(null);
    try {
      const patient1 = {
        fullName: `Sim Patient A (${Math.floor(Math.random() * 900) + 100})`,
        gender: 'female',
        ageEstimated: 32,
        villageId: simVillageId,
        villageName: 'Araku Valley',
        mandal: 'Araku Valley',
        originalAddressText: simAddress,
        hospitalId: 'hosp_araku_chc',
      };
      const patient2 = {
        fullName: `Sim Patient B (${Math.floor(Math.random() * 900) + 100})`,
        gender: 'male',
        ageEstimated: 45,
        villageId: simVillageId,
        villageName: 'Araku Valley',
        mandal: 'Araku Valley',
        originalAddressText: simAddress,
        hospitalId: 'hosp_araku_chc',
      };

      const [res1, res2] = await Promise.all([
        fetch('/api/v1/patients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(patient1),
        }),
        fetch('/api/v1/patients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(patient2),
        }),
      ]);

      const [j1, j2] = await Promise.all([res1.json(), res2.json()]);

      if (j1.success && j2.success) {
        setMessage({
          text: `Concurrency test passed! Dispatched two simultaneous registrations from ${simVillageId}. A single village group was formed/updated with both members attached!`,
          type: 'success',
        });
        await fetchGroups();
        await fetchAggregates();
      } else {
        setMessage({
          text: j1.error?.message || j2.error?.message || 'Simulation encountered an error',
          type: 'error',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSimLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-real">Active (Approved)</span>;
      case 'pending_approval':
        return <span className="badge badge-warning">Pending Review</span>;
      case 'inactive':
        return <span className="badge" style={{ backgroundColor: '#64748b', color: '#fff' }}>Inactive (Blocks Dups)</span>;
      case 'rejected':
        return <span className="badge badge-simulated">Rejected</span>;
      case 'deleted':
        return <span className="badge" style={{ backgroundColor: '#475569', color: '#fff' }}>Deleted</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const isAdmin = currentUser?.role === 'system_admin' || currentUser?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Card */}
      <section className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Village Groups (v0.2 Village Group Management)</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Automatic clustering from matching address intake on patient.registered, partial unique indexing, administrative review, and small-count privacy suppression (&lt; 5).
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-real">Partial Unique Index</span>
            <span className="badge badge-real">Cell Suppression (&lt; 5)</span>
            <span className="badge badge-simulated">Simulation Mode</span>
          </div>
        </div>

        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '6px',
              marginTop: '16px',
              backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}`,
              color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              fontSize: '0.9rem',
            }}
          >
            {message.text}
          </div>
        )}
      </section>

      {/* Aggregate Metrics & Small-Count Privacy Dashboard */}
      {aggregates && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Privacy-Preserving Aggregate Statistics</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                {aggregates.privacyPolicy.rule}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              onClick={fetchAggregates}
            >
              🔄 Refresh Aggregates
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              marginTop: '16px',
            }}
          >
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Total Village Groups</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px' }}>{aggregates.summary.totalGroups}</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Active (Approved)</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-success)', marginTop: '4px' }}>{aggregates.summary.activeGroups}</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Pending Review</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>{aggregates.summary.pendingGroups}</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>Total Unique Patients</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {aggregates.summary.totalPatients.displayValue}
                {aggregates.summary.totalPatients.isSuppressed && (
                  <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Suppressed (&lt; 5)</span>
                )}
              </div>
            </div>
          </div>

          {/* Village Breakdown with Cell Suppression */}
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
              Village Habitation Breakdown (Cell Suppression Enforced)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Village ID</th>
                    <th style={{ padding: '8px' }}>Village Name</th>
                    <th style={{ padding: '8px' }}>Mandal</th>
                    <th style={{ padding: '8px' }}>Groups</th>
                    <th style={{ padding: '8px' }}>Patient Count</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.villageBreakdown.map((vb) => (
                    <tr key={vb.villageId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px', fontFamily: 'monospace' }}>{vb.villageId}</td>
                      <td style={{ padding: '8px', fontWeight: 500 }}>{vb.villageName}</td>
                      <td style={{ padding: '8px' }}>{vb.mandal}</td>
                      <td style={{ padding: '8px' }}>{vb.groupCount}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{vb.patientCount.displayValue}</span>
                        {vb.patientCount.isSuppressed && (
                          <span
                            className="badge badge-warning"
                            style={{ fontSize: '0.65rem', marginLeft: '6px' }}
                            title={vb.patientCount.suppressionReason}
                          >
                            Privacy Masked (&lt; 5)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {aggregates.villageBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        No village groups recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Concurrent Registration Live Simulation Test Card */}
      <section className="card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>
          🧪 Live Concurrency &amp; Suppression Simulator
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Test the system requirements: two simultaneous patient registrations from the same village with matching address text will automatically collapse into exactly ONE group using atomic partial unique indexing.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Simulation Village ID</label>
            <input
              type="text"
              className="form-input"
              value={simVillageId}
              onChange={(e) => setSimVillageId(e.target.value)}
              placeholder="e.g. VILLAGE_ARAKU_01"
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Intake Address Text</label>
            <input
              type="text"
              className="form-input"
              value={simAddress}
              onChange={(e) => setSimAddress(e.target.value)}
              placeholder="e.g. Main Habitation Street"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', height: '38px' }}
              onClick={handleSimulateConcurrent}
              disabled={simLoading || !accessToken}
            >
              {simLoading ? 'Simulating...' : '⚡ Test Simultaneous Registrations'}
            </button>
          </div>
        </div>
      </section>

      {/* Groups Directory & Admin Review */}
      <section className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Village Groups Directory</h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['all', 'pending_approval', 'active', 'inactive', 'rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  onClick={() => setStatusFilter(st)}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            onClick={fetchGroups}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Groups'}
          </button>
        </div>

        {/* Groups List */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groups.map((group) => (
            <div
              key={group.groupId}
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{group.groupName}</span>
                    {getStatusBadge(group.status)}
                    {group.autoTriggerBlocked && (
                      <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                        Auto-Trigger Blocked
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    ID: <code style={{ color: 'var(--color-primary)' }}>{group.groupId}</code> | Village: {group.villageName} ({group.villageId}) | Mandal: {group.mandal}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Members: {group.patientCount} Patient{group.patientCount !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Created: {new Date(group.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Address details */}
              <div style={{ fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.04)', padding: '8px 12px', borderRadius: '4px' }}>
                <div><strong>Sample Intake Address:</strong> {group.sampleAddressText}</div>
                <div style={{ marginTop: '2px', color: 'var(--color-text-secondary)' }}>
                  <strong>Normalized Cluster Key:</strong> <code>{group.normalizedAddress}</code>
                </div>
                {group.rejectionReason && (
                  <div style={{ marginTop: '4px', color: 'var(--color-danger)' }}>
                    <strong>Rejection Reason:</strong> {group.rejectionReason}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {group.status === 'pending_approval' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                        onClick={() => handleApprove(group.groupId)}
                        disabled={actionLoading === group.groupId}
                      >
                        ✓ Approve Group
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: '0.8rem', padding: '4px 12px', borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        onClick={() => setRejectingGroupId(group.groupId)}
                        disabled={actionLoading === group.groupId}
                      >
                        ✕ Reject Group
                      </button>
                    </>
                  )}

                  {group.status === 'rejected' && group.autoTriggerBlocked && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                      onClick={() => handleUnblock(group.groupId)}
                      disabled={actionLoading === group.groupId}
                    >
                      🔓 Unblock Village Auto-Trigger
                    </button>
                  )}
                </div>
              )}

              {/* Rejection input box if open for this group */}
              {rejectingGroupId === group.groupId && (
                <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>
                    Administrative Rejection Reason
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejecting this auto-created group..."
                    style={{ marginBottom: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                      onClick={() => setRejectingGroupId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '4px 12px', backgroundColor: 'var(--color-danger)' }}
                      onClick={() => handleReject(group.groupId)}
                      disabled={actionLoading === group.groupId}
                    >
                      Confirm Rejection &amp; Block Village Auto-Trigger
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {groups.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              No village groups found for filter "{statusFilter}".
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
