import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

export interface TeleconsultationItem {
  consultationId: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  assignedClinicianId: string;
  assignedClinicianName: string;
  assignedClinicianRole: string;
  status: 'REQUESTED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  channelConfig: {
    videoStatus: 'BLOCKED';
    voiceStatus: 'BLOCKED';
    textChatStatus: 'ACTIVE';
  };
  scheduledWindow?: {
    startTime: string;
    endTime: string;
  };
  releaseStatus?: {
    isReleased: boolean;
    releasedAt?: string;
    releasedBy?: string;
  };
  cancellation?: {
    reason: string;
    cancelledAt: string;
    cancelledBy: string;
  };
  createdAt: string;
}

export interface ConsultationNoteData {
  consultationId: string;
  hospitalId: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  currentVersion: number;
  originalHash: string;
  latestHash: string;
  content: {
    clinicalObservations: string;
    recommendations: string;
    nextFollowUpDate?: string;
  };
  amendments: Array<{
    version: number;
    amendedAt: string;
    amendedBy: string;
    reason: string;
    contentHash: string;
  }>;
  isReleasedToPatient: boolean;
}

export interface DiscussionMessage {
  messageId: string;
  consultationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

interface TeleconsultationManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export const TeleconsultationManager: React.FC<TeleconsultationManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [consultations, setConsultations] = useState<TeleconsultationItem[]>([]);
  const [selectedConsultation, setSelectedConsultation] = useState<TeleconsultationItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Notes state
  const [notes, setNotes] = useState<ConsultationNoteData | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [showAddNotes, setShowAddNotes] = useState(false);
  const [newObservations, setNewObservations] = useState('');
  const [newRecommendations, setNewRecommendations] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');

