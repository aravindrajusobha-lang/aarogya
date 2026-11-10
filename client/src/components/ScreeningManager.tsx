import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';
import { AiOralHealthEngine } from './AiEngine/AiOralHealthEngine';

interface ScreeningManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

interface ScreeningCase {
  caseId: string;
  patientId: string;
  patientName: string;
  villageId: string;
  villageName?: string;
  hospitalId: string;
  status:
    | 'pending_assignment'
    | 'assigned'
    | 'under_review'
    | 'escalated'
    | 'referral_requested'
    | 'completed';
  priority: 'routine' | 'urgent' | 'high_priority';
  photoIds: string[];
  demoAiResult?: {
    riskSupportLabel: string;
    confidenceScore: number;
    qualityChecks: {
      positioning: string;
      obstruction: string;
      missingArea: string;
    };
    disclaimer: string;
    simulationBanner: string;
  };
  assignedMoId?: string;
  assignedMoName?: string;
  assignedBy?: string;
  assignedAt?: string;
  clinicalAssessmentId?: string;
  resultReleaseId?: string;
  resultReleased: boolean;
  escalationDetails?: {
    escalatedBy: string;
    escalatedAt: string;
    escalationReason: string;
  };
  referralDetails?: {
    referredBy: string;
    referredAt: string;
    specialty: string;
    facilityName: string;
    referralNotes: string;
  };
  createdAt: string;
}

interface PhotoRecord {
  photoId: string;
  patientId: string;
  originalSha256: string;
  currentSha256: string;
  version: number;
  isDemo: boolean;
  amendmentHistory: Array<{
    version: number;
    sha256: string;
    amendedAt: string;
    amendmentReason: string;
  }>;
}

