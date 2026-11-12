import * as ort from 'onnxruntime-web';
import { v4 as uuidv4 } from 'uuid';
import { db, OfflineAiScreening } from '../db/aarogyaDb';
import { calculateRiskScore, IRiskQuestionnaireAnswers, IRiskScoreResult } from './riskScore';

// Configure ONNX Runtime Web WASM paths & single-threaded execution to prevent SharedArrayBuffer isolation failures
try {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.simd = true;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = '/wasm/';
} catch {}

export interface ImageQualityCheckResult {
  ok: boolean;
  reason: string | null;
  blurScore: number;
  brightness: number;
}

export interface IGeminiPatientEducation {
  anatomicalSite?: string;
  conditionCategory?: string;
  recommendedDoctor?: { specialty?: string; facility?: string };
  patientExplanation?: string;
  imageObservation?: string;
  possibleConditions?: string[];
  riskFactors?: string[];
  possibleCauses?: string[];
  thingsToAvoid?: string[];
  whatToTellClinician?: string[];
  whenToConsult?: string[];
  whenToSeekReview?: string[];
  riskCategory?: 'low' | 'moderate' | 'high';
  informationSources?: Array<{ label: string; url: string }>;
  analyzedByModel?: string;
  answerText?: string;
  observedCondition?: string;
}

export interface IMucosalLesionResult {
  label: string | null;
  confidence: number;
  probabilities: Record<string, number>;
  referToSpecialist: boolean;
  modelVersion: string;
  source: 'server' | 'on-device';
  imageQuality: ImageQualityCheckResult;
  imageRef?: string;
  screeningId?: string;
  classes?: string[];
  is_placeholder?: boolean;
  geminiAnalysis?: IGeminiPatientEducation & Record<string, unknown>;
}

export interface IDentalFinding {
  label: string;
  probability: number;
  threshold: number;
  flagged: boolean;
}

export interface IDentalResult {
  findings: IDentalFinding[];
  seeDentistRecommended: boolean;
  modelVersion: string;
  source: 'server' | 'on-device';
  imageQuality: ImageQualityCheckResult;
  imageRef?: string;
  is_placeholder?: boolean;
  geminiAnalysis?: any;
}

export interface ICombinedReportResult {
  screeningId?: string;
  clientId: string;
  patientId: string;
  hospitalId?: string;
  moduleA?: IMucosalLesionResult;
  moduleB?: IDentalResult;
  moduleC?: IRiskScoreResult;
  combinedRecommendation: {
    referToSpecialist: boolean;
    seeDentist: boolean;
    triageCategory: 'URGENT_SPECIALIST' | 'DENTAL_MONITOR' | 'ROUTINE';
    badgeColor: 'RED' | 'AMBER' | 'GREEN';
    triggerModules: string[];
    advice: string;
  };
  syncStatus: 'SYNCED' | 'PENDING_SYNC';
  createdAt: string;
  disclaimer: string;
}

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const DEFAULT_LESION_CLASSES = ['normal', 'benign_inflammatory', 'opmd', 'suspected_malignant'];
const DEFAULT_DENTAL_LABELS = ['caries', 'gingivitis', 'calculus', 'plaque_soft_deposit', 'discoloration'];
const DEFAULT_DENTAL_THRESHOLDS: Record<string, number> = {
  caries: 0.50,
  gingivitis: 0.45,
  calculus: 0.50,
  plaque_soft_deposit: 0.50,
  discoloration: 0.55,
};

let oralSession: ort.InferenceSession | null = null;
let dentalSession: ort.InferenceSession | null = null;

