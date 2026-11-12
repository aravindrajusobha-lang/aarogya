import { logger } from '../../config/logger.js';
import { detectLanguageFromText } from './assistantRoutes.js';

export interface DoctorRecommendation {
  specialty: string;
  facility: string;
  urgency: 'routine' | 'priority' | 'urgent';
  timelineDays: number;
  consultationReason: string;
}

export interface OralPhotoAnalysisResult {
  observedCondition: string;
  conditionCategory: 'white_lesion' | 'red_lesion' | 'ulcerative' | 'pigmented' | 'dental_caries' | 'benign_mucosa' | 'other';
  riskTier: 'low_risk_support' | 'moderate_risk_support' | 'high_risk_support';
  confidenceScore: number;
  anatomicalSite: string;
  visualFindings: string[];
  recommendedDoctor: DoctorRecommendation;
  urgentRedFlags: string[];
  lifestyleAdvice: string[];
  answerText: string;
  speechText: string;
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
  language: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
  suggestedActions: string[];
  disclaimer: string;
  analyzedByModel: string;
}

export interface GeminiChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
}

export interface GeminiChatResult {
  answerText: string;
  speechText: string;
  language: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
  intent: string;
  animation: 'greeting' | 'idle' | 'listening' | 'thinking' | 'explaining' | 'pointing' | 'happy' | 'warning' | 'demonstrating' | 'empathetic';
  expression: 'friendly' | 'thoughtful' | 'professional' | 'concerned' | 'smiling' | 'attentive' | 'calm';
  gesture: 'wave' | 'open_hand' | 'point_left' | 'point_right' | 'thumbs_up' | 'hand_to_chin' | 'hands_on_chest' | 'gentle_warning';
  topic: string;
  suggestedActions: string[];
  doctorRecommendation?: DoctorRecommendation;
}

const patientResponseBlockedPattern = /\b(?:cancer|malignant|carcinoma|curative)\b|\bstage\s*(?:\d+|[ivx]+)\b|\bdiagnostic confirmation\b/i;

function ensureSafePatientText(values: Array<string | undefined>): void {
  if (values.some((value) => typeof value === 'string' && (patientResponseBlockedPattern.test(value) || /\b(?:is|are|shows|indicates|confirms)\s+(?:a\s+)?(?:diagnosis|condition|disease)\b/i.test(value)))) {
    throw new Error('Gemini response was withheld by the patient-safety content check.');
  }
}

function cleanPatientTextList(value: unknown, maxItems = 5): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 320))
    .filter(Boolean)
    .slice(0, maxItems);
}

const ORAL_HEALTH_INFORMATION_SOURCES = [
  { label: 'NHS: Mouth ulcers', url: 'https://www.nhs.uk/conditions/mouth-ulcers/' },
  { label: 'WHO: Oral health', url: 'https://www.who.int/news-room/fact-sheets/detail/oral-health' },
];

/**
 * Checks if the Gemini API Key is configured in environment
 */
export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 0);
}

/**
 * Gets the configured model name or defaults to gemini-flash-lite-latest
 */
export function getGeminiModelName(): string {
  const model = process.env.GEMINI_MODEL?.trim();
  if (!model || model === 'gemini-1.5-flash' || model === 'gemini-2.5-flash') {
    return 'gemini-flash-lite-latest';
  }
  return model;
}

/**
 * Calls the configured Gemini model using native fetch and a bounded timeout.
 */
async function callGeminiApi(payload: any): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const primaryModel = getGeminiModelName();
  const fallbackCandidates = [primaryModel];

  let lastError: Error | null = null;

  for (const model of fallbackCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        logger.warn({ status: res.status, errText: errText.slice(0, 160), model }, 'Configured Gemini model request failed');
        lastError = new Error(`Gemini API returned HTTP ${res.status} on ${model}: ${errText.slice(0, 180)}`);
        if (res.status === 404 || res.status === 503 || res.status === 429) {
          continue;
        }
        throw lastError;
      }

      return await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        logger.warn({ model }, 'Configured Gemini model call timed out');
        lastError = new Error(`Gemini API call timed out after 45 seconds on ${model}`);
        continue;
      }
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini candidate models failed');
}

/**
 * Multimodal Visual Analysis of Oral Cavity Photo
 * Evaluates lesion features, suggests which doctor/specialist to consult,
 * recommends referral hospital in ASR district, and produces Telugu/Hindi/English speechText.
 */
