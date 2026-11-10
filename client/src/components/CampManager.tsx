import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface CampManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export type CampStatus = 'draft' | 'published' | 'in_progress' | 'ongoing' | 'completed' | 'cancelled';

export interface CampRecord {
  campId: string;
  name: string;
  hospitalId: string;
  villageId: string;
  villageName?: string;
  mandal?: string;
  targetPopulation: number;
  startDate: string;
  endDate: string;
  status: CampStatus;
  leadMoId: string;
  leadMoName?: string;
  assignedWorkerIds: string[];
  location: {
    address: string;
    gpsCoordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  screeningCount: number;
  abnormalFindingsCount?: number;
  referralsCount?: number;
  notes?: string;
  publishedAt?: string;
  publishedBy?: string;
  startedAt?: string;
  startedBy?: string;
  completedAt?: string;
  completedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdAt: string;
}

export const CampManager: React.FC<CampManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [camps, setCamps] = useState<CampRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Camp Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('Paderu Agency Frontline Screening Camp');
  const [villageId, setVillageId] = useState<string>('vil_paderu_01');
  const [referenceVillages, setReferenceVillages] = useState<Array<{ villageId: string; villageName: string; mandal: string; tribalHabitation?: string }>>([]);
  const [targetPopulation, setTargetPopulation] = useState<number>(200);
  const [startDate, setStartDate] = useState<string>(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T09:00');
  const [endDate, setEndDate] = useState<string>(() => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) + 'T17:00');
  const [address, setAddress] = useState<string>('Tribal Community Hall, G. Madugula');
  const [latitude, setLatitude] = useState<number>(18.0245);
  const [longitude, setLongitude] = useState<number>(82.5123);
  const [notes, setNotes] = useState<string>('High-priority screening focusing on tobacco/gutkha chewing habitations.');

  // Action Modals State
  const [selectedCamp, setSelectedCamp] = useState<CampRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Adverse weather conditions on tribal agency ghat road');
  const [workerInput, setWorkerInput] = useState<string>('usr_asha_01, usr_anm_01');

  // Small-Count Cell Suppression Privacy Helper (< 5)
  const formatSuppressedCount = (count?: number): string => {
    if (count === undefined || count === null) return '0';
    if (count > 0 && count < 5) return '< 5 (Suppressed for Privacy)';
    return count.toString();
  };