// =============================================================================
// 1. Client-Side Image Quality Evaluation (Size, Illumination, Laplacian Blur)
// =============================================================================
export function evaluateImageQualityClient(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): ImageQualityCheckResult {
  const width = canvas.width;
  const height = canvas.height;

  if (width < 100 || height < 100) {
    return {
      ok: false,
      reason: `Image is too small (${width}x${height}px). Minimum required is 100x100px.`,
      blurScore: 0,
      brightness: 0,
    };
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const numPixels = width * height;

  // Grayscale conversion and mean luminance calculation
  const gray = new Float32Array(numPixels);
  let totalBrightness = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = luma;
    totalBrightness += luma;
  }

  const meanBrightness = Math.round((totalBrightness / numPixels) * 10) / 10;

  if (meanBrightness < 35.0) {
    return {
      ok: false,
      reason: `Image is too dark (${meanBrightness}/255). Please ensure good operatory light before retaking.`,
      blurScore: 0,
      brightness: meanBrightness,
    };
  }

  // Discrete 2D Laplacian Kernel approximation for sharpness
  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const c = gray[y * width + x];
      const top = gray[(y - 1) * width + x];
      const bottom = gray[(y + 1) * width + x];
      const left = gray[y * width + (x - 1)];
      const right = gray[y * width + (x + 1)];

      const lap = 4 * c - (top + bottom + left + right);
      laplacianSum += lap;
      laplacianSumSq += lap * lap;
      count++;
    }
  }

  const meanLap = laplacianSum / count;
  const variance = Math.round((laplacianSumSq / count - meanLap * meanLap) * 10) / 10;

  if (variance < 10.0) {
    return {
      ok: false,
      reason: `Image is extremely blurry (clarity score: ${variance}, minimum: 10.0). Please hold steady and retake.`,
      blurScore: variance,
      brightness: meanBrightness,
    };
  }

  return {
    ok: true,
    reason: null,
    blurScore: variance,
    brightness: meanBrightness,
  };
}

// =============================================================================
// 2. Preprocess Canvas to CHW Float32Array [1, 3, 224, 224]
// =============================================================================
function preprocessCanvasToCHW(canvas: HTMLCanvasElement): Float32Array {
  const targetSize = 224;
  const offscreen = document.createElement('canvas');
  offscreen.width = targetSize;
  offscreen.height = targetSize;
  const ctx = offscreen.getContext('2d')!;

  ctx.drawImage(canvas, 0, 0, targetSize, targetSize);
  const imgData = ctx.getImageData(0, 0, targetSize, targetSize).data;

  const floatArray = new Float32Array(3 * targetSize * targetSize);
  const channelSize = targetSize * targetSize;

  for (let i = 0; i < channelSize; i++) {
    const r = imgData[i * 4] / 255.0;
    const g = imgData[i * 4 + 1] / 255.0;
    const b = imgData[i * 4 + 2] / 255.0;

    floatArray[i] = (r - MEAN[0]) / STD[0];
    floatArray[channelSize + i] = (g - MEAN[1]) / STD[1];
    floatArray[channelSize * 2 + i] = (b - MEAN[2]) / STD[2];
  }

  return floatArray;
}

// Read the token from the existing login session. Screening never creates a session.
export async function getEffectiveToken(token?: string): Promise<string | null> {
  if (token && token.length > 10) return token;
  try {
    const rawSingle = localStorage.getItem('aarogya_token');
    if (rawSingle && rawSingle.length > 10) return rawSingle;

    const saved = localStorage.getItem('aarogya_tokens');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.accessToken && parsed.accessToken.length > 10) return parsed.accessToken;
    }
  } catch {}

  return null;
}

