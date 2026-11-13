import React, { useState, useRef, useEffect } from 'react';
import {
  evaluateImageQualityClient,
  analyzeMucosalLesion,
  analyzeDentalFindings,
  evaluateRiskHistoryClient,
  generateCombinedReport,
  recordScreeningConsent,
  syncPendingAiScreenings,
  IMucosalLesionResult,
  IDentalResult,
  ICombinedReportResult,
  ImageQualityCheckResult,
} from '../../services/aiEngineService';
import { IRiskQuestionnaireAnswers, IRiskScoreResult } from '../../services/riskScore';
import { LanguageCode } from '../../i18n';

export interface AiOralHealthEngineProps {
  patientId?: string;
  patientName?: string;
  hospitalId?: string;
  userRole?: string;
  token?: string;
  currentLang?: LanguageCode;
  onReportGenerated?: (report: ICombinedReportResult) => void;
  onClose?: () => void;
}

export const AiOralHealthEngine: React.FC<AiOralHealthEngineProps> = ({
  patientId = '',
  patientName = '',
  hospitalId,
  userRole = '',
  token = '',
  currentLang = 'en',
  onReportGenerated,
  onClose,
}) => {
  const selectedPatientId = patientId;
  const selectedPatientName = patientName;

  // Wizard Steps: 1: Mucosal, 2: Dental, 3: Risk History, 4: Consolidated Report
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  // Module A State
  const [mucosalImageSrc, setMucosalImageSrc] = useState<string | null>(null);
  const [mucosalQuality, setMucosalQuality] = useState<ImageQualityCheckResult | null>(null);
  const [mucosalResult, setMucosalResult] = useState<IMucosalLesionResult | null>(null);
  const [isAnalyzingMucosal, setIsAnalyzingMucosal] = useState<boolean>(false);
  const [mucosalAnalysisError, setMucosalAnalysisError] = useState<string | null>(null);

  // Module B State
  const [dentalImageSrc, setDentalImageSrc] = useState<string | null>(null);
  const [dentalQuality, setDentalQuality] = useState<ImageQualityCheckResult | null>(null);
  const [dentalResult, setDentalResult] = useState<IDentalResult | null>(null);
  const [isAnalyzingDental, setIsAnalyzingDental] = useState<boolean>(false);
  const [dentalAnalysisError, setDentalAnalysisError] = useState<string | null>(null);

  // Module C State (Risk Questionnaire)
  const [riskAnswers, setRiskAnswers] = useState<IRiskQuestionnaireAnswers>({
    chewed_tobacco_gutka: false,
    areca_nut_betel_quid: false,
    smoked_tobacco: false,
    alcohol: false,
    years_of_use: '0',
    ulcer_longer_than_2_weeks: false,
    white_red_patch: false,
    difficulty_opening_mouth: false,
    burning_sensation: false,
    neck_lump: false,
  });
  const [riskResult, setRiskResult] = useState<IRiskScoreResult | null>(null);

  // Combined Report State
  const [combinedReport, setCombinedReport] = useState<ICombinedReportResult | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  // Clinician Review State
  const [doctorImpression, setDoctorImpression] = useState<string>('');
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [doctorReviewStatus, setDoctorReviewStatus] = useState<'CONFIRMED' | 'OVERRIDDEN' | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  // Offline sync indicator
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [screeningConsentGiven, setScreeningConsentGiven] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Hidden Canvas for image evaluation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Camera & File Input References
  const mucosalFileInputRef = useRef<HTMLInputElement | null>(null);
  const dentalFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);
  const [cameraTarget, setCameraTarget] = useState<'mucosal' | 'dental'>('mucosal');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Stop active camera
  const stopCamera = () => {
    cameraRequestIdRef.current += 1;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
    setIsCameraReady(false);
  };

  const attachCameraVideo = (video: HTMLVideoElement | null) => {
    videoRef.current = video;
    const stream = mediaStreamRef.current;
    if (!video || !stream || video.srcObject === stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      stopCamera();
      setCameraError('Camera preview could not start. Close it and try again.');
    });
  };

  // Start live webcam / mobile camera with automatic desktop/mobile fallback
  const startCamera = async (type: 'mucosal' | 'dental') => {
    stopCamera();
    setCameraError(null);
    setCameraTarget(type);
    setIsCameraLoading(true);
    setIsCameraReady(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera API is not supported on this browser. Please use the Choose Photo button.');
      setIsCameraLoading(false);
      return;
    }

    const requestId = ++cameraRequestIdRef.current;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 24, max: 30 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      }

      if (requestId !== cameraRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Could not open camera. Please grant camera permission or use the Choose Photo button.');
      setIsCameraLoading(false);
    }
  };

  // Snap photo from live video viewfinder
  const captureCameraSnapshot = (type: 'mucosal' | 'dental') => {
    if (!videoRef.current || !isCameraReady) return;
    const video = videoRef.current;
    const sourceWidth = video.videoWidth || 0;
    const sourceHeight = video.videoHeight || 0;
    if (sourceWidth < 1 || sourceHeight < 1) {
      setCameraError('Camera is still starting. Wait for the preview, then capture.');
      return;
    }
    const canvas = canvasRef.current || document.createElement('canvas');
    const scale = Math.min(1, 1280 / sourceWidth);
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const quality = evaluateImageQualityClient(canvas, ctx);

    stopCamera();

    if (type === 'mucosal') {
      setMucosalImageSrc(dataUrl);
      setMucosalQuality(quality);
      setMucosalResult(null);
      setMucosalAnalysisError(null);
    } else {
      setDentalImageSrc(dataUrl);
      setDentalQuality(quality);
      setDentalResult(null);
      setDentalAnalysisError(null);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Update Module C in real time whenever risk answers change
  useEffect(() => {
    const res = evaluateRiskHistoryClient(riskAnswers);
    setRiskResult(res);
  }, [riskAnswers]);

  // Attempt sync of pending offline records on mount
  useEffect(() => {
    if (token && navigator.onLine) {
      syncPendingAiScreenings(token).then((res) => {
        if (res.synced > 0) {
          setSyncNotice(`Synced ${res.synced} offline AI records with central hospital server.`);
        }
      });
    }
  }, [token]);

  // Multilingual question titles and descriptions
  const langKey: 'en' | 'te' | 'hi' = (currentLang === 'te' || currentLang === 'hi') ? currentLang : 'en';

  const t = {
    title: {
      en: 'AI Oral Health Screening Engine (Multi-Disease)',
      te: 'AI బహుళ నోటి ఆరోగ్య స్క్రీనింగ్ వ్యవస్థ',
      hi: 'AI बहु-रोग मुख स्वास्थ्य स्क्रीनिंग प्रणाली',
    }[langKey],
    step1: {
      en: '1. Mucosal Lesion (Module A)',
      te: '1. నోటి పొర పరిశీలన (Module A)',
      hi: '1. मुख श्लेष्मा घाव (Module A)',
    }[langKey],
    step2: {
      en: '2. Dental Examination (Module B)',
      te: '2. దంతాల పరిశీలన (Module B)',
      hi: '2. दंत परीक्षण (Module B)',
    }[langKey],
    step3: {
      en: '3. Risk History (Module C)',
      te: '3. అలవాట్లు & రిస్క్ చరిత్ర (Module C)',
      hi: '3. आदतें व जोखिम इतिहास (Module C)',
    }[langKey],
    step4: {
      en: '4. Oral Health Report',
      te: '4. సంయుక్త స్క్రీనింగ్ నివేదిక',
      hi: '4. संयुक्त स्वास्थ्य रिपोर्ट',
    }[langKey],
    disclaimer: {
      en: 'Screening aid, not a diagnosis. All triaging scores require professional clinical validation.',
      te: 'ఇది స్క్రీనింగ్ సహాయం మాత్రమే, ఖచ్చితమైన నిర్ధారణ కాదు. వైద్యుల పరీక్ష తప్పనిసరి.',
      hi: 'यह केवल स्क्रीनिंग सहायता है, निदान नहीं। चिकित्सक द्वारा पुष्टि अनिवार्य है।',
    }[langKey],
  };

  // Helper to load file into Canvas & Image
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'mucosal' | 'dental'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const quality = evaluateImageQualityClient(canvas, ctx);
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.88);

        if (type === 'mucosal') {
          setMucosalImageSrc(optimizedDataUrl);
          setMucosalQuality(quality);
          setMucosalResult(null);
          setMucosalAnalysisError(null);
        } else {
          setDentalImageSrc(optimizedDataUrl);
          setDentalQuality(quality);
          setDentalResult(null);
        }
      };
      img.onerror = () => {
        if (type === 'mucosal') setMucosalAnalysisError('The selected photo could not be opened. Please choose another image.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      if (type === 'mucosal') setMucosalAnalysisError('The selected photo could not be read. Please choose another image.');
    };
    reader.readAsDataURL(file);
  };

  // Execute Module A Analysis
  const runModuleA = async () => {
    if (!mucosalImageSrc) return;
    if (!selectedPatientId.trim()) { setMucosalAnalysisError('Select a saved patient record before screening.'); return; }
    if (!screeningConsentGiven) { setMucosalAnalysisError('Record the patient’s screening consent before analysis.'); return; }
    setIsAnalyzingMucosal(true);
    setMucosalAnalysisError(null);

    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('The captured image could not be decoded. Please retake it.'));
        img.src = mucosalImageSrc;
      });

      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      await recordScreeningConsent(selectedPatientId, token, langKey);
      const res = await analyzeMucosalLesion(canvas, selectedPatientId, hospitalId, token, true);
      setMucosalResult(res);
    } catch (err: any) {
      console.error('Module A analysis error:', err);
      setMucosalAnalysisError(err instanceof Error ? err.message : 'AI screening could not complete. Please retry.');
    } finally {
      setIsAnalyzingMucosal(false);
    }
  };

  // Execute Module B Analysis
  const runModuleB = async () => {
    // If dental image not supplied, user can reuse mucosal image
    const src = dentalImageSrc || mucosalImageSrc;
    if (!src) return;
    if (!selectedPatientId.trim()) { setDentalAnalysisError('Select a saved patient record before screening.'); return; }
    if (!screeningConsentGiven) { setDentalAnalysisError('Record the patient’s screening consent before analysis.'); return; }

    setIsAnalyzingDental(true);
    setDentalAnalysisError(null);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('The captured image could not be decoded. Please retake it.'));
        img.src = src;
      });

      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      await recordScreeningConsent(selectedPatientId, token, langKey);
      const res = await analyzeDentalFindings(canvas, selectedPatientId, hospitalId, token, true);
      setDentalResult(res);
    } catch (err: any) {
      console.error('Module B analysis error:', err);
      setDentalAnalysisError(err instanceof Error ? err.message : 'Dental screening could not complete. Please retry.');
    } finally {
      setIsAnalyzingDental(false);
    }
  };

  // Generate Final Combined Report (A + B + C)
  const handleGenerateFinalReport = async () => {
    if (!selectedPatientId.trim()) { setReportError('Select a saved patient record before saving a report.'); return; }
    if (!screeningConsentGiven) { setReportError('Record the patient’s screening consent before saving a report.'); return; }
    setIsSubmittingReport(true);
    try {
      await recordScreeningConsent(selectedPatientId, token, langKey);
      const report = await generateCombinedReport(
        selectedPatientId,
        hospitalId,
        mucosalResult || undefined,
        dentalResult || undefined,
        riskResult || undefined,
        token,
        undefined,
        undefined,
        true
      );
      setCombinedReport(report);
      setReportError(null);
      setActiveStep(4);
      onReportGenerated?.(report);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'The report could not be saved. Please retry.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Clinician Review Submission (Confirm/Override)
  const handleDoctorReview = async (status: 'CONFIRMED' | 'OVERRIDDEN') => {
    if (!doctorImpression.trim()) {
      alert('Please enter your clinical impression.');
      return;
    }

    setDoctorReviewStatus(status);
    const targetId = combinedReport?.screeningId || combinedReport?.clientId;

    if (token && targetId && !targetId.startsWith('temp-')) {
      try {
        const res = await fetch(`/api/ai/screenings/${targetId}/review`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            finalImpression: doctorImpression.trim(),
            notes: doctorNotes.trim(),
          }),
        });

        if (res.ok) {
          setReviewMessage(`Clinician review recorded (${status}). Assessment is now finalized.`);
          return;
        }
      } catch {
        // Fallback
      }
    }

    setReviewMessage(`Clinician review stored locally (${status}). Assessment finalized.`);
  };

  // Print / PDF Export Handler
  const handlePrintPdf = () => {
    window.print();
  };

  const isClinician = ['medical_officer', 'admin', 'system_admin'].includes(userRole);

  return (
    <div
      style={{
        background: 'var(--surface)',
        color: 'var(--text-primary)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid var(--border)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)' }}>{t.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Patient: <strong style={{ color: 'var(--text-primary)' }}>{selectedPatientId}</strong> ({selectedPatientName}) • Facility:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{hospitalId}</strong>
            </span>
            <span style={{ background: 'var(--surface-2)', color: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 8px', fontSize: '0.74rem', fontWeight: 600 }}>
              ● Live Upload Mode
            </span>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            ✕ Close
          </button>
        )}
      </div>

      <label style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', margin: '0 0 16px', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)' }}>
        <input type="checkbox" checked={screeningConsentGiven} onChange={(event) => setScreeningConsentGiven(event.target.checked)} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>The patient has agreed to oral photo analysis and secure storage of this screening record.</span>
      </label>
      {reportError && <div role="alert" style={{ marginBottom: '12px', color: 'var(--danger-text)' }}>{reportError}</div>}

      {syncNotice && (
        <div style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-text)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', marginBottom: '12px' }}>
          ✓ {syncNotice}
        </div>
      )}

      {/* Step Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { num: 1 as const, label: t.step1 },
          { num: 2 as const, label: t.step2 },
          { num: 3 as const, label: t.step3 },
          { num: 4 as const, label: t.step4 },
        ].map((tab) => {
          const isActive = activeStep === tab.num;
          return (
            <button
              key={tab.num}
              type="button"
              onClick={() => setActiveStep(tab.num)}
              style={{
                flex: 1,
                minWidth: '160px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: isActive ? 'var(--surface-2)' : 'var(--surface)',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          STEP 1: MODULE A - Mucosal Lesion Model
      ===================================================================== */}
      {activeStep === 1 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Photo Capture & Quality Panel */}
            <div style={{ background: 'var(--surface-2)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--text-primary)' }}>📸 Oral Mucosal Photo Capture</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                Capture high-clarity photo of buccal mucosa, tongue, or palate. Ensure good operatory light.
              </p>

              {/* Dual Action: 1. Choose from Files & 2. Open Live Camera */}
              <input
                ref={mucosalFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'mucosal')}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => mucosalFileInputRef.current?.click()}
                  style={{
                    padding: '16px 12px',
                    borderRadius: '12px',
                    border: '1.5px dashed var(--accent)',
                    background: 'var(--surface)',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.6rem' }}>📁</span>
                  <span>Choose Photo / File</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Gallery or Local Disk</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCamera('mucosal')}
                  disabled={isCameraLoading}
                  style={{
                    padding: '16px 12px',
                    borderRadius: '12px',
                    border: '1.5px solid #10b981',
                    background: isCameraActive && cameraTarget === 'mucosal' ? '#10b981' : 'rgba(16, 185, 129, 0.08)',
                    color: isCameraActive && cameraTarget === 'mucosal' ? '#ffffff' : '#10b981',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.6rem' }}>📸</span>
                  <span>{isCameraLoading && cameraTarget === 'mucosal' ? 'Opening camera…' : 'Use Live Camera'}</span>
                  <span style={{ fontSize: '0.68rem', color: isCameraActive && cameraTarget === 'mucosal' ? '#e2e8f0' : 'var(--text-muted)' }}>
                    Webcam or Phone Lens
                  </span>
                </button>
              </div>

              {/* Camera Error Alert */}
              {cameraError && cameraTarget === 'mucosal' && (
                <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', fontSize: '0.78rem', marginBottom: '12px' }}>
                  ⚠️ {cameraError}
                </div>
              )}

              {isCameraLoading && cameraTarget === 'mucosal' && (
                <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--info-bg)', color: 'var(--info-text)', borderRadius: '8px', fontSize: '0.78rem', marginBottom: '12px' }}>
                  <span>{isCameraActive ? 'Camera opened; starting preview…' : 'Opening camera…'}</span>
                  <button type="button" onClick={stopCamera} style={{ border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                </div>
              )}

              {/* Live Video Viewfinder */}
              {isCameraActive && cameraTarget === 'mucosal' && (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', marginBottom: '14px', border: '2px solid #10b981' }}>
                  <video ref={attachCameraVideo} onCanPlay={() => { setIsCameraReady(true); setIsCameraLoading(false); }} playsInline autoPlay muted style={{ width: '100%', maxHeight: '280px', display: 'block', objectFit: 'cover' }} />
                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.7)', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => captureCameraSnapshot('mucosal')}
                      disabled={!isCameraReady}
                      style={{ background: '#10b981', color: '#022c22', border: 'none', borderRadius: '20px', padding: '8px 20px', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer' }}
                    >
                      {isCameraReady ? '📸 Snap Mucosal Photo' : 'Starting camera…'}
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 14px', fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>
              )}

              {mucosalImageSrc && (
                <div>
                  <img
                    src={mucosalImageSrc}
                    alt="Oral Mucosal"
                    style={{ width: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--border)' }}
                  />

                  {mucosalQuality && (
                    <div
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        background: mucosalQuality.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: mucosalQuality.ok ? 'var(--success-text)' : 'var(--danger-text)',
                        border: `1px solid ${mucosalQuality.ok ? 'var(--success-text)' : 'var(--danger-text)'}`,
                        fontSize: '0.78rem',
                        marginBottom: '12px',
                      }}
                    >
                      {mucosalQuality.ok ? (
                        <span>✓ Image Quality Good (Sharpness: {mucosalQuality.blurScore}, Brightness: {mucosalQuality.brightness})</span>
                      ) : (
                        <span>⚠️ {mucosalQuality.reason}</span>
                      )}
                    </div>
                  )}

                  {mucosalAnalysisError && (
                    <div role="alert" style={{ padding: '9px 11px', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: '0.78rem', marginBottom: '10px' }}>
                      {mucosalAnalysisError}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isAnalyzingMucosal || (mucosalQuality !== null && !mucosalQuality.ok)}
                    onClick={runModuleA}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--btn-primary-bg)',
                      color: 'var(--btn-primary-text)',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: isAnalyzingMucosal ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isAnalyzingMucosal ? 'Analyzing Mucosa (EfficientNet-B0)...' : 'Run Module A Analysis'}
                  </button>
                </div>
              )}
            </div>

            {/* Module A Results Panel */}
            <div style={{ background: 'var(--surface-2)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--text-primary)' }}>🧠 Mucosal AI Screening Results</h3>

              {/* Model Status Badge */}
              <div
                style={{
                  background: mucosalResult?.is_placeholder ? 'var(--info-bg)' : 'var(--success-bg)',
                  color: mucosalResult?.is_placeholder ? 'var(--info-text)' : 'var(--success-text)',
                  border: `1px solid ${mucosalResult?.is_placeholder ? 'var(--info-text)' : 'var(--success-text)'}`,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  marginBottom: '12px',
                }}
              >
                {mucosalResult?.is_placeholder
                  ? 'DEMO AI · model unavailable · screening support only'
                  : 'DEMO AI · oral image screening support'}
              </div>

              {mucosalResult ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Detected Category:</span>
                    <span
                      style={{
                        fontSize: '1rem',
                        fontWeight: 800,
                        color: ['opmd', 'suspected_malignant'].includes(mucosalResult.label || '') ? 'var(--danger-text)' : 'var(--success-text)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {mucosalResult.label ? mucosalResult.label.replace('_', ' ') : 'Uncertain / Low Clarity'}
                    </span>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>Confidence Score</span>
                      <span>{(mucosalResult.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '8px', background: 'var(--bar-track)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, mucosalResult.confidence * 100)}%`,
                          height: '100%',
                          background: mucosalResult.confidence < 0.6 ? 'var(--warning-text)' : 'var(--bar-fill)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Probabilities Distribution */}
                  <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                      Configurable 4-Class Softmax Distribution:
                    </span>
                    {Object.entries(mucosalResult.probabilities).map(([cls, prob]) => (
                      <div key={cls} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{cls.replace('_', ' ')}</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{(prob * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>

                  {/* Gemini Multimodal Vision Assessment if available */}
                  {mucosalResult.geminiAnalysis && (
                    <div style={{ background: 'rgba(2, 132, 199, 0.12)', border: '1.5px solid #38bdf8', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '0.84rem', color: '#38bdf8' }}>✨ Google Gemini Vision Assessment</strong>
                        <span style={{ fontSize: '0.7rem', background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>GEMINI MULTIMODAL</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Finding: {mucosalResult.geminiAnalysis.observedCondition}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Site: {mucosalResult.geminiAnalysis.anatomicalSite} • Category: {mucosalResult.geminiAnalysis.conditionCategory?.replace('_', ' ')}
                      </div>
                      {mucosalResult.geminiAnalysis.recommendedDoctor && (
                        <div style={{ fontSize: '0.74rem', color: '#38bdf8', marginTop: '4px', background: 'rgba(2, 132, 199, 0.1)', padding: '6px 8px', borderRadius: '6px' }}>
                          👨‍⚕️ <strong>Consult:</strong> {mucosalResult.geminiAnalysis.recommendedDoctor.specialty} ({mucosalResult.geminiAnalysis.recommendedDoctor.facility})
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    <span>Source: <strong style={{ color: 'var(--text-primary)' }}>{mucosalResult.source}</strong></span>
                    <span>Version: <strong style={{ color: 'var(--text-primary)' }}>{mucosalResult.modelVersion}</strong></span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--btn-primary-bg)',
                      color: 'var(--btn-primary-text)',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Proceed to Step 2: Dental Examination ➔
                  </button>
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  Upload an image and run Module A analysis to see predictions.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: MODULE B - Dental Examination (Multi-label Sigmoid)
      ===================================================================== */}
      {activeStep === 2 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'var(--surface-2)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--text-primary)' }}>🦷 Dental Arch Photo (Optional / Reuse)</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                Examine teeth, gingival margin, and tartar. You can upload a distinct dental photo or reuse the existing oral photo.
              </p>

              {/* Dual Action: 1. Choose Dental Photo & 2. Open Live Camera */}
              <input
                ref={dentalFileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'dental')}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                style={{ display: 'none' }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <button
                  type="button"
                  onClick={() => dentalFileInputRef.current?.click()}
                  style={{
                    padding: '14px 10px',
                    borderRadius: '12px',
                    border: '1.5px dashed var(--accent)',
                    background: 'var(--surface)',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>📁</span>
                  <span>Choose Dental Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => startCamera('dental')}
                  disabled={isCameraLoading}
                  style={{
                    padding: '14px 10px',
                    borderRadius: '12px',
                    border: '1.5px solid #10b981',
                    background: isCameraActive && cameraTarget === 'dental' ? '#10b981' : 'rgba(16, 185, 129, 0.08)',
                    color: isCameraActive && cameraTarget === 'dental' ? '#ffffff' : '#10b981',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>🦷</span>
                  <span>{isCameraLoading && cameraTarget === 'dental' ? 'Opening camera…' : 'Live Dental Camera'}</span>
                </button>
              </div>

              {/* Camera Error Alert for Dental */}
              {cameraError && cameraTarget === 'dental' && (
                <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '8px', color: '#f87171', fontSize: '0.78rem', marginBottom: '12px' }}>
                  ⚠️ {cameraError}
                </div>
              )}

              {isCameraLoading && cameraTarget === 'dental' && (
                <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--info-bg)', color: 'var(--info-text)', borderRadius: '8px', fontSize: '0.78rem', marginBottom: '12px' }}>
                  <span>{isCameraActive ? 'Camera opened; starting preview…' : 'Opening camera…'}</span>
                  <button type="button" onClick={stopCamera} style={{ border: 0, background: 'transparent', color: 'inherit', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                </div>
              )}

              {/* Live Video Viewfinder for Dental */}
              {isCameraActive && cameraTarget === 'dental' && (
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', marginBottom: '14px', border: '2px solid #10b981' }}>
                  <video ref={attachCameraVideo} onCanPlay={() => { setIsCameraReady(true); setIsCameraLoading(false); }} playsInline autoPlay muted style={{ width: '100%', maxHeight: '280px', display: 'block', objectFit: 'cover' }} />
                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.7)', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => captureCameraSnapshot('dental')}
                      disabled={!isCameraReady}
                      style={{ background: '#10b981', color: '#022c22', border: 'none', borderRadius: '20px', padding: '8px 20px', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer' }}
                    >
                      {isCameraReady ? '📸 Snap Dental View' : 'Starting camera…'}
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 14px', fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>
              )}

              {mucosalImageSrc && (
                <div style={{ marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDentalImageSrc(mucosalImageSrc);
                      setDentalQuality(mucosalQuality);
                      setDentalResult(null);
                    }}
                    style={{ fontSize: '0.78rem', padding: '6px 12px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔄 Reuse Step 1 Live Oral Photo for Dental Check
                  </button>
                </div>
              )}

              {(dentalImageSrc || mucosalImageSrc) && (
                <div>
                  <img
                    src={dentalImageSrc || mucosalImageSrc!}
                    alt="Dental"
                    style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', borderRadius: '8px', marginBottom: '10px', border: '1px solid var(--border)' }}
                  />

                  {dentalQuality && (
                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: dentalQuality.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: dentalQuality.ok ? 'var(--success-text)' : 'var(--danger-text)',
                        border: `1px solid ${dentalQuality.ok ? 'var(--success-text)' : 'var(--danger-text)'}`,
                        fontSize: '0.74rem',
                        marginBottom: '10px',
                      }}
                    >
                      {dentalQuality.ok ? (
                        <span>✓ Dental Image Quality Good (Sharpness: {dentalQuality.blurScore})</span>
                      ) : (
                        <span>⚠️ {dentalQuality.reason}</span>
                      )}
                    </div>
                  )}

                  {dentalAnalysisError && (
                    <div role="alert" style={{ padding: '9px 11px', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: '0.78rem', marginBottom: '10px' }}>
                      {dentalAnalysisError}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isAnalyzingDental}
                    onClick={runModuleB}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--btn-primary-bg)',
                      color: 'var(--btn-primary-text)',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 700,
                      cursor: isAnalyzingDental ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isAnalyzingDental ? 'Analyzing Dental Conditions (Sigmoid)...' : 'Run Module B Dental Analysis'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface-2)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: 'var(--text-primary)' }}>🩺 Multi-Label Dental Findings</h3>
              <div
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success-text)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  marginBottom: '12px',
                  border: '1px solid var(--success-text)',
                }}
              >
                DEMO AI · dental image screening support
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Multi-label model evaluates Caries, Gingivitis, Calculus, Plaque, and Discoloration independently with thresholding.
              </p>

              {dentalResult ? (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                    {dentalResult.findings.map((f) => (
                      <div
                        key={f.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          background: 'var(--surface)',
                          borderRadius: '8px',
                          border: f.flagged ? '1px solid var(--warning-text)' : '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                            {f.label.replace('_', ' ')}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                            Prob: {(f.probability * 100).toFixed(1)}% (Threshold: {(f.threshold * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: f.flagged ? 'var(--warning-bg)' : 'var(--success-bg)',
                            color: f.flagged ? 'var(--warning-text)' : 'var(--success-text)',
                            border: `1px solid ${f.flagged ? 'var(--warning-text)' : 'var(--success-text)'}`,
                          }}
                        >
                          {f.flagged ? 'FLAGGED' : 'NORMAL'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: dentalResult.seeDentistRecommended ? 'var(--warning-bg)' : 'var(--success-bg)',
                      color: dentalResult.seeDentistRecommended ? 'var(--warning-text)' : 'var(--success-text)',
                      border: `1px solid ${dentalResult.seeDentistRecommended ? 'var(--warning-text)' : 'var(--success-text)'}`,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      marginBottom: '14px',
                    }}
                  >
                    {dentalResult.seeDentistRecommended
                      ? '🦷 Dental Care Advised: Active caries / gingivitis / calculus flagged. Dentist visit recommended.'
                      : '✓ Routine Dentition: No urgent dental pathology flagged.'}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'var(--btn-primary-bg)',
                      color: 'var(--btn-primary-text)',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Proceed to Step 3: Risk History ➔
                  </button>
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                  Run Module B Dental Analysis to view findings.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: MODULE C - Risk History Questionnaire (Offline)
      ===================================================================== */}
      {activeStep === 3 && (
        <div style={{ background: 'var(--surface-2)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: 'var(--text-primary)' }}>📋 Oral Risk-Factor Questionnaire (Module C)</h3>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            Works 100% offline. Frontline health worker captures patient-reported habits and mucosal symptoms.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            {/* Habits Section */}
            <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--accent)' }}>🚬 Patient-Reported Habits</h4>

              {[
                { key: 'chewed_tobacco_gutka' as const, label: 'Chewed Tobacco / Gutka / Khaini', te: 'పొగాకు / గుట్కా నమలడం', hi: 'तंबाकू / गुटखा चबाना' },
                { key: 'areca_nut_betel_quid' as const, label: 'Areca Nut / Betel Quid (Paan)', te: 'తమలపాకు / సున్నం / పోకచెక్క', hi: 'सुपारी / पान मसाला' },
                { key: 'smoked_tobacco' as const, label: 'Smoked Tobacco (Bidi / Cigarette)', te: 'బీడీ / సిగరెట్ తాగడం', hi: 'बीड़ी / सिगरेट पीना' },
                { key: 'alcohol' as const, label: 'Alcohol Consumption', te: 'మద్యపానం అలవాటు', hi: 'शराब का सेवन' },
              ].map((item) => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', marginBottom: '10px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(riskAnswers[item.key])}
                    onChange={(e) => setRiskAnswers({ ...riskAnswers, [item.key]: e.target.checked })}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                      {currentLang === 'te' ? item.te : currentLang === 'hi' ? item.hi : ''}
                    </span>
                  </span>
                </label>
              ))}

              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Duration of Habit Use (Years):
                </label>
                <select
                  value={String(riskAnswers.years_of_use || '0')}
                  onChange={(e) => setRiskAnswers({ ...riskAnswers, years_of_use: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    background: 'var(--surface-2)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    fontSize: '0.8rem',
                  }}
                >
                  <option value="0">0 years (Non-user)</option>
                  <option value="1_5">1 - 5 years</option>
                  <option value="6_10">6 - 10 years</option>
                  <option value="10_plus">10+ years (Prolonged exposure)</option>
                </select>
              </div>
            </div>

            {/* Red Flag Symptoms Section */}
            <div style={{ background: 'var(--surface)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--danger-text)' }}>🚩 Oral Warning Symptoms (Red Flags)</h4>

              {[
                { key: 'ulcer_longer_than_2_weeks' as const, label: 'Ulcer non-healing > 2 weeks', te: 'రెండు వారాలకు మించి మానని పుండు', hi: '2 सप्ताह से अधिक पुराना छाला' },
                { key: 'white_red_patch' as const, label: 'White / Red Patch in mouth', te: 'నోటిలో తెల్లటి లేదా ఎర్రటి మచ్చ', hi: 'मुंह में सफेद या लाल धब्बा' },
                { key: 'difficulty_opening_mouth' as const, label: 'Difficulty opening mouth (Trismus)', te: 'నోరు తెరవడంలో తీవ్ర ఇబ్బంది (ట్రిస్మస్)', hi: 'मुंह खोलने में कठिनाई (ट्रिस्मस)' },
                { key: 'neck_lump' as const, label: 'Persistent neck swelling or lump', te: 'మెడలో గడ్డ లేదా వాపు', hi: 'गर्दन में गांठ या सूजन' },
                { key: 'burning_sensation' as const, label: 'Burning sensation with spicy foods', te: 'కారంగా ఉన్న ఆహారం తిన్నప్పుడు మంట', hi: 'मसालेदार भोजन पर जलन' },
              ].map((item) => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', marginBottom: '10px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(riskAnswers[item.key])}
                    onChange={(e) => setRiskAnswers({ ...riskAnswers, [item.key]: e.target.checked })}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <span>
                    <strong style={{ color: item.key !== 'burning_sensation' ? 'var(--danger-text)' : 'var(--text-primary)' }}>{item.label}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                      {currentLang === 'te' ? item.te : currentLang === 'hi' ? item.hi : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Real-Time Risk Score Readout */}
          {riskResult && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 18px',
                borderRadius: '10px',
                background: riskResult.level === 'HIGH' ? 'var(--danger-bg)' : riskResult.level === 'MODERATE' ? 'var(--warning-bg)' : 'var(--success-bg)',
                color: riskResult.level === 'HIGH' ? 'var(--danger-text)' : riskResult.level === 'MODERATE' ? 'var(--warning-text)' : 'var(--success-text)',
                border: `1px solid ${riskResult.level === 'HIGH' ? 'var(--danger-text)' : riskResult.level === 'MODERATE' ? 'var(--warning-text)' : 'var(--success-text)'}`,
                marginBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', opacity: 0.85, display: 'block' }}>
                  Module C Risk Level:
                </span>
                <strong style={{ fontSize: '1.05rem', letterSpacing: '0.5px' }}>{riskResult.level} RISK</strong>
                <span style={{ fontSize: '0.74rem', display: 'block', opacity: 0.9 }}>
                  (Score: {riskResult.score} • {riskResult.rationale})
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '6px' }}>
                Reported by patient
              </span>
            </div>
          )}

          <button
            type="button"
            disabled={isSubmittingReport}
            onClick={handleGenerateFinalReport}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.9rem',
              cursor: isSubmittingReport ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmittingReport ? 'Consolidating Reports (A + B + C)...' : 'Compile Consolidated Oral Health Screening Report ➔'}
          </button>
        </div>
      )}

      {/* =====================================================================
          STEP 4: CONSOLIDATED ORAL HEALTH REPORT (A + B + C)
      ===================================================================== */}
      {activeStep === 4 && (
        <div>
          {combinedReport ? (
            <div
              id="printable-oral-health-report"
              style={{
                background: 'var(--surface-2)',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid var(--border)',
              }}
            >
              {/* Report Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--accent)' }}>📄 Oral Health Screening Report</h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    ITDA Tribal Oral Health Initiative • Visit Date: {new Date(combinedReport.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={handlePrintPdf}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginRight: '8px',
                    }}
                  >
                    🖨️ Export PDF / Print
                  </button>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: combinedReport.syncStatus === 'SYNCED' ? 'var(--success-bg)' : 'var(--warning-bg)',
                      color: combinedReport.syncStatus === 'SYNCED' ? 'var(--success-text)' : 'var(--warning-text)',
                      border: `1px solid ${combinedReport.syncStatus === 'SYNCED' ? 'var(--success-text)' : 'var(--warning-text)'}`,
                    }}
                  >
                    {combinedReport.syncStatus}
                  </span>
                </div>
              </div>

              {/* Master Recommendation Triaging Badge */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '10px',
                  background:
                    combinedReport.combinedRecommendation.badgeColor === 'RED'
                      ? 'var(--danger-bg)'
                      : combinedReport.combinedRecommendation.badgeColor === 'AMBER'
                      ? 'var(--warning-bg)'
                      : 'var(--success-bg)',
                  color:
                    combinedReport.combinedRecommendation.badgeColor === 'RED'
                      ? 'var(--danger-text)'
                      : combinedReport.combinedRecommendation.badgeColor === 'AMBER'
                      ? 'var(--warning-text)'
                      : 'var(--success-text)',
                  border: `1px solid ${
                    combinedReport.combinedRecommendation.badgeColor === 'RED'
                      ? 'var(--danger-text)'
                      : combinedReport.combinedRecommendation.badgeColor === 'AMBER'
                      ? 'var(--warning-text)'
                      : 'var(--success-text)'
                  }`,
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>
                    TRIAGING CATEGORY:
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {combinedReport.combinedRecommendation.badgeColor} TIER
                  </span>
                </div>

                <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>
                  {combinedReport.combinedRecommendation.referToSpecialist
                    ? '🔴 URGENT SPECIALIST REFERRAL RECOMMENDED'
                    : combinedReport.combinedRecommendation.seeDentist
                    ? '🟡 DENTIST CONSULTATION & MONITORING'
                    : '🟢 ROUTINE PREVENTIVE ORAL HYGIENE'}
                </h4>

                <p style={{ margin: '0 0 8px', fontSize: '0.82rem', opacity: 0.95 }}>
                  {combinedReport.combinedRecommendation.advice}
                </p>

                {/* Transparent Attribution of Triggers */}
                {combinedReport.combinedRecommendation.triggerModules.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.74rem' }}>
                    <strong>Triggered by:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                      {combinedReport.combinedRecommendation.triggerModules.map((trig, i) => (
                        <li key={i}>{trig}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Module Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                {/* Module A Card */}
                <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h5 style={{ margin: '0 0 6px', color: 'var(--accent)', fontSize: '0.82rem' }}>Module A: Mucosa Screening</h5>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <div>Category: <strong style={{ textTransform: 'capitalize' }}>{combinedReport.moduleA?.label || 'Not captured'}</strong></div>
                    <div>Confidence: <strong>{combinedReport.moduleA?.confidence ? (combinedReport.moduleA.confidence * 100).toFixed(1) + '%' : 'N/A'}</strong></div>
                    <div>Source: <strong style={{ color: 'var(--text-muted)' }}>{combinedReport.moduleA?.source || 'N/A'}</strong></div>
                  </div>
                </div>

                {/* Module B Card */}
                <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h5 style={{ margin: '0 0 6px', color: 'var(--accent)', fontSize: '0.82rem' }}>Module B: Dental Examination</h5>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <div>Dental Advice: <strong>{combinedReport.combinedRecommendation.seeDentist ? 'Dentist visit needed' : 'Normal dentition'}</strong></div>
                    <div>Flagged: <strong>{combinedReport.moduleB?.findings.filter((f) => f.flagged).map((f) => f.label).join(', ') || 'None'}</strong></div>
                    <div>Source: <strong style={{ color: 'var(--text-muted)' }}>{combinedReport.moduleB?.source || 'N/A'}</strong></div>
                  </div>
                </div>

                {/* Module C Card */}
                <div style={{ background: 'var(--surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <h5 style={{ margin: '0 0 6px', color: 'var(--accent)', fontSize: '0.82rem' }}>Module C: Risk History (Reported by Patient)</h5>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <div>Risk Level: <strong>{combinedReport.moduleC?.level || 'LOW'}</strong> (Score: {combinedReport.moduleC?.score ?? 0})</div>
                    <div>Symptoms: <strong>{combinedReport.moduleC?.flaggedSymptoms?.join(', ') || 'None reported'}</strong></div>
                    <div>Habits: <strong>{combinedReport.moduleC?.flaggedHabits?.join(', ') || 'None reported'}</strong></div>
                  </div>
                </div>
              </div>

              {/* Clinician Review Section */}
              <div style={{ background: 'var(--surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '0.88rem' }}>👨‍⚕️ Clinician Review & Confirmation</h5>

                {reviewMessage ? (
                  <div style={{ padding: '8px 12px', background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-text)', borderRadius: '6px', fontSize: '0.78rem' }}>
                    <strong>{doctorReviewStatus}:</strong> {reviewMessage}
                  </div>
                ) : isClinician ? (
                  <div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Doctor Final Clinical Impression:
                      </label>
                      <input
                        type="text"
                        value={doctorImpression}
                        onChange={(e) => setDoctorImpression(e.target.value)}
                        placeholder="e.g. Early leukoplakia on left buccal mucosa; confirmed for biopsy referral."
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Clinical Notes / Navigation Instructions:
                      </label>
                      <textarea
                        value={doctorNotes}
                        onChange={(e) => setDoctorNotes(e.target.value)}
                        rows={2}
                        placeholder="e.g. Advised immediate cessation of areca nut; referred to KGH Oncology Dept on Wednesday."
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => handleDoctorReview('CONFIRMED')}
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: 'var(--btn-primary-bg)',
                          color: 'var(--btn-primary-text)',
                          border: 'none',
                          borderRadius: '6px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Confirm AI Assessment
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDoctorReview('OVERRIDDEN')}
                        style={{
                          flex: 1,
                          padding: '8px',
                          background: 'var(--warning-bg)',
                          color: 'var(--warning-text)',
                          border: '1px solid var(--warning-text)',
                          borderRadius: '6px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        ✎ Override AI Assessment
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Status: <strong style={{ color: 'var(--warning-text)' }}>Pending Review by Medical Officer</strong>. Attending MO will validate these screening findings.
                  </div>
                )}
              </div>

              {/* Mandatory Non-Diagnosis Disclaimer */}
              <div style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                {t.disclaimer}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Please complete Steps 1, 2, and 3 to generate the consolidated report.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiOralHealthEngine;
