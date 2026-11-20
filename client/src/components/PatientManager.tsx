import React, { useState, useEffect, useRef } from 'react';
import { AuthUser } from './AuthPanel';
import { db, EncryptedQueueItem } from '../db/aarogyaDb';
import { enqueueOfflinePatient, syncOfflineQueue } from '../offline/cryptoQueue';
import { LoginRequiredView } from './UIStateViews';
import { LanguageCode, getClientTranslation, translations } from '../i18n';
import { extractIdentityFromImages, IdentityDocumentKind } from '../services/localIdentityOcr';

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
  originalAddressText?: string;
  hospitalId?: string;
  isDuplicateCandidate: boolean;
  duplicateReviewStatus: string;
  matchScore?: number;
  matchReasons?: string[];
  registeredAt: string;
  flow?: {
    screening: string;
    aiScreening?: { screeningId?: string; createdAt?: string; reviewStatus?: string; status: string };
    referral: string;
    appointment: string;
  };
}

interface AiScreeningHistoryItem {
  screeningId: string;
  createdAt: string;
  riskLevel: string;
  summary?: string | null;
  findingTypeLabel?: string | null;
  nextStep: { text: string; withinDays: number };
  clinicianReview: { status: string; reviewedAt?: string | null };
  disclaimer: string;
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

interface WorkerAssignment {
  hospitalId: string;
  assignedMandal: string;
  assignedVillages: string[];
  scopeType?: 'assignment' | 'facility';
}

interface ReferenceVillage {
  villageId: string;
  villageName: string;
  mandal: string;
  hospitalId: string;
}

interface PatientManagerProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
  currentLang?: LanguageCode;
  onStartAiScreening?: (patient: { patientId: string; fullName: string }) => void;
}