export async function recordScreeningConsent(
  patientId: string,
  token: string | undefined,
  language: string = 'en',
  witnessName?: string
): Promise<void> {
  if (!patientId) throw new Error('A valid patient record is required before screening.');
  if (!navigator.onLine) {
    try {
      const cached = JSON.parse(localStorage.getItem(`aarogya_screening_consent_${patientId}`) || 'null');
      if (cached?.status === 'granted' && new Date(cached.validUntil).getTime() > Date.now()) return;
    } catch {}
    throw new Error('Connect once to record screening consent before using offline screening.');
  }
  const effectiveToken = await getEffectiveToken(token);
  if (!effectiveToken) throw new Error('Sign in to record consent and save screening results.');

  const response = await fetch('/api/v1/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${effectiveToken}` },
    body: JSON.stringify({ patientId, purpose: 'screening_ai_analysis', language, witnessName, termsVersion: '1.0.0' }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || 'Patient screening consent could not be recorded.');
  }
  try {
    localStorage.setItem(`aarogya_screening_consent_${patientId}`, JSON.stringify({ status: 'granted', validUntil: payload.data?.validUntil }));
  } catch {}
}

// =============================================================================
// 3. Module A: On-Device Mucosal Inference (WASM with Feature Fallback)
// =============================================================================
async function runOnDeviceMucosalInference(canvas: HTMLCanvasElement, imageQuality: ImageQualityCheckResult): Promise<IMucosalLesionResult> {
  try {
    if (!oralSession) {
      oralSession = await ort.InferenceSession.create('/models/oral_model.onnx', { executionProviders: ['wasm'] });
    }

    if (!oralSession) {
      throw new Error('ONNX session unavailable');
    }

    const chwData = preprocessCanvasToCHW(canvas);
    const tensor = new ort.Tensor('float32', chwData, [1, 3, 224, 224]);
    const results = await oralSession.run({ input: tensor });

    const outputTensor = results.logits || Object.values(results)[0];
    const logits = outputTensor.data as Float32Array;

    // Softmax
    const maxLogit = Math.max(...logits);
    const expScores = Array.from(logits).map((l) => Math.exp(l - maxLogit));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probs = expScores.map((e) => e / sumExp);

    // Dynamically match model output dimensionality
    const activeClasses = logits.length === 3
      ? ['benign_inflammatory', 'opmd', 'suspected_malignant']
      : DEFAULT_LESION_CLASSES;

    const probMap: Record<string, number> = {};
    activeClasses.forEach((cls, idx) => {
      probMap[cls] = Math.round((probs[idx] || 0) * 10000) / 10000;
    });

    let maxIdx = 0;
    let maxP = 0;
    probs.forEach((p, i) => {
      if (p > maxP) {
        maxP = p;
        maxIdx = i;
      }
    });

    const predictedLabel = activeClasses[maxIdx] || 'benign_inflammatory';
    const confidence = Math.round(maxP * 10000) / 10000;
    const referToSpecialist = ['opmd', 'suspected_malignant'].includes(predictedLabel) || confidence < 0.60;

    return {
      label: predictedLabel,
      confidence,
      probabilities: probMap,
      referToSpecialist,
      modelVersion: 'v2.0.0-onnx-on-device',
      source: 'on-device',
      imageQuality,
      is_placeholder: false,
      classes: activeClasses,
    };
  } catch (wasmErr) {
    throw new Error(`On-device oral screening model could not run: ${wasmErr instanceof Error ? wasmErr.message : 'model unavailable'}`);
  }
}

