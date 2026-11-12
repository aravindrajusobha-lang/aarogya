import React, { useState, useEffect } from 'react';

interface ConsentRecord {
  consentId: string;
  patientId: string;
  purpose: 'screening_ai_analysis' | 'telemedicine_share' | 'data_storage';
  status: 'granted' | 'revoked' | 'denied';
  validUntil: string;
  grantedAt: string;
  witnessName?: string;
  language: string;
}

interface ConsentManagerProps {
  patientId: string;
  accessToken: string;
}

export const ConsentManager: React.FC<ConsentManagerProps> = ({ patientId, accessToken }) => {
  const [targetPatientId, setTargetPatientId] = useState(patientId);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState<'screening_ai_analysis' | 'telemedicine_share' | 'data_storage'>('screening_ai_analysis');
  const [witnessName, setWitnessName] = useState('');
  const [consentLang, setConsentLang] = useState('te'); // Default Telugu for ITDA Paderu
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchConsents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/consent/patient/${encodeURIComponent(targetPatientId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const env = await res.json();
      if (env.success) {
        setConsents(env.data.consents);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetPatientId && accessToken) {
      fetchConsents();
    }
  }, [targetPatientId, accessToken]);

  useEffect(() => setTargetPatientId(patientId), [patientId]);

  const handleGrantConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientId: targetPatientId,
          purpose: selectedPurpose,
          witnessName,
          language: consentLang,
        }),
      });

      const env = await res.json();
      if (env.success) {
        setStatusMsg(`Consent granted for purpose: ${selectedPurpose}`);
        setShowGrantModal(false);
        fetchConsents();
      } else {
        setStatusMsg(`Error: ${env.error?.message}`);
      }
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    }
  };

  const handleRevokeConsent = async (consentId: string) => {
    try {
      const res = await fetch(`/api/v1/consent/${consentId}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const env = await res.json();
      if (env.success) {
        setStatusMsg(`Consent ${consentId} successfully revoked`);
        fetchConsents();
      }
    } catch (err: any) {
      setStatusMsg(`Failed to revoke consent: ${err.message}`);
    }
  };

  const PURPOSES = [
    {
      id: 'screening_ai_analysis',
      title: 'Oral Mucosa Photography & AI Risk Triage',
      desc: 'Consent to capture high-definition intra-oral photos and run preliminary AI screening.',
    },
    {
      id: 'telemedicine_share',
      title: 'Telemedicine Clinical Review',
      desc: 'Consent to transmit clinical records and lesion photos to Medical Officer at PHC.',
    },
    {
      id: 'data_storage',
      title: 'Longitudinal Health Record Storage',
      desc: 'Consent to retain longitudinal screening history for follow-up and clinical tracking.',
    },
  ];

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📋 DPDP Act Consent Management</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
            Informed patient consent tracking for a saved patient record.
          </p>
          <label className="form-label" htmlFor="consent-patient-id">Patient ID</label>
          <input id="consent-patient-id" className="form-input" value={targetPatientId} onChange={(event) => setTargetPatientId(event.target.value)} required />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          onClick={() => setShowGrantModal(true)}
        >
          ➕ Grant Informed Consent
        </button>
      </div>

      {statusMsg && (
        <div style={{ color: 'var(--color-brand-accent)', fontSize: '0.85rem', marginBottom: '12px' }}>
          ✓ {statusMsg}
        </div>
      )}

      {loading && consents.length === 0 && (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
          Loading consent records from DPDP registry...
        </div>
      )}

      <div className="consent-grid">
        {PURPOSES.map((p) => {
          const activeConsent = consents.find((c) => c.purpose === p.id && c.status === 'granted');

          return (
            <div
              key={p.id}
              className={`consent-card ${activeConsent ? 'granted' : 'revoked'}`}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700 }}>{p.title}</h4>
                  <span
                    style={{
                      background: activeConsent ? 'rgba(6,214,160,0.2)' : 'rgba(230,57,70,0.2)',
                      color: activeConsent ? 'var(--color-status-success)' : 'var(--color-status-danger)',
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                    }}
                  >
                    {activeConsent ? 'ACTIVE CONSENT' : 'NOT GRANTED'}
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                  {p.desc}
                </p>
              </div>

              {activeConsent ? (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                    Granted: {new Date(activeConsent.grantedAt).toLocaleDateString()} (Lang: {activeConsent.language.toUpperCase()})
                    {activeConsent.witnessName && ` • Witness: ${activeConsent.witnessName}`}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      width: '100%',
                      color: 'var(--color-status-danger)',
                      borderColor: 'rgba(230,57,70,0.4)',
                    }}
                    onClick={() => handleRevokeConsent(activeConsent.consentId)}
                  >
                    Revoke Consent
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '4px 8px', width: '100%' }}
                    onClick={() => {
                      setSelectedPurpose(p.id as any);
                      setShowGrantModal(true);
                    }}
                  >
                    Record Consent
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grant Consent Modal */}
      {showGrantModal && (
        <div className="mfa-modal-overlay">
          <div className="mfa-modal-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>📝 Record Informed Patient Consent</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', marginBottom: '14px' }}>
              Complies with Digital Personal Data Protection (DPDP) Act 2023. Notice delivered in preferred language with voluntary informed agreement.
            </p>

            <form onSubmit={handleGrantConsent}>
              <div className="form-group">
                <label className="form-label">Consent Purpose</label>
                <select
                  className="form-control"
                  value={selectedPurpose}
                  onChange={(e) => setSelectedPurpose(e.target.value as any)}
                >
                  <option value="screening_ai_analysis">Oral Photo & AI Triage Analysis</option>
                  <option value="telemedicine_share">Medical Officer Telemedicine Referral</option>
                  <option value="data_storage">Longitudinal Health Record Storage</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notice Language</label>
                <select
                  className="form-control"
                  value={consentLang}
                  onChange={(e) => setConsentLang(e.target.value)}
                >
                  <option value="te">తెలుగు (Telugu - ITDA Paderu)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Documented Witness / Field Verifier</label>
                <input
                  type="text"
                  className="form-control"
                  value={witnessName}
                  onChange={(e) => setWitnessName(e.target.value)}
                  placeholder="Name of Sarpanch / Tribal Elder / Family Member"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGrantModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm & Save Consent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
