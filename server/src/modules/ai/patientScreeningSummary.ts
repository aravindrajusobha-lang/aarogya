/**
 * Builds the patient-safe "screening result" view for one AI screening (Invariant 1).
 *
 * It reports a risk level, a plain-language explanation, the visual findings, possible conditions a doctor
 * may check for (general names that only a doctor can confirm), common causes, what to tell the doctor,
 * the model's confidence for THIS image, and the recommended next step. Every string passes the
 * prohibited-terms filter; anything matching it (e.g. cancer/malignant wording) is dropped.
 */
import { isUnsafePatientText } from '../assistant/geminiService.js';

export type ScreeningRiskLevel = 'low' | 'moderate' | 'high';

const FINDING_TYPE_LABEL: Record<string, string> = {
  white_lesion: 'White patch on the mouth lining',
  red_lesion: 'Red patch on the mouth lining',
  ulcerative: 'Sore or ulcer area',
  pigmented: 'Darkly coloured area',
  dental_caries: 'Signs of tooth decay',
  benign_mucosa: 'Mouth lining looks typical',
  other: 'Other change seen in the photo',
};

const NEXT_STEP: Record<ScreeningRiskLevel, { urgency: 'routine' | 'soon' | 'urgent'; withinDays: number; text: string }> = {
  low: { urgency: 'routine', withinDays: 90, text: 'No urgent signs were flagged. Repeat a check at your next routine visit, or sooner if anything changes.' },
  moderate: { urgency: 'soon', withinDays: 14, text: 'Please book a doctor visit within the next 2 weeks so a clinician can examine the area.' },
  high: { urgency: 'urgent', withinDays: 3, text: 'Please see a doctor within the next few days. Book an appointment now.' },
};

function safeList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 320 && !isUnsafePatientText(item));
  return Array.from(new Set(items)).slice(0, max);
}

function safeText(value: unknown, max = 1200): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > max || isUnsafePatientText(text)) return null;
  return text;
}

export function riskLevelFor(screening: any): ScreeningRiskLevel {
  const tier = String(screening?.geminiAnalysis?.riskTier || screening?.geminiAnalysis?.riskCategory || screening?.label || '').toLowerCase();
  if (tier.includes('high')) return 'high';
  if (tier.includes('moderate') || tier.includes('medium')) return 'moderate';
  if (tier.includes('low') || tier.includes('benign') || tier.includes('normal')) return 'low';
  const badge = screening?.combinedRecommendation?.badgeColor;
  if (badge === 'RED' || screening?.referToSpecialist) return 'high';
  if (badge === 'AMBER') return 'moderate';
  return 'low';
}

export function buildPatientScreeningSummary(screening: any) {
  const gemini = screening?.geminiAnalysis || null;
  const detailed = Boolean(gemini && typeof gemini === 'object' && gemini.riskTier);
  const g = gemini || {};
  const riskLevel = riskLevelFor(screening);
  const category = typeof g.conditionCategory === 'string' && FINDING_TYPE_LABEL[g.conditionCategory] ? g.conditionCategory : null;
  const confidence = typeof screening?.confidence === 'number' && Number.isFinite(screening.confidence) ? Math.max(0, Math.min(1, screening.confidence)) : null;
  const doctor = g.recommendedDoctor || {};
  const step = NEXT_STEP[riskLevel];
  const timelineDays = Number.isFinite(doctor.timelineDays) && doctor.timelineDays > 0 ? Math.round(doctor.timelineDays) : step.withinDays;

  return {
    screeningId: screening.screeningId,
    createdAt: screening.createdAt,
    reanalysisOf: screening.reanalysisOf || null,
    // Private file id; the photo is only downloadable through the JWT-protected, scope-checked storage route.
    imageRef: screening.imageRef || null,
    // 'detailed' = vision model description available; 'basic' = only the small fallback classifier ran.
    analysisSource: detailed ? 'detailed' as const : 'basic' as const,
    analyzedBy: detailed ? (typeof g.analyzedByModel === 'string' ? g.analyzedByModel : 'gemini') : (screening.modelVersion || null),
    lowConfidence: confidence !== null && confidence < 0.6,
    riskLevel,
    summary: safeText(g.patientExplanation) || safeText(g.answerText),
    observedCondition: safeText(g.observedCondition, 400),
    findingType: category,
    findingTypeLabel: category ? FINDING_TYPE_LABEL[category] : null,
    anatomicalSite: safeText(g.anatomicalSite, 200),
    visualFindings: safeList(g.visualFindings),
    imageObservation: safeText(g.imageObservation),
    // General condition names a doctor may consider for a similar appearance; only a doctor can confirm.
    possibleConditions: safeList(g.possibleConditions, 4),
    possibleCauses: safeList(g.possibleCauses, 5),
    reasons: safeList(g.riskFactors, 5),
    warningSigns: safeList(g.urgentRedFlags, 5),
    thingsToAvoid: safeList(g.thingsToAvoid, 3),
    whatToTellDoctor: safeList(g.whatToTellClinician, 5),
    whenToSeekReview: safeList(g.whenToSeekReview, 5),
    confidence,
    imageQuality: screening?.imageQuality ? { ok: Boolean(screening.imageQuality.ok), reason: safeText(screening.imageQuality.reason, 300) } : null,
    nextStep: {
      urgency: step.urgency,
      withinDays: Math.min(step.withinDays, timelineDays),
      text: step.text,
      suggestedDoctorType: safeText(doctor.specialty, 120),
      facility: safeText(doctor.facility, 160),
      reason: safeText(doctor.consultationReason, 300),
    },
    modelVersion: screening.modelVersion || null,
    clinicianReview: {
      status: screening?.clinicianReview?.status || 'PENDING',
      reviewedAt: screening?.clinicianReview?.reviewedAt || null,
      // Clinician text is stored separately from AI output and is shown only after the prohibited-terms filter.
      impression: safeText(screening?.clinicianReview?.finalImpression),
    },
    label: 'DEMO AI',
    disclaimer: 'DEMO AI screening support only. This is not a clinical finding. A qualified doctor must examine you.',
  };
}