// =============================================================================
// 4. Module B: On-Device Dental Inference (WASM with Feature Fallback)
// =============================================================================
async function runOnDeviceDentalInference(canvas: HTMLCanvasElement, imageQuality: ImageQualityCheckResult): Promise<IDentalResult> {
  try {
    if (!dentalSession) {
      dentalSession = await ort.InferenceSession.create('/models/dental_model.onnx', { executionProviders: ['wasm'] });
    }

    if (!dentalSession) {
      throw new Error('Dental ONNX session unavailable');
    }

    const chwData = preprocessCanvasToCHW(canvas);
    const tensor = new ort.Tensor('float32', chwData, [1, 3, 224, 224]);
    const results = await dentalSession.run({ input: tensor });

    const outputTensor = results.logits || Object.values(results)[0];
    const logits = outputTensor.data as Float32Array;

    // Sigmoid
    const findings: IDentalFinding[] = [];
    let anyFlagged = false;

    DEFAULT_DENTAL_LABELS.forEach((label, idx) => {
      const logit = logits[idx] ?? 0;
      const prob = 1 / (1 + Math.exp(-logit));
      const roundedProb = Math.round(prob * 10000) / 10000;
      const threshold = DEFAULT_DENTAL_THRESHOLDS[label] ?? 0.50;
      const flagged = roundedProb >= threshold;

      if (flagged && label !== 'discoloration') {
        anyFlagged = true;
      }

      findings.push({
        label,
        probability: roundedProb,
        threshold,
        flagged,
      });
    });

    return {
      findings,
      seeDentistRecommended: anyFlagged,
      modelVersion: 'v2.0.0-dental-onnx-on-device',
      source: 'on-device',
      imageQuality,
      is_placeholder: false,
    };
  } catch (wasmErr) {
    throw new Error(`On-device dental screening model could not run: ${wasmErr instanceof Error ? wasmErr.message : 'model unavailable'}`);
  }
}

// =============================================================================
// 5. Unified AI Engine Orchestrator
// =============================================================================

/**
 * Analyzes mucosal lesion: tries server first; falls back gracefully to on-device ONNX.
 */
