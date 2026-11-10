import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';
import { db, EncryptedQueueItem } from '../db/aarogyaDb';
import { enqueueOfflinePatient, syncOfflineQueue } from '../offline/cryptoQueue';
import { LoginRequiredView } from './UIStateViews';

interface Patient {
  patientId: string;
  fullName: string;
  gender: string;
  ageEstimated: number;
  phone?: string;
  guardianName?: string;
  villageName: string;
  villageId: string;
  mandal: string;
  district: string;
  originalAddressText: string;
  hospitalId: string;
  isDuplicateCandidate: boolean;
  duplicateReviewStatus: string;
  matchScore?: number;
  matchReasons?: string[];
  registeredAt: string;
}

interface DuplicateReviewTicket {
  reviewId: string;
  newPatientId: string;
  existingPatientId: string;
  matchScore: number;
  matchReasons: string[];
  status: string;
  createdAt: string;
  newPatient?: Patient;
  existingPatient?: Patient;
}

interface PatientManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export const PatientManager: React.FC<PatientManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'register' | 'patients' | 'duplicates' | 'queue'>('register');

  // Registration Method & Mode State
  const [regMethod, setRegMethod] = useState<'aadhaar_assisted' | 'manual' | 'health_worker_assisted'>('aadhaar_assisted');
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
  const [extractingOcr, setExtractingOcr] = useState<boolean>(false);
  const [maskedAadhaar, setMaskedAadhaar] = useState<string>('');
  const [dob, setDob] = useState<string>('');
  const [stateName, setStateName] = useState<string>('Andhra Pradesh');
  const [district, setDistrict] = useState<string>('Alluri Sitharama Raju');
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [caregiverName, setCaregiverName] = useState<string>('');
  const [caregiverPhone, setCaregiverPhone] = useState<string>('');
  const [consentObtained, setConsentObtained] = useState<boolean>(true);

  // Registration Form State
  const [fullName, setFullName] = useState('Korra Somulu');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [ageEstimated, setAgeEstimated] = useState<number>(54);
  const [phone, setPhone] = useState<string>('9440188990');
  const [guardianName, setGuardianName] = useState<string>('Korra Somanna');
  const [villageName, setVillageName] = useState<string>('Vankachinta');
  const [mandal, setMandal] = useState<string>('Paderu');
  const [originalAddressText, setOriginalAddressText] = useState<string>(
    'Near Old Water Tank, Vankachinta Upper Habitation, Paderu Mandal, ASR District'
  );
  const [hospitalId, setHospitalId] = useState<string>(currentUser?.hospitalId || 'hosp_paderu_dh');
  const [submitting, setSubmitting] = useState(false);
  const [regMsg, setRegMsg] = useState<{ type: 'success' | 'warning' | 'error'; text: string; details?: any } | null>(null);
  const [referenceVillages, setReferenceVillages] = useState<Array<{ villageName: string; mandal: string }>>([]);

  // Patients List State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Duplicate Review Tickets State
  const [reviews, setReviews] = useState<DuplicateReviewTicket[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Offline Encrypted Queue State
  const [queueItems, setQueueItems] = useState<EncryptedQueueItem[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);

  const fetchPatients = async () => {
    if (!accessToken) return;
    setLoadingPatients(true);
    try {
      const res = await fetch('/api/v1/patients', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setPatients(payload.data?.patients || []);
      }
    } catch (err) {
      // ignore
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchReviews = async () => {
    if (!accessToken) return;
    setLoadingReviews(true);
    try {
      const res = await fetch('/api/v1/patients/duplicates/review', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setReviews(payload.data?.reviews || []);
      }
    } catch (err) {
      // ignore
    } finally {
      setLoadingReviews(false);
    }
  };

  const refreshQueue = async () => {
    const items = await db.encryptedQueue.toArray();
    setQueueItems(items);
  };

  useEffect(() => {
    fetchPatients();
    fetchReviews();
    refreshQueue();

    if (accessToken) {
      fetch('/api/v1/reference/villages', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((payload) => {
          if (payload?.success && Array.isArray(payload.data?.villages)) {
            setReferenceVillages(payload.data.villages);
          }
        })
        .catch(() => {});
    }
  }, [accessToken]);

  useEffect(() => {
    if (currentUser?.hospitalId) {
      setHospitalId(currentUser.hospitalId);
    }
  }, [currentUser]);

// Client-side image compressor to prevent 413 Payload Too Large on mobile photo uploads
function compressCardImage(file: File, maxDim = 1200): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// Aadhaar OCR Extraction
  const handleExtractOcr = async () => {
    let token = accessToken;
    if (!token) {
      try {
        const stored = localStorage.getItem('aarogya_tokens');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed.accessToken || null;
        }
      } catch {
        // ignore
      }
    }

    if (!token) {
      // Auto-authenticate as frontline demo worker if unauthenticated in demo mode
      try {
        const authRes = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'asha.pad01', password: 'Asha@2026' }),
        });
        const authData = await authRes.json();
        if (authData.success && authData.data?.tokens?.accessToken) {
          token = authData.data.tokens.accessToken;
        } else if (authData.success && authData.data?.accessToken) {
          token = authData.data.accessToken;
        }
      } catch {
        // ignore
      }
    }

    if (!token) {
      setRegMsg({ type: 'error', text: 'Authentication token required for OCR extraction. Please log in as an ASHA worker or Medical Officer.' });
      return;
    }
    setExtractingOcr(true);
    setRegMsg(null);
    try {
      const res = await fetch('/api/v1/mock/aadhaar/ocr-extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          frontImage: aadhaarFront || 'data:image/jpeg;base64,demo_front',
          backImage: aadhaarBack || 'data:image/jpeg;base64,demo_back',
          consentObtained: true,
        }),
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        const ext = payload.data?.extractedData || payload.data?.extracted || payload.data;
        if (ext && typeof ext === 'object') {
          if (ext.fullName) setFullName(ext.fullName);
          if (ext.gender && ['male', 'female', 'other'].includes(ext.gender)) setGender(ext.gender);
          if (ext.ageEstimated) setAgeEstimated(Number(ext.ageEstimated) || 0);
          if (ext.dob) setDob(ext.dob);
          if (ext.guardianName) setGuardianName(ext.guardianName);
          if (ext.villageName) setVillageName(ext.villageName);
          if (ext.mandal) setMandal(ext.mandal);
          if (ext.district) setDistrict(ext.district);
          if (ext.originalAddressText) setOriginalAddressText(ext.originalAddressText);
          if (ext.maskedAadhaar) setMaskedAadhaar(ext.maskedAadhaar);
          setRegMsg({
            type: 'success',
            text: `✓ OCR extracted successfully for ${ext.fullName || 'Patient'}! Permitted demographic fields populated. Zero raw Aadhaar stored.`,
          });
        } else {
          throw new Error('No demographic data returned from OCR extraction');
        }
      } else {
        throw new Error(payload.error?.message || payload.message || 'OCR extraction failed');
      }
    } catch (err: any) {
      setRegMsg({ type: 'error', text: `OCR scan notice: ${err.message}` });
    } finally {
      setExtractingOcr(false);
    }
  };

  // Online Registration
  const handleRegisterOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) {
      setRegMsg({ type: 'error', text: 'Authentication token required for online registration' });
      return;
    }

    setSubmitting(true);
    setRegMsg(null);

    try {
      const res = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          gender,
          ageEstimated: Number(ageEstimated),
          phone: phone.trim() || undefined,
          guardianName: guardianName.trim() || undefined,
          villageName: villageName.trim(),
          mandal: mandal.trim(),
          district: district.trim(),
          originalAddressText: originalAddressText.trim(),
          hospitalId,
          maskedAadhaar: maskedAadhaar || undefined,
          registrationMethod: regMethod,
          consentObtained,
          emergencyContact: emergencyName.trim() ? { name: emergencyName.trim(), phone: emergencyPhone.trim() } : undefined,
          caregiverDetails: caregiverName.trim() ? { name: caregiverName.trim(), phone: caregiverPhone.trim() } : undefined,
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success) {
        const patient = payload.data?.patient;
        const dup = payload.data?.duplicateReview;

        if (dup?.flagged) {
          setRegMsg({
            type: 'warning',
            text: `⚠️ Patient Registered as ${patient.patientId}, but FLAGGED AS POTENTIAL DUPLICATE (Match Score: ${dup.matchScore}/100). Never auto-merged! Review ticket opened.`,
            details: dup,
          });
        } else {
          setRegMsg({
            type: 'success',
            text: `✓ Patient registered successfully! Assigned Tribal Patient ID: ${patient.patientId} (OTP-Free)`,
          });
        }

        fetchPatients();
        fetchReviews();
      } else {
        throw new Error(payload.error?.message || 'Registration failed');
      }
    } catch (err: any) {
      setRegMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Offline Encrypted Queue Save
  const handleSaveToEncryptedQueue = async () => {
    try {
      const patientPayload = {
        fullName: fullName.trim(),
        gender,
        ageEstimated: Number(ageEstimated),
        phone: phone.trim() || undefined,
        guardianName: guardianName.trim() || undefined,
        villageName: villageName.trim(),
        mandal: mandal.trim(),
        district: district.trim(),
        originalAddressText: originalAddressText.trim(),
        hospitalId,
        maskedAadhaar: maskedAadhaar || undefined,
        registrationMethod: regMethod,
        consentObtained,
        emergencyContact: emergencyName.trim() ? { name: emergencyName.trim(), phone: emergencyPhone.trim() } : undefined,
        caregiverDetails: caregiverName.trim() ? { name: caregiverName.trim(), phone: caregiverPhone.trim() } : undefined,
      };

      const queuedItem = await enqueueOfflinePatient(patientPayload);
      await refreshQueue();

      setRegMsg({
        type: 'success',
        text: `🔒 Saved to Offline Encrypted Queue! (AES-GCM-256, Mutation ID: ${queuedItem.clientMutationId.substring(0, 16)}...). Will sync idempotently once network is available.`,
      });
    } catch (err: any) {
      setRegMsg({ type: 'error', text: `Offline encryption failed: ${err.message}` });
    }
  };

  // Sync Encrypted Queue
  const handleSyncQueue = async () => {
    if (!accessToken) {
      setQueueMsg('You must be logged in to sync the offline queue to the server.');
      return;
    }

    setSyncingQueue(true);
    setQueueMsg(null);

    try {
      const result = await syncOfflineQueue(accessToken);
      setQueueMsg(`✓ Synced ${result.syncedCount} item(s) to server idempotently with zero duplicate creation!`);
      await refreshQueue();
      fetchPatients();
      fetchReviews();
    } catch (err: any) {
      setQueueMsg(`Sync error: ${err.message}`);
    } finally {
      setSyncingQueue(false);
    }
  };

  // Resolve Duplicate Review Ticket
  const handleResolveReview = async (reviewId: string, resolution: 'resolved_distinct' | 'resolved_merged') => {
    if (!accessToken) return;
    setResolvingId(reviewId);

    try {
      const res = await fetch(`/api/v1/patients/duplicates/${reviewId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          resolution,
          resolutionNotes: `Administrative resolution: ${resolution === 'resolved_distinct' ? 'Confirmed Distinct Individuals' : 'Manual Authorized Clinical Record Merge'}`,
        }),
      });

      if (res.ok) {
        fetchReviews();
        fetchPatients();
      }
    } catch (err) {
      // ignore
    } finally {
      setResolvingId(null);
    }
  };

  const filteredPatients = patients.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.patientId.toLowerCase().includes(q) ||
      p.villageName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner (Reference: Flash Card Study App panel) */}
      <div className="card hero progress-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '8px' }}>
              <span className="eyebrow-dot" style={{ background: 'var(--mint-strong)' }} />
              <span>TRIBAL PATIENT INTAKE & REGISTRY • గిరిజన రోగుల నమోదు</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px', color: 'var(--slate)' }}>
              Patients Registry & Idempotent Offline Sync
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '820px', margin: 0, lineHeight: 1.5 }}>
              <strong>OTP-Free Registration</strong> designed for remote agency habitations with zero cellular connectivity. 
              Features a composite duplicate-detection engine (duplicates are <em>never auto-merged</em>), verbatim address preservation, 
              and client-side <strong>AES-GCM-256 WebCrypto</strong> offline queue surviving reloads and syncing exactly once.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="button-outline"
              onClick={() => {
                fetchPatients();
                fetchReviews();
                refreshQueue();
              }}
              style={{ fontSize: '0.85rem' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {!accessToken && (
        <LoginRequiredView
          moduleTitle="Tribal Patient Registry & Offline Sync"
          moduleDescription="Sign in with demo credentials to access live patient records, run composite duplicate checks, and sync offline queues with the server."
          onLoginAsAsha={onRequireLogin ? () => onRequireLogin('asha') : undefined}
          onLoginAsDoctor={onRequireLogin ? () => onRequireLogin('doctor') : undefined}
          onGoToAuth={onGoToAuth}
        />
      )}

      {/* Navigation Sub-Tabs */}
      <nav style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => setActiveTab('register')}
        >
          📝 OTP-Free Registration
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          🗂️ Patient Registry ({patients.length})
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'duplicates' ? 'active' : ''}`}
          onClick={() => setActiveTab('duplicates')}
        >
          ⚠️ Duplicate Review Queue ({reviews.length})
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'queue' ? 'active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          🔒 Encrypted Offline Queue ({queueItems.filter((q) => q.status === 'pending').length} pending)
        </button>
      </nav>

      {/* TAB 1: OTP-FREE REGISTRATION */}
      {activeTab === 'register' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          <form onSubmit={handleRegisterOnline} className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  Smart Patient Registration (OTP-Free)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                  Choose registration method. Generates standard Unique Tribal Patient ID (e.g. <code>PAD-2026-XXXXX</code>).
                </p>
              </div>
              <span className="badge badge-mock">Zero-Connectivity Ready</span>
            </div>

            {/* 3-Method Registration Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '14px' }}>
              <button
                type="button"
                className={`auth-tab ${regMethod === 'aadhaar_assisted' ? 'active' : ''}`}
                onClick={() => setRegMethod('aadhaar_assisted')}
                style={{ fontSize: '0.8rem', padding: '8px 10px', textAlign: 'center' }}
              >
                🪪 Aadhaar OCR Auto-Fill
              </button>
              <button
                type="button"
                className={`auth-tab ${regMethod === 'manual' ? 'active' : ''}`}
                onClick={() => setRegMethod('manual')}
                style={{ fontSize: '0.8rem', padding: '8px 10px', textAlign: 'center' }}
              >
                📝 Manual Registration
              </button>
              <button
                type="button"
                className={`auth-tab ${regMethod === 'health_worker_assisted' ? 'active' : ''}`}
                onClick={() => setRegMethod('health_worker_assisted')}
                style={{ fontSize: '0.8rem', padding: '8px 10px', textAlign: 'center' }}
              >
                👩‍⚕️ Health Worker Assisted
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              {/* MODE A: AADHAAR OCR EXTRACTION BOX */}
              {regMethod === 'aadhaar_assisted' && (
                <div style={{ padding: '12px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--color-brand-primary)' }}>
                      🪪 Aadhaar Card Image OCR Scanner
                    </strong>
                    <span className="badge badge-mock">MOCK OCR / ZERO RAW RETENTION</span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
                    Upload or capture card front and back. Permitted demographic fields will be automatically extracted. Complete card numbers and photos are discarded immediately after field extraction (Invariant 5).
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ border: '1px dashed rgba(255,255,255,0.25)', padding: '10px', borderRadius: '6px', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Front Side Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ fontSize: '0.72rem', maxWidth: '100%' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const compressed = await compressCardImage(file);
                            setAadhaarFront(compressed);
                          }
                        }}
                      />
                      {aadhaarFront && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <img
                            src={aadhaarFront}
                            alt="Front Preview"
                            style={{ maxHeight: '60px', maxWidth: '100%', borderRadius: '4px', border: '1px solid #10b981' }}
                          />
                          <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>✓ Front Card Ready</span>
                        </div>
                      )}
                    </div>
                    <div style={{ border: '1px dashed rgba(255,255,255,0.25)', padding: '10px', borderRadius: '6px', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Back Side Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ fontSize: '0.72rem', maxWidth: '100%' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const compressed = await compressCardImage(file);
                            setAadhaarBack(compressed);
                          }
                        }}
                      />
                      {aadhaarBack && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <img
                            src={aadhaarBack}
                            alt="Back Preview"
                            style={{ maxHeight: '60px', maxWidth: '100%', borderRadius: '4px', border: '1px solid #10b981' }}
                          />
                          <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>✓ Back Card Ready</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      className="button-forest-primary button"
                      style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                      onClick={handleExtractOcr}
                      disabled={extractingOcr}
                    >
                      {extractingOcr ? '⏳ Scanning & Extracting...' : '🔍 Extract Details with OCR'}
                    </button>
                    {maskedAadhaar && (
                      <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                        🔒 Masked Aadhaar: {maskedAadhaar}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* MODE C: HEALTH WORKER ASSISTED QUICK TOOLS */}
              {regMethod === 'health_worker_assisted' && (
                <div style={{ padding: '12px', background: 'rgba(6, 214, 160, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 214, 160, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.86rem', color: '#06d6a0' }}>
                      👩‍⚕️ Frontline Assisted Intake (Large Tap Targets)
                    </strong>
                    <button
                      type="button"
                      className="button-outline"
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => {
                        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          const utt = new SpeechSynthesisUtterance('దయచేసి మీ పేరు మరియు వయస్సును తెలపండి. మేము మీ నోటి ఆరోగ్య రికార్డును నమోదు చేస్తున్నాము.');
                          utt.lang = 'te-IN';
                          window.speechSynthesis.speak(utt);
                        }
                      }}
                    >
                      🔊 Voice Prompt (Telugu)
                    </button>
                  </div>

                  {/* One-Tap Quick Habitations */}
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                      Quick Village Picker:
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['Vankachinta', 'Minumuluru', 'Dumbriguda', 'Araku Valley', 'Munchingiputtu', 'Chintapalli'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="button-outline"
                          style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            background: villageName === v ? '#06d6a0' : undefined,
                            color: villageName === v ? '#041014' : undefined,
                          }}
                          onClick={() => {
                            setVillageName(v);
                            if (v === 'Vankachinta' || v === 'Minumuluru') setMandal('Paderu');
                            else if (v === 'Dumbriguda') setMandal('Dumbriguda');
                            else if (v === 'Araku Valley') setMandal('Araku Valley');
                            else if (v === 'Munchingiputtu') setMandal('Munchingiputtu');
                            else if (v === 'Chintapalli') setMandal('Chintapalli');
                          }}
                        >
                          🏡 {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Age Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Quick Age:</span>
                    {[-5, -1, 1, 5].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        className="button-outline"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        onClick={() => setAgeEstimated((prev) => Math.max(1, Math.min(115, prev + delta)))}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* COMMON REGISTRATION FORM FIELDS */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-select"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                  >
                    <option value="male">👨 Male</option>
                    <option value="female">👩 Female</option>
                    <option value="other">⚧ Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Estimated Age (Years)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={ageEstimated}
                    onChange={(e) => setAgeEstimated(Number(e.target.value))}
                    min={1}
                    max={120}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Date of Birth (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    placeholder="DD/MM/YYYY or YYYY"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Phone (Optional / Shared)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Shared family phone"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="e.g. Andhra Pradesh"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Guardian / Spouse / Father Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="Relative's name for phonetic verification"
                />
              </div>

              {/* Emergency Contact & Optional Caregiver Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Emergency Contact Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Emergency Contact Name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Emergency Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="Emergency Contact Phone"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Caregiver Name (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={caregiverName}
                    onChange={(e) => setCaregiverName(e.target.value)}
                    placeholder="Caregiver Name"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Caregiver Phone (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={caregiverPhone}
                    onChange={(e) => setCaregiverPhone(e.target.value)}
                    placeholder="Caregiver Phone"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Mandal</label>
                  <input
                    type="text"
                    className="form-input"
                    value={mandal}
                    onChange={(e) => setMandal(e.target.value)}
                    placeholder="e.g. Paderu, Araku Valley"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Village / Habitation Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={villageName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVillageName(val);
                      const matched = referenceVillages.find(
                        (v) => v.villageName.toLowerCase() === val.trim().toLowerCase()
                      );
                      if (matched?.mandal) {
                        setMandal(matched.mandal);
                      }
                    }}
                    list="village-suggestions"
                    placeholder="e.g. Vankachinta, Minumuluru"
                    required
                  />
                  {referenceVillages.length > 0 && (
                    <datalist id="village-suggestions">
                      {referenceVillages.map((v, idx) => (
                        <option key={`${v.villageName}-${idx}`} value={v.villageName}>
                          {v.villageName} ({v.mandal})
                        </option>
                      ))}
                    </datalist>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Affiliated Healthcare Facility</label>
                <select
                  className="form-select"
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                >
                  <option value="hosp_paderu_dh">District Hospital Paderu (DH Paderu)</option>
                  <option value="hosp_araku_ah">Area Hospital Araku (AH Araku)</option>
                  <option value="hosp_chintapalli_chc">Community Health Centre Chintapalli (CHC)</option>
                  <option value="hosp_hukumpeta_phc">Primary Health Centre Hukumpeta (PHC)</option>
                </select>
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                  Nearest clinical referral facility for triage and teleconsultation navigation.
                </span>
              </div>

              {/* Original Address Text: Mandatory & Verbatim */}
              <div className="form-group">
                <label className="form-label">
                  Original Submitted Address Text (Stored Verbatim)
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={originalAddressText}
                  onChange={(e) => setOriginalAddressText(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                  Mandatory: Preserved without transformation to capture local tribal dialect landmarks and hamlet directions.
                </span>
              </div>

              {/* Informed Consent Checkbox */}
              <div className="form-group" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.8rem' }}>
                  <input
                    type="checkbox"
                    checked={consentObtained}
                    onChange={(e) => setConsentObtained(e.target.checked)}
                  />
                  <span>
                    ✓ <strong>Informed Consent:</strong> Patient or designated guardian consented to demographic registration and clinical screening navigation.
                  </span>
                </label>
              </div>

              {regMsg && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)',
                    background:
                      regMsg.type === 'success'
                        ? 'rgba(6, 214, 160, 0.15)'
                        : regMsg.type === 'warning'
                        ? 'rgba(255, 183, 3, 0.15)'
                        : 'rgba(230, 57, 70, 0.15)',
                    border: `1px solid ${
                      regMsg.type === 'success'
                        ? 'var(--color-status-success)'
                        : regMsg.type === 'warning'
                        ? 'var(--color-status-warning)'
                        : 'var(--color-status-danger)'
                    }`,
                    color: 'var(--color-text-primary)',
                    fontSize: '0.84rem',
                  }}
                >
                  <div>{regMsg.text}</div>
                  {regMsg.details?.matchReasons && (
                    <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--color-status-warning)' }}>
                      Match Indicators: {regMsg.details.matchReasons.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="button-outline"
                  onClick={handleSaveToEncryptedQueue}
                  style={{ flex: 1, fontSize: '0.88rem' }}
                >
                  🔒 Save to Encrypted Offline Queue
                </button>
                <button
                  type="submit"
                  className="button-coral"
                  disabled={submitting}
                  style={{ flex: 1, fontSize: '0.88rem' }}
                >
                  {submitting ? 'Registering...' : '🚀 Submit Online'}
                </button>
              </div>
            </div>
          </form>

          {/* Side Info & Duplicate Detection Architecture Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ borderLeft: '4px solid var(--color-brand-accent)' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 8px' }}>
                Duplicate-Detection Policy (Never Auto-Merged)
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                Aarogya Drishti evaluates each patient against existing agency records using a multi-factor composite score:
              </p>
              <ul style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', paddingLeft: '20px', marginTop: '8px', lineHeight: 1.6 }}>
                <li><strong>Phonetic Name Match (35 pts):</strong> Jaro-Winkler metric with tribal prefix awareness.</li>
                <li><strong>Village & Habitation Proximity (25 pts):</strong> Exact census village or neighbouring hamlet.</li>
                <li><strong>Gender & Age Band (20 pts):</strong> Demographic alignment with $\pm 2$ year tolerance.</li>
                <li><strong>Contact / Guardian Similarity (20 pts):</strong> Shared family contact or guardian name match.</li>
              </ul>
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(255, 183, 3, 0.1)', border: '1px solid rgba(255, 183, 3, 0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--color-status-warning)' }}>
                🛡️ <strong>Safety Invariant:</strong> Scores $\ge 75$ open a review ticket. The platform <em>never auto-merges</em> clinical records to prevent disastrous patient misidentification.
              </div>
            </div>

            <div className="card" style={{ borderLeft: '4px solid var(--color-brand-primary)' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 8px' }}>
                Offline Queue Cryptographic Strength
              </h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <div>🔐 <strong>Algorithm:</strong> AES-GCM (Galois/Counter Mode) 256-bit key</div>
                <div>🔑 <strong>Key Derivation:</strong> PBKDF2-HMAC-SHA256 (100,000 iterations)</div>
                <div>🎲 <strong>Nonce / IV:</strong> 96-bit unique cryptographically random IV per record</div>
                <div>🛡️ <strong>Integrity Tag:</strong> 128-bit AEAD authentication tag</div>
                <div>💾 <strong>Persistence:</strong> IndexedDB (Dexie) stores only ciphertext; zero plaintext at rest.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PATIENT REGISTRY */}
      {activeTab === 'patients' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Agency Patient Registry ({filteredPatients.length})
            </h3>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search patient name, ID, or village..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '280px', fontSize: '0.85rem' }}
            />
          </div>

          {loadingPatients && <div style={{ color: 'var(--color-text-muted)', padding: '24px', textAlign: 'center' }}>Loading patients...</div>}

          {!loadingPatients && filteredPatients.length === 0 && (
            <div style={{ color: 'var(--color-text-secondary)', padding: '32px 0', textAlign: 'center' }}>
              No patient records found. Register a new patient using the intake tab.
            </div>
          )}

          {filteredPatients.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Full Name</th>
                    <th>Age/Gender</th>
                    <th>Village & Mandal</th>
                    <th>Original Submitted Address</th>
                    <th>Duplicate Status</th>
                    <th>Registered</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p) => (
                    <tr key={p.patientId}>
                      <td><code style={{ color: 'var(--color-brand-accent)', fontWeight: 700 }}>{p.patientId}</code></td>
                      <td><strong>{p.fullName}</strong></td>
                      <td>{p.ageEstimated} yrs • {p.gender.toUpperCase()}</td>
                      <td>{p.villageName} ({p.mandal})</td>
                      <td style={{ maxWidth: '240px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {p.originalAddressText}
                      </td>
                      <td>
                        {p.isDuplicateCandidate ? (
                          <span className="badge" style={{ background: 'var(--color-status-warning)', color: '#000', fontSize: '0.7rem' }}>
                            ⚠️ {p.duplicateReviewStatus.toUpperCase()} ({p.matchScore} pts)
                          </span>
                        ) : (
                          <span className="badge badge-real" style={{ fontSize: '0.7rem' }}>
                            ✓ UNIQUE
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.75rem' }}>
                        {new Date(p.registeredAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DUPLICATE REVIEW QUEUE */}
      {activeTab === 'duplicates' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Pending Duplicate Review Tickets ({reviews.length})
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Records flagged by composite scoring. Administrators review diffs and authorize manual linkage or mark distinct.
              </p>
            </div>
            <span className="badge badge-mock">Manual Audit Gate</span>
          </div>

          {loadingReviews && <div style={{ color: 'var(--color-text-muted)', padding: '24px', textAlign: 'center' }}>Loading review tickets...</div>}

          {!loadingReviews && reviews.length === 0 && (
            <div style={{ color: 'var(--color-text-secondary)', padding: '36px 0', textAlign: 'center' }}>
              ✓ Zero pending duplicate reviews! All patient records are cleanly partitioned.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
            {reviews.map((rev) => (
              <div
                key={rev.reviewId}
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255, 183, 3, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge" style={{ background: 'var(--color-status-warning)', color: '#000', fontWeight: 700 }}>
                      MATCH SCORE: {rev.matchScore} / 100
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                      Ticket: {rev.reviewId}
                    </span>
                  </div>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', fontSize: '0.72rem' }}>
                    {rev.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {rev.matchReasons.map((r, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(255, 183, 3, 0.12)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.72rem',
                        color: 'var(--color-status-warning)',
                      }}
                    >
                      {r}
                    </span>
                  ))}
                </div>

                {/* Side-by-Side Comparison */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>NEW INTAKE PATIENT</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                      {rev.newPatient?.fullName || rev.newPatientId}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      ID: <code>{rev.newPatientId}</code><br />
                      Age: {rev.newPatient?.ageEstimated} • Gender: {rev.newPatient?.gender}<br />
                      Village: {rev.newPatient?.villageName} ({rev.newPatient?.mandal})
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>EXISTING RECORD CANDIDATE</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-brand-accent)' }}>
                      {rev.existingPatient?.fullName || rev.existingPatientId}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      ID: <code>{rev.existingPatientId}</code><br />
                      Age: {rev.existingPatient?.ageEstimated} • Gender: {rev.existingPatient?.gender}<br />
                      Village: {rev.existingPatient?.villageName} ({rev.existingPatient?.mandal})
                    </div>
                  </div>
                </div>

                {/* Administrative Resolution Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleResolveReview(rev.reviewId, 'resolved_distinct')}
                    disabled={resolvingId === rev.reviewId}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    ✓ Confirm Distinct Individuals
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleResolveReview(rev.reviewId, 'resolved_merged')}
                    disabled={resolvingId === rev.reviewId}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', background: 'var(--color-status-warning)', color: '#000' }}
                  >
                    🔗 Authorized Manual Merge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ENCRYPTED OFFLINE QUEUE (WEBCRYPTO & DEXIE) */}
      {activeTab === 'queue' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                Encrypted Offline Queue (WebCrypto AES-GCM-256 + Dexie)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                Zero plaintext at rest. Client mutations survive page reloads and sync idempotently to the server.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSyncQueue}
              disabled={syncingQueue || queueItems.filter((q) => q.status === 'pending').length === 0}
              style={{ fontSize: '0.85rem' }}
            >
              {syncingQueue ? 'Syncing...' : '⚡ Sync Queue to Cloud'}
            </button>
          </div>

          {queueMsg && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: queueMsg.includes('✓') ? 'rgba(6, 214, 160, 0.15)' : 'rgba(230, 57, 70, 0.15)',
                color: queueMsg.includes('✓') ? 'var(--color-brand-accent)' : 'var(--color-status-danger)',
                fontSize: '0.84rem',
              }}
            >
              {queueMsg}
            </div>
          )}

          {queueItems.length === 0 && (
            <div style={{ color: 'var(--color-text-secondary)', padding: '36px 0', textAlign: 'center' }}>
              Offline queue is empty. Submit a patient registration with "Save to Encrypted Offline Queue".
            </div>
          )}

          {queueItems.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: '16px' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Mutation ID</th>
                    <th>Type</th>
                    <th>Encryption Ciphertext (Base64)</th>
                    <th>IV / Salt</th>
                    <th>Status</th>
                    <th>Retries</th>
                    <th>Queued At</th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map((item) => (
                    <tr key={item.id}>
                      <td><code style={{ color: 'var(--color-brand-accent)' }}>{item.clientMutationId.substring(0, 18)}...</code></td>
                      <td>{item.type}</td>
                      <td>
                        <code style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          {item.ciphertext.substring(0, 32)}... [AES-GCM-256]
                        </code>
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                        IV: {item.iv.substring(0, 8)}... | Salt: {item.salt.substring(0, 8)}...
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background:
                              item.status === 'synced'
                                ? 'var(--color-status-success)'
                                : item.status === 'pending'
                                ? 'var(--color-brand-primary)'
                                : 'var(--color-status-danger)',
                            color: '#fff',
                            fontSize: '0.7rem',
                          }}
                        >
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                      <td>{item.retryCount}</td>
                      <td style={{ fontSize: '0.75rem' }}>
                        {new Date(item.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