  const fetchCamps = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const url = filterStatus === 'all'
        ? '/api/v1/camps'
        : `/api/v1/camps?status=${filterStatus}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCamps(json.data.camps || []);
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps();
    if (accessToken) {
      fetch('/api/v1/reference/villages', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((payload) => {
          if (payload?.success && Array.isArray(payload.data?.villages) && payload.data.villages.length > 0) {
            setReferenceVillages(payload.data.villages);
            setVillageId(payload.data.villages[0].villageId);
            const first = payload.data.villages[0];
            setAddress(`Community Hall, ${first.tribalHabitation || first.villageName}, ${first.mandal}`);
          }
        })
        .catch(() => {});
    }
  }, [accessToken, filterStatus]);

  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/camps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name,
          villageId,
          targetPopulation,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          location: {
            address,
            gpsCoordinates: { latitude, longitude },
          },
          notes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setMessage({
          text: `Camp "${json.data.camp.name}" created in DRAFT status! It must be PUBLISHED before starting.`,
          type: 'success',
        });
        setShowCreateModal(false);
        await fetchCamps();
      } else {
        setMessage({ text: json.error?.message || 'Failed to create camp', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePublishCamp = async (campId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/camps/${campId}/publish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Camp successfully PUBLISHED! It can now be started.', type: 'success' });
        await fetchCamps();
      } else {
        setMessage({ text: json.error?.message || 'Publishing failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleStartCamp = async (campId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/camps/${campId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Camp started! Status changed to IN_PROGRESS.', type: 'success' });
        await fetchCamps();
      } else {
        setMessage({ text: json.error?.message || 'Failed to start camp', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleCompleteCamp = async (campId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/camps/${campId}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Camp marked as COMPLETED.', type: 'success' });
        await fetchCamps();
      } else {
        setMessage({ text: json.error?.message || 'Completion failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleCancelCamp = async (campId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/camps/${campId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Camp successfully CANCELLED.', type: 'success' });
        setSelectedCamp(null);
        await fetchCamps();
      } else {
        setMessage({ text: json.error?.message || 'Cancellation failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleAssignWorkers = async (campId: string) => {
    if (!accessToken) return;
    const workerIds = workerInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/v1/camps/${campId}/workers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ workerIds }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Health workers assigned to camp!', type: 'success' });
        setSelectedCamp(null);
        await fetchCamps();
      } else {
        setMessage({ text: json.error?.message || 'Worker assignment failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner (Reference: Flash Card Study App panel) */}
      <div className="card hero progress-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>
              <span className="eyebrow-dot" style={{ background: 'var(--coral)' }} />
              <span>OUTREACH SCREENING CAMPS • స్క్రీనింగ్ శిబిరాలు</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px', color: 'var(--slate)' }}>
              Community Outreach Screening Camps
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '820px', margin: 0, lineHeight: 1.5 }}>
              Frontline outreach screening operations across ITDA Paderu Agency mandals. 
              Camps require <strong>PUBLISHED</strong> status before launching. All small-cohort aggregates (&lt; 5) are masked for patient privacy.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="button-outline"
              onClick={fetchCamps}
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Refresh Camps
            </button>
            {(currentUser?.role === 'admin' ||
              currentUser?.role === 'medical_officer' ||
              currentUser?.role === 'system_admin') && (
              <button
                type="button"
                className="button-coral"
                onClick={() => setShowCreateModal(true)}
                style={{ fontSize: '0.85rem' }}
              >
                + Plan New Camp
              </button>
            )}
          </div>
        </div>
      </div>

      {!accessToken && (
        <LoginRequiredView
          moduleTitle="Outreach Screening Camps"
          moduleDescription="Sign in with demo credentials to manage frontline screening camps, assign health workers, and monitor cohort statistics."
          onLoginAsAsha={onRequireLogin ? () => onRequireLogin('asha') : undefined}
          onLoginAsDoctor={onRequireLogin ? () => onRequireLogin('doctor') : undefined}
          onGoToAuth={onGoToAuth}
        />
      )}

      {/* Action Notification Banner */}
      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: message.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: message.type === 'success' ? '#065f46' : '#991b1b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Camps List ({camps.length})</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            Filter by lifecycle stage or schedule new outreach missions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            className="form-select"
            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {(currentUser?.role === 'admin' ||
            currentUser?.role === 'medical_officer' ||
            currentUser?.role === 'system_admin') && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.85rem' }}
              onClick={() => setShowCreateModal(true)}
            >
              ➕ Plan New Camp
            </button>
          )}

          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.85rem' }}
            onClick={fetchCamps}
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Create Camp Form Modal / Panel */}
      {showCreateModal && (
        <section className="card" style={{ border: '2px solid var(--color-brand-accent)' }}>
          <div className="card-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Plan New Community Screening Camp</h3>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              onClick={() => setShowCreateModal(false)}
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleCreateCamp} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Camp Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Target Village</label>
                {referenceVillages.length > 0 ? (
                  <select
                    className="form-select"
                    value={villageId}
                    onChange={(e) => {
                      const selected = referenceVillages.find((v) => v.villageId === e.target.value);
                      setVillageId(e.target.value);
                      if (selected) {
                        setAddress(`Community Hall, ${selected.tribalHabitation || selected.villageName}, ${selected.mandal}`);
                      }
                    }}
                    required
                  >
                    {referenceVillages.map((v) => (
                      <option key={v.villageId} value={v.villageId}>
                        {v.villageName} ({v.mandal})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={villageId}
                    onChange={(e) => setVillageId(e.target.value)}
                    placeholder="e.g. vil_paderu_01"
                    required
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Target Population</label>
                <input
                  type="number"
                  className="form-input"
                  value={targetPopulation}
                  onChange={(e) => setTargetPopulation(Number(e.target.value))}
                  min={10}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Start Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>End Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Location Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>GPS Coordinates (Lat / Long)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    placeholder="Latitude"
                  />
                  <input
                    type="number"
                    step="0.0001"
                    className="form-input"
                    value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    placeholder="Longitude"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Operational Notes</label>
              <textarea
                className="form-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : '💾 Save as DRAFT Camp'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Camps List Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {camps.map((camp) => (
          <div
            key={camp.campId}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{camp.name}</span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor:
                        camp.status === 'in_progress' || camp.status === 'ongoing'
                          ? '#10b981'
                          : camp.status === 'published'
                          ? '#3b82f6'
                          : camp.status === 'draft'
                          ? '#f59e0b'
                          : camp.status === 'completed'
                          ? '#6b7280'
                          : '#ef4444',
                      color: '#fff',
                    }}
                  >
                    {camp.status.toUpperCase()}
                  </span>
                  <span className="badge badge-real">{camp.campId}</span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Village: <strong>{camp.villageName ? `${camp.villageName} (${camp.villageId})` : camp.villageId}</strong> {camp.mandal ? `| Mandal: ${camp.mandal}` : ''} | Hospital: <strong>{camp.hospitalId}</strong> | Target: <strong>{camp.targetPopulation}</strong> residents
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                <div>Dates: <strong>{new Date(camp.startDate).toLocaleDateString()}</strong> – <strong>{new Date(camp.endDate).toLocaleDateString()}</strong></div>
                <div style={{ color: 'var(--color-text-secondary)' }}>Lead MO: {camp.leadMoName || camp.leadMoId}</div>
              </div>
            </div>

            {/* Location, Workers & Cell-Suppressed Statistics */}
            <div style={{ fontSize: '0.82rem', display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--color-text-secondary)', alignItems: 'center' }}>
              <div>📍 {camp.location.address}</div>
              <div>👥 {camp.assignedWorkerIds.length} Health Workers Assigned</div>
              <div>📊 Screenings: <strong>{camp.screeningCount}</strong></div>
              <div>⚠️ Abnormal Findings: <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>{formatSuppressedCount(camp.abnormalFindingsCount)}</span></div>
              <div>🏥 Suspected Lesion Referrals: <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontSize: '0.75rem' }}>{formatSuppressedCount(camp.referralsCount)}</span></div>
            </div>

            {/* Lifecycle Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {/* Draft -> Publish */}
              {camp.status === 'draft' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                  onClick={() => handlePublishCamp(camp.campId)}
                >
                  📢 Publish Camp
                </button>
              )}

              {/* Published -> Start */}
              {camp.status === 'published' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '4px 12px', backgroundColor: '#10b981' }}
                  onClick={() => handleStartCamp(camp.campId)}
                >
                  🚀 Start Camp (In Progress)
                </button>
              )}

              {/* In Progress / Ongoing -> Complete */}
              {(camp.status === 'in_progress' || camp.status === 'ongoing') && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '4px 12px', backgroundColor: '#4b5563' }}
                  onClick={() => handleCompleteCamp(camp.campId)}
                >
                  ✓ Complete Camp
                </button>
              )}

              {/* Assign Workers button */}
              {(camp.status === 'draft' || camp.status === 'published' || camp.status === 'in_progress' || camp.status === 'ongoing') && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  onClick={() => {
                    setSelectedCamp(camp);
                    setWorkerInput(camp.assignedWorkerIds.join(', '));
                  }}
                >
                  👥 Manage Workers
                </button>
              )}

              {/* Cancel Camp button */}
              {(camp.status === 'draft' || camp.status === 'published') && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ fontSize: '0.8rem', padding: '4px 10px', color: '#ef4444' }}
                  onClick={() => setSelectedCamp(camp)}
                >
                  ⚠️ Cancel
                </button>
              )}
            </div>

            {/* Expanded Worker Assignment Panel */}
            {selectedCamp?.campId === camp.campId && (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  border: '1px solid var(--color-border)',
                  marginTop: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Assign Health Workers (Comma Separated IDs)</div>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.8rem' }}
                  value={workerInput}
                  onChange={(e) => setWorkerInput(e.target.value)}
                  placeholder="usr_asha_01, usr_anm_02"
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setSelectedCamp(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => handleAssignWorkers(camp.campId)}
                  >
                    Save Workers
                  </button>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px', marginTop: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#dc2626' }}>Cancel Camp</div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.8rem', marginTop: '4px', marginBottom: '6px' }}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Cancellation reason..."
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', color: '#dc2626' }}
                    onClick={() => handleCancelCamp(camp.campId)}
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {camps.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            No screening camps found for this filter.
          </div>
        )}
      </div>
    </div>
  );
};