export async function analyzeMucosalLesion(
  canvas: HTMLCanvasElement,
  patientId: string,
  hospitalId?: string,
  token?: string,
  consentGiven = false,
  language: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' = 'en'
): Promise<IMucosalLesionResult> {
  const ctx = canvas.getContext('2d')!;
  const quality = evaluateImageQualityClient(canvas, ctx);

  if (!patientId) throw new Error('A valid patient record is required before screening.');
  if (!consentGiven) throw new Error('Record patient consent before analyzing a screening photo.');
  if (!quality.ok) throw new Error(quality.reason || 'Retake the photo before screening.');

  // 1. Try online server analysis
  const effectiveToken = await getEffectiveToken(token);
  if (navigator.onLine && !effectiveToken) throw new Error('Sign in again to analyze and save this screening.');
  if (navigator.onLine && effectiveToken) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 65000);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('The screening image could not be prepared. Please choose it again.');
      const formData = new FormData();
      formData.append('image', blob, 'mucosal.jpg');
      formData.append('patientId', patientId);
      if (hospitalId) formData.append('hospitalId', hospitalId);
      formData.append('consentGiven', 'true');
      formData.append('clientId', uuidv4());
      formData.append('language', language);

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${effectiveToken}` },
        signal: controller.signal,
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Server screening analysis failed.');
      }
      const d = payload?.data || payload;
      if (d?.isPlaceholder || d?.is_placeholder) throw new Error('The configured screening model is not available for analysis.');
      return {
        label: d.label,
        confidence: d.confidence,
        probabilities: d.probabilities || {},
        referToSpecialist: d.referToSpecialist,
        modelVersion: d.modelVersion,
        source: 'server',
        imageQuality: d.imageQuality || quality,
        imageRef: d.imageRef,
        screeningId: d.screeningId,
        geminiAnalysis: d.geminiAnalysis,
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return runOnDeviceMucosalInference(canvas, quality);
}

/**
 * Analyzes dental findings: tries server first; falls back to on-device ONNX.
 */
export async function analyzeDentalFindings(
  canvas: HTMLCanvasElement,
  patientId: string,
  hospitalId?: string,
  token?: string,
  consentGiven = false
): Promise<IDentalResult> {
  const ctx = canvas.getContext('2d')!;
  const quality = evaluateImageQualityClient(canvas, ctx);

  if (!patientId) throw new Error('A valid patient record is required before screening.');
  if (!consentGiven) throw new Error('Record patient consent before analyzing a screening photo.');
  if (!quality.ok) throw new Error(quality.reason || 'Retake the photo before screening.');

  const effectiveToken = await getEffectiveToken(token);
  if (navigator.onLine && !effectiveToken) throw new Error('Sign in again to analyze and save this screening.');
  if (navigator.onLine && effectiveToken) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 65000);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('The dental image could not be prepared. Please choose it again.');
      const formData = new FormData();
      formData.append('image', blob, 'dental.jpg');
      formData.append('patientId', patientId);
      if (hospitalId) formData.append('hospitalId', hospitalId);
      formData.append('consentGiven', 'true');

      const response = await fetch('/api/ai/analyze-dental', {
        method: 'POST',
        headers: { Authorization: `Bearer ${effectiveToken}` },
        signal: controller.signal,
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || 'Dental screening analysis failed.');
      const d = payload?.data || payload;
      if (d?.isPlaceholder || d?.is_placeholder) throw new Error('The configured dental screening model is not available for analysis.');
      return {
        findings: d.findings || [],
        seeDentistRecommended: d.seeDentistRecommended,
        modelVersion: d.modelVersion,
        source: 'server',
        imageQuality: d.imageQuality || quality,
        imageRef: d.imageRef,
        geminiAnalysis: d.geminiAnalysis,
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return runOnDeviceDentalInference(canvas, quality);
}

/**
 * Evaluates patient risk-factor questionnaire (100% offline).
 */
export function evaluateRiskHistoryClient(answers: IRiskQuestionnaireAnswers): IRiskScoreResult {
  return calculateRiskScore(answers);
}

/**
 * Computes unified recommendation and saves consolidated report (online or IndexedDB offline queue).
 */
export async function generateCombinedReport(
  patientId: string,
  hospitalId: string | undefined,
  moduleA?: IMucosalLesionResult,
  moduleB?: IDentalResult,
  moduleC?: IRiskScoreResult,
  token?: string,
  _mucosalPhotoDataUrl?: string,
  _dentalPhotoDataUrl?: string,
  consentGiven = false
): Promise<ICombinedReportResult> {
  if (!patientId) throw new Error('A valid patient record is required before saving a screening report.');
  if (!consentGiven) throw new Error('Patient consent is required before saving a screening report.');
  const clientId = uuidv4();
  const triggerModules: string[] = [];

  // Module A rules
  const labelA = moduleA?.label || '';
  const confA = moduleA?.confidence ?? 1.0;
  const isHighRiskLesion = Boolean(moduleA?.referToSpecialist) || ['opmd', 'suspected_malignant', 'osmf', 'non_healing_ulcer'].includes(labelA);
  const isLowConfidence = labelA ? confA < 0.60 : false;

  if (isHighRiskLesion) {
    triggerModules.push(`Module A: Suspected lesion detected (${labelA})`);
  }
  if (isLowConfidence) {
    triggerModules.push(`Module A: Low confidence screening (${(confA * 100).toFixed(0)}% < 60%) requires specialist evaluation`);
  }

  // Module C rules
  const riskLevel = moduleC?.level || 'LOW';
  const isHighRiskHistory = riskLevel === 'HIGH';
  if (isHighRiskHistory) {
    const syms = moduleC?.flaggedSymptoms?.length ? moduleC.flaggedSymptoms.join(', ') : 'High-risk patient history';
    triggerModules.push(`Module C: High-risk patient history (${syms})`);
  }

  // Final specialist referral
  const referToSpecialist = isHighRiskLesion || isLowConfidence || isHighRiskHistory;

  // Module B rules
  const hasDentalFlag = Boolean(
    moduleB?.seeDentistRecommended ||
    moduleB?.findings?.some((f) => f.flagged && f.label !== 'discoloration')
  );
  const seeDentist = hasDentalFlag;
  if (hasDentalFlag) {
    const flaggedLabels = moduleB?.findings?.filter((f) => f.flagged).map((f) => f.label) || [];
    triggerModules.push(`Module B: Dental findings flagged (${flaggedLabels.join(', ') || 'dental issues'})`);
  }

  let triageCategory: 'URGENT_SPECIALIST' | 'DENTAL_MONITOR' | 'ROUTINE' = 'ROUTINE';
  let badgeColor: 'RED' | 'AMBER' | 'GREEN' = 'GREEN';
  let advice = 'Routine oral hygiene care advised. Screening aid, not a diagnosis.';

  if (referToSpecialist) {
    triageCategory = 'URGENT_SPECIALIST';
    badgeColor = 'RED';
    advice = 'URGENT: Oral medicine / surgical specialist referral recommended. Comprehensive clinical examination required.';
  } else if (seeDentist || riskLevel === 'MODERATE') {
    triageCategory = 'DENTAL_MONITOR';
    badgeColor = 'AMBER';
    advice = 'Dentist consultation and regular habit monitoring recommended.';
  }

  const combinedRecommendation = {
    referToSpecialist,
    seeDentist,
    triageCategory,
    badgeColor,
    triggerModules,
    advice,
  };

  const reportPayload: ICombinedReportResult = {
    clientId,
    patientId,
    hospitalId,
    moduleA,
    moduleB,
    moduleC,
    combinedRecommendation,
    syncStatus: 'PENDING_SYNC',
    createdAt: new Date().toISOString(),
    disclaimer: 'This AI result is a screening aid, not a diagnosis. Please consult a qualified doctor.',
  };

  // Try online submission
  const effectiveToken = await getEffectiveToken(token);
  if (navigator.onLine && !effectiveToken) throw new Error('Sign in again to save this screening report.');
  if (navigator.onLine && effectiveToken) {
    const response = await fetch('/api/ai/screenings/combined', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${effectiveToken}` },
      body: JSON.stringify({ ...reportPayload, consentGiven: true }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error?.message || 'The screening report could not be saved to the patient record.');
    }
    const data = payload.data || payload;
    reportPayload.screeningId = data.screeningId;
    reportPayload.syncStatus = 'SYNCED';
    return reportPayload;
  }

  // Save to Dexie offline queue
  const offlineItem: OfflineAiScreening = {
    clientId,
    patientId,
    hospitalId,
    consentGiven: true,
    consentTimestamp: new Date().toISOString(),
    label: moduleA?.label,
    confidence: moduleA?.confidence,
    probabilities: moduleA?.probabilities,
    referToSpecialist,
    moduleA,
    moduleB,
    moduleC,
    combinedRecommendation,
    syncStatus: 'PENDING_SYNC',
    createdAt: Date.now(),
  };

  await db.offlineAiScreenings.add(offlineItem);
  return reportPayload;
}

