import React, { useState, useEffect } from 'react';
import { SimulationBanner } from './components/SimulationBanner';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { OfflineStatusIndicator } from './components/OfflineStatusIndicator';
import { LoadingView, EmptyView, ErrorView, SuccessView } from './components/UIStateViews';
import { LanguageCode, translations, getClientTranslation } from './i18n';
import { db, OfflineScreening } from './db/aarogyaDb';

interface SystemHealthData {
  status: string;
  service: string;
  version: string;
  simulation: boolean;
  database: {
    connected: boolean;
    isReplicaSet: boolean;
    setName: string | null;
    supportsTransactions: boolean;
  };
  scheduler: {
    running: boolean;
    jobCount: number;
  };
}

export const App: React.FC = () => {
  const [lang, setLang] = useState<LanguageCode>('en');
  const dict = translations[lang];
  const t = (path: string) => getClientTranslation(dict, path);

  // System Diagnostics State
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // ASHA Screening Form State
  const [patientDemoId, setPatientDemoId] = useState<string>('DEMO-PAD-8492');
  const [tobaccoHabit, setTobaccoHabit] = useState<boolean>(true);
  const [durationYears, setDurationYears] = useState<number>(8);
  const [lesionObserved, setLesionObserved] = useState<boolean>(true);
  const [lesionType, setLesionType] = useState<string>('whitePatch');
  const [anatomicalSite, setAnatomicalSite] = useState<string>('buccalMucosa');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Screening Submission State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // State Demo Viewer Toggle
  const [demoState, setDemoState] = useState<'normal' | 'loading' | 'empty' | 'error' | 'success'>('normal');

  // Fetch System Health from Backend API Envelope
  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/v1/health');
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const payload = await res.json();
      if (payload.success && payload.data) {
        setSystemHealth(payload.data);
      } else {
        throw new Error(payload.error?.message || 'Failed to parse response envelope');
      }
    } catch (err) {
      setHealthError((err as Error).message);
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Handle Photo File Select & Preview
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setPhotoPreview(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Preliminary Screening Risk Category (Demo AI Heuristic)
  const computeRiskTier = (): { tier: 'Tier 1' | 'Tier 2' | 'Tier 3'; label: string; class: string } => {
    if (!lesionObserved) {
      return { tier: 'Tier 1', label: t('screening.riskTier.low'), class: 'risk-tier-1' };
    }
    if (lesionType === 'ulcer' || lesionType === 'redPatch') {
      return { tier: 'Tier 3', label: t('screening.riskTier.high'), class: 'risk-tier-3' };
    }
    return { tier: 'Tier 2', label: t('screening.riskTier.moderate'), class: 'risk-tier-2' };
  };

  const riskTier = computeRiskTier();

  // Save to Local Dexie DB (Offline First)
  const handleSaveOffline = async () => {
    try {
      const record: OfflineScreening = {
        patientDemoId,
        campId: 'CAMP-PADERU-DEMO-01',
        ashaId: 'ASHA-CHINTAPALLI-102',
        visualFindings: {
          lesionObserved,
          lesionType,
          anatomicalSite,
        },
        demoRiskTier: riskTier.tier,
        photoDataUrl: photoPreview || undefined,
        syncStatus: 'local_pending',
        createdAt: Date.now(),
      };

      await db.screenings.add(record);
      setSubmitSuccess(
        `Screening saved to Dexie local database for demo patient ${patientDemoId}. Queued for synchronization.`
      );
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  };

  // Submit via Private Storage API (Simulated Upload)
  const handleSubmitOnline = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      // 1. Create a simulated blob if photo exists or generate a mock binary
      const mockBlob = new Blob(['SIMULATED_ORAL_CAVITY_IMAGE_BLOB'], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', mockBlob, `${patientDemoId}_oral_mucosa_demo.png`);

      const uploadRes = await fetch('/api/v1/storage/upload', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer sim_user_asha_chintapalli_01',
        },
        body: formData,
      });

      const payload = await uploadRes.json();
      if (!payload.success) {
        throw new Error(payload.error?.message || 'Storage upload rejected');
      }

      setSubmitSuccess(
        `Screening image securely uploaded to private storage (ID: ${payload.data.fileId}). File has ZERO public URLs and requires MO authorization to view.`
      );
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Simulation Banner - Mandatory Non-dismissible Header */}
      <SimulationBanner />

      <main className="app-container">
        {/* Header Bar */}
        <header className="app-header">
          <div>
            <h1 className="brand-title">
              <span>🩺</span> {t('app.title')}
            </h1>
            <p className="brand-subtitle">{t('app.subtitle')} — ITDA Paderu</p>
          </div>
          <div className="header-controls">
            <OfflineStatusIndicator
              onlineLabel={t('app.onlineNotice')}
              offlineLabel={t('app.offlineNotice')}
            />
            <LanguageSwitcher currentLang={lang} onSelect={setLang} />
          </div>
        </header>

        {/* System Diagnostics & Backend Status */}
        <section className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">System Infrastructure Status</h2>
              <span className="badge badge-mock">Simulation Mode</span>
            </div>

            {healthLoading ? (
              <LoadingView message="Verifying backend replica set and scheduler..." />
            ) : healthError ? (
              <ErrorView message={`Failed to connect to backend: ${healthError}`} onRetry={fetchHealth} />
            ) : systemHealth ? (
              <div style={{ fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>MongoDB Replica Set:</span>
                  <span style={{ color: systemHealth.database.isReplicaSet ? 'var(--color-status-success)' : 'var(--color-status-warning)', fontWeight: 700 }}>
                    {systemHealth.database.isReplicaSet ? `Connected (${systemHealth.database.setName})` : 'Standalone (No Replica)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>ACID Transactions:</span>
                  <span style={{ color: systemHealth.database.supportsTransactions ? 'var(--color-status-success)' : 'var(--color-status-danger)', fontWeight: 700 }}>
                    {systemHealth.database.supportsTransactions ? 'Verified Supported' : 'Unsupported'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Agenda Scheduler:</span>
                  <span style={{ color: systemHealth.scheduler.running ? 'var(--color-status-success)' : 'var(--color-status-danger)', fontWeight: 700 }}>
                    {systemHealth.scheduler.running ? 'Active (Direct Mongo)' : 'Offline'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Response Envelope:</span>
                  <span style={{ color: 'var(--color-status-success)', fontWeight: 700 }}>
                    Strict {'{ success, data, error, meta }'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Log Redaction:</span>
                  <span style={{ color: 'var(--color-status-success)', fontWeight: 700 }}>
                    Pino PHI & Secrets Redaction
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Clinical Simulation Boundaries */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Simulation Boundaries & Adapters</h2>
              <span className="badge badge-mock">DEMO ADAPTERS</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
              All external services are simulated with transparent adapters:
            </p>
            <ul style={{ listStyle: 'none', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Aadhaar Verification:</span>
                <span className="badge badge-mock">MOCK ADAPTER</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>AI Screening Classifier:</span>
                <span className="badge badge-mock">DEMO AI</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>SMS / WhatsApp Notifications:</span>
                <span className="badge badge-mock">MOCK GATEWAY</span>
              </li>
              <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tele-Consultation Video/Audio:</span>
                <span className="badge badge-mock">MOCK WEBRTC</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Screening Simulation Form (ASHA / ANM Workflow) */}
        <section className="card" style={{ marginBottom: '28px' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">{t('screening.title')}</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-status-warning)', marginTop: '2px' }}>
                {t('screening.simulationDisclaimer')}
              </p>
            </div>
            <span className="badge badge-mock">Field Simulation</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <div>
              <div className="form-group">
                <label className="form-label">{t('screening.patientId')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={patientDemoId}
                  onChange={(e) => setPatientDemoId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t('screening.habits.tobacco')}</label>
                <select
                  className="form-select"
                  value={tobaccoHabit ? 'yes' : 'no'}
                  onChange={(e) => setTobaccoHabit(e.target.value === 'yes')}
                >
                  <option value="yes">Yes (Daily Khaini / Gutkha / Chutta)</option>
                  <option value="no">No Habit Reported</option>
                </select>
              </div>

              {tobaccoHabit && (
                <div className="form-group">
                  <label className="form-label">{t('screening.habits.durationYears')}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={durationYears}
                    onChange={(e) => setDurationYears(Number(e.target.value))}
                    min={0}
                    max={60}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{t('screening.visualInspection.lesionPresent')}</label>
                <select
                  className="form-select"
                  value={lesionObserved ? 'yes' : 'no'}
                  onChange={(e) => setLesionObserved(e.target.value === 'yes')}
                >
                  <option value="yes">Yes (Visible mucosal lesion / patch observed)</option>
                  <option value="no">No abnormality observed</option>
                </select>
              </div>

              {lesionObserved && (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('screening.visualInspection.lesionType')}</label>
                    <select
                      className="form-select"
                      value={lesionType}
                      onChange={(e) => setLesionType(e.target.value)}
                    >
                      <option value="whitePatch">{t('screening.visualInspection.whitePatch')}</option>
                      <option value="redPatch">{t('screening.visualInspection.redPatch')}</option>
                      <option value="ulcer">{t('screening.visualInspection.ulcer')}</option>
                      <option value="submucousFibrosis">{t('screening.visualInspection.submucousFibrosis')}</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t('screening.visualInspection.site')}</label>
                    <select
                      className="form-select"
                      value={anatomicalSite}
                      onChange={(e) => setAnatomicalSite(e.target.value)}
                    >
                      <option value="buccalMucosa">{t('screening.visualInspection.buccalMucosa')}</option>
                      <option value="tongue">{t('screening.visualInspection.tongue')}</option>
                      <option value="palate">{t('screening.visualInspection.palate')}</option>
                      <option value="lip">{t('screening.visualInspection.lip')}</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Oral Photo Capture & Demo AI Assessment */}
            <div>
              <div className="form-group">
                <label className="form-label">{t('screening.actions.capturePhoto')}</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="form-input"
                  onChange={handlePhotoSelect}
                />
              </div>

              {photoPreview ? (
                <div className="preview-container">
                  <img src={photoPreview} alt="Demo oral screening preview" className="preview-img" />
                  <span className="preview-watermark">⚠️ DEMO CLINICAL PHOTO</span>
                </div>
              ) : (
                <div
                  style={{
                    height: '180px',
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.85rem',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '2rem', marginBottom: '8px' }}>📸</span>
                  <span>No oral cavity photo attached yet. Upload demo image or submit survey without photo.</span>
                </div>
              )}

              {/* Demo AI Assessment Result Card */}
              <div className={`risk-card ${riskTier.class}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{t('screening.riskTier.title')}</strong>
                  <span className="badge badge-mock">DEMO AI</span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>{riskTier.label}</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                  {t('screening.riskTier.reviewNotice')}
                </p>
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {submitSuccess && (
            <div style={{ marginTop: '16px' }}>
              <SuccessView message={submitSuccess} onDismiss={() => setSubmitSuccess(null)} />
            </div>
          )}
          {submitError && (
            <div style={{ marginTop: '16px' }}>
              <ErrorView message={submitError} onRetry={() => setSubmitError(null)} />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitOnline}
              disabled={submitting}
            >
              {submitting ? t('screening.actions.syncing') : `${t('screening.actions.submitScreening')} (Authorized Storage)`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleSaveOffline}
            >
              {t('screening.actions.saveDraft')}
            </button>
          </div>
        </section>

        {/* UI State Demonstrator (Loading, Empty, Error, Success) */}
        <section className="card" style={{ marginBottom: '28px' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">UI State Handling Verification</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Demonstration of required states: Loading, Empty, Error, and Success
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-secondary ${demoState === 'normal' ? 'btn-primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setDemoState('normal')}
              >
                Normal
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${demoState === 'loading' ? 'btn-primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setDemoState('loading')}
              >
                Loading
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${demoState === 'empty' ? 'btn-primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setDemoState('empty')}
              >
                Empty
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${demoState === 'error' ? 'btn-primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setDemoState('error')}
              >
                Error
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${demoState === 'success' ? 'btn-primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={() => setDemoState('success')}
              >
                Success
              </button>
            </div>
          </div>

          <div>
            {demoState === 'normal' && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '12px 0' }}>
                All views and screening lists handle asynchronous state transitions. Select any button above to preview state rendering.
              </p>
            )}
            {demoState === 'loading' && <LoadingView message={t('states.loading')} />}
            {demoState === 'empty' && (
              <EmptyView
                title={t('states.empty')}
                description="No screening referrals queued in this primary health centre sector."
                actionLabel="Create New Screening"
                onAction={() => setDemoState('normal')}
              />
            )}
            {demoState === 'error' && (
              <ErrorView
                title="Simulation Network Interruption"
                message={t('states.error')}
                onRetry={() => setDemoState('normal')}
              />
            )}
            {demoState === 'success' && (
              <SuccessView
                title="Operation Completed"
                message={t('states.success')}
                onDismiss={() => setDemoState('normal')}
              />
            )}
          </div>
        </section>

        {/* Footer */}
        <footer style={{ textAlign: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '20px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
          <p>
            Aarogya Drishti Simulation System — AAROHAN Inter-Centre Hackathon 2026 (ITDA Paderu).
          </p>
          <p style={{ marginTop: '4px', color: 'var(--color-status-warning)' }}>
            ⚠️ Strict Clinical Safety Notice: Screening support only. Preliminary risk observation. Never provides clinical diagnosis.
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;