export async function analyzeOralPhotoWithGemini(params: {
  imageBase64: string;
  mimeType?: string;
  patientNote?: string;
  language?: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
}): Promise<OralPhotoAnalysisResult> {
  const { imageBase64, mimeType = 'image/jpeg', patientNote = '', language = 'en' } = params;

  // Clean base64 string if it contains data URI header
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const languageNames: Record<typeof language, string> = {
    en: 'clear, accessible Indian English',
    te: 'natural, conversational Telugu script',
    hi: 'clear, conversational Hindi in Devanagari script',
    ta: 'clear, conversational Tamil script',
    kn: 'clear, conversational Kannada script',
    ml: 'clear, conversational Malayalam script',
  };
  const langPrompt = `Write all patient-facing text in ${languageNames[language]}. Use short sentences and explain unfamiliar health words simply.`;

  const systemPrompt = `You are Drishti AI, a community health navigation assistant for Aarogya-Drishti.

Use the photo only to describe visible features for DEMO AI screening support. Never diagnose, identify a disease, assign a stage, recommend medicine, or claim certainty. Explain that a qualified clinician must review any concern. Do not infer patient identity, history, or symptoms that are not provided. Suggest a clinician type and local facility only as navigation options; the clinician decides urgency and care.
${langPrompt}
The speechText field is read aloud. Use plain spoken sentences without markdown, emojis, or URLs.

Respond only with valid JSON matching this structure. Do not name or diagnose a disease. Describe only what is visibly apparent, and distinguish that observation from general health education. Never claim that a cause applies to this patient. If the image is unclear, say so. Base general education only on NHS mouth-ulcer guidance (https://www.nhs.uk/conditions/mouth-ulcers/) and WHO oral-health guidance (https://www.who.int/news-room/fact-sheets/detail/oral-health); avoid speculation:
{
  "observedCondition": "plain description of visible appearance, or unclear",
  "conditionCategory": "white_lesion | red_lesion | ulcerative | pigmented | dental_caries | benign_mucosa | other",
  "riskTier": "low_risk_support | moderate_risk_support | high_risk_support",
  "confidenceScore": 0.0,
  "anatomicalSite": "visible location or unclear",
  "visualFindings": ["visible feature"],
  "recommendedDoctor": {"specialty": "appropriate clinician type", "facility": "facility name or ask local staff", "urgency": "routine | priority | urgent", "timelineDays": 0, "consultationReason": "screening support reason, without diagnosis"},
  "urgentRedFlags": [],
  "lifestyleAdvice": [],
  "imageObservation": "The photo appears to show a visible feature, or the image is unclear. This description may be inaccurate.",
  "possibleConditions": ["one to three general educational condition names only; each is possible, not a diagnosis"],
  "riskFactors": ["only factors supplied in the patient notes; never infer from the image"],
  "possibleCauses": ["general, common causes of a similar appearance; clearly state these are possibilities and cannot be determined from the photo"],
  "thingsToAvoid": ["general self-care avoidance guidance, never a treatment plan"],
  "whatToTellClinician": ["useful details the patient can share at an appointment, such as when it started or whether it is changing"],
  "whenToConsult": ["one to two week rule and urgent symptoms as general navigation guidance"],
  "riskCategory": "low | moderate | high; based only on supplied risk factors and symptoms, never image alone",
  "patientExplanation": "2-4 short sentences explaining what the image appears to show, what an image cannot establish, and why a clinician review matters",
  "whenToSeekReview": ["clear, practical signs or timeframes for arranging an in-person review"],
  "answerText": "same plain-language explanation for existing report and chat features",
  "speechText": "plain spoken version of the summary",
  "suggestedActions": ["Book a clinician visit"]
}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Review this oral photo for screening support only. Patient notes: "${patientNote || 'No additional notes provided'}". Describe visible features cautiously and suggest a clinician type for an in-person review.`,
          },
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2200,
      responseMimeType: 'application/json',
    },
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  const responseJson = await callGeminiApi(payload);
  const textOutput = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOutput) {
    throw new Error('Gemini returned an empty response for oral photo analysis');
  }

  const parsed = JSON.parse(textOutput);

  const validRiskTiers = ['low_risk_support', 'moderate_risk_support', 'high_risk_support'];
  const validCategories = ['white_lesion', 'red_lesion', 'ulcerative', 'pigmented', 'dental_caries', 'benign_mucosa', 'other'];
  const validUrgencies = ['routine', 'priority', 'urgent'];
  if (!validRiskTiers.includes(parsed.riskTier) || !validCategories.includes(parsed.conditionCategory)) {
    throw new Error('Gemini returned an incomplete screening support response.');
  }
  if (typeof parsed.confidenceScore !== 'number' || !Number.isFinite(parsed.confidenceScore) || parsed.confidenceScore < 0 || parsed.confidenceScore > 1) {
    throw new Error('Gemini returned an invalid confidence value.');
  }
  if (!parsed.recommendedDoctor || typeof parsed.recommendedDoctor.specialty !== 'string' || !parsed.recommendedDoctor.specialty.trim()) {
    throw new Error('Gemini did not provide a clinician navigation suggestion.');
  }
  if (!validUrgencies.includes(parsed.recommendedDoctor.urgency) || !Number.isInteger(parsed.recommendedDoctor.timelineDays) || parsed.recommendedDoctor.timelineDays < 0) {
    throw new Error('Gemini returned an invalid follow-up suggestion.');
  }
  if (typeof parsed.observedCondition !== 'string' || typeof parsed.answerText !== 'string' || typeof parsed.speechText !== 'string') {
    throw new Error('Gemini returned an incomplete screening support response.');
  }

  const patientExplanation = typeof parsed.patientExplanation === 'string' && parsed.patientExplanation.trim()
    ? parsed.patientExplanation.trim().slice(0, 1200)
    : parsed.answerText.trim().slice(0, 1200);
  const imageObservation = typeof parsed.imageObservation === 'string' && parsed.imageObservation.trim()
    ? parsed.imageObservation.trim().slice(0, 1200)
    : `The photo appears to show ${String(parsed.observedCondition || 'an area that needs clinician review')}. This description may be inaccurate.`;
  const possibleConditions = cleanPatientTextList(parsed.possibleConditions, 3);
  const riskFactors = cleanPatientTextList(parsed.riskFactors);
  const possibleCauses = cleanPatientTextList(parsed.possibleCauses);
  const thingsToAvoid = cleanPatientTextList(parsed.thingsToAvoid);
  const whatToTellClinician = cleanPatientTextList(parsed.whatToTellClinician);
  const whenToConsult = cleanPatientTextList(parsed.whenToConsult);
  const whenToSeekReview = cleanPatientTextList(parsed.whenToSeekReview);
  const visualFindings = cleanPatientTextList(parsed.visualFindings);
  const urgentRedFlags = cleanPatientTextList(parsed.urgentRedFlags);
  const lifestyleAdvice = cleanPatientTextList(parsed.lifestyleAdvice);
  const suggestedActions = cleanPatientTextList(parsed.suggestedActions);
  const riskCategory = ['low', 'moderate', 'high'].includes(parsed.riskCategory) ? parsed.riskCategory as 'low' | 'moderate' | 'high' : 'low';
  ensureSafePatientText([
    parsed.observedCondition,
    parsed.answerText,
    parsed.speechText,
    patientExplanation,
    imageObservation,
    ...possibleConditions,
    ...riskFactors,
    parsed.recommendedDoctor.specialty,
    parsed.recommendedDoctor.consultationReason,
    ...possibleCauses,
    ...thingsToAvoid,
    ...whenToConsult,
    ...whatToTellClinician,
    ...whenToSeekReview,
    ...visualFindings,
    ...urgentRedFlags,
    ...lifestyleAdvice,
    ...suggestedActions,
  ]);

  return {
    observedCondition: parsed.observedCondition,
    conditionCategory: parsed.conditionCategory,
    riskTier: parsed.riskTier,
    confidenceScore: parsed.confidenceScore,
    anatomicalSite: parsed.anatomicalSite || 'Unclear from image',
    visualFindings,
    recommendedDoctor: {
      specialty: parsed.recommendedDoctor.specialty.trim(),
      facility: typeof parsed.recommendedDoctor.facility === 'string' ? parsed.recommendedDoctor.facility : 'Ask local health staff',
      urgency: parsed.recommendedDoctor.urgency,
      timelineDays: parsed.recommendedDoctor.timelineDays,
      consultationReason: typeof parsed.recommendedDoctor.consultationReason === 'string' ? parsed.recommendedDoctor.consultationReason : 'An in-person clinician review is needed.',
    },
    urgentRedFlags,
    lifestyleAdvice,
    answerText: parsed.answerText.trim().slice(0, 1600),
    speechText: parsed.speechText.trim().slice(0, 1200),
    patientExplanation,
    imageObservation,
    possibleConditions,
    riskFactors,
    possibleCauses,
    thingsToAvoid,
    whatToTellClinician,
    whenToConsult,
    whenToSeekReview,
    riskCategory,
    informationSources: ORAL_HEALTH_INFORMATION_SOURCES,
    language,
    suggestedActions,
    disclaimer:
      'DEMO AI SCREENING SUPPORT ONLY — CONTAINS NO CONFIRMED CLINICAL FINDINGS OR STAGING. REQUIRES IN-PERSON CLINICIAN REVIEW.',
    analyzedByModel: getGeminiModelName(),
  };
}

