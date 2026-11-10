import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface Specialist {
  specialistId: string;
  name: string;
  specialty: string;
  hospitalId: string;
  hospitalName: string;
  qualifications: string[];
  teleconsultAvailable: boolean;
  contactPhone: string;
  email: string;
  languages: string[];
  status: string;
}

interface SpecialistDirectoryProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export const SpecialistDirectory: React.FC<SpecialistDirectoryProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [onlyTeleconsult, setOnlyTeleconsult] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Register Specialist Form Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('oral_oncology');
  const [hospitalId, setHospitalId] = useState('hosp_paderu_dh');
  const [hospitalName, setHospitalName] = useState('District Hospital Paderu');
  const [qualifications, setQualifications] = useState('MBBS, MDS (Oral Maxillofacial Surgery)');
  const [contactPhone, setContactPhone] = useState('+91 94401 22334');
  const [email, setEmail] = useState('');
  const [teleconsultAvailable, setTeleconsultAvailable] = useState(true);
  const [timingsDays, setTimingsDays] = useState('Mon, Tue, Wed, Thu, Fri');
  const [timingsHours, setTimingsHours] = useState('09:00 AM - 04:00 PM');
  const [experienceYears, setExperienceYears] = useState(8);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Status Toggle
  const handleToggleDoctorStatus = async (spec: Specialist, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/specialists/${spec.specialistId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchSpecialists();
    } catch {
      // ignore
    }
  };

  // Referral Simulation Modal
  const [referralTarget, setReferralTarget] = useState<Specialist | null>(null);
  const [referralPatientId, setReferralPatientId] = useState('DEMO-PAD-8492');
  const [referralNotes, setReferralNotes] = useState('Biopsy recommended for buccal mucosa white patch (Tier 2)');
  const [referralSent, setReferralSent] = useState(false);

  const fetchSpecialists = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSpecialty !== 'all') params.append('specialty', selectedSpecialty);
      if (onlyTeleconsult) params.append('teleconsultAvailable', 'true');

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      };

      const res = await fetch(`/api/v1/specialists?${params.toString()}`, { headers });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setSpecialists(payload.data?.specialists || []);
      } else {
        throw new Error(payload.error?.message || 'Failed to fetch specialists');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecialists();
  }, [selectedSpecialty, onlyTeleconsult, accessToken]);

  const handleRegisterSpecialist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setFormMsg({ type: 'error', text: 'You must be logged in to register a specialist' });
      return;
    }

    setSubmitting(true);
    setFormMsg(null);

    try {
      const qualsList = qualifications.split(',').map((q) => q.trim()).filter(Boolean);

      const res = await fetch('/api/v1/specialists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          specialty,
          hospitalId,
          hospitalName,
          qualifications: qualsList,
          teleconsultAvailable,
          contactPhone: contactPhone.trim(),
          email: email.trim(),
          languages: ['te', 'en'],
          consultationTimings: {
            days: timingsDays.split(',').map((d) => d.trim()).filter(Boolean),
            hours: timingsHours.trim(),
          },
          experienceYears: Number(experienceYears) || undefined,
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success) {
        setFormMsg({ type: 'success', text: `Specialist ${name} successfully registered!` });
        setName('');
        setEmail('');
        setShowAddModal(false);
        fetchSpecialists();
      } else {
        throw new Error(payload.error?.message || 'Failed to register specialist');
      }
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const formatSpecialty = (spec: string) => {
    switch (spec) {
      case 'oral_oncology':
        return 'Oral Oncology';
      case 'maxillofacial_surgery':
        return 'Maxillofacial Surgery';
      case 'ent_head_neck':
        return 'ENT & Head/Neck';
      case 'pathology':
        return 'Oral Pathology';
      case 'radiation_oncology':
        return 'Radiation Oncology';
      case 'general_dental':
        return 'Dental Surgery';
      default:
        return spec.replace(/_/g, ' ').toUpperCase();
    }
  };

  const filteredSpecialists = specialists.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.hospitalName.toLowerCase().includes(q) ||
      s.specialty.toLowerCase().includes(q) ||
      s.qualifications.some((qual) => qual.toLowerCase().includes(q))
    );
  });

  if (!accessToken) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <LoginRequiredView
          moduleTitle="Specialist Directory & Teleconsultation"
          moduleDescription="Access to verified clinical specialists, teleconsultation scheduling, and hospital referral navigation across ITDA Paderu requires authenticated staff credentials."
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
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(28, 114, 147, 0.2) 0%, rgba(21, 34, 56, 0.8) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.6rem' }}>👨‍⚕️</span>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Specialists Directory</h2>
              <span className="badge badge-real">Phase 3: Administration</span>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', maxWidth: '780px', margin: 0 }}>
              District clinical specialists directory for secondary and tertiary oral mucosal referrals and remote teleconsultations across ITDA Paderu. Filter by surgical subspecialty or live teleconsult availability.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={fetchSpecialists}
              disabled={loading}
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Refresh
            </button>
            {(currentUser?.role === 'system_admin' || currentUser?.role === 'admin' || currentUser?.role === 'medical_officer') && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddModal(true)}
                style={{ fontSize: '0.85rem' }}
              >
                + Register Specialist
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Search Box */}
          <div style={{ flex: '1', minWidth: '240px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search specialist name, hospital, qualifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
          </div>

          {/* Specialty Dropdown */}
          <div style={{ minWidth: '200px' }}>
            <select
              className="form-select"
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="all">All Specialties</option>
              <option value="oral_oncology">Oral Oncology</option>
              <option value="maxillofacial_surgery">Maxillofacial Surgery</option>
              <option value="ent_head_neck">ENT & Head/Neck</option>
              <option value="pathology">Oral Pathology</option>
              <option value="radiation_oncology">Radiation Oncology</option>
              <option value="general_dental">General Dental</option>
            </select>
          </div>

          {/* Teleconsult Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.86rem', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={onlyTeleconsult}
              onChange={(e) => setOnlyTeleconsult(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-brand-accent)' }}
            />
            <span style={{ color: onlyTeleconsult ? 'var(--color-brand-accent)' : 'var(--color-text-secondary)', fontWeight: 600 }}>
              🟢 Live Teleconsult Only
            </span>
          </label>
        </div>
      </div>

      {/* Specialists Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
            Available Specialists ({filteredSpecialists.length})
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Showing verified clinical consultants in ITDA Paderu
          </span>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>Loading specialists...</div>}
        {error && <div style={{ color: 'var(--color-status-danger)', padding: '16px' }}>{error}</div>}

        {!loading && filteredSpecialists.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
            <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
              No specialists match the selected criteria. Try selecting "All Specialties" or register a new consultant.
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredSpecialists.map((s) => (
            <div
              key={s.specialistId}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                borderLeft: s.teleconsultAvailable ? '4px solid var(--color-brand-accent)' : '4px solid var(--color-text-muted)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{s.name}</h4>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-brand-accent)', fontWeight: 600 }}>
                    {formatSpecialty(s.specialty)}
                  </div>
                </div>
                <span
                  className="badge"
                  style={{
                    background: s.teleconsultAvailable ? 'rgba(6, 214, 160, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                    color: s.teleconsultAvailable ? 'var(--color-brand-accent)' : 'var(--color-text-muted)',
                    fontSize: '0.72rem',
                    border: `1px solid ${s.teleconsultAvailable ? 'var(--color-brand-accent)' : 'var(--color-text-muted)'}`,
                  }}
                >
                  {s.teleconsultAvailable ? '🟢 Teleconsult Ready' : '🔴 In-Clinic Only'}
                </span>
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
                🏥 <strong>{s.hospitalName}</strong>
              </div>

              {s.qualifications && s.qualifications.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {s.qualifications.map((q, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'rgba(255, 255, 255, 0.07)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.72rem',
                      }}
                    >
                      {q}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                <div>📞 {s.contactPhone}</div>
                <div>🗣️ {s.languages?.join(', ').toUpperCase()}</div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', color: s.status === 'active' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                    ● {s.status?.toUpperCase() || 'ACTIVE'}
                  </span>
                  <button
                    type="button"
                    className="button-outline"
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    onClick={() => handleToggleDoctorStatus(s, s.status === 'active' ? 'on_leave' : 'active')}
                  >
                    {s.status === 'active' ? 'Set On Leave' : 'Set Active'}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setReferralTarget(s);
                    setReferralSent(false);
                  }}
                  style={{ width: '100%', fontSize: '0.8rem', padding: '6px 10px' }}
                >
                  📋 Request Referral / Teleconsult
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral Modal */}
      {referralTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 11, 24, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '500px', width: '100%', background: 'var(--color-surface-card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Refer Patient to {referralTarget.name}
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReferralTarget(null)}
                style={{ padding: '2px 8px', fontSize: '0.8rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ margin: '14px 0', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Facility: <strong>{referralTarget.hospitalName}</strong> | Specialty: <strong>{formatSpecialty(referralTarget.specialty)}</strong>
            </div>

            {!referralSent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Patient Demo ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={referralPatientId}
                    onChange={(e) => setReferralPatientId(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Clinical Impression & Referral Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={referralNotes}
                    onChange={(e) => setReferralNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setReferralTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setReferralSent(true)}
                  >
                    🚀 Dispatch Referral
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', background: 'rgba(6, 214, 160, 0.15)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>✓ Referral Ticket Dispatched!</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Case sent to <strong>{referralTarget.name}</strong>. The teleconsult session link and secure health record envelope have been provisioned under DPDP patient consent.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setReferralTarget(null)}
                  style={{ marginTop: '14px', fontSize: '0.85rem' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Specialist Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(6, 11, 24, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '540px', width: '100%', background: 'var(--color-surface-card)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="card-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Register Specialist Consultant
              </h3>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '2px 8px', fontSize: '0.8rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSpecialist} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <div className="form-group">
                <label className="form-label">Full Name & Honorific</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Dr. S. K. Murthy, MDS"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Specialty Field</label>
                  <select
                    className="form-select"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  >
                    <option value="oral_oncology">Oral Oncology</option>
                    <option value="maxillofacial_surgery">Maxillofacial Surgery</option>
                    <option value="ent_head_neck">ENT Head & Neck</option>
                    <option value="pathology">Oral Pathology</option>
                    <option value="radiation_oncology">Radiation Oncology</option>
                    <option value="general_dental">General Dental</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Facility ID</label>
                  <select
                    className="form-select"
                    value={hospitalId}
                    onChange={(e) => {
                      setHospitalId(e.target.value);
                      if (e.target.value === 'hosp_paderu_dh') setHospitalName('District Hospital Paderu');
                      if (e.target.value === 'hosp_araku_ah') setHospitalName('Area Hospital Araku');
                      if (e.target.value === 'hosp_chintapalli_chc') setHospitalName('Community Health Centre Chintapalli');
                    }}
                  >
                    <option value="hosp_paderu_dh">hosp_paderu_dh</option>
                    <option value="hosp_araku_ah">hosp_araku_ah</option>
                    <option value="hosp_chintapalli_chc">hosp_chintapalli_chc</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Qualifications (Comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="specialist@paderu.gov.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Consultation Days</label>
                  <input
                    type="text"
                    className="form-input"
                    value={timingsDays}
                    onChange={(e) => setTimingsDays(e.target.value)}
                    placeholder="Mon, Wed, Fri"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Consultation Hours</label>
                  <input
                    type="text"
                    className="form-input"
                    value={timingsHours}
                    onChange={(e) => setTimingsHours(e.target.value)}
                    placeholder="09:00 AM - 04:00 PM"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Years of Clinical Experience</label>
                <input
                  type="number"
                  className="form-input"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  min={0}
                  max={60}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={teleconsultAvailable}
                  onChange={(e) => setTeleconsultAvailable(e.target.checked)}
                  style={{ accentColor: 'var(--color-brand-accent)' }}
                />
                <span>Available for Remote Video / Audio Teleconsultations</span>
              </label>

              {formMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: formMsg.type === 'success' ? 'rgba(6, 214, 160, 0.15)' : 'rgba(230, 57, 70, 0.15)',
                    color: formMsg.type === 'success' ? 'var(--color-brand-accent)' : 'var(--color-status-danger)',
                    fontSize: '0.85rem',
                  }}
                >
                  {formMsg.text}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Registering...' : 'Save Specialist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