/**
 * Syncs pending offline AI screenings with backend.
 */
export async function syncPendingAiScreenings(token?: string): Promise<{ synced: number; skipped: number }> {
  if (!navigator.onLine) return { synced: 0, skipped: 0 };
  const effectiveToken = await getEffectiveToken(token);
  if (!effectiveToken) return { synced: 0, skipped: 0 };

  const pending = await db.offlineAiScreenings.where({ syncStatus: 'PENDING_SYNC' }).toArray();
  if (pending.length === 0) return { synced: 0, skipped: 0 };

  try {
    const res = await fetch('/api/ai/screenings/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${effectiveToken}`,
      },
      body: JSON.stringify({ screenings: pending }),
    });

    if (res.ok) {
      const json = await res.json();
      const syncedCount = json.data?.syncedCount || 0;
      const dupCount = json.data?.duplicateCount || 0;
      const acceptedIds = new Set<string>((json.data?.screenings || []).map((record: { clientId?: string }) => record.clientId).filter(Boolean));
      if (acceptedIds.size > 0) {
        await db.offlineAiScreenings.where('clientId').anyOf([...acceptedIds]).modify({ syncStatus: 'SYNCED' });
      }
      return { synced: syncedCount, skipped: dupCount };
    }
  } catch {
    // Retry later
  }

  return { synced: 0, skipped: 0 };
}