/**
 * Conversational Chatbot Generation with Gemini
 * Supports Telugu, Hindi, English, and directs patients to doctors and health facilities.
 */
export async function generateChatResponseWithGemini(params: {
  message: string;
  conversationHistory?: { role: string; text: string }[];
  language?: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
  context?: any;
}): Promise<GeminiChatResult> {
  const { message, conversationHistory = [], language = 'en', context } = params;

  const detected = detectLanguageFromText(message);
  const targetLang = detected !== 'en' ? detected : language;

  const langInstruction =
    targetLang === 'te'
      ? 'Reply ONLY in Telugu (తెలుగు script). Use simple, friendly sentences suitable for frontline tribal healthcare workers and patients. Do not use English script.'
      : targetLang === 'hi'
      ? 'Reply ONLY in Hindi (हिंदी script). Use simple, respectful sentences suitable for frontline healthcare workers and patients.'
      : 'Reply in clear Indian English with simple vocabulary.';

  const systemPrompt = `You are "Drishti AI", the intelligent rural healthcare assistant for the Aarogya-Drishti platform across the 22 tribal mandals of Alluri Sitharama Raju (ASR) District, Andhra Pradesh (including Paderu, Araku Valley, Chintapalli, Dumbriguda, Munchingiputtu).

ROLE & ATTITUDE:
- Warm, polite, empathetic female community health navigator ("Drishti").
- You guide patients on oral hygiene, recognizing mouth ulcers, booking appointments, screening camp schedules, and which doctor to consult.
- When a user asks about mouth symptoms (ulcer lasting > 2 weeks, white patches, difficulty swallowing, pain, chewing difficulty):
  1. Clearly recommend seeing a **Dental Surgeon** or **Oral Specialist**.
  2. Mention local facilities (e.g. CHC Paderu, Area Hospital Araku, KGH Visakhapatnam).
  3. Emphasize stopping tobacco/betel nut and not delaying an in-person checkup.
- ${langInstruction}
- Plain speech text: The "speechText" field will be read aloud by browser Text-to-Speech. Never include markdown asterisks, bullet symbols, emojis, or URLs in speechText.

Respond ONLY with a valid JSON object matching:
{
  "answerText": "Markdown response for reading in UI",
  "speechText": "Spoken sentence without markdown or emojis for TTS audio",
  "language": "${targetLang}",
  "intent": "e.g. doctor_referral | symptoms_triage | camp_schedule | registration",
  "animation": "explaining | pointing | empathetic | happy | warning | greeting",
  "expression": "friendly | thoughtful | concerned | smiling | attentive",
  "gesture": "open_hand | point_right | gentle_warning | hands_on_chest | thumbs_up",
  "topic": "doctor_guidance | oral_health | screening",
  "suggestedActions": ["Action 1", "Action 2"],
  "doctorRecommendation": {
    "specialty": "Dental Surgeon / Oral Specialist",
    "facility": "CHC Paderu / Area Hospital Araku",
    "urgency": "priority",
    "timelineDays": 7,
    "consultationReason": "Professional clinical evaluation"
  }
}`;

  // Build Gemini contents array from conversation turns
  const contents: any[] = [];

  const recentHistory = conversationHistory.slice(-6);
  for (const turn of recentHistory) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    });
  }

  // Current turn
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const payload = {
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 900,
      responseMimeType: 'application/json',
    },
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  const responseJson = await callGeminiApi(payload);
  const textOutput = responseJson?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOutput) {
    throw new Error('Gemini returned an empty conversational response');
  }

  const parsed = JSON.parse(textOutput);

  return {
    answerText: parsed.answerText || 'I am here to guide your oral health navigation. Please consult a medical officer at your nearest PHC.',
    speechText: parsed.speechText || 'I am here to help you. Please visit your nearest health centre for an oral checkup.',
    language: targetLang,
    intent: parsed.intent || 'healthcare_inquiry',
    animation: parsed.animation || 'explaining',
    expression: parsed.expression || 'friendly',
    gesture: parsed.gesture || 'open_hand',
    topic: parsed.topic || 'oral_health',
    suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : ['Find Nearest PHC', 'Doctor Consultation'],
    doctorRecommendation: parsed.doctorRecommendation || undefined,
  };
}