  // Note amendment state
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendReason, setAmendReason] = useState('');
  const [amendObservations, setAmendObservations] = useState('');
  const [amendRecommendations, setAmendRecommendations] = useState('');

  // Messages state (Real text-based staff discussion)
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Request form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqPatientId, setReqPatientId] = useState('DEMO-PAD-8492');
  const [reqPatientName, setReqPatientName] = useState('Tribal Patient Demo');
  const [reqAssignedClinicianId, setReqAssignedClinicianId] = useState('usr_mo_paderu_01');
  const [reqAssignedClinicianName, setReqAssignedClinicianName] = useState('Dr. Ramesh');
  const [reqAssignedClinicianRole, setReqAssignedClinicianRole] = useState<'medical_officer' | 'specialist'>('medical_officer');
  const [reqHospitalId, setReqHospitalId] = useState(currentUser?.hospitalId || 'hosp_paderu_dh');

  // Cancel form state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const isAssignedClinician =
    currentUser &&
    selectedConsultation &&
    selectedConsultation.assignedClinicianId === currentUser.userId;

  const isStaff =
    currentUser &&
    ['medical_officer', 'specialist', 'anm', 'asha', 'admin', 'hospital_manager'].includes(
      currentUser.role
    );

  const fetchConsultations = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/teleconsultation', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConsultations(data.data.consultations || []);
        if (data.data.consultations?.length > 0 && !selectedConsultation) {
          setSelectedConsultation(data.data.consultations[0]);
        }
      } else {
        setError(data.error?.message || 'Failed to load teleconsultation sessions');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async (consultationId: string) => {
    if (!accessToken) return;
    setNotesLoading(true);
    setNotesError(null);
    try {
      const res = await fetch(`/api/v1/teleconsultation/${consultationId}/notes`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotes(data.data.notes);
      } else {
        setNotes(null);
        if (data.error?.code === 'RESULT_NOT_RELEASED') {
          setNotesError('RESULT_NOT_RELEASED: Clinical notes have not been released for patient viewing yet.');
        } else if (data.error?.code === 'NOTES_NOT_FOUND') {
          setNotes(null);
        } else {
          setNotesError(data.error?.message || 'Could not fetch consultation notes');
        }
      }
    } catch (err) {
      setNotesError((err as Error).message);
    } finally {
      setNotesLoading(false);
    }
  };

  const fetchMessages = async (consultationId: string) => {
    if (!accessToken) return;
    setMessagesError(null);
    try {
      const res = await fetch(`/api/v1/teleconsultation/${consultationId}/messages`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessages(data.data.messages || []);
      } else {
        if (data.error?.code === 'FORBIDDEN_STAFF_DISCUSSION') {
          setMessagesError('Case discussion is restricted to healthcare providers.');
        } else {
          setMessagesError(data.error?.message || 'Failed to fetch discussion messages');
        }
      }
    } catch (err) {
      setMessagesError((err as Error).message);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, [accessToken]);

  useEffect(() => {
    if (selectedConsultation) {
      fetchNotes(selectedConsultation.consultationId);
      if (isStaff) {
        fetchMessages(selectedConsultation.consultationId);
      }
    }
  }, [selectedConsultation?.consultationId, accessToken]);

  const handleRequestConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setError(null);
    try {
      const res = await fetch('/api/v1/teleconsultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          patientId: reqPatientId,
          patientName: reqPatientName,
          hospitalId: reqHospitalId,
          assignedClinicianId: reqAssignedClinicianId,
          assignedClinicianName: reqAssignedClinicianName,
          assignedClinicianRole: reqAssignedClinicianRole,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Teleconsultation session requested successfully in REQUESTED status.');
        setShowRequestModal(false);
        await fetchConsultations();
      } else {
        setError(data.error?.message || 'Failed to request teleconsultation');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleScheduleSession = async (consultationId: string) => {
    if (!accessToken) return;
    const start = new Date(Date.now() + 86400000 * 2).toISOString();
    const end = new Date(Date.now() + 86400000 * 2 + 1800000).toISOString();
    try {
      const res = await fetch(`/api/v1/teleconsultation/${consultationId}/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          scheduledWindow: {
            startTime: start,
            endTime: end,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Consultation scheduled successfully.');
        await fetchConsultations();
      } else {
        setError(data.error?.message || 'Failed to schedule consultation');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStartSession = async (consultationId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/teleconsultation/${consultationId}/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Teleconsultation session is now IN_PROGRESS.');
        await fetchConsultations();
      } else {
        setError(data.error?.message || 'Failed to transition to IN_PROGRESS');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRecordNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedConsultation) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/teleconsultation/${selectedConsultation.consultationId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          clinicalObservations: newObservations,
          recommendations: newRecommendations,
          nextFollowUpDate: newFollowUpDate || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Consultation notes recorded with cryptographic provenance hash.');
        setShowAddNotes(false);
        setNewObservations('');
        setNewRecommendations('');
        await fetchNotes(selectedConsultation.consultationId);
      } else {
        setError(data.error?.message || 'Failed to record consultation notes');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAmendNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedConsultation) return;
    setError(null);
    try {
      const res = await fetch(`/api/v1/teleconsultation/${selectedConsultation.consultationId}/notes/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason: amendReason,
          clinicalObservations: amendObservations,
          recommendations: amendRecommendations,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Notes amended successfully. Original hash preserved intact.');
        setShowAmendModal(false);
        setAmendReason('');
        await fetchNotes(selectedConsultation.consultationId);
      } else {
        setError(data.error?.message || 'Failed to amend notes');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReleaseNotes = async (consultationId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/teleconsultation/${consultationId}/release`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Consultation notes released for patient viewing.');
        await fetchNotes(consultationId);
        await fetchConsultations();
      } else {
        setError(data.error?.message || 'Failed to release notes');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedConsultation || !newMessage.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/v1/teleconsultation/${selectedConsultation.consultationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          content: newMessage.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewMessage('');
        await fetchMessages(selectedConsultation.consultationId);
      } else {
        setError(data.error?.message || 'Failed to post staff message');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedConsultation || !cancelReason.trim()) return;
    try {
      const res = await fetch(`/api/v1/teleconsultation/${selectedConsultation.consultationId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reason: cancelReason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('Consultation cancelled successfully.');
        setShowCancelModal(false);
        setCancelReason('');
        await fetchConsultations();
      } else {
        setError(data.error?.message || 'Failed to cancel consultation');
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner (Reference: Flash Card Study App panel) */}
      <div className="card hero progress-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>
              <span className="eyebrow-dot" style={{ background: 'var(--blue)' }} />
              <span>SPECIALIST TELEMEDICINE • టెలిమెడిసిన్ నెట్‌వర్క్</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px', color: 'var(--slate)' }}>
              Teleconsultation & Case Discussion
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '820px', margin: 0, lineHeight: 1.5 }}>
              Inter-facility clinical coordination connecting frontline ASHA workers and community patients to District Hospital specialists. 
              Features immutable SHA-256 clinical notes and peer discussion. (Raw video streaming marked BLOCKED per simulation invariant).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="button-outline"
              onClick={fetchConsultations}
              disabled={loading}
              style={{ fontSize: '0.85rem' }}
            >
              {loading ? 'Refreshing...' : '🔄 Refresh'}
            </button>
            <button
              type="button"
              className="button-coral"
              onClick={() => setShowRequestModal(true)}
              style={{ fontSize: '0.85rem' }}
            >
              + Request Session
            </button>
          </div>
        </div>
      </div>

      {!accessToken && (
        <LoginRequiredView
          moduleTitle="Teleconsultation Network & Case Discussion"
          moduleDescription="Sign in with demo credentials to coordinate clinical cases with Medical Officers, record SHA-256 consultation notes, and join provider discussions."
          onLoginAsAsha={onRequireLogin ? () => onRequireLogin('asha') : undefined}
          onLoginAsDoctor={onRequireLogin ? () => onRequireLogin('doctor') : undefined}
          onGoToAuth={onGoToAuth}
        />
      )}

        {/* EXPLICIT ADAPTER BLOCKED BADGES */}
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: 'var(--color-status-danger)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
              VIDEO: BLOCKED
            </span>
            <span
              style={{
                background: 'var(--color-status-danger)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
              VOICE: BLOCKED
            </span>
            <span
              style={{
                background: 'var(--color-status-danger)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
              PHOTO: BLOCKED
            </span>
            <span
              style={{
                background: 'var(--color-status-success)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '4px',
                letterSpacing: '0.5px',
              }}
            >
              STAFF CHAT: ACTIVE (REAL)
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            <strong>Safety & Governance Notice:</strong> Real-time video and voice streams are explicitly stubbed as{' '}
            <code>BLOCKED</code>. aarogya-drishti strictly forbids simulated fake call screens or mock video feeds.
            Text-based case discussions between healthcare personnel are authenticated and persisted.
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--color-status-danger)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginTop: '12px',
              fontSize: '0.85rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--color-status-success)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              marginTop: '12px',
              fontSize: '0.85rem',
            }}
          >
            ✓ {successMsg}
          </div>
        )}

      {/* MAIN TWO-COLUMN WORKFLOW */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
        {/* LEFT COLUMN: CONSULTATION SESSIONS LIST */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px' }}>
            Sessions ({consultations.length})
          </h3>
          {consultations.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              No teleconsultation sessions found.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {consultations.map((item) => {
                const isSelected = selectedConsultation?.consultationId === item.consultationId;
                const statusColor =
                  item.status === 'COMPLETED'
                    ? 'var(--color-status-success)'
                    : item.status === 'IN_PROGRESS'
                    ? 'var(--color-brand-accent)'
                    : item.status === 'CANCELLED'
                    ? 'var(--color-text-muted)'
                    : 'var(--color-status-warning)';

                return (
                  <div
                    key={item.consultationId}
                    onClick={() => setSelectedConsultation(item)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(0,0,0,0.2)',
                      border: isSelected ? '1px solid var(--color-brand-accent)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.patientName}</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: statusColor,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      Clinician: {item.assignedClinicianName}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      ID: <code>{item.consultationId.substring(0, 16)}...</code>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: CONSULTATION DETAILS & WORKFLOW PANELS */}
        {selectedConsultation ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* SESSION ACTION BAR */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
                    Consultation #{selectedConsultation.consultationId}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Patient: <strong>{selectedConsultation.patientName}</strong> ({selectedConsultation.patientId}) • Hospital: <code>{selectedConsultation.hospitalId}</code>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedConsultation.status === 'REQUESTED' && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleScheduleSession(selectedConsultation.consultationId)}
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      📅 Schedule Session
                    </button>
                  )}
                  {selectedConsultation.status === 'SCHEDULED' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleStartSession(selectedConsultation.consultationId)}
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      ▶️ Start Consultation
                    </button>
                  )}
                  {['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(selectedConsultation.status) && (
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setShowCancelModal(true)}
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      ❌ Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* VIDEO ADAPTER STUB VIEW (NO FAKE CALL SCREEN) */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px dashed var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginTop: '16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🚫</div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-status-danger)' }}>
                  MEDIA CALL STREAM: BLOCKED
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '4px', maxWidth: '540px', margin: '4px auto 0' }}>
                  Real video and voice calls are blocked until an approved real-time WebRTC/telemedicine provider is integrated. No fake call controls or simulated camera overlays are displayed.
                </div>
              </div>
            </div>

            {/* CLINICAL CONSULTATION NOTES (AUTHORED BY ASSIGNED CLINICIAN ONLY) */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
                    📝 Clinical Consultation Notes (Immutable & Versioned)
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    Authored exclusively by assigned clinician {selectedConsultation.assignedClinicianName}. Originals stay byte-identical.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {notes && isAssignedClinician && !notes.isReleasedToPatient && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setAmendObservations(notes.content.clinicalObservations);
                        setAmendRecommendations(notes.content.recommendations);
                        setShowAmendModal(true);
                      }}
                      style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                    >
                      ✏️ Amend Notes
                    </button>
                  )}
                  {notes && isAssignedClinician && !notes.isReleasedToPatient && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleReleaseNotes(selectedConsultation.consultationId)}
                      style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                    >
                      🔓 Release to Patient
                    </button>
                  )}
                  {!notes && isAssignedClinician && selectedConsultation.status === 'IN_PROGRESS' && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setShowAddNotes(true)}
                      style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                    >
                      + Record Notes
                    </button>
                  )}
                </div>
              </div>

              {notesLoading && <p style={{ fontSize: '0.85rem' }}>Loading notes...</p>}

              {notesError && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--color-status-warning)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                  }}
                >
                  🔒 {notesError}
                </div>
              )}

              {notes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.2)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>VERSION:</span>{' '}
                      <strong>v{notes.currentVersion}</strong> •{' '}
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>AUTHOR:</span>{' '}
                      <strong>{notes.authorName}</strong> ({notes.authorRole})
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: notes.isReleasedToPatient ? 'var(--color-status-success)' : 'var(--color-status-warning)',
                        color: '#fff',
                      }}
                    >
                      {notes.isReleasedToPatient ? 'RELEASED TO PATIENT' : 'INTERNAL DRAFT (NOT RELEASED)'}
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Clinical Observations & Examination Findings
                    </label>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {notes.content.clinicalObservations}
                    </p>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                      Care Recommendations & Next Steps
                    </label>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {notes.content.recommendations}
                    </p>
                  </div>

                  {notes.content.nextFollowUpDate && (
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Recommended Next Follow-up
                      </label>
                      <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                        {new Date(notes.content.nextFollowUpDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {/* PROVENANCE HASH TRACKING */}
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem' }}>
                    <div>
                      <strong>Original Hash (SHA-256):</strong> <code>{notes.originalHash}</code>
                    </div>
                    {notes.amendments?.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <strong>Latest Hash (v{notes.currentVersion}):</strong> <code>{notes.latestHash}</code> • Amendments: {notes.amendments.length}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!notes && !notesLoading && !notesError && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  No consultation notes recorded yet for this session.
                </p>
              )}
            </div>

            {/* REAL STAFF DISCUSSION (AUTHENTICATED CLINICIAN & WORKER CHAT) */}
            {isStaff && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
                      💬 Staff Discussion & Case Exchange (Real Text)
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                      Restricted to healthcare personnel (MO, ANM, ASHA, Specialists). Patients cannot view or submit.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fetchMessages(selectedConsultation.consultationId)}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    Refresh Chat
                  </button>
                </div>

                {messagesError && (
                  <p style={{ color: 'var(--color-status-danger)', fontSize: '0.8rem' }}>{messagesError}</p>
                )}

                <div
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    height: '220px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    marginBottom: '12px',
                  }}
                >
                  {messages.length === 0 ? (
                    <div style={{ margin: 'auto', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      No discussion messages yet. Start clinical case discussion below.
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.senderId === currentUser?.userId;
                      return (
                        <div
                          key={m.messageId}
                          style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                            background: isMe ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.06)',
                            border: isMe ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            padding: '8px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{m.senderName} ({m.senderRole})</span>
                            <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>{m.content}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type clinical inquiry or case observation..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sendingMsg}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sendingMsg || !newMessage.trim()}
                    style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                  >
                    {sendingMsg ? 'Posting...' : 'Send'}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Select a teleconsultation session from the left column to view session status, clinical notes, and case discussions.
            </p>
          </div>
        )}
      </div>

      {/* MODAL: REQUEST TELECONSULTATION */}
      {showRequestModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
              Request New Teleconsultation Session
            </h3>
            <form onSubmit={handleRequestConsultation}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Patient ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={reqPatientId}
                  onChange={(e) => setReqPatientId(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Patient Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={reqPatientName}
                  onChange={(e) => setReqPatientName(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Hospital ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={reqHospitalId}
                  onChange={(e) => setReqHospitalId(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Assigned Clinician ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={reqAssignedClinicianId}
                  onChange={(e) => setReqAssignedClinicianId(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Clinician Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={reqAssignedClinicianName}
                  onChange={(e) => setReqAssignedClinicianName(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Clinician Role</label>
                <select
                  className="form-control"
                  value={reqAssignedClinicianRole}
                  onChange={(e) => setReqAssignedClinicianRole(e.target.value as any)}
                >
                  <option value="medical_officer">Medical Officer</option>
                  <option value="specialist">Specialist</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRequestModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECORD CLINICAL NOTES */}
      {showAddNotes && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '14px' }}>
              Record Clinical Consultation Notes
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
              Note: Clinical safety rules require objective clinical observations. System does not suggest diagnosis or stage.
            </p>
            <form onSubmit={handleRecordNotes}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Clinical Observations</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={newObservations}
                  onChange={(e) => setNewObservations(e.target.value)}
                  placeholder="Record objective mucosal findings, lesion boundaries, or tissue observations..."
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Recommendations & Care Plan</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={newRecommendations}
                  onChange={(e) => setNewRecommendations(e.target.value)}
                  placeholder="Prescribed guidance, hygiene instructions, or biopsy referral..."
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Follow-up Date (Optional)</label>
                <input
                  type="date"
                  className="form-control"
                  value={newFollowUpDate}
                  onChange={(e) => setNewFollowUpDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddNotes(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Notes (Hash & Version)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AMEND CLINICAL NOTES */}
      {showAmendModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
              Amend Clinical Notes (Preserves Original Hash)
            </h3>
            <form onSubmit={handleAmendNotes}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Mandatory Amendment Reason</label>
                <input
                  type="text"
                  className="form-control"
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  placeholder="e.g., Updated after second review of clinical photographs"
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Amended Observations</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={amendObservations}
                  onChange={(e) => setAmendObservations(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Amended Recommendations</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={amendRecommendations}
                  onChange={(e) => setAmendRecommendations(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAmendModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Commit Amendment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL CONSULTATION */}
      {showCancelModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--color-status-danger)' }}>
              Cancel Teleconsultation Session
            </h3>
            <form onSubmit={handleCancel}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Cancellation Reason</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Mandatory clinical or operational reason..."
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
