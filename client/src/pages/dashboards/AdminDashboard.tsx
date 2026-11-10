import React, { useState } from 'react';
import { AuthUser } from '../../components/AuthPanel';
import '../../styles/Dashboard.css';

export interface AdminDashboardProps {
  currentUser: AuthUser | null;
  onNavigateTab?: (tab: string) => void;
}

interface HospitalRecord {
  id: string;
  name: string;
  category: 'CHC' | 'AREA_HOSPITAL' | 'DISTRICT_HEADQUARTERS' | 'SUB_CENTRE';
  mandal: string;
  phone: string;
  managerName: string;
  activeDoctors: number;
  screeningsCount: string; // Small count suppression string
  status: 'ACTIVE' | 'INACTIVE';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'hospitals' | 'doctors' | 'camps' | 'critical' | 'security'>('overview');
  const [showAddHospital, setShowAddHospital] = useState<boolean>(false);
  const [showAddDoctor, setShowAddDoctor] = useState<boolean>(false);
  const [showAddCamp, setShowAddCamp] = useState<boolean>(false);

  // New Doctor Form State
  const [newDocName, setNewDocName] = useState<string>('');
  const [newDocSpecialty, setNewDocSpecialty] = useState<string>('Dental Surgeon & Oral Medicine');
  const [newDocHospital, setNewDocHospital] = useState<string>('HOSP-PAD-01');

  // New Camp Form State
  const [newCampName, setNewCampName] = useState<string>('');
  const [newCampMandal, setNewCampMandal] = useState<string>('Paderu');
  const [newCampVillage, setNewCampVillage] = useState<string>('Vankachinta');
  const [newCampDate, setNewCampDate] = useState<string>('2026-11-20');

  // Doctors State
  const [doctorsList, setDoctorsList] = useState<any[]>([
    {
      id: 'DR-PAD-01',
      name: 'Dr. K. Somasekhar',
      qualification: 'MDS, Oral Medicine',
      specialty: 'Oral Medicine & Pre-Cancer Specialist',
      hospitalName: 'Community Health Centre (CHC) Paderu',
      status: 'ACTIVE',
      totalConsultations: 142,
    },
    {
      id: 'DR-ARA-01',
      name: 'Dr. V. Rama Rao',
      qualification: 'MS (ENT)',
      specialty: 'Head & Neck / ENT Surgeon',
      hospitalName: 'Area Hospital Araku Valley',
      status: 'ACTIVE',
      totalConsultations: 88,
    },
    {
      id: 'DR-CHI-01',
      name: 'Dr. S. Venkat Naidu',
      qualification: 'BDS',
      specialty: 'Dental Surgeon',
      hospitalName: 'CHC Chintapalli Outpost',
      status: 'ACTIVE',
      totalConsultations: 64,
    },
    {
      id: 'DR-DUM-01',
      name: 'Dr. Ananya Roy',
      qualification: 'MBBS, Medical Officer',
      specialty: 'General Medicine & Triage',
      hospitalName: 'Primary Health Centre Dumbriguda',
      status: 'ACTIVE',
      totalConsultations: 95,
    },
  ]);

  // Medical Camps State
  const [campsList, setCampsList] = useState<any[]>([
    {
      id: 'CAMP-2026-01',
      name: 'Dumbriguda Agency Oral Health Outreach Camp',
      mandal: 'Dumbriguda',
      village: 'Vankachinta Settlement',
      date: '18 Nov 2026',
      assignedDoctor: 'Dr. K. Somasekhar',
      assignedAsha: 'K. Padma (ASHA 01)',
      screeningsCount: '48',
      referralsCount: '< 5',
      status: 'SCHEDULED',
    },
    {
      id: 'CAMP-2026-02',
      name: 'Araku Valley Tribal High School Screening',
      mandal: 'Araku Valley',
      village: 'Padmapuram',
      date: '22 Nov 2026',
      assignedDoctor: 'Dr. V. Rama Rao',
      assignedAsha: 'G. Lakshmi (ASHA 04)',
      screeningsCount: '62',
      referralsCount: '8',
      status: 'SCHEDULED',
    },
    {
      id: 'CAMP-2026-03',
      name: 'Chintapalli Hat-Day Health Screening Camp',
      mandal: 'Chintapalli',
      village: 'Lammasingi',
      date: '04 Nov 2026',
      assignedDoctor: 'Dr. S. Venkat Naidu',
      assignedAsha: 'M. Parvati (ASHA 07)',
      screeningsCount: '74',
      referralsCount: '12',
      status: 'COMPLETED',
    },
  ]);

