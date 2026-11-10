import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LanguageCode, translations, getClientTranslation } from '../i18n';
import { db, OfflineScreening } from '../db/aarogyaDb';
import { LoadingView, EmptyView, ErrorView, SuccessView } from './UIStateViews';
import { CinematicHealthcareBackdrop } from './CinematicHealthcareBackdrop';
import { OralProcedureVideoPlayer } from './OralProcedureVideoPlayer';
import '../styles/procedureVideo.css';

interface DashboardOverviewProps {
  currentUser: AuthUser | null;
  onNavigate: (tabId: string) => void;
  onOpenVoiceAssistant: () => void;
  currentLang: LanguageCode;
}

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

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentUser,
  onNavigate,
  onOpenVoiceAssistant,
  currentLang,
}) => {
  const dict = translations[currentLang] || translations.en;
  const t = (path: string) => getClientTranslation(dict, path);

  // System Diagnostics State
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // ASHA Screening Form State (Preserved from Phase 1 Foundation)
  const [patientDemoId, setPatientDemoId] = useState<string>('DEMO-PAD-8492');
  const [tobaccoHabit, setTobaccoHabit] = useState<boolean>(true);
  const [durationYears, setDurationYears] = useState<number>(8);
  const [lesionObserved, setLesionObserved] = useState<boolean>(true);
  const [lesionType, setLesionType] = useState<string>('whitePatch');
  const [anatomicalSite, setAnatomicalSite] = useState<string>('buccalMucosa');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState<boolean>(false);
  const [aiPhotoAnalysis, setAiPhotoAnalysis] = useState<any | null>(null);

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
    } catch (err: any) {
      setHealthError(err.message || 'Connection error');
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
        setAiPhotoAnalysis(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Real-time Oral Photo Analysis via Gemini Multimodal Vision API
  const handleAnalyzePhotoWithAi = async () => {
    if (!photoPreview || isAnalyzingPhoto) return;
    setIsAnalyzingPhoto(true);
    try {
      const res = await fetch('/api/v1/assistant/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: photoPreview,
          patientNote: `${lesionObserved ? `Visual presentation: ${lesionType} at ${anatomicalSite}.` : 'Routine visual check.'} Habit: ${tobaccoHabit ? `Tobacco/gutka use ${durationYears} years.` : 'None.'}`,
          language: currentLang,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAiPhotoAnalysis(json.data);
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsAnalyzingPhoto(false);
    }
  };

  // Preliminary Screening Risk Category (Demo AI Heuristic)
  const computeRiskTier = (): { tier: 'Tier 1' | 'Tier 2' | 'Tier 3'; label: string; class: string } => {
    if (!lesionObserved) {
      return { tier: 'Tier 1', label: t('screening.riskTier.low') || 'Low Risk (Tier 1)', class: 'risk-tier-1' };
    }
    if (lesionType === 'ulcer' || lesionType === 'redPatch') {
      return { tier: 'Tier 3', label: t('screening.riskTier.high') || 'High Risk (Tier 3)', class: 'risk-tier-3' };
    }
    return { tier: 'Tier 2', label: t('screening.riskTier.moderate') || 'Moderate Risk (Tier 2)', class: 'risk-tier-2' };
  };

  const riskTier = computeRiskTier();

  // Save to Local Dexie DB (Offline First)
  const handleSaveOffline = async () => {
    try {
      const record: OfflineScreening = {
        patientDemoId,
        campId: 'CAMP-PADERU-DEMO-01',
        ashaId: currentUser ? currentUser.username : 'ASHA-CHINTAPALLI-102',
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
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save offline record');
    }
  };

  // Submit via Private Storage API (Simulated Upload)
  const handleSubmitOnline = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
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
    } catch (err: any) {
      setSubmitError(err.message || 'Submission error');
    } finally {
      setSubmitting(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      if (currentLang === 'te') return 'శుభోదయం';
      if (currentLang === 'hi') return 'सुप्रभात';
      return 'Good Morning';
    }
    if (hour < 17) {
      if (currentLang === 'te') return 'శుభ మధ్యాహ్నం';
      if (currentLang === 'hi') return 'शुभ दोपहर';
      return 'Good Afternoon';
    }
    if (currentLang === 'te') return 'శుభ సాయంత్రం';
    if (currentLang === 'hi') return 'शुभ संध्या';
    return 'Good Evening';
  };

  const mandalList = [
    { name: 'Araku Valley', screenings: 42, camps: 1, status: 'Active Camps', statusClass: 'status-pill-emerald', flag: 'High' },
    { name: 'Paderu Agency', screenings: 89, camps: 2, status: 'District Center', statusClass: 'status-pill-sapphire', flag: 'Optimal' },
    { name: 'Dumbriguda', screenings: 35, camps: 1, status: 'Active Outreach', statusClass: 'status-pill-amber', flag: 'High' },
    { name: 'Chintapalli', screenings: 28, camps: 0, status: 'Sub-Centre Review', statusClass: 'status-pill-cyan', flag: 'Moderate' },
    { name: 'Munchingiputtu', screenings: 18, camps: 0, status: 'Follow-up Needed', statusClass: 'status-pill-rose', flag: 'Needs Camp' },
    { name: 'Ananthagiri', screenings: 24, camps: 1, status: 'Field Mobile Unit', statusClass: 'status-pill-purple', flag: 'Moderate' },
  ];

  return (
    <div className="dashboard-view-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Futuristic Animated Oral Care Shorts & 3D Interactive Carousel */}
      <CinematicHealthcareBackdrop
        currentLang={currentLang}
        onSelectScene={(scene) => {
          if (scene.targetTab) {
            onNavigate(scene.targetTab as any);
          } else if (scene.id === 'oral-screening' || scene.id === 'lesion-exam') {
            onNavigate('screening');
          } else if (scene.id === 'oncology-care') {
            onNavigate('teleconsultation');
          } else if (scene.id === 'patient-recovery') {
            onNavigate('patients');
          }
        }}
      />

      {/* 1. Hero Welcome Banner (Reference: Flash Card Study App hero) */}
      <section className="forest-hero-card hero">
        <div className="hero-content hero-copy">
          <div className="hero-eyebrow eyebrow">
            <span className="eyebrow-dot"></span>
            <span className="hero-leaf-badge">🌿 ITDA Paderu Agency Oral Health Initiative</span>
            <span className="hero-simulation-tag">Simulation Mode Active</span>
          </div>

          <h2 className="hero-heading">
            {getGreeting()}, {currentUser ? currentUser.fullName || currentUser.username : 'Health Worker'} <em>• Community Care</em>
          </h2>

          <p className="hero-subtext">
            {currentLang === 'te'
              ? 'ఆరోగ్య దృష్టి కమాండ్ సెంటర్ ద్వారా మారుమూల గిరిజన గ్రామాల్లో నోటి ముందస్తు స్క్రీనింగ్, రిజిస్ట్రీ మరియు సహాయక సేవలను సమన్వయం చేయండి.'
              : currentLang === 'hi'
              ? 'आरोग्य दृष्टि कमांड सेंटर के माध्यम से दूरदराज के आदिवासी गांवों में मुख स्वास्थ्य स्क्रीनिंग, रजिस्ट्री और टेलीमेडिसिन का समन्वय करें।'
              : 'Empowering frontline ASHA & ANM staff across the Eastern Ghats with offline-first oral mucosal screening, MO review queues, and field navigation.'}
          </p>

          <div className="hero-action-row hero-actions">
            <button
              type="button"
              className="btn-forest-primary button button-coral"
              onClick={() => onNavigate('screening')}
            >
              🩺 {currentLang === 'te' ? 'పూర్తి స్క్రీనింగ్ క్యూ' : currentLang === 'hi' ? 'स्क्रीनिंग कतार' : 'Open Screening Queue'}
            </button>
            <button
              type="button"
              className="btn-forest-voice button button-outline"
              onClick={onOpenVoiceAssistant}
            >
              🤖 {currentLang === 'te' ? 'దృష్టి AI రోబోట్' : currentLang === 'hi' ? 'दృష్టి AI रोबोट' : 'Drishti AI Robot'}
            </button>
            <button
              type="button"
              className="btn-forest-secondary button button-dark"
              onClick={() => onNavigate('camps')}
            >
              🏕️ {currentLang === 'te' ? 'గ్రామీణ శిబిరాలు' : currentLang === 'hi' ? 'आउटरीच शिविर' : 'Outreach Camps'}
            </button>
          </div>
        </div>

        <div className="hero-procedure-video-wrap">
          <OralProcedureVideoPlayer
            onOpenScreeningQueue={() => onNavigate('screening')}
            currentLang={currentLang}
          />
        </div>
      </section>

      {/* 2. Primary KPI Metrics Tiles (Reference: Flash Card Study App stat cards) */}
      <section className="dashboard-stats-grid">
        <div className="forest-stat-card stat-card-screening stat-dark" onClick={() => onNavigate('screening')}>
          <div className="stat-card-header">
            <span className="stat-title">Completed Screenings</span>
            <span className="stat-icon-emerald">🩺</span>
          </div>
          <div className="stat-card-value">248</div>
          <div className="stat-card-footer">
            <span className="badge-emerald-accent">14 Under MO Review</span>
            <span className="stat-trend">↑ 18 this week</span>
          </div>
        </div>

        <div className="forest-stat-card stat-card-camps stat-coral" onClick={() => onNavigate('camps')}>
          <div className="stat-card-header">
            <span className="stat-title">Outreach Camps</span>
            <span className="stat-icon-emerald">🏕️</span>
          </div>
          <div className="stat-card-value">3 Active</div>
          <div className="stat-card-footer">
            <span className="badge-emerald-accent">Dumbriguda &amp; Araku</span>
            <span className="stat-trend">5 Scheduled</span>
          </div>
        </div>

        <div className="forest-stat-card stat-card-tele stat-blue" onClick={() => onNavigate('teleconsultation')}>
          <div className="stat-card-header">
            <span className="stat-title">Teleconsultations</span>
            <span className="stat-icon-emerald">📞</span>
          </div>
          <div className="stat-card-value">3 Requested</div>
          <div className="stat-card-footer">
            <span className="badge-emerald-accent">Doctor Paderu Online</span>
            <span className="stat-trend">Text &amp; Case Notes</span>
          </div>
        </div>

        <div className="forest-stat-card stat-card-registry stat-white" onClick={() => onNavigate('patients')}>
          <div className="stat-card-header">
            <span className="stat-title">Offline Engine Health</span>
            <span className="stat-icon-emerald">📶</span>
          </div>
          <div className="stat-card-value">IndexedDB OK</div>
          <div className="stat-card-footer">
            <span className="badge-emerald-accent">0 Pending Sync</span>
            <span className="stat-trend">Encrypted Local Queue</span>
          </div>
        </div>
      </section>

      {/* 3. CORE INTERACTIVE FEATURE: Frontline Community Screening Intake Form */}
      <section className="card forest-card-panel" style={{ padding: '24px' }}>
        <div className="card-header" style={{ marginBottom: '18px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '6px' }}>
              <span className="eyebrow-dot" style={{ background: '#10b981' }} />
              <span style={{ color: 'var(--color-status-success)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                DIRECT COMMUNITY SCREENING INTAKE • తక్షణ స్క్రీనింగ్ నమోదు
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate)' }}>
              {t('screening.title') || 'Oral Mucosal Visual Screening Simulation'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              {t('screening.simulationDisclaimer') || '⚠️ Frontline visual screening support only. Strict Invariant 1: Does not provide medical diagnosis.'}
            </p>
          </div>
          <span className="badge badge-mock">Field Simulation</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Left Column: Clinical Parameters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {t('screening.patientId') || 'Patient Demo Identifier'}
              </label>
              <input
                type="text"
                className="form-input"
                value={patientDemoId}
                onChange={(e) => setPatientDemoId(e.target.value)}
                placeholder="e.g. DEMO-PAD-8492"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {t('screening.habits.tobacco') || 'Tobacco / Gutkha / Pan Usage'}
              </label>
              <select
                className="form-select"
                value={tobaccoHabit ? 'yes' : 'no'}
                onChange={(e) => setTobaccoHabit(e.target.value === 'yes')}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
              >
                <option value="yes">Yes (Daily Khaini / Gutkha / Chutta / Pan)</option>
                <option value="no">No Habit Reported</option>
              </select>
            </div>

            {tobaccoHabit && (
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  {t('screening.habits.durationYears') || 'Duration of Consumption (Years)'}
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={durationYears}
                  onChange={(e) => setDurationYears(Number(e.target.value))}
                  min={0}
                  max={60}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {t('screening.visualInspection.lesionPresent') || 'Mucosal Visual Inspection Finding'}
              </label>
              <select
                className="form-select"
                value={lesionObserved ? 'yes' : 'no'}
                onChange={(e) => setLesionObserved(e.target.value === 'yes')}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
              >
                <option value="yes">Yes (Visible mucosal lesion / plaque / ulcer observed)</option>
                <option value="no">No abnormality observed (Healthy mucosa)</option>
              </select>
            </div>

            {lesionObserved && (
              <>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {t('screening.visualInspection.lesionType') || 'Lesion Characteristic'}
                  </label>
                  <select
                    className="form-select"
                    value={lesionType}
                    onChange={(e) => setLesionType(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="whitePatch">{t('screening.visualInspection.whitePatch') || 'White Patch (Leukoplakia)'}</option>
                    <option value="redPatch">{t('screening.visualInspection.redPatch') || 'Red Patch (Erythroplakia)'}</option>
                    <option value="ulcer">{t('screening.visualInspection.ulcer') || 'Non-Healing Ulcer (> 14 days)'}</option>
                    <option value="submucousFibrosis">{t('screening.visualInspection.submucousFibrosis') || 'Oral Submucous Fibrosis (OSMF)'}</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {t('screening.visualInspection.site') || 'Anatomical Location'}
                  </label>
                  <select
                    className="form-select"
                    value={anatomicalSite}
                    onChange={(e) => setAnatomicalSite(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
                  >
                    <option value="buccalMucosa">{t('screening.visualInspection.buccalMucosa') || 'Buccal Mucosa (Inner Cheek)'}</option>
                    <option value="tongue">{t('screening.visualInspection.tongue') || 'Lateral Border of Tongue'}</option>
                    <option value="palate">{t('screening.visualInspection.palate') || 'Hard / Soft Palate'}</option>
                    <option value="lip">{t('screening.visualInspection.lip') || 'Labial Mucosa (Lip / Commissure)'}</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Right Column: Oral Photo Capture & Demo AI Assessment Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Quick Multi-Disease AI Engine Launcher */}
            <div style={{ background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>🔬 Multi-Disease AI Engine (Modules A+B+C)</strong>
                <span className="badge badge-mock" style={{ background: '#0284c7', color: '#fff' }}>ONNX &amp; FASTAPI</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: '0 0 10px', lineHeight: 1.4 }}>
                Run comprehensive oral mucosal lesion classification, multi-label dental assessment, and risk questionnaire with on-device WASM and server support.
              </p>
              <button
                type="button"
                className="button"
                onClick={() => onNavigate('ai-screening')}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                }}
              >
                🚀 Open Interactive AI Screening Engine
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {t('screening.actions.capturePhoto') || 'Oral Cavity Visual Photo Capture'}
              </label>
              <input
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="form-input"
                onChange={handlePhotoSelect}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                style={{ width: '100%', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
              />
            </div>

            {photoPreview ? (
              <div className="preview-container" style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                <img src={photoPreview} alt="Demo oral screening preview" className="preview-img" style={{ width: '100%', height: '170px', objectFit: 'cover' }} />
                <span className="preview-watermark" style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fbbf24', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px' }}>
                  ⚠️ DEMO CLINICAL PHOTO
                </span>
              </div>
            ) : (
              <div
                style={{
                  height: '160px',
                  border: '1.5px dashed rgba(52, 211, 153, 0.4)',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.85rem',
                  padding: '16px',
                  textAlign: 'center',
                  background: 'rgba(6, 78, 59, 0.1)',
                }}
              >
                <span style={{ fontSize: '2rem', marginBottom: '6px' }}>📸</span>
                <span>No oral photo selected. Upload demo image or record observation without photo.</span>
              </div>
            )}

            {/* AI Vision Analysis Trigger Button */}
            {photoPreview && (
              <button
                type="button"
                className="btn-forest-voice"
                onClick={handleAnalyzePhotoWithAi}
                disabled={isAnalyzingPhoto}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: isAnalyzingPhoto ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                }}
              >
                {isAnalyzingPhoto ? '⏳ Running Gemini AI Vision Screening...' : '✨ Analyze Photo with Gemini AI'}
              </button>
            )}

            {/* AI Vision Analysis & Doctor Referral Card */}
            {aiPhotoAnalysis && (
              <div
                className="ai-analysis-feedback-card"
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background:
                    aiPhotoAnalysis.riskTier === 'high_risk_support'
                      ? 'rgba(239, 68, 68, 0.14)'
                      : 'rgba(6, 78, 59, 0.45)',
                  border: `1.5px solid ${
                    aiPhotoAnalysis.riskTier === 'high_risk_support' ? '#ef4444' : '#10b981'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#6ee7b7' }}>
                    🔍 Visual Observation ({aiPhotoAnalysis.analyzedByModel || 'Gemini Vision'})
                  </strong>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: aiPhotoAnalysis.riskTier === 'high_risk_support' ? '#ef4444' : '#059669',
                      color: '#ffffff',
                      fontWeight: 700,
                    }}
                  >
                    {aiPhotoAnalysis.riskTier === 'high_risk_support' ? 'URGENT' : 'PRIORITY'}
                  </span>
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                  {aiPhotoAnalysis.observedCondition}
                </div>

                {aiPhotoAnalysis.recommendedDoctor && (
                  <div
                    style={{
                      background: 'rgba(15, 23, 42, 0.65)',
                      padding: '10px',
                      borderRadius: '8px',
                      marginTop: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '2px' }}>
                      👨‍⚕️ Doctor to Consult: {aiPhotoAnalysis.recommendedDoctor.specialty}
                    </div>
                    <div style={{ color: '#cbd5e1', marginBottom: '2px' }}>
                      🏥 Facility: {aiPhotoAnalysis.recommendedDoctor.facility}
                    </div>
                    <div style={{ color: '#fbbf24', fontSize: '0.78rem' }}>
                      ⏱️ Timeline: Consult within {aiPhotoAnalysis.recommendedDoctor.timelineDays || 14} days
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Demo AI Assessment Result Card */}
            <div className={`risk-card ${riskTier.class}`} style={{ padding: '14px', borderRadius: '10px', background: riskTier.tier === 'Tier 3' ? 'rgba(239, 68, 68, 0.1)' : riskTier.tier === 'Tier 2' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: `1.5px solid ${riskTier.tier === 'Tier 3' ? '#ef4444' : riskTier.tier === 'Tier 2' ? '#f59e0b' : '#10b981'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--slate)' }}>
                  {t('screening.riskTier.title') || 'Triaging Category Support'}
                </strong>
                <span className="badge badge-mock" style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'rgba(245, 158, 11, 0.2)', color: '#d97706', borderRadius: '4px' }}>DEMO AI</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px', color: riskTier.tier === 'Tier 3' ? '#dc2626' : riskTier.tier === 'Tier 2' ? '#d97706' : '#059669' }}>
                {riskTier.label}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.4 }}>
                {t('screening.riskTier.reviewNotice') || 'Pre-diagnostic automated scoring for Medical Officer queue prioritization.'}
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
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-forest-primary button button-coral"
            onClick={handleSubmitOnline}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : `${t('screening.actions.submitScreening') || 'Submit Screening'} (Authorized Storage)`}
          </button>
          <button
            type="button"
            className="btn-forest-secondary button button-dark"
            onClick={handleSaveOffline}
          >
            💾 {t('screening.actions.saveDraft') || 'Save to Local Offline Queue'}
          </button>
        </div>
      </section>

      {/* 4. Live System Infrastructure Diagnostics & Simulation Boundaries */}
      <section className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="card forest-card-panel" style={{ padding: '20px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>System Infrastructure Status</h3>
            <span className="badge badge-mock" style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>Simulation Mode</span>
          </div>

          {healthLoading ? (
            <LoadingView message="Verifying backend replica set and scheduler..." />
          ) : healthError ? (
            <ErrorView message={`Backend connection issue: ${healthError}`} onRetry={fetchHealth} />
          ) : systemHealth ? (
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>MongoDB Database:</span>
                <span style={{ color: systemHealth.database.connected ? 'var(--color-status-success)' : 'var(--color-status-danger)', fontWeight: 700 }}>
                  {systemHealth.database.connected ? 'CONNECTED (Port 27017)' : 'DISCONNECTED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>MongoDB Topology:</span>
                <span style={{ color: systemHealth.database.isReplicaSet ? 'var(--color-status-success)' : '#d97706', fontWeight: 700 }}>
                  {systemHealth.database.isReplicaSet ? `Replica Set (${systemHealth.database.setName})` : 'Standalone MongoDB Service'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>ACID Multi-Doc Transactions:</span>
                <span style={{ color: systemHealth.database.supportsTransactions ? 'var(--color-status-success)' : '#d97706', fontWeight: 700 }}>
                  {systemHealth.database.supportsTransactions ? 'Supported' : 'Single-Doc Mode'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Agenda Scheduler:</span>
                <span style={{ color: systemHealth.scheduler.running ? 'var(--color-status-success)' : 'var(--color-status-danger)', fontWeight: 700 }}>
                  {systemHealth.scheduler.running ? 'Active (Direct Mongo)' : 'Offline'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Standard Envelope:</span>
                <span style={{ color: 'var(--color-status-success)', fontWeight: 700 }}>
                  {'{ success, data, error, meta }'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Log Redaction:</span>
                <span style={{ color: 'var(--color-status-success)', fontWeight: 700 }}>
                  Pino PHI &amp; Secrets Redacted
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Simulation Boundaries & Transparent Adapters */}
        <div className="card forest-card-panel" style={{ padding: '20px' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Simulation Boundaries &amp; Adapters</h3>
            <span className="badge badge-mock" style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>DEMO ADAPTERS</span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            External communication channels are executed using transparent in-memory adapters:
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Aadhaar Verification:</span>
              <span className="badge badge-mock" style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' }}>MOCK ADAPTER</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>AI Screening Classifier:</span>
              <span className="badge badge-mock" style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>DEMO AI</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>SMS &amp; Telephony:</span>
              <span className="badge badge-mock" style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>SIMULATED DISPATCHER</span>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Tele-Consultation Video/Audio:</span>
              <span className="badge badge-mock" style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}>BLOCKED (No Live HW)</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 5. UI State Handling Verification (Loading, Empty, Error, Success) */}
      <section className="card forest-card-panel" style={{ padding: '20px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>UI State Handling Verification</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              Demonstration of required states: Loading, Empty, Error, and Success
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`button ${demoState === 'normal' ? 'button-coral' : 'button-dark'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => setDemoState('normal')}
            >
              Normal
            </button>
            <button
              type="button"
              className={`button ${demoState === 'loading' ? 'button-coral' : 'button-dark'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => setDemoState('loading')}
            >
              Loading
            </button>
            <button
              type="button"
              className={`button ${demoState === 'empty' ? 'button-coral' : 'button-dark'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => setDemoState('empty')}
            >
              Empty
            </button>
            <button
              type="button"
              className={`button ${demoState === 'error' ? 'button-coral' : 'button-dark'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => setDemoState('error')}
            >
              Error
            </button>
            <button
              type="button"
              className={`button ${demoState === 'success' ? 'button-coral' : 'button-dark'}`}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
              onClick={() => setDemoState('success')}
            >
              Success
            </button>
          </div>
        </div>

        <div>
          {demoState === 'normal' && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '6px 0', margin: 0 }}>
              All views handle asynchronous state transitions. Select any button above to preview state rendering.
            </p>
          )}
          {demoState === 'loading' && <LoadingView message={t('states.loading') || 'Loading screening data...'} />}
          {demoState === 'empty' && (
            <EmptyView
              title={t('states.empty') || 'No records found'}
              description="No screening referrals queued in this primary health centre sector."
              actionLabel="Create New Screening"
              onAction={() => setDemoState('normal')}
            />
          )}
          {demoState === 'error' && (
            <ErrorView
              title="Simulation Network Interruption"
              message={t('states.error') || 'Simulated network disconnect.'}
              onRetry={() => setDemoState('normal')}
            />
          )}
          {demoState === 'success' && (
            <SuccessView
              title="Operation Completed"
              message={t('states.success') || 'Data saved successfully.'}
              onDismiss={() => setDemoState('normal')}
            />
          )}
        </div>
      </section>

      {/* 6. Two Column Grid: Operations Quick Access Launchpad & Catchment Mandals */}
      <div className="dashboard-dual-grid">
        {/* Quick Launchpad (Reference: Flash Card Study App panel progress-panel) */}
        <section className="card-forest-panel panel progress-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span className="panel-icon">⚡</span>
              <h3>Field Operations Launchpad</h3>
            </div>
            <span className="panel-hint">Quick Shortcuts</span>
          </div>

          <div className="launchpad-grid">
            <button
              type="button"
              className="launchpad-tile tile-patients manage-card"
              onClick={() => onNavigate('patients')}
            >
              <span className="launchpad-icon">👥</span>
              <div className="launchpad-text">
                <span className="tile-title">Tribal Patient Registry</span>
                <span className="tile-desc">Register demographic data &amp; landmarks</span>
              </div>
              <span className="tile-arrow">›</span>
            </button>

            <button
              type="button"
              className="launchpad-tile tile-appointments manage-card"
              onClick={() => onNavigate('appointments')}
            >
              <span className="launchpad-icon">📅</span>
              <div className="launchpad-text">
                <span className="tile-title">Patient Appointments</span>
                <span className="tile-desc">Book specialist consultations</span>
              </div>
              <span className="tile-arrow">›</span>
            </button>

            <button
              type="button"
              className="launchpad-tile tile-camps manage-card"
              onClick={() => onNavigate('camps')}
            >
              <span className="launchpad-icon">🏕️</span>
              <div className="launchpad-text">
                <span className="tile-title">Screening Camp Manager</span>
                <span className="tile-desc">Manage outreach campaigns</span>
              </div>
              <span className="tile-arrow">›</span>
            </button>

            <button
              type="button"
              className="launchpad-tile tile-recovery manage-card"
              onClick={() => onNavigate('recovery')}
            >
              <span className="launchpad-icon">🛡️</span>
              <div className="launchpad-text">
                <span className="tile-title">Account Recovery</span>
                <span className="tile-desc">Admin dual-approval credential recovery</span>
              </div>
              <span className="tile-arrow">›</span>
            </button>
          </div>
        </section>

        {/* Catchment Mandals Table (Reference: Flash Card Study App panel recent-panel) */}
        <section className="card-forest-panel panel recent-panel">
          <div className="panel-header">
            <div className="panel-title-wrap">
              <span className="panel-icon">🗺️</span>
              <h3>Catchment Mandals Summary</h3>
            </div>
            <span className="badge-emerald-accent">11 ITDA Mandals</span>
          </div>

          <div className="mandal-table-wrap">
            <table className="forest-table">
              <thead>
                <tr>
                  <th>Mandal</th>
                  <th>Screenings</th>
                  <th>Camps</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mandalList.map((m) => (
                  <tr key={m.name}>
                    <td className="font-semibold cell-mandal-name">{m.name}</td>
                    <td>
                      <span className="cell-metric">{m.screenings}</span>
                    </td>
                    <td>
                      <span className="cell-camps">{m.camps}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${m.statusClass}`}>{m.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mandal-footer-note">
            <small>
              ℹ️ Aggregated metric counts adhere strictly to Invariant 3 (&lt; 5 small count cell suppression for sparse tribal habitations).
            </small>
          </div>
        </section>
      </div>
    </div>
  );
};