export const ScreeningManager: React.FC<ScreeningManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'intake' | 'queue' | 'patient_view' | 'ai_engine'>('queue');
  const [cases, setCases] = useState<ScreeningCase[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Intake / Upload State
  const [patientId, setPatientId] = useState<string>('PAT-DEMO-2026-001');
  const [patientName, setPatientName] = useState<string>('Parvati Devi');
  const [villageId, setVillageId] = useState<string>('VILLAGE_ARAKU_01');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'high_priority'>('routine');
  const [isDemoImage, setIsDemoImage] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadedPhoto, setUploadedPhoto] = useState<PhotoRecord | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);

  // Amendment State
  const [amendFile, setAmendFile] = useState<File | null>(null);
  const [amendReason, setAmendReason] = useState<string>('Enhanced focal resolution and lighting');
  const [amending, setAmending] = useState<boolean>(false);

  // AI Analysis State
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Queue Action Modals / State
  const [selectedCase, setSelectedCase] = useState<ScreeningCase | null>(null);
  const [assignMoId, setAssignMoId] = useState<string>('usr_mo_paderu_01');
  const [clinicalImpression, setClinicalImpression] = useState<string>(
    'Well-demarcated homogenous white plaque noted on buccal mucosa.'
  );
  const [riskCategorization, setRiskCategorization] = useState<
    'low_risk_support' | 'moderate_risk_support' | 'high_risk_support'
  >('moderate_risk_support');
  const [followUpDays, setFollowUpDays] = useState<number>(30);
  const [patientSummaryMsg, setPatientSummaryMsg] = useState<string>(
    'Oral visual screening completed. Follow routine oral hygiene and schedule a 30-day follow-up with your local health worker.'
  );
  const [recommendedAction, setRecommendedAction] = useState<string>(
    'Routine 30-day oral mucosa review at Primary Health Centre.'
  );
  const [escalateReason, setEscalateReason] = useState<string>('');
  const [referralSpecialty, setReferralSpecialty] = useState<string>('oral_maxillofacial_surgery');
  const [referralFacility, setReferralFacility] = useState<string>('District Hospital Paderu');
  const [referralNotes, setReferralNotes] = useState<string>('Teleconsultation and secondary review.');

  // Patient Results View State
  const [patientViewId, setPatientViewId] = useState<string>('PAT-DEMO-2026-001');
  const [patientResultsData, setPatientResultsData] = useState<any>(null);

  const fetchCases = async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/screening/cases', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success && json.data) {
        setCases(json.data.items || []);
      }
    } catch {
      // Ignore network errors in demo
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [accessToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPhoto = async () => {
    const effectiveToken = accessToken || localStorage.getItem('aarogya_token');
    if (!effectiveToken || !selectedFile) {
      if (!selectedFile) setMessage({ text: 'Please select a photo file to upload.', type: 'error' });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('photo', selectedFile);
      formData.append('patientId', patientId);
      formData.append('hospitalId', currentUser?.hospitalId || 'hosp_paderu_dh');
      formData.append('isDemo', isDemoImage ? 'true' : 'false');

      const res = await fetch('/api/v1/screening/photos/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${effectiveToken}` },
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.photo) {
        setUploadedPhoto(json.data.photo);
        setMessage({
          text: `Photo uploaded successfully! SHA-256: ${json.data.photo.originalSha256.slice(0, 16)}... (Version 1)`,
          type: 'success',
        });
      } else {
        setMessage({
          text: json.error?.message || 'Failed to upload photo. Check consent status.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleAmendPhoto = async () => {
    if (!accessToken || !uploadedPhoto || !amendFile) return;
    setAmending(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('photo', amendFile);
      formData.append('amendmentReason', amendReason);

      const res = await fetch(`/api/v1/screening/photos/${uploadedPhoto.photoId}/amend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = await res.json();
      if (json.success && json.data?.photo) {
        setUploadedPhoto(json.data.photo);
        setMessage({
          text: `Amendment successful! New Version: ${json.data.photo.version}. Original hash remained byte-identical: ${json.data.photo.originalSha256.slice(0, 16)}...`,
          type: 'success',
        });
        setAmendFile(null);
      } else {
        setMessage({ text: json.error?.message || 'Failed to amend photo', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setAmending(false);
    }
  };

  const handleRunAi = async () => {
    const effectiveToken = accessToken || localStorage.getItem('aarogya_token');
    if (!effectiveToken) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/v1/screening/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveToken}`,
        },
        body: JSON.stringify({
          photoId: uploadedPhoto?.photoId,
          photoSha256: uploadedPhoto?.currentSha256 || 'simulated_photo_hash',
          imageBase64: photoPreview || undefined,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAiResult(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateCase = async () => {
    if (!accessToken) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/v1/screening/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientId,
          patientName,
          villageId,
          hospitalId: currentUser?.hospitalId || 'hosp_paderu_dh',
          priority,
          photoIds: uploadedPhoto ? [uploadedPhoto.photoId] : [],
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.case) {
        setMessage({
          text: `Case ${json.data.case.caseId} successfully created and entered into the MO queue!`,
          type: 'success',
        });
        await fetchCases();
        setActiveSubTab('queue');
      } else {
        setMessage({ text: json.error?.message || 'Failed to create case', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignCase = async (caseId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/screening/cases/${caseId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ targetMoId: assignMoId }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: `Case assigned to Medical Officer (${assignMoId})!`, type: 'success' });
        await fetchCases();
      } else {
        setMessage({ text: json.error?.message || 'Assignment failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleRecordAssessment = async (caseId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/screening/cases/${caseId}/assess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clinicalImpression,
          riskCategorization,
          recommendedFollowUpDays: followUpDays,
          clinicalNotes: 'Preliminary frontline oral screening evaluation recorded.',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          text: 'Clinical assessment recorded as a separate entity! Results remain unreleased to patient.',
          type: 'success',
        });
        await fetchCases();
      } else {
        setMessage({ text: json.error?.message || 'Assessment failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleReleaseResult = async (caseId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/screening/cases/${caseId}/release-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientSummaryMessage: patientSummaryMsg,
          recommendedAction,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({
          text: 'Results officially released! Patient can now view the clinical summary.',
          type: 'success',
        });
        await fetchCases();
      } else {
        setMessage({ text: json.error?.message || 'Release failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleEscalateCase = async (caseId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/screening/cases/${caseId}/escalate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reason: escalateReason || 'Complex lesion requiring panel review' }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Case successfully escalated for secondary review!', type: 'success' });
        await fetchCases();
      } else {
        setMessage({ text: json.error?.message || 'Escalation failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleReferralCase = async (caseId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/screening/cases/${caseId}/referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          specialty: referralSpecialty,
          facilityName: referralFacility,
          referralNotes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'Specialist referral requested!', type: 'success' });
        await fetchCases();
      } else {
        setMessage({ text: json.error?.message || 'Referral failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleQueryPatientResults = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/screening/patient/${patientViewId}/results`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = await res.json();
      if (json.success) {
        setPatientResultsData(json.data);
      }
    } catch {
      // Ignore
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
              <span>CLINICAL SCREENING & DEMO AI • క్లినికల్ స్క్రీనింగ్</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px', color: 'var(--slate)' }}>
              Clinical Screening, Demo AI & MO Queue
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '820px', margin: 0, lineHeight: 1.5 }}>
              Frontline oral mucosal visual intake, cryptographic SHA-256 photo hashing, 
              <strong>DEMO AI</strong> screening assistance (strictly non-diagnostic), and verified Medical Officer triaging queue.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button-coral"
              onClick={() => setActiveSubTab('ai_engine')}
              style={{ fontSize: '0.85rem', background: '#0284c7', borderColor: '#0284c7' }}
            >
              🔬 AI Screening Engine
            </button>
            <button
              type="button"
              className="button-outline"
              onClick={fetchCases}
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Refresh Queue
            </button>
            <button
              type="button"
              className="button-coral"
              onClick={() => setActiveSubTab('intake')}
              style={{ fontSize: '0.85rem' }}
            >
              + New Patient Intake
            </button>
          </div>
        </div>
      </div>

      {!accessToken && (
        <LoginRequiredView
          moduleTitle="Clinical Screening & MO Review Queue"
          moduleDescription="Sign in with demo credentials to access verified screening submissions, run Demo AI risk support evaluations, and submit clinician assessments."
          onLoginAsAsha={onRequireLogin ? () => onRequireLogin('asha') : undefined}
          onLoginAsDoctor={onRequireLogin ? () => onRequireLogin('doctor') : undefined}
          onGoToAuth={onGoToAuth}
        />
      )}

      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor:
              message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${
              message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)'
            }`,
            color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            fontSize: '0.85rem',
          }}
        >
          {message.text}
        </div>
      )}

      {/* Sub Navigation Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${activeSubTab === 'queue' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.85rem' }}
          onClick={() => setActiveSubTab('queue')}
        >
          📋 MO Case Queue ({cases.length})
        </button>
        <button
          type="button"
          className={`btn ${activeSubTab === 'ai_engine' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.85rem', background: activeSubTab === 'ai_engine' ? '#0284c7' : undefined, borderColor: '#0284c7' }}
          onClick={() => setActiveSubTab('ai_engine')}
        >
          🔬 Multi-Disease AI Engine (Modules A+B+C)
        </button>
        <button
          type="button"
          className={`btn ${activeSubTab === 'intake' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.85rem' }}
          onClick={() => setActiveSubTab('intake')}
        >
          📷 Photo Upload &amp; Demo AI
        </button>
        <button
          type="button"
          className={`btn ${activeSubTab === 'patient_view' ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.85rem' }}
          onClick={() => {
            setActiveSubTab('patient_view');
            handleQueryPatientResults();
          }}
        >
          👤 Patient Released Results View
        </button>
      </div>

      {/* VIEW: MULTI-DISEASE AI ENGINE */}
      {activeSubTab === 'ai_engine' && (
        <AiOralHealthEngine
          patientId={patientId || 'DEMO-PAD-8492'}
          patientName={patientName || 'Parvati Devi'}
          hospitalId={currentUser?.hospitalId || 'hosp_paderu_dh'}
          userRole={currentUser?.role?.toLowerCase() || 'asha'}
          token={accessToken || ''}
          onClose={() => setActiveSubTab('queue')}
        />
      )}

      {/* VIEW 1: MO CASE QUEUE */}
      {activeSubTab === 'queue' && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Medical Officer Case Queue</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Cases assigned within hospital governance boundary. Clinical assessments and releases are separate entities.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
              onClick={fetchCases}
              disabled={loading}
            >
              🔄 Refresh Queue
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {cases.map((c) => (
              <div
                key={c.caseId}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{c.patientName}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>({c.patientId})</span>
                      <span className={`badge ${c.priority === 'urgent' ? 'badge-danger' : 'badge-real'}`}>
                        {c.priority}
                      </span>
                      <span className="badge badge-warning">{c.status.replace('_', ' ')}</span>
                      {c.resultReleased && (
                        <span className="badge badge-real" style={{ backgroundColor: '#10b981', color: '#fff' }}>
                          ✓ Result Released to Patient
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      Case: <code>{c.caseId}</code> | Hospital: <strong>{c.hospitalId}</strong> | Village: {c.villageId}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                    <div>MO: <strong>{c.assignedMoName || 'Unassigned'}</strong></div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>
                      Created: {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Demo AI analysis summary if present */}
                {c.demoAiResult && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.05)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>DEMO AI Risk Support:</span>
                      <span className="badge badge-real">{c.demoAiResult.riskSupportLabel}</span>
                    </div>
                    <div style={{ marginTop: '4px', color: 'var(--color-text-secondary)' }}>
                      Quality Checks: Positioning ({c.demoAiResult.qualityChecks.positioning}) | Obstruction ({c.demoAiResult.qualityChecks.obstruction}) | Missing Area ({c.demoAiResult.qualityChecks.missingArea})
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {c.status === 'pending_assignment' && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ width: '180px', height: '32px', fontSize: '0.8rem' }}
                        value={assignMoId}
                        onChange={(e) => setAssignMoId(e.target.value)}
                        placeholder="MO User ID"
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        onClick={() => handleAssignCase(c.caseId)}
                      >
                        Assign MO
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    onClick={() => setSelectedCase(selectedCase?.caseId === c.caseId ? null : c)}
                  >
                    {selectedCase?.caseId === c.caseId ? 'Close Review' : 'Review / Action'}
                  </button>
                </div>

                {/* Expanded Action Panel for Case */}
                {selectedCase?.caseId === c.caseId && (
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--color-bg)',
                      border: '1px solid var(--color-border)',
                      marginTop: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                    }}
                  >
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Clinician Governance Actions</h4>

                    {/* Section 1: Record Clinical Assessment */}
                    <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                        1. Record Clinical Assessment (Separate Entity - Withheld from Patient)
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Clinical Impression</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.8rem' }}
                          value={clinicalImpression}
                          onChange={(e) => setClinicalImpression(e.target.value)}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Risk Tier</label>
                          <select
                            className="form-select"
                            style={{ fontSize: '0.8rem' }}
                            value={riskCategorization}
                            onChange={(e) => setRiskCategorization(e.target.value as any)}
                          >
                            <option value="low_risk_support">Low Risk Support</option>
                            <option value="moderate_risk_support">Moderate Risk Support</option>
                            <option value="high_risk_support">High Risk Support</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Follow-up (Days)</label>
                          <input
                            type="number"
                            className="form-input"
                            style={{ fontSize: '0.8rem' }}
                            value={followUpDays}
                            onChange={(e) => setFollowUpDays(Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                        onClick={() => handleRecordAssessment(c.caseId)}
                      >
                        Save Assessment (Leave Unreleased)
                      </button>
                    </div>

                    {/* Section 2: Release Results to Patient */}
                    <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>
                        2. Officially Release Results to Patient (Separate Release Entity)
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Patient Summary Message</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.8rem' }}
                          value={patientSummaryMsg}
                          onChange={(e) => setPatientSummaryMsg(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Recommended Follow-up Action</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.8rem' }}
                          value={recommendedAction}
                          onChange={(e) => setRecommendedAction(e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: '0.8rem', padding: '4px 12px', backgroundColor: '#10b981' }}
                        onClick={() => handleReleaseResult(c.caseId)}
                      >
                        ✓ Release Result to Patient
                      </button>
                    </div>

                    {/* Section 3: Escalation and Referral */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>3. Escalate Case</div>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.8rem', marginBottom: '8px' }}
                          placeholder="Escalation reason..."
                          value={escalateReason}
                          onChange={(e) => setEscalateReason(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ fontSize: '0.8rem', padding: '4px 10px', color: '#f59e0b', borderColor: '#f59e0b' }}
                          onClick={() => handleEscalateCase(c.caseId)}
                        >
                          ⚡ Escalate
                        </button>
                      </div>

                      <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>4. Request Referral</div>
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.8rem', marginBottom: '4px' }}
                          value={referralSpecialty}
                          onChange={(e) => setReferralSpecialty(e.target.value)}
                          placeholder="Specialty"
                        />
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.8rem', marginBottom: '4px' }}
                          value={referralFacility}
                          onChange={(e) => setReferralFacility(e.target.value)}
                          placeholder="Facility"
                        />
                        <input
                          type="text"
                          className="form-input"
                          style={{ fontSize: '0.8rem', marginBottom: '8px' }}
                          value={referralNotes}
                          onChange={(e) => setReferralNotes(e.target.value)}
                          placeholder="Referral clinical notes"
                        />
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                          onClick={() => handleReferralCase(c.caseId)}
                        >
                          🏥 Request Referral
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {cases.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                No screening cases currently queued for this hospital.
              </div>
            )}
          </div>
        </section>
      )}

      {/* VIEW 2: PHOTO UPLOAD & DEMO AI */}
      {activeSubTab === 'intake' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Photo Capture & Consent Guard */}
          <section className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
              1. Clinical Photo Upload (Consent Guard)
            </h3>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Patient ID</label>
              <input
                type="text"
                className="form-input"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Patient Name</label>
              <input
                type="text"
                className="form-input"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Village ID</label>
              <input
                type="text"
                className="form-input"
                value={villageId}
                onChange={(e) => setVillageId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Priority</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{ fontSize: '0.8rem' }}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="high_priority">High Priority</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
              <input
                type="checkbox"
                id="demo_toggle"
                checked={isDemoImage}
                onChange={(e) => setIsDemoImage(e.target.checked)}
              />
              <label htmlFor="demo_toggle" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                Tag as Demo Simulation Photo (bypasses active consent requirement)
              </label>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Select Oral Photo</label>
              <input
                type="file"
                accept="image/jpeg, image/png, image/webp"
                className="form-input"
                onChange={handleFileChange}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              />
            </div>

            {photoPreview && (
              <div style={{ marginTop: '12px', textAlign: 'center' }}>
                <img
                  src={photoPreview}
                  alt="Oral photo preview"
                  style={{ maxHeight: '180px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                />
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
              onClick={handleUploadPhoto}
              disabled={uploading || !selectedFile}
            >
              {uploading ? 'Uploading...' : '📤 Upload Photo & Compute Hash'}
            </button>

            {/* Amendment Form if photo is uploaded */}
            {uploadedPhoto && (
              <div
                style={{
                  marginTop: '20px',
                  padding: '14px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(0,0,0,0.03)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Photo Version &amp; Amendment (Byte-Identical)</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                  Original SHA-256: <code>{uploadedPhoto.originalSha256.slice(0, 16)}...</code> (Immutable)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  Current SHA-256: <code>{uploadedPhoto.currentSha256.slice(0, 16)}...</code> | Version: {uploadedPhoto.version}
                </div>

                <div style={{ marginTop: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Amend with New Image</label>
                  <input
                    type="file"
                    accept="image/jpeg, image/png, image/webp"
                    className="form-input"
                    onChange={(e) => setAmendFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '0.75rem', marginBottom: '6px' }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={amendReason}
                    onChange={(e) => setAmendReason(e.target.value)}
                    placeholder="Amendment reason..."
                    style={{ fontSize: '0.75rem', marginBottom: '8px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', width: '100%' }}
                    onClick={handleAmendPhoto}
                    disabled={amending || !amendFile}
                  >
                    {amending ? 'Amending...' : '📝 Submit Amendment (Keeps Original Unchanged)'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* DEMO AI Analysis Card */}
          <section className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>
              2. DEMO AI Screening Support
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '14px' }}>
              Generates non-diagnostic risk-support labels. Positioning, obstruction, and missing-area checks return "unavailable".
            </p>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginBottom: '16px' }}
              onClick={handleRunAi}
              disabled={aiLoading}
            >
              {aiLoading ? 'Analyzing...' : '⚡ Run DEMO AI Analysis'}
            </button>

            {aiResult && (
              <div
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #f59e0b',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#92400e',
                    fontWeight: 600,
                  }}
                >
                  {aiResult.simulationBanner}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Risk Support Tier:</span>
                  <span className="badge badge-warning" style={{ fontSize: '0.8rem' }}>
                    {aiResult.riskSupportLabel}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem' }}>
                  <strong>Confidence:</strong> {(aiResult.confidenceScore * 100).toFixed(0)}%
                </div>

                <div style={{ padding: '8px', backgroundColor: 'var(--color-bg)', borderRadius: '4px', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Quality &amp; Anatomy Checks:</div>
                  <div>Positioning: <span style={{ color: 'var(--color-text-secondary)' }}>{aiResult.qualityChecks.positioning}</span></div>
                  <div>Obstruction: <span style={{ color: 'var(--color-text-secondary)' }}>{aiResult.qualityChecks.obstruction}</span></div>
                  <div>Missing Area: <span style={{ color: 'var(--color-text-secondary)' }}>{aiResult.qualityChecks.missingArea}</span></div>
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                  {aiResult.disclaimer}
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: '8px' }}
                  onClick={handleCreateCase}
                >
                  📥 Submit into MO Case Queue
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* VIEW 3: PATIENT RESULTS PORTAL (ONLY AFTER RELEASE) */}
      {activeSubTab === 'patient_view' && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Patient Clinical Results View</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                Guaranteed patient privacy: Unreleased evaluations are strictly withheld until official clinician release.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', margin: '16px 0', maxWidth: '400px' }}>
            <input
              type="text"
              className="form-input"
              value={patientViewId}
              onChange={(e) => setPatientViewId(e.target.value)}
              placeholder="Enter Patient ID"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleQueryPatientResults}
            >
              Query Results
            </button>
          </div>

          {patientResultsData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-bg-secondary)',
                  fontSize: '0.85rem',
                }}
              >
                <div><strong>Patient ID:</strong> {patientResultsData.patientId}</div>
                <div><strong>Total Cases:</strong> {patientResultsData.totalCases} | <strong>Released:</strong> {patientResultsData.releasedCount} | <strong>Pending Review:</strong> {patientResultsData.pendingCount}</div>
                <div style={{ marginTop: '4px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                  {patientResultsData.patientNotice}
                </div>
              </div>

              {patientResultsData.results.map((res: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                      ✓ Official Released Summary
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Case: {res.caseId}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>Clinician Summary:</strong> {res.patientSummaryMessage}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>Recommended Next Steps:</strong> {res.recommendedAction}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    Released by: {res.releasedBy} | {res.simulationBanner}
                  </div>
                </div>
              ))}

              {patientResultsData.results.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  🔒 No clinical results have been officially released for this patient yet. The medical evaluation remains in progress.
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
