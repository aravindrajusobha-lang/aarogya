import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface Hospital {
  hospitalId: string;
  name: string;
  type: string;
  district: string;
  mandal: string;
  jurisdictionVillages: string[];
  adminUserIds: string[];
  status: string;
}

interface HospitalManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export const HospitalManager: React.FC<HospitalManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Hospital Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHospitalId, setNewHospitalId] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('primary_health_centre');
  const [newMandal, setNewMandal] = useState('Paderu');
  const [newVillages, setNewVillages] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Extra Hospital Fields
  const [newAddress, setNewAddress] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newServices, setNewServices] = useState('Oral Screening, Teleconsultation, Dental Surgery');

  // Manager Account Creation Modal State
  const [selectedHospitalForManager, setSelectedHospitalForManager] = useState<Hospital | null>(null);
  const [managerFullName, setManagerFullName] = useState('');
  const [managerUsername, setManagerUsername] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [creatingManager, setCreatingManager] = useState(false);
  const [createdManagerResult, setCreatedManagerResult] = useState<{ username: string; password: string } | null>(null);

  // Performance Modal State
  const [selectedHospitalForPerf, setSelectedHospitalForPerf] = useState<Hospital | null>(null);
  const [perfData, setPerfData] = useState<any | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(false);

  // Cross-Hospital Access Control Probe Simulator
  const [probeTargetHospital, setProbeTargetHospital] = useState('hosp_chintapalli_chc');
  const [probeResult, setProbeResult] = useState<any | null>(null);
  const [probing, setProbing] = useState(false);

  const handleOpenManagerModal = (h: Hospital) => {
    setSelectedHospitalForManager(h);
    setManagerFullName(`Manager - ${h.name}`);
    setManagerUsername(`mgr_${h.hospitalId.replace('hosp_', '')}`);
    setManagerPhone('');
    setManagerEmail('');
    setManagerPassword('');
    setCreatedManagerResult(null);
  };

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalForManager || !accessToken) return;
    setCreatingManager(true);
    try {
      const res = await fetch(`/api/v1/hospitals/${selectedHospitalForManager.hospitalId}/managers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName: managerFullName.trim(),
          username: managerUsername.trim(),
          phone: managerPhone.trim() || undefined,
          email: managerEmail.trim() || undefined,
          password: managerPassword.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setCreatedManagerResult({
          username: payload.data?.manager?.username || managerUsername,
          password: payload.data?.temporaryPassword || 'GeneratedSecurePassword',
        });
        fetchHospitals();
      } else {
        alert(payload.error?.message || 'Failed to create manager account');
      }
    } catch (err: any) {
      alert(`Error creating manager: ${err.message}`);
    } finally {
      setCreatingManager(false);
    }
  };

  const handleOpenPerformance = async (h: Hospital) => {
    setSelectedHospitalForPerf(h);
    setPerfData(null);
    setLoadingPerf(true);
    try {
      const res = await fetch(`/api/v1/hospitals/${h.hospitalId}/performance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setPerfData(payload.data?.metrics);
      }
    } catch (err) {
      // ignore
    } finally {
      setLoadingPerf(false);
    }
  };

  const fetchHospitals = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };

      const res = await fetch('/api/v1/hospitals', { headers });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setHospitals(payload.data?.hospitals || []);
      } else {
        throw new Error(payload.error?.message || 'Failed to fetch hospital list');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading facilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, [accessToken]);

  const handleCreateHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setAddMsg({ type: 'error', text: 'You must be logged in to register a hospital' });
      return;
    }

    setSubmitting(true);
    setAddMsg(null);

    try {
      const villagesList = newVillages
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/v1/hospitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          hospitalId: newHospitalId.trim(),
          name: newName.trim(),
          type: newType,
          district: 'Alluri Sitharama Raju',
          mandal: newMandal.trim(),
          address: newAddress.trim() || undefined,
          contactNumber: newContactPhone.trim() || undefined,
          services: newServices.split(',').map((s) => s.trim()).filter(Boolean),
          specialties: ['Oral Screening', 'Teleconsultation'],
          jurisdictionVillages: villagesList,
          adminUserIds: currentUser?.userId ? [currentUser.userId] : [],
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success) {
        setAddMsg({ type: 'success', text: `Hospital "${newName}" registered successfully!` });
        setNewHospitalId('');
        setNewName('');
        setNewVillages('');
        setShowAddForm(false);
        fetchHospitals();
      } else {
        throw new Error(payload.error?.message || 'Failed to create hospital');
      }
    } catch (err: any) {
      setAddMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Run Cross-Hospital Isolation Security Probe
  const handleRunIsolationProbe = async () => {
    setProbing(true);
    setProbeResult(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(`/api/v1/hospitals/${probeTargetHospital}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: 'Unauthorized Cross-Hospital Tamper Attempt',
        }),
      });

      const payload = await res.json();
      setProbeResult({
        status: res.status,
        success: payload.success,
        error: payload.error,
        message: payload.error
          ? `[Access Blocked: ${payload.error.code}] ${payload.error.message}`
          : 'Update unexpectedly succeeded',
      });
    } catch (err: any) {
      setProbeResult({
        status: 500,
        success: false,
        message: err.message,
      });
    } finally {
      setProbing(false);
    }
  };

  const formatFacilityType = (type: string) => {
    switch (type) {
      case 'district_hospital':
        return 'District Hospital (DH)';
      case 'area_hospital':
        return 'Area Hospital (AH)';
      case 'community_health_centre':
        return 'Community Health Centre (CHC)';
      case 'primary_health_centre':
        return 'Primary Health Centre (PHC)';
      case 'sub_centre':
        return 'Ayushman Arogya Mandir (Sub-Centre)';
      default:
        return type.toUpperCase();
    }
  };

  if (!accessToken) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <LoginRequiredView
          moduleTitle="Hospital Network & Facility Catchment"
          moduleDescription="Managing catchment hospitals, CHC facilities, and tribal administrative links requires authenticated administrator access."
          onLoginAsAsha={() => onRequireLogin?.('asha')}
          onLoginAsDoctor={() => onRequireLogin?.('doctor')}
          onGoToAuth={onGoToAuth}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Explanation */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(28, 114, 147, 0.2) 0%, rgba(21, 34, 56, 0.8) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.6rem' }}>🏥</span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Hospitals & Facility Catchment</h2>
              <span className="badge badge-real">Phase 3: Administration</span>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', maxWidth: '780px', margin: 0 }}>
              ITDA Paderu healthcare facilities hierarchy. Each hospital operates within strict territorial catchment and administrative boundaries. Cross-hospital access is strictly forbidden unless authorized by Super Admin.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchHospitals}
              disabled={loading}
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Refresh
            </button>
            {currentUser?.role === 'system_admin' && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddForm(!showAddForm)}
                style={{ fontSize: '0.85rem' }}
              >
                {showAddForm ? '✕ Close Form' : '+ Add Facility'}
              </button>
            )}
          </div>
        </div>

        {currentUser?.hospitalId && (
          <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(6, 214, 160, 0.1)', border: '1px solid rgba(6, 214, 160, 0.3)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--color-brand-accent)' }}>🔒</span>
            <span style={{ fontSize: '0.84rem' }}>
              Your Session Affiliation: <strong>{currentUser.hospitalId}</strong> — Modifications to any other facility will be strictly rejected by the Cross-Hospital isolation guard.
            </span>
          </div>
        )}
      </div>

      {/* Cross-Hospital Security Isolation Probe Card */}
      <div className="card" style={{ borderLeft: '4px solid var(--color-status-warning)' }}>
        <div className="card-header" style={{ paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🛡️</span> Cross-Hospital Isolation Guard (Interactive Security Probe)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
              Simulate a staff member from one hospital attempting to modify another facility's catchment data.
            </p>
          </div>
          <span className="badge badge-mock">Zero-Trust Isolation</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <label className="form-label" style={{ fontSize: '0.78rem' }}>TARGET FACILITY TO PROBE</label>
            <select
              className="form-select"
              value={probeTargetHospital}
              onChange={(e) => setProbeTargetHospital(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="hosp_chintapalli_chc">hosp_chintapalli_chc (CHC Chintapalli)</option>
              <option value="hosp_paderu_dh">hosp_paderu_dh (District Hospital Paderu)</option>
              <option value="hosp_araku_ah">hosp_araku_ah (Area Hospital Araku)</option>
              <option value="hosp_hukumpeta_phc">hosp_hukumpeta_phc (PHC Hukumpeta)</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRunIsolationProbe}
            disabled={probing}
            style={{ marginTop: '18px', fontSize: '0.85rem' }}
          >
            {probing ? 'Probing Gateway...' : '⚡ Probe Cross-Hospital Boundary'}
          </button>
        </div>

        {probeResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              background: probeResult.status === 403 ? 'rgba(230, 57, 70, 0.15)' : 'rgba(6, 214, 160, 0.15)',
              border: `1px solid ${probeResult.status === 403 ? 'var(--color-status-danger)' : 'var(--color-status-success)'}`,
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <strong>
                HTTP {probeResult.status} {probeResult.status === 403 ? 'FORBIDDEN (Isolation Preserved)' : 'OK'}
              </strong>
              <span className="badge" style={{ background: probeResult.status === 403 ? 'var(--color-status-danger)' : 'var(--color-status-success)', color: '#fff' }}>
                {probeResult.status === 403 ? 'CROSS_HOSPITAL_FORBIDDEN' : 'SUCCESS'}
              </span>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {probeResult.message}
            </div>
          </div>
        )}
      </div>

      {/* Add Facility Form (Conditional) */}
      {showAddForm && (
        <form onSubmit={handleCreateHospital} className="card" style={{ background: 'rgba(21, 34, 56, 0.95)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>
            Register New ITDA Paderu Healthcare Facility
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Facility ID (e.g. hosp_gudem_phc)</label>
              <input
                type="text"
                className="form-input"
                placeholder="hosp_dumbriguda_phc"
                value={newHospitalId}
                onChange={(e) => setNewHospitalId(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Facility Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Primary Health Centre Dumbriguda"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Facility Type</label>
              <select
                className="form-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                <option value="primary_health_centre">Primary Health Centre (PHC)</option>
                <option value="community_health_centre">Community Health Centre (CHC)</option>
                <option value="area_hospital">Area Hospital (AH)</option>
                <option value="district_hospital">District Hospital (DH)</option>
                <option value="sub_centre">Sub-Centre / Health & Wellness</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Mandal (Agency)</label>
              <input
                type="text"
                className="form-input"
                value={newMandal}
                onChange={(e) => setNewMandal(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                type="text"
                className="form-input"
                placeholder="08935-245100"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Physical Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="Main Road, Paderu Agency"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label">Clinical Services (Comma-separated)</label>
            <input
              type="text"
              className="form-input"
              value={newServices}
              onChange={(e) => setNewServices(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginTop: '12px' }}>
            <label className="form-label">Jurisdiction Villages (Comma-separated IDs)</label>
            <input
              type="text"
              className="form-input"
              placeholder="vil_vankachinta_01, vil_minumuluru_02"
              value={newVillages}
              onChange={(e) => setNewVillages(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              These define the exclusive village catchment records accessible to this facility's clinical officers.
            </span>
          </div>

          {addMsg && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: addMsg.type === 'success' ? 'rgba(6, 214, 160, 0.15)' : 'rgba(230, 57, 70, 0.15)',
                color: addMsg.type === 'success' ? 'var(--color-brand-accent)' : 'var(--color-status-danger)',
                fontSize: '0.85rem',
              }}
            >
              {addMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Save Facility'}
            </button>
          </div>
        </form>
      )}

      {/* Facilities Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            Registered Facilities Directory ({hospitals.length})
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Agency: Alluri Sitharama Raju (ASR)
          </span>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Loading hospitals...</div>}
        {error && <div style={{ color: 'var(--color-status-danger)', padding: '16px' }}>{error}</div>}

        {!loading && hospitals.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
              No facilities loaded yet. If you are logged in as Admin, you can add facilities or seed demo reference facilities.
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {hospitals.map((h) => {
            const isUserAffiliated = currentUser?.hospitalId === h.hospitalId;
            return (
              <div
                key={h.hospitalId}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: isUserAffiliated ? '1px solid var(--color-brand-accent)' : '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{h.name}</h4>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-brand-accent)', fontFamily: 'monospace' }}>
                      {h.hospitalId}
                    </span>
                  </div>
                  <span className="badge" style={{ background: 'rgba(28, 114, 147, 0.4)', color: '#fff', fontSize: '0.75rem' }}>
                    {formatFacilityType(h.type)}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                  <div>📍 <strong>Mandal:</strong> {h.mandal}</div>
                  <div>🏛️ <strong>District:</strong> {h.district}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                    JURISDICTION VILLAGES ({h.jurisdictionVillages?.length || 0})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {h.jurisdictionVillages && h.jurisdictionVillages.length > 0 ? (
                      h.jurisdictionVillages.map((v) => (
                        <span
                          key={v}
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.72rem',
                            fontFamily: 'monospace',
                          }}
                        >
                          {v}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>None registered</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      Admins: {h.adminUserIds?.length || 0} designated
                    </span>
                    {isUserAffiliated && (
                      <span className="badge badge-real" style={{ fontSize: '0.7rem' }}>
                        Your Assigned Facility
                      </span>
                    )}
                  </div>

                  {/* Actions for Super Admin / Facility Admin */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="button-outline"
                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                      onClick={() => handleOpenManagerModal(h)}
                    >
                      👤 Create Manager
                    </button>
                    <button
                      type="button"
                      className="button-outline"
                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                      onClick={() => handleOpenPerformance(h)}
                    >
                      📊 Performance
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL 1: CREATE MANAGER ACCOUNT */}
      {selectedHospitalForManager && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', background: '#0e1726', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Create Manager Account
              </h3>
              <button type="button" className="button-outline" style={{ padding: '2px 8px' }} onClick={() => setSelectedHospitalForManager(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '0 0 14px' }}>
              Hospital: <strong>{selectedHospitalForManager.name}</strong> ({selectedHospitalForManager.hospitalId})
            </p>

            {createdManagerResult ? (
              <div style={{ padding: '16px', background: 'rgba(6, 214, 160, 0.12)', border: '1px solid #06d6a0', borderRadius: '6px', marginBottom: '14px' }}>
                <h4 style={{ color: '#06d6a0', margin: '0 0 8px', fontSize: '0.95rem' }}>✓ Manager Account Created!</h4>
                <div style={{ fontSize: '0.84rem', lineHeight: 1.6 }}>
                  <div><strong>Username:</strong> <code>{createdManagerResult.username}</code></div>
                  <div><strong>Temporary Password:</strong> <code>{createdManagerResult.password}</code></div>
                </div>
                <button
                  type="button"
                  className="button-forest-primary button"
                  style={{ marginTop: '12px', fontSize: '0.8rem', padding: '4px 10px' }}
                  onClick={() => {
                    navigator.clipboard.writeText(`Username: ${createdManagerResult.username}\nPassword: ${createdManagerResult.password}`);
                    alert('Credentials copied to clipboard!');
                  }}
                >
                  📋 Copy Login Credentials
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateManager} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Manager Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={managerFullName}
                    onChange={(e) => setManagerFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    value={managerUsername}
                    onChange={(e) => setManagerUsername(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Phone (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email (Optional)</label>
                    <input
                      type="email"
                      className="form-input"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Password (Leave blank to auto-generate)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Auto-generated secure password"
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedHospitalForManager(null)}>Cancel</button>
                  <button type="submit" className="button-coral button" disabled={creatingManager}>
                    {creatingManager ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: HOSPITAL PERFORMANCE METRICS */}
      {selectedHospitalForPerf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', background: '#0e1726', border: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                📊 Hospital Performance & Referrals
              </h3>
              <button type="button" className="button-outline" style={{ padding: '2px 8px' }} onClick={() => setSelectedHospitalForPerf(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: '0 0 16px' }}>
              Facility: <strong>{selectedHospitalForPerf.name}</strong> • Isolated Catchment Metrics
            </p>

            {loadingPerf ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>Loading metrics...</div>
            ) : perfData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Catchment Patients</span>
                  <strong style={{ fontSize: '1.4rem', color: '#38bdf8' }}>{perfData.totalRegisteredPatients}</strong>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Total Incoming Referrals</span>
                  <strong style={{ fontSize: '1.4rem', color: '#06d6a0' }}>{perfData.totalReferrals}</strong>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>Pending Consultations</span>
                  <strong style={{ fontSize: '1.4rem', color: '#f59e0b' }}>{perfData.pendingConsultations}</strong>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', display: 'block' }}>High-Risk Screening Alerts</span>
                  <strong style={{ fontSize: '1.4rem', color: '#ef4444' }}>{perfData.highRiskScreenings}</strong>
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', color: 'var(--color-text-muted)' }}>No performance data available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