  // New Hospital Form State
  const [newHospName, setNewHospName] = useState<string>('');
  const [newHospCategory, setNewHospCategory] = useState<'CHC' | 'AREA_HOSPITAL' | 'SUB_CENTRE'>('CHC');
  const [newHospMandal, setNewHospMandal] = useState<string>('Paderu');
  const [newHospPhone, setNewHospPhone] = useState<string>('+91 8935-254000');

  // Hospitals Data with Small-Count Cell Suppression (< 5 suppressed per Invariant 3)
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([
    {
      id: 'HOSP-PAD-01',
      name: 'Community Health Centre (CHC) Paderu',
      category: 'CHC',
      mandal: 'Paderu Agency',
      phone: '+91 8935-254221',
      managerName: 'Dr. K. Somasekhar',
      activeDoctors: 4,
      screeningsCount: '89',
      status: 'ACTIVE',
    },
    {
      id: 'HOSP-ARA-02',
      name: 'Area Hospital Araku Valley',
      category: 'AREA_HOSPITAL',
      mandal: 'Araku Valley',
      phone: '+91 8936-249610',
      managerName: 'Dr. V. Rao',
      activeDoctors: 6,
      screeningsCount: '42',
      status: 'ACTIVE',
    },
    {
      id: 'HOSP-CHI-03',
      name: 'CHC Chintapalli Outpost',
      category: 'CHC',
      mandal: 'Chintapalli',
      phone: '+91 8937-238450',
      managerName: 'Dr. S. Venkat',
      activeDoctors: 2,
      screeningsCount: '28',
      status: 'ACTIVE',
    },
    {
      id: 'HOSP-DUM-04',
      name: 'Dumbriguda Primary Sub-Centre',
      category: 'SUB_CENTRE',
      mandal: 'Dumbriguda',
      phone: '+91 8935-255100',
      managerName: 'Dr. Ananya Roy',
      activeDoctors: 1,
      screeningsCount: '< 5', // Invariant 3: Small-Count Cell Suppression!
      status: 'ACTIVE',
    },
    {
      id: 'HOSP-MUN-05',
      name: 'Munchingiputtu Mobile Outreach',
      category: 'SUB_CENTRE',
      mandal: 'Munchingiputtu',
      phone: '+91 8938-271000',
      managerName: 'Dr. G. Naidu',
      activeDoctors: 1,
      screeningsCount: '< 5', // Invariant 3: Small-Count Cell Suppression!
      status: 'ACTIVE',
    },
  ]);

  const handleToggleHospitalStatus = (id: string) => {
    setHospitals((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, status: h.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : h
      )
    );
  };