export const PatientManager: React.FC<PatientManagerProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
  currentLang = 'en',
  onStartAiScreening,
}) => {
  const isFieldWorker = ['asha', 'asha_worker', 'anm'].includes(currentUser?.role?.toLowerCase() || '');
  const [activeTab, setActiveTab] = useState<'register' | 'patients' | 'duplicates' | 'queue'>('register');

  // Registration Method & Mode State
  const [regMethod, setRegMethod] = useState<'aadhaar_assisted' | 'manual' | 'health_worker_assisted'>(isFieldWorker ? 'health_worker_assisted' : 'aadhaar_assisted');
  const [aadhaarFront, setAadhaarFront] = useState<string | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<string | null>(null);
  const [showAadhaarScan, setShowAadhaarScan] = useState(false);
  const [cameraSide, setCameraSide] = useState<'front' | 'back' | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [extractingOcr, setExtractingOcr] = useState<boolean>(false);
  const [maskedAadhaar, setMaskedAadhaar] = useState<string>('');
  const [maskedAbha, setMaskedAbha] = useState<string>('');
  const [identityDocKind, setIdentityDocKind] = useState<IdentityDocumentKind>('aadhaar');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const uiLanguage = currentLang === 'te' || currentLang === 'hi' ? currentLang : 'en';
  const ocrText = (key: string) => getClientTranslation(translations[uiLanguage], `patientOcr.${key}`);
  const [dob, setDob] = useState<string>('');
  const [stateName, setStateName] = useState<string>('Andhra Pradesh');
  const [district] = useState<string>('Alluri Sitharama Raju');
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');
  const [caregiverName, setCaregiverName] = useState<string>('');
  const [caregiverPhone, setCaregiverPhone] = useState<string>('');
  const [consentObtained, setConsentObtained] = useState<boolean>(true);

  // Registration Form State
  const [fullName, setFullName] = useState(isFieldWorker ? '' : 'Korra Somulu');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>(isFieldWorker ? '' : 'male');
  const [ageEstimated, setAgeEstimated] = useState<number | ''>(isFieldWorker ? '' : 54);
  const [phone, setPhone] = useState<string>(isFieldWorker ? '' : '9440188990');
  const [guardianName, setGuardianName] = useState<string>(isFieldWorker ? '' : 'Korra Somanna');
  const [villageName, setVillageName] = useState<string>(isFieldWorker ? '' : 'Vankachinta');
  const [villageId, setVillageId] = useState<string>('');
  const [mandal, setMandal] = useState<string>(isFieldWorker ? '' : 'Paderu');
  const [originalAddressText, setOriginalAddressText] = useState<string>(
    isFieldWorker ? '' : 'Near Old Water Tank, Vankachinta Upper Habitation, Paderu Mandal, ASR District'
  );
  const [hospitalId, setHospitalId] = useState<string>(isFieldWorker ? currentUser?.hospitalId || '' : currentUser?.hospitalId || 'hosp_paderu_dh');
  const [submitting, setSubmitting] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [regMsg, setRegMsg] = useState<{ type: 'success' | 'warning' | 'error'; text: string; details?: any } | null>(null);
  const [referenceVillages, setReferenceVillages] = useState<ReferenceVillage[]>([]);
  const [workerAssignment, setWorkerAssignment] = useState<WorkerAssignment | null>(null);
  const [workerScopeError, setWorkerScopeError] = useState('');
  const [usingCachedWorkerScope, setUsingCachedWorkerScope] = useState(false);
  const [patientLoadError, setPatientLoadError] = useState('');

  // Patients List State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [screeningHistory, setScreeningHistory] = useState<AiScreeningHistoryItem[]>([]);
  const [loadingScreeningHistory, setLoadingScreeningHistory] = useState(false);
  const [screeningHistoryError, setScreeningHistoryError] = useState('');
  const screeningHistoryRequestRef = useRef(0);

  // Duplicate Review Tickets State
  const [reviews, setReviews] = useState<DuplicateReviewTicket[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Offline Encrypted Queue State
  const [queueItems, setQueueItems] = useState<EncryptedQueueItem[]>([]);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [queueMsg, setQueueMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const registrationFormRef = useRef<HTMLFormElement>(null);
  const aadhaarFrontInputRef = useRef<HTMLInputElement>(null);
  const aadhaarBackInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const pendingPatientMutationRef = useRef<{ fingerprint: string; clientMutationId: string } | null>(null);
  const publicRegText = (key: string) => getClientTranslation(translations[uiLanguage], `public.reg.${key}`);

  const stopAadhaarCamera = () => {
    cameraRequestRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraSide(null);
  };

  const startAadhaarCamera = async (side: 'front' | 'back') => {
    stopAadhaarCamera();
    const requestId = cameraRequestRef.current;
    setCameraError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable.');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraSide(side);
    } catch (error) {
      if (cameraRequestRef.current === requestId) {
        const detail = error instanceof Error ? ` ${error.message}` : '';
        setCameraError(`${publicRegText('cameraError')}${detail}`);
        stopAadhaarCamera();
      }
    }
  };

  const captureAadhaarCamera = () => {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !cameraSide) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1200 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError(publicRegText('cameraError'));
      stopAadhaarCamera();
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.82);
    if (cameraSide === 'front') setAadhaarFront(image);
    else setAadhaarBack(image);
    stopAadhaarCamera();
  };

  const clearAadhaarImages = () => {
    setAadhaarFront(null);
    setAadhaarBack(null);
    stopAadhaarCamera();
    setCameraError('');
    if (aadhaarFrontInputRef.current) aadhaarFrontInputRef.current.value = '';
    if (aadhaarBackInputRef.current) aadhaarBackInputRef.current.value = '';
  };

  useEffect(() => {
    const video = cameraVideoRef.current;
    const stream = cameraStreamRef.current;
    if (cameraSide && video && stream) {
      video.srcObject = stream;
      void video.play().catch(() => {
        setCameraError(publicRegText('cameraError'));
        stopAadhaarCamera();
      });
    }
  }, [cameraSide]);

  useEffect(() => {
    const stopCamera = () => {
      cameraRequestRef.current += 1;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
      setCameraSide(null);
    };
    window.addEventListener('aarogya:stop-camera', stopCamera);
    return () => {
      window.removeEventListener('aarogya:stop-camera', stopCamera);
      cameraRequestRef.current += 1;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  const fetchPatients = async () => {
    if (!accessToken) return;
    setLoadingPatients(true);
    setPatientLoadError('');
    try {
      const res = await fetch('/api/v1/patients', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await res.json();
      if (res.ok && payload.success) {
        setPatients(payload.data?.patients || []);
      } else {
        throw new Error(payload.error?.message || 'Unable to load patients in your assigned scope.');
      }
    } catch (err) {
      setPatientLoadError(err instanceof Error ? err.message : 'Unable to load patients in your assigned scope.');
    } finally {
      setLoadingPatients(false);
    }
  };

  const togglePatientProfile = async (patientId: string) => {
    const requestId = ++screeningHistoryRequestRef.current;
    if (expandedPatientId === patientId) {
      setExpandedPatientId(null);
      setScreeningHistory([]);
      setScreeningHistoryError('');
      setLoadingScreeningHistory(false);
      return;
    }

    setExpandedPatientId(patientId);
    setScreeningHistory([]);
    setScreeningHistoryError('');
    if (!accessToken) {
      setScreeningHistoryError('Sign in again to load this patient’s check-up history.');
      return;
    }

    setLoadingScreeningHistory(true);
    try {
      const response = await fetch(`/api/ai/screenings?patientId=${encodeURIComponent(patientId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error?.message || 'Unable to load this patient’s screening history.');
      }
      if (requestId === screeningHistoryRequestRef.current) setScreeningHistory(payload.data);
    } catch (error) {
      if (requestId === screeningHistoryRequestRef.current) {
        setScreeningHistoryError(error instanceof Error ? error.message : 'Unable to load this patient’s screening history.');
      }
    } finally {
      if (requestId === screeningHistoryRequestRef.current) setLoadingScreeningHistory(false);
    }
  };

  const fetchReviews = async () => {
    if (!accessToken || isFieldWorker) return;
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

    let active = true;
    const loadFieldWorkerScope = async () => {
      if (!accessToken) return;
      setWorkerScopeError('');
      setUsingCachedWorkerScope(false);
      if (isFieldWorker) {
        setWorkerAssignment(null);
        setReferenceVillages([]);
      }
      let serviceUnavailable = false;
      try {
        if (isFieldWorker) {
          if (!currentUser?.userId) throw new Error('Your account is missing its worker ID.');
          const workerId = currentUser.userId;
          const assignmentResponse = await fetch(`/api/v1/assignments/worker/${encodeURIComponent(currentUser.userId)}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const assignmentPayload = await assignmentResponse.json();
          if (!assignmentResponse.ok || !assignmentPayload.success) {
            serviceUnavailable = assignmentResponse.status >= 500;
            throw new Error(assignmentPayload.error?.message || 'Unable to load your village assignment.');
          }
          const assignment = assignmentPayload.data?.assignment as WorkerAssignment | null;
          const assignedVillageIds = assignment?.assignedVillages || [];
          const hasVillageAssignment = assignedVillageIds.length > 0;

          const villagesResponse = await fetch('/api/v1/reference/villages', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const villagesPayload = await villagesResponse.json();
          if (!villagesResponse.ok || !villagesPayload.success) {
            serviceUnavailable = villagesResponse.status >= 500;
            throw new Error(villagesPayload.error?.message || 'Unable to load your assigned villages.');
          }
          const facilityId = assignment?.hospitalId
            || villagesPayload.data?.hospitalId
            || currentUser.hospitalId
            || '';
          const villages = ((villagesPayload.data?.villages || []) as ReferenceVillage[])
            .filter((village) => hasVillageAssignment
              ? assignedVillageIds.includes(village.villageId)
              : village.hospitalId === facilityId);
          if (!active) return;
          if (!facilityId || villages.length === 0) {
            setWorkerAssignment(null);
            setReferenceVillages([]);
            await db.workerScopes.delete(workerId);
            setWorkerScopeError(hasVillageAssignment
              ? 'Your assignment has no active village records. Ask your administrator to update the village assignment.'
              : 'No active villages are available for your healthcare facility. Ask your administrator to verify the facility village list.');
            return;
          }
          const workerScope: WorkerAssignment = {
            hospitalId: facilityId,
            assignedMandal: hasVillageAssignment ? assignment?.assignedMandal || '' : '',
            assignedVillages: hasVillageAssignment ? assignedVillageIds : villages.map((village) => village.villageId),
            scopeType: hasVillageAssignment ? 'assignment' : 'facility',
          };
          setWorkerAssignment(workerScope);
          setHospitalId(workerScope.hospitalId);
          setMandal(workerScope.assignedMandal);
          setReferenceVillages(villages);
          try {
            await db.workerScopes.put({
              workerId,
              hospitalId: workerScope.hospitalId,
              scopeType: workerScope.scopeType,
              assignedMandal: workerScope.assignedMandal,
              assignedVillages: workerScope.assignedVillages,
              villages,
              cachedAt: Date.now(),
            });
          } catch (cacheError) {
            if (active) {
              setWorkerScopeError(
                `Your assignment is loaded, but could not be saved for offline use: ${
                  cacheError instanceof Error ? cacheError.message : 'local storage is unavailable.'
                }`
              );
            }
          }
        } else {
          const villagesResponse = await fetch('/api/v1/reference/villages', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const villagesPayload = await villagesResponse.json();
          if (villagesResponse.ok && villagesPayload.success && Array.isArray(villagesPayload.data?.villages)) {
            setReferenceVillages(villagesPayload.data.villages);
          }
        }
      } catch (err) {
        if (!active) return;
        if (isFieldWorker && currentUser?.userId
          && (!navigator.onLine || err instanceof TypeError || serviceUnavailable)) {
          try {
            const cachedScope = await db.workerScopes.get(currentUser.userId);
            const cachedVillages = cachedScope?.villages.filter((village) =>
              cachedScope.assignedVillages.includes(village.villageId)
            ) || [];
            if (!active) return;
            if (cachedScope && cachedScope.assignedVillages.length > 0 && cachedVillages.length > 0) {
              setWorkerAssignment({
                hospitalId: cachedScope.hospitalId,
                assignedMandal: cachedScope.assignedMandal,
                assignedVillages: cachedScope.assignedVillages,
                scopeType: cachedScope.scopeType || 'assignment',
              });
              setHospitalId(cachedScope.hospitalId);
              setMandal(cachedScope.assignedMandal);
              setReferenceVillages(cachedVillages);
              setUsingCachedWorkerScope(true);
              return;
            }
            setWorkerScopeError('Offline registration needs a saved facility village list. Connect while online to load it, or ask your administrator to verify your facility villages.');
          } catch (cacheError) {
            setWorkerScopeError(
              `Unable to load your saved village assignment: ${
                cacheError instanceof Error ? cacheError.message : 'local storage is unavailable.'
              }`
            );
          }
          return;
        }
        setWorkerScopeError(err instanceof Error ? err.message : 'Unable to load your assigned villages.');
      }
    };
    void loadFieldWorkerScope();
    return () => { active = false; };
  }, [accessToken, currentUser?.userId, isFieldWorker]);

  useEffect(() => {
    if (!isFieldWorker && currentUser?.hospitalId) {
      setHospitalId(currentUser.hospitalId);
    }
  }, [currentUser, isFieldWorker]);

  useEffect(() => {
    if (!isFieldWorker) return;
    setActiveTab('register');
    setFullName('');
    setGender('');
    setAgeEstimated('');
    setPhone('');
    setGuardianName('');
    setVillageName('');
    setVillageId('');
    setMandal('');
    setOriginalAddressText('');
    setHospitalId('');
    setRegMethod('health_worker_assisted');
    setShowAadhaarScan(false);
    setIdentityDocKind('aadhaar');
    setMaskedAadhaar('');
    setMaskedAbha('');
  }, [isFieldWorker]);

  useEffect(() => {
    if (activeTab !== 'register') {
      clearAadhaarImages();
      setShowAadhaarScan(false);
      setMaskedAadhaar('');
      setMaskedAbha('');
    }
  }, [activeTab]);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  const buildPatientPayload = () => ({
    fullName: fullName.trim(),
    gender,
    ageEstimated: Number(ageEstimated),
    phone: phone.trim() || undefined,
    guardianName: guardianName.trim() || undefined,
    villageId: villageId || undefined,
    villageName: villageName.trim(),
    mandal: mandal.trim(),
    district: district.trim(),
    originalAddressText: isFieldWorker
      ? [villageName.trim(), mandal.trim()].join(', ')
      : originalAddressText.trim(),
    hospitalId,
    maskedAadhaar: isFieldWorker ? undefined : maskedAadhaar || undefined,
    registrationMethod: regMethod,
    consentObtained,
    emergencyContact: [
      emergencyName.trim() && `Name: ${emergencyName.trim()}`,
      emergencyPhone.trim() && `Phone: ${emergencyPhone.trim()}`,
    ].filter(Boolean).join('; ') || undefined,
    caregiverDetails: [
      caregiverName.trim() && `Name: ${caregiverName.trim()}`,
      caregiverPhone.trim() && `Phone: ${caregiverPhone.trim()}`,
    ].filter(Boolean).join('; ') || undefined,
  });

  const availableMandals = Array.from(new Set(referenceVillages.map((village) => village.mandal))).sort();
  const registrationVillages = workerAssignment?.scopeType === 'facility'
    ? mandal
      ? referenceVillages.filter((village) => village.mandal.toLowerCase() === mandal.toLowerCase())
      : []
    : referenceVillages;
  const selectableMandals = workerAssignment?.scopeType === 'assignment'
    ? availableMandals.filter((availableMandal) =>
      availableMandal.toLowerCase() === workerAssignment.assignedMandal.toLowerCase())
    : availableMandals;

  const getWorkerLocationError = () => {
    if (!workerAssignment || referenceVillages.length === 0) {
      return workerScopeError || 'Your authorized village list is not loaded yet. Please try again.';
    }

    const hasAuthorizedMandal = workerAssignment.scopeType === 'assignment'
      ? mandal.trim().toLowerCase() === workerAssignment.assignedMandal.trim().toLowerCase()
      : availableMandals.some((availableMandal) =>
        availableMandal.trim().toLowerCase() === mandal.trim().toLowerCase());
    if (!villageName.trim() || !hasAuthorizedMandal) {
      return workerAssignment.scopeType === 'facility'
        ? 'Enter a village or habitation and choose a mandal with active villages in your facility.'
        : 'Enter a village or habitation in your assigned mandal.';
    }

    if (!villageId) return null;

    const selectedVillage = referenceVillages.find((village) => village.villageId === villageId);
    if (!selectedVillage
      || selectedVillage.villageName.trim().toLowerCase() !== villageName.trim().toLowerCase()
      || selectedVillage.mandal.trim().toLowerCase() !== mandal.trim().toLowerCase()) {
      return 'Choose a listed village or enter an unlisted habitation in an authorized mandal.';
    }

    return null;
  };

  const saveRegistrationOffline = async () => {
    const queuedItem = await enqueueOfflinePatient(buildPatientPayload());
    clearAadhaarImages();
    setMaskedAadhaar('');
    setMaskedAbha('');
    await refreshQueue();
    setRegMsg({
      type: 'success',
      text: `Saved securely on this device. Registration is pending sync (Mutation ID: ${queuedItem.clientMutationId.slice(0, 12)}…). It is not yet registered on the server.`,
    });
  };

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

// On-device identity-card OCR. Card pixels and full OCR text never leave this browser.
  const handleExtractOcr = async () => {
    if (!consentObtained) {
      setRegMsg({ type: 'error', text: ocrText('consentRequired') });
      return;
    }
    const images = [aadhaarFront, aadhaarBack].filter((image): image is string => Boolean(image));
    if (!images.length) {
      setRegMsg({ type: 'error', text: ocrText('selectImage') });
      return;
    }

    setExtractingOcr(true);
    setOcrProgress(0);
    setRegMsg(null);
    let extractedSuccessfully = false;
    try {
      const fields = await extractIdentityFromImages(images, identityDocKind, setOcrProgress);
      const foundAnyField = isFieldWorker
        ? Boolean(fields.fullName || fields.gender || fields.village || fields.habitation || fields.mandal)
        : Boolean(fields.fullName || fields.dob || fields.gender || fields.guardianName || fields.address);
      if (!foundAnyField) throw new Error(ocrText('noFields'));

      if (fields.fullName) setFullName(fields.fullName);
      if (fields.gender) setGender(fields.gender === 'transgender' ? 'other' : fields.gender);
      if (!isFieldWorker && fields.ageEstimated) setAgeEstimated(fields.ageEstimated);
      if (!isFieldWorker && fields.dob) setDob(fields.dob);
      if (!isFieldWorker && fields.guardianName) setGuardianName(fields.guardianName);
      if (!isFieldWorker && fields.address) setOriginalAddressText(fields.address);
      if (isFieldWorker && workerAssignment?.scopeType === 'facility' && fields.mandal) {
        const recognizedMandal = availableMandals.find((candidate) =>
          candidate.trim().toLowerCase() === fields.mandal?.trim().toLowerCase()
        );
        if (recognizedMandal) setMandal(recognizedMandal);
      }
      if (isFieldWorker && (fields.village || fields.habitation)) {
        const recognizedVillage = (fields.village || fields.habitation)!.trim();
        const selectedVillage = referenceVillages.find((village) =>
          village.villageName.trim().toLowerCase() === recognizedVillage.toLowerCase()
        );
        setVillageName(selectedVillage?.villageName || recognizedVillage);
        setVillageId(selectedVillage?.villageId || '');
        if (selectedVillage) setMandal(selectedVillage.mandal);
      }
      if (!isFieldWorker && identityDocKind === 'aadhaar' && fields.maskedIdentity) {
        setMaskedAadhaar(fields.maskedIdentity);
        setMaskedAbha('');
      } else if (!isFieldWorker && identityDocKind === 'abha' && fields.maskedIdentity) {
        setMaskedAbha(fields.maskedIdentity);
        setMaskedAadhaar('');
      }

      setRegMsg({ type: 'warning', text: ocrText('reviewExtracted') });
      extractedSuccessfully = true;
    } catch (err: any) {
      setRegMsg({ type: 'error', text: err.message || ocrText('ocrFailed') });
    } finally {
      if (extractedSuccessfully) clearAadhaarImages();
      setExtractingOcr(false);
    }
  };
  // Online Registration
  const handleRegisterOnline = async (e: React.FormEvent) => {
    e.preventDefault();
    const locationError = isFieldWorker ? getWorkerLocationError() : null;
    if (locationError) {
      setRegMsg({ type: 'error', text: locationError });
      return;
    }
    if (!navigator.onLine) {
      setRegMsg({
        type: 'warning',
        text: 'You are offline, so no online registration was sent. Reconnect to register, or choose Save Offline (Optional) to queue it on this device.',
      });
      return;
    }
    if (!accessToken) {
      setRegMsg({ type: 'error', text: 'Authentication token required for online registration' });
      return;
    }

    setSubmitting(true);
    setRegMsg(null);

    try {
      const patientPayload = buildPatientPayload();
      const fingerprint = JSON.stringify(patientPayload);
      if (pendingPatientMutationRef.current?.fingerprint !== fingerprint) {
        pendingPatientMutationRef.current = { fingerprint, clientMutationId: crypto.randomUUID() };
      }
      const res = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ...patientPayload,
          clientMutationId: pendingPatientMutationRef.current.clientMutationId,
        }),
      });

      const payload = await res.json();
      if (res.ok && payload.success) {
        pendingPatientMutationRef.current = null;
        clearAadhaarImages();
        setMaskedAadhaar('');
        setMaskedAbha('');
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
      if (err instanceof TypeError || !navigator.onLine) {
        setRegMsg({
          type: 'warning',
          text: 'The server connection was lost, so registration could not be confirmed. Check My Patients before retrying, or choose Save Offline (Optional) to queue a local copy.',
        });
      } else {
        setRegMsg({ type: 'error', text: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Offline Encrypted Queue Save
  const handleSaveToEncryptedQueue = async () => {
    const locationError = isFieldWorker ? getWorkerLocationError() : null;
    if (locationError) {
      setRegMsg({ type: 'error', text: locationError });
      return;
    }
    if (!registrationFormRef.current?.reportValidity()) return;
    setSavingOffline(true);
    try {
      await saveRegistrationOffline();
    } catch (err: any) {
      setRegMsg({ type: 'error', text: `Could not save registration offline: ${err.message}` });
    } finally {
      setSavingOffline(false);
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
              <span>{isFieldWorker ? 'ASHA FIELD WORK' : 'TRIBAL PATIENT INTAKE & REGISTRY • గిరిజన రోగుల నమోదు'}</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 600, margin: '0 0 8px', color: 'var(--slate)' }}>
              {isFieldWorker ? 'Patient workspace' : 'Patients Registry & Idempotent Offline Sync'}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '820px', margin: 0, lineHeight: 1.5 }}>
              {isFieldWorker
                ? 'Register patients in your assigned villages and review their care records. Your work is saved securely when offline.'
                : <><strong>OTP-Free Registration</strong> designed for remote agency habitations with zero cellular connectivity. Features a composite duplicate-detection engine (duplicates are <em>never auto-merged</em>), verbatim address preservation, and client-side <strong>AES-GCM-256 WebCrypto</strong> offline queue surviving reloads and syncing exactly once.</>}
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
          📝 {isFieldWorker ? 'Register Patient' : 'OTP-Free Registration'}
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'patients' ? 'active' : ''}`}
          onClick={() => setActiveTab('patients')}
        >
          🗂️ {isFieldWorker
            ? workerAssignment?.scopeType === 'facility' ? 'My Patient Registrations' : 'My Assigned Patients'
            : 'Patient Registry'} ({patients.length})
        </button>
        {!isFieldWorker && (
          <button
            type="button"
            className={`auth-tab ${activeTab === 'duplicates' ? 'active' : ''}`}
            onClick={() => setActiveTab('duplicates')}
          >
            ⚠️ Duplicate Review Queue ({reviews.length})
          </button>
        )}
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
          <form ref={registrationFormRef} onSubmit={handleRegisterOnline} className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  {isFieldWorker ? 'Register a Patient in Your Assigned Area' : 'Smart Patient Registration (OTP-Free)'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                  {isFieldWorker
                    ? 'Register online first for immediate confirmation. Saving offline is optional; records remain pending until synced.'
                    : <>Choose registration method. Generates standard Unique Tribal Patient ID (e.g. <code>PAD-2026-XXXXX</code>).</>}
                </p>
              </div>
              <span className="badge badge-mock">{isFieldWorker ? 'Offline-ready' : 'Zero-Connectivity Ready'}</span>
            </div>

            {isFieldWorker && (
              <div role="status" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: workerScopeError ? 'rgba(230, 57, 70, 0.12)' : usingCachedWorkerScope ? 'rgba(255, 183, 3, 0.12)' : 'rgba(6, 214, 160, 0.10)', color: 'var(--color-text-primary)', fontSize: '0.84rem' }}>
                {workerScopeError || (usingCachedWorkerScope
                  ? workerAssignment?.scopeType === 'facility'
                    ? `Using the saved village list for ${workerAssignment.hospitalId}. Choose a mandal and village; the server will re-check facility access when records sync.`
                    : `Using your saved assignment for ${workerAssignment?.assignedMandal}. Registrations stay on this device until sync, when the server re-checks your access.`
                  : workerAssignment
                    ? workerAssignment.scopeType === 'facility'
                      ? `Select any active village in your facility (${workerAssignment.hospitalId}).`
                      : `Assigned facility: ${workerAssignment.hospitalId} · Mandal: ${workerAssignment.assignedMandal}`
                    : 'Loading your facility villages...')}
              </div>
            )}

            <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12, padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${isOnline ? 'var(--color-status-success)' : 'var(--color-status-warning)'}`, background: isOnline ? 'rgba(6, 214, 160, 0.10)' : 'rgba(255, 183, 3, 0.12)' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)' }}>
                {isOnline ? 'Online: registrations can be submitted to the server.' : 'Offline: submit to save this registration securely on this device; sync it when connected.'}
                {' '}Pending registrations: {queueItems.filter((item) => item.type === 'patient_registration' && ['pending', 'failed'].includes(item.status)).length}
              </span>
              <button type="button" className="button-outline" onClick={() => setActiveTab('queue')} style={{ fontSize: '0.8rem', padding: '6px 10px' }}>
                Review offline queue
              </button>
            </div>

            {/* 3-Method Registration Selector */}
            {isFieldWorker && (
              <button
                type="button"
                className={`auth-tab ${showAadhaarScan ? 'active' : ''}`}
                aria-pressed={showAadhaarScan}
                onClick={() => {
                  if (showAadhaarScan) {
                    clearAadhaarImages();
                    setMaskedAadhaar('');
                  }
                  setShowAadhaarScan((visible) => !visible);
                }}
                style={{ marginTop: '14px' }}
              >
                🪪 {ocrText('aadhaarCard')}
              </button>
            )}
            {!isFieldWorker && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '14px' }}>
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
            </div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              {/* MODE A: AADHAAR OCR EXTRACTION BOX */}
              {(regMethod === 'aadhaar_assisted' || (isFieldWorker && showAadhaarScan)) && (
                <div style={{ padding: '12px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--color-brand-primary)' }}>
                      {ocrText('title')}
                    </strong>
                    <span className="badge badge-mock">MOCK · ON-DEVICE OCR</span>
                  </div>
                  <p style={{ fontSize: '0.76rem', color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
                    {ocrText('privacyNote')}
                  </p>

                  {!isFieldWorker && <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {(['aadhaar', 'abha'] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        className={`auth-tab ${identityDocKind === kind ? 'active' : ''}`}
                        onClick={() => {
                          setIdentityDocKind(kind);
                          setMaskedAadhaar('');
                          setMaskedAbha('');
                        }}
                        style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                      >
                        {kind === 'aadhaar' ? ocrText('aadhaarCard') : ocrText('abhaCard')}
                      </button>
                    ))}
                  </div>}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ border: '1px dashed rgba(255,255,255,0.25)', padding: '10px', borderRadius: '6px', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
                      <span style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px', fontWeight: 600 }}>{ocrText('frontImage')}</span>
                      {isFieldWorker && <button
                        type="button"
                        className="button-outline"
                        onClick={() => void startAadhaarCamera('front')}
                        disabled={extractingOcr}
                        style={{ marginBottom: '8px' }}
                      >
                        📷 {publicRegText('useCamera')}
                      </button>}
                      <input
                        ref={aadhaarFrontInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
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
                      <span style={{ fontSize: '0.78rem', display: 'block', marginBottom: '4px', fontWeight: 600 }}>{ocrText('backImage')}</span>
                      {isFieldWorker && <button
                        type="button"
                        className="button-outline"
                        onClick={() => void startAadhaarCamera('back')}
                        disabled={extractingOcr}
                        style={{ marginBottom: '8px' }}
                      >
                        📷 {publicRegText('useCamera')}
                      </button>}
                      <input
                        ref={aadhaarBackInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
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

                  {cameraSide && (
                    <div className="adp-camera">
                      <video ref={cameraVideoRef} playsInline muted autoPlay />
                      <div className="adp-camera-frame" aria-hidden="true" />
                      <p>{publicRegText('cameraHelp')}</p>
                      <div className="adp-camera-actions">
                        <button type="button" className="button-outline" onClick={stopAadhaarCamera}>
                          {getClientTranslation(translations[uiLanguage], 'common.cancel')}
                        </button>
                        <button type="button" className="button-forest-primary button" onClick={captureAadhaarCamera}>
                          {publicRegText('capture')}
                        </button>
                      </div>
                    </div>
                  )}
                  {cameraError && <p role="alert" style={{ color: 'var(--color-status-error)' }}>{cameraError}</p>}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      className="button-forest-primary button"
                      style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                      onClick={handleExtractOcr}
                      disabled={extractingOcr}
                    >
                      {extractingOcr ? `${ocrText('scanning')} ${ocrProgress}%` : ocrText('extractButton')}
                    </button>
                    {!isFieldWorker && maskedAadhaar && (
                      <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                        🔒 {ocrText('maskedAadhaar')}: {maskedAadhaar}
                      </span>
                    )}
                    {!isFieldWorker && maskedAbha && (
                      <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                        🔒 {ocrText('maskedAbha')}: {maskedAbha}
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
                      {(isFieldWorker
                        ? referenceVillages.map((village) => village.villageName)
                        : ['Vankachinta', 'Minumuluru', 'Dumbriguda', 'Araku Valley', 'Munchingiputtu', 'Chintapalli']
                      ).map((v) => (
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
                            if (isFieldWorker) {
                              const selectedVillage = referenceVillages.find((village) => village.villageName === v);
                              setVillageId(selectedVillage?.villageId || '');
                              if (selectedVillage?.mandal) setMandal(selectedVillage.mandal);
                            } else if (v === 'Vankachinta' || v === 'Minumuluru') setMandal('Paderu');
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
                        onClick={() => setAgeEstimated((prev) => Math.max(1, Math.min(115, Number(prev || 0) + delta)))}
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
                    onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'other' | '')}
                    required
                  >
                    {isFieldWorker && <option value="" disabled>Select gender</option>}
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
                    onChange={(e) => setAgeEstimated(e.target.value ? Number(e.target.value) : '')}
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
                  <label className="form-label">
                    {isFieldWorker && workerAssignment?.scopeType === 'assignment' ? 'Assigned Mandal' : 'Mandal'}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={mandal}
                    onChange={(e) => {
                      const nextMandal = e.target.value;
                      setMandal(nextMandal);
                      if (regMsg?.type === 'error') setRegMsg(null);
                      const selectedVillage = referenceVillages.find((village) => village.villageId === villageId);
                      if (isFieldWorker && selectedVillage
                        && selectedVillage.mandal.toLowerCase() !== nextMandal.trim().toLowerCase()) {
                        setVillageId('');
                        setVillageName('');
                      }
                    }}
                    list={isFieldWorker ? 'worker-mandal-suggestions' : undefined}
                    placeholder={isFieldWorker
                      ? workerAssignment?.scopeType === 'assignment' ? 'Type your assigned mandal' : 'Type or select a mandal'
                      : 'e.g. Paderu, Araku Valley'}
                    required
                  />
                  {isFieldWorker && selectableMandals.length > 0 && (
                    <datalist id="worker-mandal-suggestions">
                      {selectableMandals.map((availableMandal) => (
                        <option key={availableMandal} value={availableMandal} />
                      ))}
                    </datalist>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {isFieldWorker && workerAssignment?.scopeType === 'assignment'
                      ? 'Assigned Village / Habitation'
                      : 'Village / Habitation Name'}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={villageName}
                    onChange={(e) => {
                      const nextVillageName = e.target.value;
                      setVillageName(nextVillageName);
                      if (regMsg?.type === 'error') setRegMsg(null);
                      const candidates = referenceVillages.filter(
                        (village) => village.villageName.trim().toLowerCase() === nextVillageName.trim().toLowerCase()
                      );
                      const selectedVillage = candidates.find(
                        (village) => village.mandal.trim().toLowerCase() === mandal.trim().toLowerCase()
                      ) || (candidates.length === 1 ? candidates[0] : undefined);
                      setVillageId(selectedVillage?.villageId || '');
                      if (selectedVillage) setMandal(selectedVillage.mandal);
                    }}
                    list={isFieldWorker ? 'worker-village-suggestions' : 'village-suggestions'}
                    placeholder="Enter village name manually or choose a suggestion"
                    required
                  />
                  {referenceVillages.length > 0 && (
                    <datalist id={isFieldWorker ? 'worker-village-suggestions' : 'village-suggestions'}>
                      {(isFieldWorker && workerAssignment?.scopeType === 'facility' && mandal
                        ? registrationVillages
                        : referenceVillages).map((village) => (
                        <option
                          key={village.villageId}
                          value={village.villageName}
                          label={`${village.villageName} (${village.mandal})`}
                        />
                      ))}
                    </datalist>
                  )}
                  {isFieldWorker && (
                    <span style={{ display: 'block', marginTop: '4px', fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>
                      {workerAssignment?.scopeType === 'facility' && referenceVillages.length > 0
                        ? 'Manual entry is enabled. Unlisted habitations are grouped under an active village in the selected facility mandal.'
                        : workerAssignment && referenceVillages.length > 0
                          ? 'Manual entry is enabled for villages and habitations within your assigned mandal.'
                          : 'No active facility villages are available. Ask your administrator to verify the facility village list.'}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Affiliated Healthcare Facility</label>
                {isFieldWorker ? (
                  <input className="form-input" value={hospitalId} readOnly aria-readonly="true" />
                ) : (
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
                )}
                <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                  Nearest clinical referral facility for triage and teleconsultation navigation.
                </span>
              </div>

              {!isFieldWorker && (
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
              )}

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
                  type="submit"
                  className="button button-primary"
                  disabled={submitting || savingOffline || (isFieldWorker && (!workerAssignment || referenceVillages.length === 0))}
                  style={{ flex: 1, fontSize: '0.88rem' }}
                >
                  {submitting ? 'Registering...' : '🚀 Register Patient Online'}
                </button>
                <button
                  type="button"
                  className="button-outline"
                  onClick={handleSaveToEncryptedQueue}
                  disabled={submitting || savingOffline || (isFieldWorker && (!workerAssignment || referenceVillages.length === 0))}
                  style={{ flex: 1, fontSize: '0.88rem' }}
                >
                  {savingOffline ? 'Saving Offline...' : '🔒 Save Offline (Optional)'}
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
          </div>
        </div>
      )}

      {/* TAB 2: PATIENT REGISTRY */}
      {activeTab === 'patients' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              {isFieldWorker
                ? workerAssignment?.scopeType === 'facility' ? 'My Patient Registrations' : 'My Assigned Patients'
                : 'Agency Patient Registry'} ({filteredPatients.length})
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
          {patientLoadError && <div role="alert" style={{ color: 'var(--color-status-danger)', padding: '12px 0' }}>{patientLoadError}</div>}

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
                    {!isFieldWorker && <th>Original Submitted Address</th>}
                    {!isFieldWorker && <th>Duplicate Status</th>}
                    {isFieldWorker && <th>Screening</th>}
                    {isFieldWorker && <th>AI Screening</th>}
                    {isFieldWorker && <th>Referral</th>}
                    {isFieldWorker && <th>Appointment</th>}
                    <th>Registered</th>
                    {isFieldWorker && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p) => (
                    <React.Fragment key={p.patientId}>
                      <tr>
                        <td><code style={{ color: 'var(--color-brand-accent)', fontWeight: 700 }}>{p.patientId}</code></td>
                        <td><strong>{p.fullName}</strong></td>
                        <td>{p.ageEstimated} yrs • {p.gender.toUpperCase()}</td>
                        <td>{p.villageName} ({p.mandal})</td>
                        {!isFieldWorker && <td style={{ maxWidth: '240px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{p.originalAddressText}</td>}
                        {!isFieldWorker && <td>
                          {p.isDuplicateCandidate ? (
                            <span className="badge" style={{ background: 'var(--color-status-warning)', color: '#000', fontSize: '0.7rem' }}>
                              ⚠️ {p.duplicateReviewStatus.toUpperCase()} ({p.matchScore} pts)
                            </span>
                          ) : (
                            <span className="badge badge-real" style={{ fontSize: '0.7rem' }}>✓ UNIQUE</span>
                          )}
                        </td>}
                        {isFieldWorker && <td>{(p.flow?.screening || 'not_started').replace(/_/g, ' ')}</td>}
                        {isFieldWorker && <td>{(p.flow?.aiScreening?.status || 'not_started').replace(/_/g, ' ')}</td>}
                        {isFieldWorker && <td>{(p.flow?.referral || 'not_referred').replace(/_/g, ' ')}</td>}
                        {isFieldWorker && <td>{(p.flow?.appointment || 'not_booked').replace(/_/g, ' ')}</td>}
                        <td style={{ fontSize: '0.75rem' }}>
                          {new Date(p.registeredAt).toLocaleDateString()}
                        </td>
                        {isFieldWorker && (
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              className="button-outline"
                              onClick={() => void togglePatientProfile(p.patientId)}
                            >
                              {expandedPatientId === p.patientId ? 'Hide profile' : 'Check-up history'}
                            </button>
                            {onStartAiScreening && (
                              <button
                                type="button"
                                className="button-forest-primary button"
                                style={{ marginLeft: 8 }}
                                onClick={() => onStartAiScreening({ patientId: p.patientId, fullName: p.fullName })}
                              >
                                Start AI screening
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                      {isFieldWorker && expandedPatientId === p.patientId && (
                        <tr>
                          <td colSpan={9} style={{ padding: 16, background: 'var(--color-surface-subtle, #f8faf8)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div>
                                <strong>{p.fullName} · Check-up history</strong>
                                <p style={{ margin: '4px 0', color: 'var(--color-text-secondary)' }}>
                                  Screening: {(p.flow?.screening || 'not_started').replace(/_/g, ' ')} ·
                                  {' '}AI screening: {(p.flow?.aiScreening?.status || 'not_started').replace(/_/g, ' ')} ·
                                  {' '}Referral: {(p.flow?.referral || 'not_referred').replace(/_/g, ' ')} ·
                                  {' '}Appointment: {(p.flow?.appointment || 'not_booked').replace(/_/g, ' ')}
                                </p>
                              </div>
                              {loadingScreeningHistory && <p role="status">Loading AI screening history...</p>}
                              {screeningHistoryError && <p role="alert" style={{ color: 'var(--color-status-danger)' }}>{screeningHistoryError}</p>}
                              {!loadingScreeningHistory && !screeningHistoryError && screeningHistory.length === 0 && (
                                <p style={{ margin: 0 }}>No AI screening records yet.</p>
                              )}
                              {screeningHistory.map((record) => (
                                <article key={record.screeningId} style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface, #fff)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <strong>{record.riskLevel.replace(/_/g, ' ')} · {record.findingTypeLabel || 'Screening completed'}</strong>
                                    <span>{new Date(record.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p style={{ margin: '8px 0' }}>
                                    Clinician review: {record.clinicianReview.status.replace(/_/g, ' ').toLowerCase()}.
                                    {' '}{record.nextStep.text} (within {record.nextStep.withinDays} days)
                                  </p>
                                  {record.summary && <p style={{ margin: '4px 0' }}>{record.summary}</p>}
                                  <small>{record.disclaimer}</small>
                                </article>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
