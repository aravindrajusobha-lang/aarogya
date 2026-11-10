import React, { useState, useEffect } from 'react';
import { LanguageCode } from '../i18n';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface CampPlanningManagerProps {
  currentLang: LanguageCode;
  currentUser: AuthUser | null;
  authToken?: string | null;
  preselectedVillage?: any;
  onCampCreated?: (camp: any) => void;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

interface CampDashboardStats {
  totalMandalsCovered: number;
  totalVillagesCovered: number;
  totalCampsConducted: number;
  upcomingCamps: number;
  villagesCoveredByScreening: number;
  villagesPendingScreening: number;
  patientsScreened: number;
  suspectedCasesReferred: number;
}

interface CampRecommendation {
  villageId: string;
  villageName: string;
  nameTe?: string;
  mandal: string;
  panchayat: string;
  tribalHabitation: string;
  populationEstimated: number;
  nearestFacilityDistanceKm: number;
  nearestFacilityName: string;
  nearestFacilityType: string;
  healthcareAccessLevel: string;
  screeningCoveragePercent: number;
  campCount: number;
  priorityScore: number;
  urgency: 'critical' | 'high' | 'medium' | 'routine';
  reasons: string[];
  gpsCoordinates?: { latitude: number; longitude: number };
}

export const CampPlanningManager: React.FC<CampPlanningManagerProps> = ({
  currentLang,
  currentUser,
  authToken,
  preselectedVillage,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [stats, setStats] = useState<CampDashboardStats>({
    totalMandalsCovered: 22,
    totalVillagesCovered: 0,
    totalCampsConducted: 0,
    upcomingCamps: 0,
    villagesCoveredByScreening: 0,
    villagesPendingScreening: 0,
    patientsScreened: 0,
    suspectedCasesReferred: 0,
  });

  const [recommendations, setRecommendations] = useState<CampRecommendation[]>([]);
  const [mandals, setMandals] = useState<any[]>([]);
  const [panchayats, setPanchayats] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [campsList, setCampsList] = useState<any[]>([]);

  const [filterMandal, setFilterMandal] = useState<string>('all');
  const [selectedMandal, setSelectedMandal] = useState<string>('');
  const [selectedPanchayat, setSelectedPanchayat] = useState<string>('');
  const [selectedVillageId, setSelectedVillageId] = useState<string>('');

  // Camp Creation Form
  const [campName, setCampName] = useState<string>('');
  const [targetPopulation, setTargetPopulation] = useState<number>(100);
  const [startDate, setStartDate] = useState<string>(() => new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(() => new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
  const [leadMoName, setLeadMoName] = useState<string>('Dr. K. Srinivas Rao, Civil Assistant Surgeon');
  const [assignedStaffText, setAssignedStaffText] = useState<string>('G. Lakshmi (ANM), P. Mary (ASHA)');
  const [campAddress, setCampAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'recommendations' | 'history'>('dashboard');
  const [loading, setLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Headers helper
  const getHeaders = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    return h;
  };

  // Load Dashboard Data & Recommendations
  const loadDashboardData = async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Dashboard Stats
      const statRes = await fetch('/api/v1/camps/planning/dashboard', { headers: getHeaders() });
      if (statRes.ok) {
        const json = await statRes.json();
        if (json.data) setStats(json.data);
      }

      // 2. Recommendations
      const recRes = await fetch(
        filterMandal !== 'all'
          ? `/api/v1/camps/planning/recommendations?mandal=${encodeURIComponent(filterMandal)}`
          : '/api/v1/camps/planning/recommendations',
        { headers: getHeaders() }
      );
      if (recRes.ok) {
        const json = await recRes.json();
        if (json.data?.recommendations) setRecommendations(json.data.recommendations);
      }

      // 3. Mandals
      const mRes = await fetch('/api/v1/reference/asr/mandals', { headers: getHeaders() });
      if (mRes.ok) {
        const json = await mRes.json();
        if (json.data?.mandals) setMandals(json.data.mandals);
      }

      // 4. Facilities
      const facRes = await fetch('/api/v1/reference/asr/facilities', { headers: getHeaders() });
      if (facRes.ok) {
        const json = await facRes.json();
        if (json.data?.facilities) setFacilities(json.data.facilities);
      }

      // 5. Camps History
      const campRes = await fetch('/api/v1/camps', { headers: getHeaders() });
      if (campRes.ok) {
        const json = await campRes.json();
        if (json.data?.camps) setCampsList(json.data.camps);
      }
    } catch (err) {
      console.error('Failed to load camp planning data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [authToken, filterMandal]);

  // Handle preselected village from Map
  useEffect(() => {
    if (preselectedVillage) {
      setSelectedMandal(preselectedVillage.mandal);
      setSelectedPanchayat(preselectedVillage.panchayat || '');
      setSelectedVillageId(preselectedVillage.villageId);
      setCampName(`${preselectedVillage.villageName} Comprehensive Oral Screening Camp`);
      setCampAddress(`Community Hall / Anganwadi Centre, ${preselectedVillage.villageName}, ${preselectedVillage.mandal} Mandal`);
      setActiveTab('create');
    }
  }, [preselectedVillage]);

  // Load Panchayats when Mandal changes in Create Form
  useEffect(() => {
    if (!selectedMandal) {
      setPanchayats([]);
      setVillages([]);
      return;
    }
    fetch(`/api/v1/reference/asr/panchayats?mandal=${encodeURIComponent(selectedMandal)}`, {
      headers: getHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.panchayats) setPanchayats(json.data.panchayats);
      })
      .catch((err) => console.warn('Failed to load panchayats:', err));

    fetch(`/api/v1/reference/asr/villages?mandal=${encodeURIComponent(selectedMandal)}`, {
      headers: getHeaders(),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.data?.villages) setVillages(json.data.villages);
      })
      .catch((err) => console.warn('Failed to load villages:', err));
  }, [selectedMandal]);

  // Pre-fill village selection
  const handleSelectRecommendation = (rec: CampRecommendation) => {
    setSelectedMandal(rec.mandal);
    setSelectedPanchayat(rec.panchayat);
    setSelectedVillageId(rec.villageId);
    setCampName(`${rec.villageName} Priority Health Screening Camp`);
    setCampAddress(`Tribal Community Centre, ${rec.villageName}, ${rec.mandal} Mandal`);
    setNotes(
      `Recommended Camp based on ${rec.nearestFacilityDistanceKm} km distance to nearest facility. Urgent field screening required.`
    );
    setActiveTab('create');
  };

  // Submit New Medical Camp to Backend MongoDB
  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVillageId) {
      setFeedbackMsg({ type: 'error', text: 'Please select a target village for the camp.' });
      return;
    }

    const selVillage = villages.find((v) => v.villageId === selectedVillageId) || recommendations.find((r) => r.villageId === selectedVillageId);

    const payload = {
      name: campName || `${selectedMandal} Screening Camp`,
      villageId: selectedVillageId,
      villageName: selVillage?.villageName || 'Tribal Village',
      mandal: selectedMandal,
      targetPopulation: Number(targetPopulation),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      leadMoId: currentUser?.userId || 'usr_mo_001',
      leadMoName: leadMoName,
      assignedWorkerIds: ['usr_asha_001', 'usr_anm_001'],
      location: {
        address: campAddress || `${selectedMandal} Panchayat Office`,
        gpsCoordinates: selVillage?.gpsCoordinates,
      },
      notes: notes || 'Oral mucosal screening and referral navigation camp',
    };

    setLoading(true);
    try {
      const res = await fetch('/api/v1/camps', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setFeedbackMsg({
          type: 'success',
          text: `Medical Camp "${json.data.camp?.name || campName}" successfully scheduled and stored in MongoDB!`,
        });
        loadDashboardData();
        setActiveTab('history');
      } else {
        setFeedbackMsg({
          type: 'error',
          text: json.error?.message || 'Failed to create medical camp. Please verify details.',
        });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Network error while scheduling camp.' });
    } finally {
      setLoading(false);
    }
  };

  if (!authToken) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <LoginRequiredView
          moduleTitle="Camp Planning & Micro-Planning"
          moduleDescription="Access to screening camp schedules, target populations, and village micro-planning requires verified health staff authentication."
          onLoginAsAsha={() => onRequireLogin?.('asha')}
          onLoginAsDoctor={() => onRequireLogin?.('doctor')}
          onGoToAuth={onGoToAuth}
        />
      </div>
    );
  }

  return (
    <div className="camp-planning-container">
      {/* Header */}
      <div className="camp-planning-header">
        <div className="header-titles">
          <span className="badge-nature">🌿 ASR Tribal Outreach Planning</span>
          <h2>
            {currentLang === 'te'
              ? 'మెడికల్ క్యాంప్ ప్లానింగ్ & లొకేషన్ గుర్తింపు'
              : currentLang === 'hi'
              ? 'मेडिकल कैंप योजना एवं स्थान पहचान'
              : 'Medical Camp Planning & Location Identification'}
          </h2>
          <p className="header-desc">
            Identify remote tribal hamlets, evaluate accessibility deficits, and schedule targeted field screening camps across all 22 Mandals.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="planning-tab-pills">
          <button
            type="button"
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Camp Dashboard
          </button>
          <button
            type="button"
            className={activeTab === 'recommendations' ? 'active' : ''}
            onClick={() => setActiveTab('recommendations')}
          >
            🎯 AI Recommendations ({recommendations.length})
          </button>
          <button
            type="button"
            className={activeTab === 'create' ? 'active' : ''}
            onClick={() => setActiveTab('create')}
          >
            ➕ Schedule New Camp
          </button>
          <button
            type="button"
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => setActiveTab('history')}
          >
            📋 Camp Records ({campsList.length})
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className={`feedback-alert ${feedbackMsg.type}`}>
          <span>{feedbackMsg.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)}>
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: KPI Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="camp-tab-content">
          <div className="kpi-metric-cards-grid">
            <div className="kpi-card green-card">
              <span className="card-icon">🗺️</span>
              <div className="kpi-text">
                <span className="kpi-number">{stats.totalMandalsCovered}</span>
                <span className="kpi-label">Mandals Covered</span>
                <span className="kpi-sub">Alluri Sitharama Raju District</span>
              </div>
            </div>

            <div className="kpi-card emerald-card">
              <span className="card-icon">🏡</span>
              <div className="kpi-text">
                <span className="kpi-number">{stats.totalVillagesCovered}</span>
                <span className="kpi-label">Villages Mapped</span>
                <span className="kpi-sub">{stats.villagesCoveredByScreening} Screened • {stats.villagesPendingScreening} Pending</span>
              </div>
            </div>

            <div className="kpi-card purple-card">
              <span className="card-icon">🏕️</span>
              <div className="kpi-text">
                <span className="kpi-number">{stats.totalCampsConducted}</span>
                <span className="kpi-label">Camps Conducted</span>
                <span className="kpi-sub">{stats.upcomingCamps} Upcoming / Active</span>
              </div>
            </div>

            <div className="kpi-card amber-card">
              <span className="card-icon">🩺</span>
              <div className="kpi-text">
                <span className="kpi-number">{stats.patientsScreened}</span>
                <span className="kpi-label">Patients Screened</span>
                <span className="kpi-sub">{stats.suspectedCasesReferred} Suspected Cases Referred</span>
              </div>
            </div>
          </div>

          {/* Quick Action & Coverage Status */}
          <div className="planning-split-section">
            <div className="planning-card">
              <h3>🚨 Urgent Villages Requiring Camps</h3>
              <p className="card-hint">
                Hamlets over 12 km from nearest PHC with difficult terrain or monsoon isolation.
              </p>
              <div className="priority-mini-list">
                {recommendations.slice(0, 5).map((rec) => (
                  <div key={rec.villageId} className="priority-row">
                    <div className="p-info">
                      <strong>{rec.villageName}</strong>
                      <span>{rec.mandal} Mandal • {rec.nearestFacilityDistanceKm} km from facility</span>
                    </div>
                    <div className="p-score-badge">
                      <span className="score-val">{rec.priorityScore}/100</span>
                      <button
                        type="button"
                        className="btn-mini-plan"
                        onClick={() => handleSelectRecommendation(rec)}
                      >
                        Plan Camp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="planning-card">
              <h3>🏥 Catchment Health Facilities Support</h3>
              <p className="card-hint">
                District Hospital, Area Hospital, and CHCs ready for teleconsultation and specialist backup.
              </p>
              <div className="facilities-mini-list">
                {facilities.slice(0, 6).map((f) => (
                  <div key={f.facilityId} className="facility-row">
                    <span className="fac-badge">{f.type === 'district_hospital' ? 'DH' : f.type === 'area_hospital' ? 'AH' : 'CHC'}</span>
                    <div className="fac-info">
                      <strong>{f.name}</strong>
                      <span>{f.mandal} Mandal {f.bedCapacity ? `• ${f.bedCapacity} Beds` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Recommendation Engine */}
      {activeTab === 'recommendations' && (
        <div className="camp-tab-content">
          <div className="filter-ribbon">
            <label>Filter by Mandal:</label>
            <select
              value={filterMandal}
              onChange={(e) => setFilterMandal(e.target.value)}
              className="mandal-filter-select"
            >
              <option value="all">-- All 22 Mandals --</option>
              {mandals.map((m) => (
                <option key={m.mandalId} value={m.mandalName}>
                  {m.mandalName} ({m.revenueDivision} Division)
                </option>
              ))}
            </select>
            <span className="rec-count-label">
              Found <strong>{recommendations.length}</strong> prioritized locations
            </span>
          </div>

          <div className="recommendations-grid">
            {recommendations.map((rec) => (
              <div key={rec.villageId} className={`rec-card ${rec.urgency}`}>
                <div className="rec-head">
                  <div className="rec-title">
                    <h4>{rec.villageName}</h4>
                    {rec.nameTe && <span className="rec-vernacular">{rec.nameTe}</span>}
                    <span className="rec-geo">{rec.mandal} Mandal • {rec.panchayat} GP</span>
                  </div>
                  <div className="rec-priority-pill">
                    <span className="score-num">{rec.priorityScore}</span>
                    <span className="score-txt">Priority Score</span>
                  </div>
                </div>

                <div className="rec-metrics">
                  <div className="m-item">
                    <span className="m-label">Distance to Facility:</span>
                    <span className="m-val">{rec.nearestFacilityDistanceKm} km</span>
                  </div>
                  <div className="m-item">
                    <span className="m-label">Accessibility:</span>
                    <span className="m-val highlight">{rec.healthcareAccessLevel.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  <div className="m-item">
                    <span className="m-label">Screening Coverage:</span>
                    <span className="m-val">{rec.screeningCoveragePercent}%</span>
                  </div>
                  <div className="m-item">
                    <span className="m-label">Est. Population:</span>
                    <span className="m-val">{rec.populationEstimated}</span>
                  </div>
                </div>

                <div className="rec-reasons">
                  <strong>Priority Criteria:</strong>
                  <ul>
                    {rec.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  className="btn-select-camp-loc"
                  onClick={() => handleSelectRecommendation(rec)}
                >
                  🏕️ Approve & Schedule Medical Camp Here
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Schedule New Medical Camp */}
      {activeTab === 'create' && (
        <div className="camp-tab-content">
          <form className="camp-creation-form" onSubmit={handleCreateCamp}>
            <h3>🏕️ Schedule Screening Camp in Selected Habitation</h3>
            <p className="form-sub">
              This camp will be assigned to clinical medical officers and frontline workers and saved to MongoDB.
            </p>

            <div className="form-two-col">
              <div className="form-group">
                <label>1. Select Mandal *</label>
                <select
                  required
                  value={selectedMandal}
                  onChange={(e) => setSelectedMandal(e.target.value)}
                >
                  <option value="">-- Choose Mandal --</option>
                  {mandals.map((m) => (
                    <option key={m.mandalId} value={m.mandalName}>
                      {m.mandalName} ({m.revenueDivision} Division)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>2. Select Gram Panchayat *</label>
                <select
                  required
                  value={selectedPanchayat}
                  onChange={(e) => setSelectedPanchayat(e.target.value)}
                  disabled={!selectedMandal}
                >
                  <option value="">-- Choose Gram Panchayat --</option>
                  {panchayats.map((p) => (
                    <option key={p.panchayatId} value={p.panchayatName}>
                      {p.panchayatName} {p.nameTe ? `(${p.nameTe})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>3. Target Village / Habitation *</label>
              <select
                required
                value={selectedVillageId}
                onChange={(e) => {
                  const vId = e.target.value;
                  setSelectedVillageId(vId);
                  const v = villages.find((item) => item.villageId === vId);
                  if (v) {
                    setCampName(`${v.villageName} Oral Screening Camp`);
                    setCampAddress(`Community Centre / Anganwadi, ${v.villageName}, ${v.mandal}`);
                  }
                }}
                disabled={!selectedMandal}
              >
                <option value="">-- Choose Village --</option>
                {villages.map((v) => (
                  <option key={v.villageId} value={v.villageId}>
                    {v.villageName} ({v.panchayat} GP - {v.nearestFacilityDistanceKm || 5} km to PHC)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-two-col">
              <div className="form-group">
                <label>Camp Name *</label>
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="e.g. Gurthedu Remote Outreach Camp"
                />
              </div>

              <div className="form-group">
                <label>Target Population for Screening *</label>
                <input
                  type="number"
                  required
                  min={10}
                  max={2000}
                  value={targetPopulation}
                  onChange={(e) => setTargetPopulation(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="form-two-col">
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-two-col">
              <div className="form-group">
                <label>Lead Medical Officer (MO) *</label>
                <input
                  type="text"
                  required
                  value={leadMoName}
                  onChange={(e) => setLeadMoName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Assigned ASHA & ANM Staff *</label>
                <input
                  type="text"
                  required
                  value={assignedStaffText}
                  onChange={(e) => setAssignedStaffText(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Location & Landmark Description *</label>
              <input
                type="text"
                required
                value={campAddress}
                onChange={(e) => setCampAddress(e.target.value)}
                placeholder="e.g. Near Old Mango Tree / Anganwadi Centre, Dumbriguda"
              />
            </div>

            <div className="form-group">
              <label>Field Notes / Accessibility Instructions</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transport guidance (e.g. ghat road cutoff during monsoon, 4x4 vehicle required)..."
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-submit-camp" disabled={loading}>
                {loading ? 'Saving to Database...' : '🚀 Finalize & Create Screening Camp'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: Camp History */}
      {activeTab === 'history' && (
        <div className="camp-tab-content">
          <div className="camps-history-card">
            <h3>📋 Scheduled & Conducted Medical Camps</h3>
            <p className="card-hint">
              Live records persisted in MongoDB. Includes screening statistics and referral tallies.
            </p>

            <div className="table-responsive">
              <table className="camps-table">
                <thead>
                  <tr>
                    <th>Camp Name</th>
                    <th>Mandal</th>
                    <th>Status</th>
                    <th>Dates</th>
                    <th>Target</th>
                    <th>Screened</th>
                    <th>Abnormal</th>
                    <th>Referred</th>
                  </tr>
                </thead>
                <tbody>
                  {campsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
                        No medical camps found. Schedule your first camp using the planner!
                      </td>
                    </tr>
                  ) : (
                    campsList.map((c) => (
                      <tr key={c.campId}>
                        <td>
                          <strong>{c.name}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{c.location?.address}</div>
                        </td>
                        <td>{c.mandal || 'ASR District'}</td>
                        <td>
                          <span className={`status-pill ${c.status}`}>{c.status.toUpperCase()}</span>
                        </td>
                        <td>
                          {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                        </td>
                        <td>{c.targetPopulation}</td>
                        <td>{c.screeningCount || 0}</td>
                        <td>{c.abnormalFindingsCount || 0}</td>
                        <td>{c.referralsCount || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
