import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface AadhaarMockManagerProps {
  currentUser: AuthUser | null;
  accessToken: string | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export const AadhaarMockManager: React.FC<AadhaarMockManagerProps> = ({
  currentUser,
  accessToken,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'otp' | 'demographic' | 'status'>('otp');
  const [testAadhaarNumber, setTestAadhaarNumber] = useState('0000-0000-1234');
  const [purpose, setPurpose] = useState('Demonstration Screening & Registration');

  // OTP State
  const [transactionId, setTransactionId] = useState('');
  const [maskedAadhaar, setMaskedAadhaar] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('123456');
  const [otpResult, setOtpResult] = useState<any>(null);

  // Demographic State
  const [demoName, setDemoName] = useState('K. Savithri');
  const [demoYearOfBirth, setDemoYearOfBirth] = useState('1988');
  const [demoGender, setDemoGender] = useState('F');
  const [demographicResult, setDemographicResult] = useState<any>(null);

  // Status State
  const [adapterStatus, setAdapterStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/v1/mock/aadhaar/status', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdapterStatus(data.data);
      }
    } catch (e: any) {
      console.error('Error fetching mock adapter status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [currentUser]);

  const handleGenerateOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setOtpResult(null);

    try {
      const res = await fetch('/api/v1/mock/aadhaar/generate-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ testAadhaarNumber, purpose }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to generate simulated OTP');
      }

      setTransactionId(data.data.transactionId);
      setMaskedAadhaar(data.data.maskedAadhaar);
      setEnteredOtp(data.data.testOtpHint || '123456');
      setMessage(data.data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !transactionId) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/v1/mock/aadhaar/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ transactionId, otp: enteredOtp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Simulated OTP evaluation failed');
      }

      setOtpResult(data.data);
      setMessage(data.data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemographicAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setDemographicResult(null);

    try {
      const res = await fetch('/api/v1/mock/aadhaar/demographic-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          testAadhaarNumber,
          name: demoName,
          yearOfBirth: demoYearOfBirth,
          gender: demoGender,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Simulated demographic evaluation failed');
      }

      setDemographicResult(data.data);
      setMessage(data.data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card panel progress-panel" style={{ marginTop: '1.5rem' }}>
      {/* Simulation Banner - Mandatory on all Mock screens */}
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '1.25rem' }}>⚠️</span>
        <div>
          <strong style={{ color: '#ef4444' }}>[MOCK] AADHAAR SIMULATION ADAPTER</strong>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            DEMO SIMULATION ONLY • NOT CONNECTED TO UIDAI • TEST IDENTIFIERS ONLY
          </div>
        </div>
      </div>

      {!accessToken && (
        <LoginRequiredView
          moduleTitle="Aadhaar Mock Verification Service"
          moduleDescription="Sign in with demo credentials to test simulated OTP generation, demographic matching, and sandbox Aadhaar validation."
          onLoginAsAsha={onRequireLogin ? () => onRequireLogin('asha') : undefined}
          onLoginAsDoctor={onRequireLogin ? () => onRequireLogin('doctor') : undefined}
          onGoToAuth={onGoToAuth}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Aadhaar Mock Service</span>
            <span className="badge badge-warning" style={{ background: '#f59e0b', color: '#000', fontWeight: 'bold' }}>
              MOCK
            </span>
            <span className="badge badge-danger" style={{ background: '#dc2626', color: '#fff' }}>
              REAL UIDAI: BLOCKED
            </span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Privacy-safe simulated beneficiary authentication adapter for ITDA Paderu screening camps.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <button
          className={`btn ${activeTab === 'otp' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('otp')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          [MOCK] Simulated OTP Flow
        </button>
        <button
          className={`btn ${activeTab === 'demographic' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('demographic')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          [MOCK] Demographic Match
        </button>
        <button
          className={`btn ${activeTab === 'status' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('status')}
          style={{ borderRadius: '6px 6px 0 0' }}
        >
          Adapter Status & Guardrails
        </button>
      </div>

      {message && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '6px' }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {/* Tab 1: Simulated OTP */}
      {activeTab === 'otp' && (
        <div>
          <form onSubmit={handleGenerateOtp} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Test Aadhaar Number (Demo Dummy Only)</label>
                <input
                  type="text"
                  className="form-control"
                  value={testAadhaarNumber}
                  onChange={(e) => setTestAadhaarNumber(e.target.value)}
                  placeholder="0000-0000-1234"
                  required
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  Full numbers are never stored. Masked fragment: <code>XXXX-XXXX-1234</code>.
                </small>
              </div>
              <div className="form-group">
                <label>Demonstration Purpose</label>
                <input
                  type="text"
                  className="form-control"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Screening Registration"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Processing...' : 'Generate Simulated OTP [MOCK]'}
            </button>
          </form>

          {transactionId && (
            <div
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1.25rem',
                marginTop: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ margin: 0 }}>Active Mock Session: <code>{transactionId}</code></h4>
                <span className="badge badge-info" style={{ background: '#3b82f6', color: '#fff' }}>
                  Masked: {maskedAadhaar}
                </span>
              </div>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Demonstration OTP hint: <code>123456</code> (Test code valid for 5 minutes).
              </p>

              <form onSubmit={handleEvaluateOtp} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label>Enter 6-Digit Simulated OTP Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={enteredOtp}
                    onChange={(e) => setEnteredOtp(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Evaluating...' : 'Evaluate Simulated OTP [MOCK]'}
                </button>
              </form>

              {otpResult && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '1rem',
                    background: otpResult.status === 'simulated_match' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${otpResult.status === 'simulated_match' ? '#10b981' : '#ef4444'}`,
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge" style={{ background: otpResult.status === 'simulated_match' ? '#10b981' : '#ef4444', color: '#fff' }}>
                      STATUS: {otpResult.status}
                    </span>
                    <span className="badge badge-warning" style={{ background: '#f59e0b', color: '#000' }}>
                      MOCK ONLY
                    </span>
                  </div>
                  <div><strong>Notice:</strong> {otpResult.message}</div>
                  {otpResult.demoProfile && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>
                      <strong>Simulated Profile Match:</strong>
                      <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                        <li>Name: {otpResult.demoProfile.name}</li>
                        <li>Year of Birth: {otpResult.demoProfile.yearOfBirth}</li>
                        <li>Gender: {otpResult.demoProfile.gender}</li>
                        <li>District: {otpResult.demoProfile.district}</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Demographic Match */}
      {activeTab === 'demographic' && (
        <form onSubmit={handleDemographicAuth}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Test Aadhaar Identifier</label>
              <input
                type="text"
                className="form-control"
                value={testAadhaarNumber}
                onChange={(e) => setTestAadhaarNumber(e.target.value)}
                placeholder="0000-0000-5678"
                required
              />
            </div>
            <div className="form-group">
              <label>Beneficiary Name</label>
              <input
                type="text"
                className="form-control"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                placeholder="Beneficiary Full Name"
                required
              />
            </div>
            <div className="form-group">
              <label>Year of Birth (Optional)</label>
              <input
                type="text"
                className="form-control"
                value={demoYearOfBirth}
                onChange={(e) => setDemoYearOfBirth(e.target.value)}
                placeholder="1988"
              />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select
                className="form-control"
                value={demoGender}
                onChange={(e) => setDemoGender(e.target.value)}
              >
                <option value="F">Female (F)</option>
                <option value="M">Male (M)</option>
                <option value="O">Other (O)</option>
              </select>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Evaluating...' : 'Evaluate Demographic Match [MOCK]'}
          </button>

          {demographicResult && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                background: demographicResult.status === 'simulated_match' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${demographicResult.status === 'simulated_match' ? '#10b981' : '#ef4444'}`,
                borderRadius: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="badge" style={{ background: demographicResult.status === 'simulated_match' ? '#10b981' : '#ef4444', color: '#fff' }}>
                  {demographicResult.status} ({demographicResult.matchConfidence})
                </span>
                <span className="badge badge-warning" style={{ background: '#f59e0b', color: '#000' }}>
                  MOCK ONLY
                </span>
              </div>
              <div><strong>Notice:</strong> {demographicResult.message}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Evaluated against masked test reference: <code>{demographicResult.maskedAadhaar}</code>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Tab 3: Status & Guardrails */}
      {activeTab === 'status' && (
        <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px' }}>
          <h4>Mock Adapter Architecture & Boundary Rules</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Adapter Status</div>
              <strong style={{ color: '#f59e0b' }}>{adapterStatus?.adapterStatus || 'MOCK'}</strong>
            </div>
            <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Real UIDAI Integration</div>
              <strong style={{ color: '#ef4444' }}>{adapterStatus?.realIntegration || 'BLOCKED'}</strong>
            </div>
            <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>UIDAI Live Connected</div>
              <strong>{adapterStatus?.uidaiConnected ? 'TRUE' : 'FALSE (BLOCKED)'}</strong>
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
            <p><strong>Non-Custodial Data Handling:</strong> Full 12-digit Aadhaar numbers are never logged, never persisted in MongoDB, and never transmitted across network hops. Only masked 4-digit fragments (e.g. <code>XXXX-XXXX-1234</code>) are recorded in tamper-proof audit trails.</p>
            <p><strong>Clinical & Legal Integrity:</strong> The platform explicitly refrains from claiming government identification verification. All evaluation states are rendered as <code>simulated_match</code> or <code>simulated_mismatch</code>.</p>
          </div>
        </div>
      )}
    </div>
  );
};
