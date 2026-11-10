import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface Assignment {
  assignmentId: string;
  workerId: string;
  workerName: string;
  workerRole: 'asha' | 'anm';
  hospitalId: string;
  assignedMandal: string;
  assignedVillages: string[];
  assignedBy: string;
  status: 'active' | 'revoked';
  assignedAt: string;
}

interface Village {
  villageId: string;
  villageName: string;
  mandal: string;
  panchayat: string;
  tribalHabitation: string;
  hospitalId: string;
  censusCode: string;
  populationEstimated: number;
}

interface AssignmentManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export const AssignmentManager: React.FC<AssignmentManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'assignments' | 'reference' | 'scope_probe'>('assignments');

  // Assignments State
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Village Reference State
  const [villages, setVillages] = useState<Village[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [villageFilterMandal, setVillageFilterMandal] = useState<string>('all');

  // Assignment Form State
  const [workerId, setWorkerId] = useState('usr_asha_pad01');
  const [workerName, setWorkerName] = useState('Lakshmi Bai (ASHA)');
  const [workerRole, setWorkerRole] = useState<'asha' | 'anm'>('asha');
  const [hospitalId, setHospitalId] = useState(currentUser?.hospitalId || 'hosp_paderu_dh');
  const [assignedMandal, setAssignedMandal] = useState('Paderu');
  const [selectedVillageIds, setSelectedVillageIds] = useState<string[]>(['vil_vankachinta_01']);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scope Probe State
  const [probeResult, setProbeResult] = useState<any | null>(null);
  const [probingScope, setProbingScope] = useState(false);

  // New Village Reference Form State
  const [showAddVillage, setShowAddVillage] = useState(false);
  const [newVillageId, setNewVillageId] = useState('');
  const [newVillageName, setNewVillageName] = useState('');
  const [newMandal, setNewMandal] = useState('Paderu');
  const [newPanchayat, setNewPanchayat] = useState('');
  const [newHabitation, setNewHabitation] = useState('');
  const [newCensusCode, setNewCensusCode] = useState('');
  const [newPop, setNewPop] = useState(650);
  const [villageSubmitting, setVillageSubmitting] = useState(false);
  const [villageMsg, setVillageMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAssignments = async () => {
    if (!accessToken) return;
    setLoadingAssignments(true);
    setAssignError(null);
    try {
      const res = await fetch('/api/v1/assignments', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setAssignments(payload.data?.assignments || []);
      } else {
        throw new Error(payload.error?.message || 'Failed to fetch assignments');
      }
    } catch (err: any) {
      setAssignError(err.message);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchVillages = async () => {
    if (!accessToken) {
      setLoadingVillages(false);
      return;
    }
    setLoadingVillages(true);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };

      let url = '/api/v1/reference/villages';
      if (villageFilterMandal !== 'all') {
        url += `?mandal=${encodeURIComponent(villageFilterMandal)}`;
      }

      const res = await fetch(url, { headers });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setVillages(payload.data?.villages || []);
      }
    } catch (err) {
      // ignore
    } finally {
      setLoadingVillages(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [accessToken]);

  useEffect(() => {
    fetchVillages();
  }, [accessToken, villageFilterMandal]);

  const handleToggleVillage = (vId: string) => {
    setSelectedVillageIds((prev) =>
      prev.includes(vId) ? prev.filter((id) => id !== vId) : [...prev, vId]
    );
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setFormMsg({ type: 'error', text: 'You must be logged in as Admin to assign health workers' });
      return;
    }

    if (selectedVillageIds.length === 0) {
      setFormMsg({ type: 'error', text: 'Please select at least one jurisdiction village' });
      return;
    }

    setSubmitting(true);
    setFormMsg(null);

    try {
      const res = await fetch('/api/v1/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          workerId: workerId.trim(),
          workerName: workerName.trim(),
          workerRole,
          hospitalId,
          assignedMandal: assignedMandal.trim(),
          assignedVillages: selectedVillageIds,
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success) {
        setFormMsg({
          type: 'success',
          text: `Explicit jurisdiction granted to ${workerName} for ${selectedVillageIds.length} village(s)!`,
        });
        fetchAssignments();
      } else {
        throw new Error(payload.error?.message || 'Assignment failed');
      }
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeAssignment = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/assignments/${id}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        fetchAssignments();
      }
    } catch (err) {
      // ignore
    }
  };

  // Run Scope Probe to test village partitioning
  const handleRunScopeProbe = async () => {
    setProbingScope(true);
    setProbeResult(null);

    try {
      // Use current user's token or test against /reference/villages
      const headers: Record<string, string> = {};
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch('/api/v1/reference/villages', { headers });
      const payload = await res.json();

      setProbeResult({
        status: res.status,
        assignedScopeOnly: payload.data?.assignedScopeOnly ?? false,
        totalVillagesReturned: payload.data?.villages?.length ?? 0,
        workerId: payload.data?.workerId || currentUser?.userId,
        villages: payload.data?.villages || [],
        raw: payload,
      });
    } catch (err: any) {
      setProbeResult({
        status: 500,
        error: err.message,
      });
    } finally {
      setProbingScope(false);
    }
  };

  // Create Village Reference Data
  const handleCreateVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setVillageSubmitting(true);
    setVillageMsg(null);

    try {
      const res = await fetch('/api/v1/reference/villages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          villageId: newVillageId.trim(),
          villageName: newVillageName.trim(),
          mandal: newMandal.trim(),
          panchayat: newPanchayat.trim(),
          tribalHabitation: newHabitation.trim(),
          hospitalId,
          censusCode: newCensusCode.trim(),
          populationEstimated: Number(newPop),
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success) {
        setVillageMsg({ type: 'success', text: `Village ${newVillageName} registered in ITDA census reference!` });
        setNewVillageId('');
        setNewVillageName('');
        setShowAddVillage(false);
        fetchVillages();
      } else {
        throw new Error(payload.error?.message || 'Failed to add village');
      }
    } catch (err: any) {
      setVillageMsg({ type: 'error', text: err.message });
    } finally {
      setVillageSubmitting(false);
    }
  };

  if (!accessToken) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <LoginRequiredView
          moduleTitle="Health Worker Jurisdiction Assignments"
          moduleDescription="Assigning ASHA and ANM frontline staff to specific tribal habitations requires authenticated supervisory credentials."
          onLoginAsAsha={() => onRequireLogin?.('asha')}
          onLoginAsDoctor={() => onRequireLogin?.('doctor')}
          onGoToAuth={onGoToAuth}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(28, 114, 147, 0.25) 0%, rgba(21, 34, 56, 0.85) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.6rem' }}>📍</span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Health Worker Assignments & Village Scope</h2>
              <span className="badge badge-real">Phase 3: Administration</span>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', maxWidth: '800px', margin: 0 }}>
              Explicit jurisdictional scoping for ASHA & ANM field workers. Under tribal agency data protection rules, 
              <strong> clinical scope originates ONLY from explicit active assignments</strong>. Unassigned health workers see ZERO villages.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchAssignments}
              disabled={loadingAssignments}
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <nav style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          📋 Field Assignments
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'scope_probe' ? 'active' : ''}`}
          onClick={() => setActiveTab('scope_probe')}
        >
          🛡️ Worker Scope Verifier (Live Proof)
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'reference' ? 'active' : ''}`}
          onClick={() => setActiveTab('reference')}
        >
          🗺️ ITDA Census Villages ({villages.length})
        </button>
      </nav>

      {/* TAB 1: FIELD ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {/* Creator Form */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
              Grant Explicit Field Jurisdiction
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
              Assign an ASHA or ANM worker to specific tribal habitations and villages.
            </p>

            <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Worker ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Worker Role</label>
                  <select
                    className="form-select"
                    value={workerRole}
                    onChange={(e) => setWorkerRole(e.target.value as any)}
                  >
                    <option value="asha">ASHA Worker</option>
                    <option value="anm">ANM (Sub-Centre Nurse)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Worker Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Hospital ID</label>
                  <select
                    className="form-select"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                  >
                    <option value="hosp_paderu_dh">hosp_paderu_dh</option>
                    <option value="hosp_araku_ah">hosp_araku_ah</option>
                    <option value="hosp_chintapalli_chc">hosp_chintapalli_chc</option>
                    <option value="hosp_hukumpeta_phc">hosp_hukumpeta_phc</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Mandal</label>
                  <input
                    type="text"
                    className="form-input"
                    value={assignedMandal}
                    onChange={(e) => setAssignedMandal(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Village Selection Checkboxes */}
              <div className="form-group">
                <label className="form-label">
                  Assigned Villages ({selectedVillageIds.length} selected)
                </label>
                <div
                  style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {villages.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      No reference villages found. You can manually enter or seed demo villages.
                    </div>
                  ) : (
                    villages.map((v) => (
                      <label
                        key={v.villageId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedVillageIds.includes(v.villageId)}
                          onChange={() => handleToggleVillage(v.villageId)}
                          style={{ accentColor: 'var(--color-brand-accent)' }}
                        />
                        <span>
                          <strong>{v.villageName}</strong> ({v.mandal} • {v.villageId})
                        </span>
                      </label>
                    ))
                  )}
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
                disabled={submitting}
                style={{ width: '100%', marginTop: '6px' }}
              >
                {submitting ? 'Granting Jurisdiction...' : '🔒 Assign Field Jurisdiction'}
              </button>
            </form>
          </div>

          {/* Active Assignments List */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px' }}>
              Active Health Worker Assignments ({assignments.length})
            </h3>

            {loadingAssignments && <div style={{ color: 'var(--color-text-muted)', padding: '16px' }}>Loading assignments...</div>}
            {assignError && <div style={{ color: 'var(--color-status-danger)', padding: '12px' }}>{assignError}</div>}

            {!loadingAssignments && assignments.length === 0 && (
              <div style={{ color: 'var(--color-text-secondary)', padding: '24px 0', textAlign: 'center' }}>
                No active health worker assignments. Create one using the form on the left.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '540px', overflowY: 'auto' }}>
              {assignments.map((asgn) => (
                <div
                  key={asgn.assignmentId}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{asgn.workerName}</strong>{' '}
                      <span className="badge" style={{ background: 'rgba(28, 114, 147, 0.5)', color: '#fff', fontSize: '0.7rem' }}>
                        {asgn.workerRole.toUpperCase()}
                      </span>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: asgn.status === 'active' ? 'var(--color-status-success)' : 'var(--color-status-danger)',
                        color: '#fff',
                        fontSize: '0.7rem',
                      }}
                    >
                      {asgn.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    ID: <code>{asgn.workerId}</code> • Mandal: <strong>{asgn.assignedMandal}</strong> • Hospital: <code>{asgn.hospitalId}</code>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      ASSIGNED VILLAGES ({asgn.assignedVillages.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {asgn.assignedVillages.map((v) => (
                        <span
                          key={v}
                          style={{
                            background: 'rgba(6, 214, 160, 0.1)',
                            border: '1px solid rgba(6, 214, 160, 0.3)',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.72rem',
                            color: 'var(--color-brand-accent)',
                          }}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>

                  {asgn.status === 'active' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleRevokeAssignment(asgn.assignmentId)}
                        style={{ fontSize: '0.72rem', padding: '2px 8px', color: 'var(--color-status-danger)' }}
                      >
                        Revoke Assignment
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCOPE PROBE VERIFIER */}
      {activeTab === 'scope_probe' && (
        <div className="card" style={{ borderLeft: '4px solid var(--color-brand-accent)' }}>
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Health Worker Scope Isolation Verifier (Live Proof)
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Verify the core security rule: <strong>"Health Worker sees ONLY assigned villages"</strong>.
              </p>
            </div>
            <span className="badge badge-real">Zero-Trust Partitions</span>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
              <div>Current Authenticated User: <strong>{currentUser?.fullName || 'Not logged in'}</strong> (Role: <code>{currentUser?.role || 'Guest'}</code>)</div>
              <div style={{ marginTop: '6px', color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
                When logged in as an ASHA or ANM, the backend query pipeline intercepts <code>/api/v1/reference/villages</code>, retrieves the worker's active assignment, and injects <code>villageId: &#123; $in: assignment.assignedVillages &#125;</code>.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRunScopeProbe}
              disabled={probingScope}
              style={{ width: 'fit-content' }}
            >
              {probingScope ? 'Probing Scope...' : '⚡ Probe Village Reference Endpoint'}
            </button>

            {probeResult && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(6, 214, 160, 0.1)',
                  border: '1px solid var(--color-brand-accent)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>Probe Status: HTTP {probeResult.status}</strong>
                  <span className="badge badge-real">
                    Assigned Scope Enforced: {String(probeResult.assignedScopeOnly)}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                  Total Villages Visible to This Session: <strong>{probeResult.totalVillagesReturned}</strong>
                </div>

                {probeResult.villages.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {probeResult.villages.map((v: any) => (
                      <span
                        key={v.villageId}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                        }}
                      >
                        ✓ {v.villageName} ({v.mandal})
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-status-warning)', fontSize: '0.82rem' }}>
                    0 Villages Returned. Worker has no explicit active assignment or is unassigned.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REFERENCE VILLAGES */}
      {activeTab === 'reference' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select
                className="form-select"
                value={villageFilterMandal}
                onChange={(e) => setVillageFilterMandal(e.target.value)}
                style={{ width: '200px', fontSize: '0.85rem' }}
              >
                <option value="all">All Mandals</option>
                <option value="Paderu">Paderu</option>
                <option value="Araku Valley">Araku Valley</option>
                <option value="Chintapalli">Chintapalli</option>
                <option value="Hukumpeta">Hukumpeta</option>
                <option value="Dumbriguda">Dumbriguda</option>
              </select>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={fetchVillages}
                disabled={loadingVillages}
                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              >
                🔄 Refresh
              </button>
            </div>

            {(currentUser?.role === 'system_admin' || currentUser?.role === 'admin') && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddVillage(!showAddVillage)}
                style={{ fontSize: '0.85rem' }}
              >
                {showAddVillage ? '✕ Close Form' : '+ Add Reference Village'}
              </button>
            )}
          </div>

          {/* New Village Form */}
          {showAddVillage && (
            <form onSubmit={handleCreateVillage} className="card" style={{ background: 'rgba(21, 34, 56, 0.95)' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px' }}>
                Register ITDA Census Reference Village
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Village ID</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="vil_minumuluru_02"
                    value={newVillageId}
                    onChange={(e) => setNewVillageId(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Village Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Minumuluru"
                    value={newVillageName}
                    onChange={(e) => setNewVillageName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mandal</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newMandal}
                    onChange={(e) => setNewMandal(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gram Panchayat</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Minumuluru GP"
                    value={newPanchayat}
                    onChange={(e) => setNewPanchayat(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tribal Habitation</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Minumuluru Colony"
                    value={newHabitation}
                    onChange={(e) => setNewHabitation(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Census Code</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="584931"
                    value={newCensusCode}
                    onChange={(e) => setNewCensusCode(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Est. Population</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newPop}
                    onChange={(e) => setNewPop(Number(e.target.value))}
                    min={1}
                    required
                  />
                </div>
              </div>

              {villageMsg && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: villageMsg.type === 'success' ? 'rgba(6, 214, 160, 0.15)' : 'rgba(230, 57, 70, 0.15)',
                    color: villageMsg.type === 'success' ? 'var(--color-brand-accent)' : 'var(--color-status-danger)',
                    fontSize: '0.85rem',
                  }}
                >
                  {villageMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddVillage(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={villageSubmitting}
                >
                  {villageSubmitting ? 'Saving...' : 'Save Village'}
                </button>
              </div>
            </form>
          )}

          {/* Villages Table */}
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>Village Name</th>
                  <th>ID</th>
                  <th>Census Code</th>
                  <th>Mandal</th>
                  <th>Panchayat</th>
                  <th>Habitation</th>
                  <th>Est. Pop</th>
                  <th>Jurisdiction</th>
                </tr>
              </thead>
              <tbody>
                {villages.map((v) => (
                  <tr key={v.villageId}>
                    <td><strong>{v.villageName}</strong></td>
                    <td><code>{v.villageId}</code></td>
                    <td>{v.censusCode}</td>
                    <td>{v.mandal}</td>
                    <td>{v.panchayat}</td>
                    <td>{v.tribalHabitation}</td>
                    <td>{v.populationEstimated}</td>
                    <td><code>{v.hospitalId}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