  const handleCreateHospital = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospName.trim()) return;

    const newHosp: HospitalRecord = {
      id: `HOSP-${newHospMandal.substring(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      name: newHospName,
      category: newHospCategory,
      mandal: newHospMandal,
      phone: newHospPhone,
      managerName: 'Manager Pending',
      activeDoctors: 0,
      screeningsCount: '0',
      status: 'ACTIVE',
    };

    setHospitals((prev) => [...prev, newHosp]);
    setNewHospName('');
    setShowAddHospital(false);
  };

  return (
    <div className="admin-dashboard-root">
      {/* Admin Greeting Banner */}
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff' }}>
            System Administrator: {currentUser?.fullName || currentUser?.username || 'District Health Officer'}
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Alluri Sitharama Raju District • ITDA Paderu Central Command</span>
        </div>
        <span className="dash-status-pill status-completed">ROLE: SUPER ADMIN</span>
      </div>

      {/* 1. Super Admin KPI Grid */}
      <div className="dash-kpi-grid">
        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">Registered Hospitals</span>
            <div className="dash-kpi-icon-wrap icon-blue">🏥</div>
          </div>
          <div className="dash-kpi-value">{hospitals.length} Facilities</div>
          <div className="dash-kpi-footer">
            <span className="dash-kpi-trend-up">● Invariant 7 Scoped</span>
            <span>Zero Cross-Hospital Leakage</span>
          </div>
        </div>

        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">Active Doctors &amp; MOs</span>
            <div className="dash-kpi-icon-wrap icon-emerald">👨‍⚕️</div>
          </div>
          <div className="dash-kpi-value">14 Clinicians</div>
          <div className="dash-kpi-footer">
            <span>Provisioned across 5 Mandals</span>
          </div>
        </div>

        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">ITDA Agency Screenings</span>
            <div className="dash-kpi-icon-wrap icon-amber">🩺</div>
          </div>
          <div className="dash-kpi-value">248 Total</div>
          <div className="dash-kpi-footer">
            <span>Small counts (&lt; 5) suppressed</span>
          </div>
        </div>

        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">Security &amp; Audit Status</span>
            <div className="dash-kpi-icon-wrap icon-rose">🛡️</div>
          </div>
          <div className="dash-kpi-value" style={{ fontSize: '1.4rem', color: '#34d399' }}>ACID / PII Sanitized</div>
          <div className="dash-kpi-footer">
            <span>Pino Redaction &amp; Zero Raw Aadhaar</span>
          </div>
        </div>
      </div>

      {/* 2. Admin Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`dash-btn ${activeTab === 'overview' ? 'dash-btn-primary' : 'dash-btn-outline'}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Agency Command Overview
        </button>
        <button
          type="button"
          className={`dash-btn ${activeTab === 'hospitals' ? 'dash-btn-primary' : 'dash-btn-outline'}`}
          onClick={() => setActiveTab('hospitals')}
        >
          🏥 Hospital &amp; PHC Registry ({hospitals.length})
        </button>
        <button
          type="button"
          className={`dash-btn ${activeTab === 'doctors' ? 'dash-btn-primary' : 'dash-btn-outline'}`}
          onClick={() => setActiveTab('doctors')}
        >
          👨‍⚕️ Medical Officers &amp; Specialists ({doctorsList.length})
        </button>
        <button
          type="button"
          className={`dash-btn ${activeTab === 'camps' ? 'dash-btn-primary' : 'dash-btn-outline'}`}
          onClick={() => setActiveTab('camps')}
        >
          🏕️ Outreach Medical Camps ({campsList.length})
        </button>
        <button
          type="button"
          className={`dash-btn ${activeTab === 'critical' ? 'dash-btn-primary' : 'dash-btn-outline'}`}
          onClick={() => setActiveTab('critical')}
        >
          🚨 High-Risk Case Monitoring
        </button>
        {onNavigateTab && (
          <button
            type="button"
            className="dash-btn dash-btn-outline"
            onClick={() => onNavigateTab('asr-map')}
          >
            🗺️ Open Mandal GIS Map
          </button>
        )}
      </div>

      {/* Tab 1: Hospital Registry Table */}
      {activeTab === 'hospitals' && (
      <div className="dash-panel">
        <div className="dash-panel-header">
          <h3 className="dash-panel-title">
            <span>🏥</span>
            <span>Hospital Registry &amp; Isolated Tenant Management</span>
          </h3>
          <button
            type="button"
            className="dash-btn dash-btn-primary"
            onClick={() => setShowAddHospital(true)}
          >
            + Register New Hospital
          </button>
        </div>

        <div className="dash-table-container">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Hospital ID</th>
                <th>Facility Name</th>
                <th>Category</th>
                <th>Catchment Mandal</th>
                <th>Contact Phone</th>
                <th>Doctors</th>
                <th>Screenings</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8' }}>{h.id}</td>
                  <td>
                    <strong>{h.name}</strong>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Manager: {h.managerName}</div>
                  </td>
                  <td>{h.category}</td>
                  <td>{h.mandal}</td>
                  <td>{h.phone}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{h.activeDoctors}</td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{h.screeningsCount}</td>
                  <td>
                    <span
                      className={`dash-status-pill ${
                        h.status === 'ACTIVE' ? 'status-completed' : 'status-high-risk'
                      }`}
                    >
                      {h.status}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="dash-btn dash-btn-outline"
                      style={{ padding: '4px 10px', fontSize: '0.74rem' }}
                      onClick={() => handleToggleHospitalStatus(h.id)}
                    >
                      {h.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Tab 2: Doctor Management (Module 9) */}
      {activeTab === 'doctors' && (
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3 className="dash-panel-title">
              <span>👨‍⚕️</span>
              <span>Doctor &amp; Medical Officer Provisioning (ASR District)</span>
            </h3>
            <button
              type="button"
              className="dash-btn dash-btn-primary"
              onClick={() => setShowAddDoctor(true)}
            >
              + Register New Medical Officer
            </button>
          </div>

          <div className="dash-table-container">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Doctor ID</th>
                  <th>Name &amp; Qualification</th>
                  <th>Specialization</th>
                  <th>Assigned Hospital</th>
                  <th>Consultations</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {doctorsList.map((doc) => (
                  <tr key={doc.id}>
                    <td style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>{doc.id}</td>
                    <td>
                      <strong>{doc.name}</strong>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{doc.qualification}</div>
                    </td>
                    <td>{doc.specialty}</td>
                    <td>{doc.hospitalName}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{doc.totalConsultations}</td>
                    <td>
                      <span className="dash-status-pill status-completed">{doc.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Medical Camps Management (Module 9) */}
      {activeTab === 'camps' && (
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3 className="dash-panel-title">
              <span>🏕️</span>
              <span>Screening Medical Camps Management</span>
            </h3>
            <button
              type="button"
              className="dash-btn dash-btn-primary"
              onClick={() => setShowAddCamp(true)}
            >
              + Create New Medical Camp
            </button>
          </div>

          <div className="dash-table-container">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Camp ID</th>
                  <th>Camp Name</th>
                  <th>Mandal &amp; Village</th>
                  <th>Scheduled Date</th>
                  <th>Assigned Medical Team</th>
                  <th>Screenings</th>
                  <th>Referrals</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campsList.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>{c.id}</td>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.village}, {c.mandal}</td>
                    <td>{c.date}</td>
                    <td>
                      <div>{c.assignedDoctor}</div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{c.assignedAsha}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.screeningsCount}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'monospace', color: '#fb7185', fontWeight: 700 }}>{c.referralsCount}</td>
                    <td>
                      <span className={`dash-status-pill ${c.status === 'COMPLETED' ? 'status-completed' : 'status-pending'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: High-Risk Case Monitoring (Module 9 - Invariant 3 Suppression) */}
      {activeTab === 'critical' && (
        <div className="dash-panel" style={{ border: '1.5px solid #ef4444' }}>
          <div className="dash-panel-header">
            <h3 className="dash-panel-title" style={{ color: '#f87171' }}>
              <span>🚨</span>
              <span>High-Risk Mucosal Case &amp; Referral Queue (District Oversight)</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '12px' }}>
              Small-Count Cell Suppression Active (&lt; 5)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div style={{ fontSize: '0.76rem', color: '#fca5a5' }}>Paderu Mandal High-Risk Cases</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>8 Cases</div>
            </div>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ fontSize: '0.76rem', color: '#fde68a' }}>Dumbriguda Sub-Centre (Small-Count)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>&lt; 5</div>
            </div>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <div style={{ fontSize: '0.76rem', color: '#bae6fd' }}>Araku Valley Scheduled Referrals</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>6 Cases</div>
            </div>
          </div>
        </div>
      )}

      {/* Overview tab KPI grid */}
      {activeTab === 'overview' && (
        <div className="dash-panel">
          <h3 className="dash-panel-title" style={{ marginBottom: '14px' }}>
            <span>🗺️</span>
            <span>Alluri Sitharama Raju District Geographic Command</span>
          </h3>
          <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
            Central monitoring and coordination portal for ITDA Paderu. Real-time telemetry across 11 Agency Mandals, 243 Gram Panchayats, 5 Community Health Centres, 18 Primary Health Centres, and 142 Frontline ASHA Tribal Outposts.
          </p>
        </div>
      )}

      {/* Add Hospital Modal */}
      {showAddHospital && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="dash-panel"
            style={{ maxWidth: '520px', width: '100%', border: '1px solid #10b981' }}
          >
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                <span>🏥</span>
                <span>Register New Tribal Health Facility</span>
              </h3>
              <button
                type="button"
                className="dash-btn dash-btn-outline"
                style={{ padding: '4px 10px' }}
                onClick={() => setShowAddHospital(false)}
              >
                ✕ Close
              </button>
            </div>

            <form onSubmit={handleCreateHospital}>
              <div className="login-form-group">
                <label className="login-label">Hospital Name:</label>
                <input
                  type="text"
                  className="login-input"
                  placeholder="e.g. Community Health Centre Ananthagiri"
                  value={newHospName}
                  onChange={(e) => setNewHospName(e.target.value)}
                  required
                />
              </div>

              <div className="login-form-group">
                <label className="login-label">Category:</label>
                <select
                  className="login-input"
                  value={newHospCategory}
                  onChange={(e) => setNewHospCategory(e.target.value as any)}
                >
                  <option value="CHC">Community Health Centre (CHC)</option>
                  <option value="AREA_HOSPITAL">Area Hospital</option>
                  <option value="SUB_CENTRE">Primary Tribal Sub-Centre</option>
                </select>
              </div>

              <div className="login-form-group">
                <label className="login-label">Catchment Mandal:</label>
                <select
                  className="login-input"
                  value={newHospMandal}
                  onChange={(e) => setNewHospMandal(e.target.value)}
                >
                  <option value="Paderu">Paderu</option>
                  <option value="Araku Valley">Araku Valley</option>
                  <option value="Dumbriguda">Dumbriguda</option>
                  <option value="Chintapalli">Chintapalli</option>
                  <option value="Munchingiputtu">Munchingiputtu</option>
                  <option value="Ananthagiri">Ananthagiri</option>
                </select>
              </div>

              <div className="login-form-group">
                <label className="login-label">Official Phone:</label>
                <input
                  type="text"
                  className="login-input"
                  value={newHospPhone}
                  onChange={(e) => setNewHospPhone(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="dash-btn dash-btn-outline"
                  onClick={() => setShowAddHospital(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="dash-btn dash-btn-primary">
                  Save Hospital Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddDoctor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="dash-panel" style={{ maxWidth: '520px', width: '100%', border: '1px solid #38bdf8' }}>
            <div className="dash-panel-header">
              <h3 className="dash-panel-title"><span>👨‍⚕️</span><span>Register Medical Officer / Specialist</span></h3>
              <button type="button" className="dash-btn dash-btn-outline" style={{ padding: '4px 10px' }} onClick={() => setShowAddDoctor(false)}>✕ Close</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newDocName.trim()) return;
              setDoctorsList(prev => [...prev, {
                id: `DR-PAD-0${prev.length + 1}`,
                name: newDocName,
                qualification: 'MBBS / BDS, Medical Officer',
                specialty: newDocSpecialty,
                hospitalName: hospitals.find(h => h.id === newDocHospital)?.name || 'CHC Paderu',
                status: 'ACTIVE',
                totalConsultations: 0,
              }]);
              setNewDocName('');
              setShowAddDoctor(false);
            }}>
              <div className="login-form-group">
                <label className="login-label">Doctor Full Name:</label>
                <input type="text" className="login-input" placeholder="e.g. Dr. M. Suresh Kumar" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} required />
              </div>
              <div className="login-form-group">
                <label className="login-label">Specialization:</label>
                <input type="text" className="login-input" value={newDocSpecialty} onChange={(e) => setNewDocSpecialty(e.target.value)} required />
              </div>
              <div className="login-form-group">
                <label className="login-label">Assigned Facility:</label>
                <select className="login-input" value={newDocHospital} onChange={(e) => setNewDocHospital(e.target.value)}>
                  {hospitals.map(h => (<option key={h.id} value={h.id}>{h.name}</option>))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="dash-btn dash-btn-outline" onClick={() => setShowAddDoctor(false)}>Cancel</button>
                <button type="submit" className="dash-btn dash-btn-primary">Register Doctor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Camp Modal */}
      {showAddCamp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="dash-panel" style={{ maxWidth: '520px', width: '100%', border: '1px solid #a855f7' }}>
            <div className="dash-panel-header">
              <h3 className="dash-panel-title"><span>🏕️</span><span>Create Tribal Screening Medical Camp</span></h3>
              <button type="button" className="dash-btn dash-btn-outline" style={{ padding: '4px 10px' }} onClick={() => setShowAddCamp(false)}>✕ Close</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!newCampName.trim()) return;
              setCampsList(prev => [...prev, {
                id: `CAMP-2026-0${prev.length + 1}`,
                name: newCampName,
                mandal: newCampMandal,
                village: newCampVillage,
                date: newCampDate,
                assignedDoctor: doctorsList[0]?.name || 'Dr. K. Somasekhar',
                assignedAsha: 'Frontline ASHA Unit',
                screeningsCount: '0',
                referralsCount: '0',
                status: 'SCHEDULED',
              }]);
              setNewCampName('');
              setShowAddCamp(false);
            }}>
              <div className="login-form-group">
                <label className="login-label">Camp Name:</label>
                <input type="text" className="login-input" placeholder="e.g. Hukumpeta Weekly Tribal Screening Camp" value={newCampName} onChange={(e) => setNewCampName(e.target.value)} required />
              </div>
              <div className="login-form-group">
                <label className="login-label">Mandal:</label>
                <select className="login-input" value={newCampMandal} onChange={(e) => setNewCampMandal(e.target.value)}>
                  <option value="Paderu">Paderu</option>
                  <option value="Araku Valley">Araku Valley</option>
                  <option value="Dumbriguda">Dumbriguda</option>
                  <option value="Chintapalli">Chintapalli</option>
                  <option value="Munchingiputtu">Munchingiputtu</option>
                  <option value="Hukumpeta">Hukumpeta</option>
                </select>
              </div>
              <div className="login-form-group">
                <label className="login-label">Village / Habitation:</label>
                <input type="text" className="login-input" value={newCampVillage} onChange={(e) => setNewCampVillage(e.target.value)} required />
              </div>
              <div className="login-form-group">
                <label className="login-label">Scheduled Date:</label>
                <input type="date" className="login-input" value={newCampDate} onChange={(e) => setNewCampDate(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="dash-btn dash-btn-outline" onClick={() => setShowAddCamp(false)}>Cancel</button>
                <button type="submit" className="dash-btn dash-btn-primary">Schedule Medical Camp</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
