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

export const patientResponseBlockedPattern = /\b(?:cancer|malignant|carcinoma|curative)\b|\bstage\s*(?:\d+|[ivx]+)\b|\bdiagnostic confirmation\b/i;

const diagnosticClaimPattern = /\b(?:is|are|shows|indicates|confirms)\s+(?:a\s+)?(?:diagnosis|condition|disease)\b/i;

/** True when text contains prohibited wording (Invariant 1) or a definitive diagnostic claim. */
export function isUnsafePatientText(value: unknown): boolean {
  return typeof value === 'string' && (patientResponseBlockedPattern.test(value) || diagnosticClaimPattern.test(value));
}

/** Returns trimmed text, or the fallback when the text is empty or unsafe (the rest of the analysis is kept). */
function safeText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  return text && !isUnsafePatientText(text) ? text : fallback;
}

/** Cleans a list and drops individual unsafe items instead of discarding the whole response. */
function safeList(value: unknown, maxItems = 5): string[] {
  return cleanPatientTextList(value, maxItems).filter((item) => !isUnsafePatientText(item));
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
  // Respect the configured model; only retired 1.5 names fall back to the default.
  if (!model || model.startsWith('gemini-1.5')) {
    return 'gemini-flash-lite-latest';
  }
  return model;
}

/**
 * Calls the configured Gemini model using native fetch and a bounded timeout.
 */
/** Ordered list of models to try: configured model first, then GEMINI_FALLBACK_MODELS (comma-separated). */
export function getGeminiModelChain(): string[] {
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.5-flash,gemini-flash-latest,gemini-flash-lite-latest')
    .split(',').map((item) => item.trim()).filter((item) => item && !item.startsWith('gemini-1.5'));
  return Array.from(new Set([getGeminiModelName(), ...fallbacks]));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/** Concatenates the answer text, skipping "thought" parts emitted by thinking models. */
function extractCandidateText(responseJson: any): string {
  const parts: any[] = responseJson?.candidates?.[0]?.content?.parts || [];
  return parts.filter((part) => typeof part?.text === 'string' && !part.thought).map((part) => part.text).join('').trim();
}

/**
 * Calls Gemini with retries and a model fallback chain.
 * Overloaded (503), rate-limited (429) and timed-out calls are retried with backoff, then the next model is tried.
 * The API key travels in the x-goog-api-key header so it never appears in URLs or logs.
 */
async function callGeminiApi(payload: any): Promise<{ json: any; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const attemptsPerModel = Math.max(1, Number(process.env.GEMINI_ATTEMPTS_PER_MODEL || 2));
  const deadline = Date.now() + Math.max(15_000, Number(process.env.GEMINI_TOTAL_BUDGET_MS || 110_000));
  let lastError: Error | null = null;

  for (const model of getGeminiModelChain()) {
    for (let attempt = 1; attempt <= attemptsPerModel; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining < 3_000) throw lastError || new Error('Gemini analysis time budget exhausted');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const controller = new AbortController();
      const timeoutMs = Math.min(45_000, remaining);
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) return { json: await res.json(), model };

        const errText = await res.text();
        lastError = new Error(`Gemini API returned HTTP ${res.status} on ${model}: ${errText.slice(0, 180)}`);
        logger.warn({ status: res.status, model, attempt }, 'Gemini model request failed');
        if (res.status === 404) break; // model unavailable for this key: try the next model
        if (!RETRYABLE_STATUS.has(res.status)) throw lastError; // 400/401/403: retrying will not help
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.name === 'AbortError') {
          lastError = new Error(`Gemini API call timed out after ${Math.round(timeoutMs / 1000)} seconds on ${model}`);
          logger.warn({ model, attempt }, 'Gemini model call timed out');
        } else if (err instanceof Error && /HTTP (400|401|403)/.test(err.message)) {
          throw err;
        } else {
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }
      if (attempt < attemptsPerModel) await sleep(1_200 * attempt + Math.floor(Math.random() * 400));
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
  const langPrompt = `Write all patient-facing text in ${languageNames[language]}. Use short sentences and explain unfamiliar health words simply. Keep the enum values (conditionCategory, riskTier, urgency, riskCategory) in English exactly as listed.`;

  const systemPrompt = `You are Drishti AI, a community oral-health screening assistant for Aarogya-Drishti (DEMO AI screening support for frontline health workers in tribal areas).

Your job: look carefully at the oral photo and give a detailed, well-organised description that helps the patient understand what is visible and how soon to see a doctor.
Rules:
- You do not make a final clinical decision. Never state that the patient definitely has a disease, never assign a grade, never recommend medicines or treatment, and never claim certainty.
- Never use these words: cancer, malignant, malignancy, carcinoma, the word stage followed by a number, or the phrase diagnostic confirmation. To express serious concern, use the riskTier field and phrases such as "needs prompt examination by a doctor".
- possibleConditions may list two to four common, general condition names that a doctor might consider for a similar appearance (for example: mouth ulcer, white patch (leukoplakia), lichen planus, fungal infection (oral thrush), gum inflammation, tooth decay). They are possibilities to discuss with a doctor only.
- Describe visual findings precisely: colour, approximate size compared with nearby teeth, shape, borders (smooth or irregular), surface (smooth, rough, raised, ulcerated) and location.
- Do not infer identity, history or symptoms that were not supplied. If the photo is blurry, too dark or does not show the mouth, say so and set confidenceScore low.
- confidenceScore (0 to 1) means how clearly the photo shows the features you describe.
${langPrompt}
The speechText field is read aloud: plain spoken sentences without markdown, emojis or URLs.

Respond only with valid JSON matching this structure:
{
  "observedCondition": "one sentence describing the main visible appearance",
  "conditionCategory": "white_lesion | red_lesion | ulcerative | pigmented | dental_caries | benign_mucosa | other",
  "riskTier": "low_risk_support | moderate_risk_support | high_risk_support",
  "confidenceScore": 0.0,
  "anatomicalSite": "visible location, e.g. left inner cheek, side of tongue, lower gum",
  "visualFindings": ["3 to 6 specific visible features: colour, size, shape, borders, surface"],
  "recommendedDoctor": {"specialty": "clinician type, e.g. dentist or oral medicine specialist", "facility": "facility type, e.g. nearest PHC or district hospital", "urgency": "routine | priority | urgent", "timelineDays": 14, "consultationReason": "short reason for the visit"},
  "urgentRedFlags": ["signs that mean the patient should seek care quickly"],
  "lifestyleAdvice": [],
  "imageObservation": "2 to 3 sentences describing what the photo appears to show and its quality",
  "possibleConditions": ["2 to 4 general condition names a doctor may consider"],
  "riskFactors": ["only factors supplied in the patient notes; empty if none"],
  "possibleCauses": ["2 to 4 common general causes of a similar appearance, e.g. sharp tooth edge, tobacco or betel use, infection"],
  "thingsToAvoid": ["1 to 3 mouth-related habits to avoid until examined, e.g. tobacco, betel quid, touching the area"],
  "whatToTellClinician": ["2 to 4 details to share with the doctor, e.g. when it started, pain, bleeding, growth"],
  "whenToConsult": ["general timing guidance"],
  "riskCategory": "low | moderate | high",
  "patientExplanation": "3 to 5 short sentences: what is visible, what a photo cannot tell, and why the doctor visit matters",
  "whenToSeekReview": ["2 to 4 practical signs or timeframes for an in-person review"],
  "answerText": "same plain-language explanation",
  "speechText": "plain spoken version of the summary",
  "suggestedActions": ["Book a clinician visit"]
}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Review this oral photo for screening support only. Patient notes: "${patientNote || 'No additional notes provided'}". Describe the visible features in detail and suggest a clinician type for an in-person review.`,
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
      maxOutputTokens: 6144,
      responseMimeType: 'application/json',
    },
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
  };

  // A truncated or malformed JSON answer is retried once (the call itself already retries overloads).
  let parsed: any;
  let usedModel = getGeminiModelName();
  let lastParseError: Error | null = null;
  for (let attempt = 1; attempt <= 2 && !parsed; attempt += 1) {
    const { json: responseJson, model } = await callGeminiApi(payload);
    usedModel = model;
    const textOutput = extractCandidateText(responseJson);
    try {
      if (!textOutput) throw new Error('Gemini returned an empty response for oral photo analysis');
      const candidate = JSON.parse(textOutput.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      validateOralAnalysis(candidate);
      parsed = candidate;
    } catch (parseError) {
      lastParseError = parseError instanceof Error ? parseError : new Error(String(parseError));
      logger.warn({ model, attempt, err: lastParseError.message.slice(0, 160) }, 'Gemini oral analysis response unusable');
    }
  }
  if (!parsed) throw lastParseError || new Error('Gemini returned an unusable oral photo analysis');

  const patientExplanation = safeText(
    typeof parsed.patientExplanation === 'string' && parsed.patientExplanation.trim() ? parsed.patientExplanation : parsed.answerText,
    'The photo shows an area that a clinician should look at. A photo alone cannot tell the cause, so an in-person examination is important.',
    1200,
  );
  const observedCondition = safeText(parsed.observedCondition, 'A visible change that needs clinician review.', 400);
  const imageObservation = safeText(
    typeof parsed.imageObservation === 'string' && parsed.imageObservation.trim() ? parsed.imageObservation : `The photo appears to show ${observedCondition}`,
    'The photo shows an area that needs clinician review. This description may be inaccurate.',
    1200,
  );
  const riskCategory = ['low', 'moderate', 'high'].includes(parsed.riskCategory) ? parsed.riskCategory as 'low' | 'moderate' | 'high' : 'low';

  return {
    observedCondition,
    conditionCategory: parsed.conditionCategory,
    riskTier: parsed.riskTier,
    confidenceScore: parsed.confidenceScore,
    anatomicalSite: safeText(parsed.anatomicalSite, 'Unclear from image', 200),
    visualFindings: safeList(parsed.visualFindings, 6),
    recommendedDoctor: {
      specialty: safeText(parsed.recommendedDoctor.specialty, 'Dentist or medical officer', 120),
      facility: safeText(parsed.recommendedDoctor.facility, 'Ask local health staff', 160),
      urgency: parsed.recommendedDoctor.urgency,
      timelineDays: Math.round(parsed.recommendedDoctor.timelineDays),
      consultationReason: safeText(parsed.recommendedDoctor.consultationReason, 'An in-person clinician review is needed.', 300),
    },
    urgentRedFlags: safeList(parsed.urgentRedFlags),
    lifestyleAdvice: safeList(parsed.lifestyleAdvice),
    answerText: safeText(parsed.answerText, patientExplanation, 1600),
    speechText: safeText(parsed.speechText, patientExplanation, 1200),
    patientExplanation,
    imageObservation,
    possibleConditions: safeList(parsed.possibleConditions, 4),
    riskFactors: safeList(parsed.riskFactors),
    possibleCauses: safeList(parsed.possibleCauses),
    thingsToAvoid: safeList(parsed.thingsToAvoid, 3),
    whatToTellClinician: safeList(parsed.whatToTellClinician),
    whenToConsult: safeList(parsed.whenToConsult),
    whenToSeekReview: safeList(parsed.whenToSeekReview),
    riskCategory,
    informationSources: ORAL_HEALTH_INFORMATION_SOURCES,
    language,
    suggestedActions: safeList(parsed.suggestedActions),
    disclaimer:
      'DEMO AI SCREENING SUPPORT ONLY — CONTAINS NO CONFIRMED CLINICAL FINDINGS. REQUIRES IN-PERSON CLINICIAN REVIEW.',
    analyzedByModel: usedModel,
  };
}

/** Structural validation of the Gemini JSON (throws on unusable responses). */
function validateOralAnalysis(parsed: any): void {
  const validRiskTiers = ['low_risk_support', 'moderate_risk_support', 'high_risk_support'];
  const validCategories = ['white_lesion', 'red_lesion', 'ulcerative', 'pigmented', 'dental_caries', 'benign_mucosa', 'other'];
  const validUrgencies = ['routine', 'priority', 'urgent'];
  if (!parsed || !validRiskTiers.includes(parsed.riskTier) || !validCategories.includes(parsed.conditionCategory)) {
    throw new Error('Gemini returned an incomplete screening support response.');
  }
  if (typeof parsed.confidenceScore !== 'number' || !Number.isFinite(parsed.confidenceScore) || parsed.confidenceScore < 0 || parsed.confidenceScore > 1) {
    throw new Error('Gemini returned an invalid confidence value.');
  }
  if (!parsed.recommendedDoctor || typeof parsed.recommendedDoctor.specialty !== 'string' || !parsed.recommendedDoctor.specialty.trim()) {
    throw new Error('Gemini did not provide a clinician navigation suggestion.');
  }
  if (!validUrgencies.includes(parsed.recommendedDoctor.urgency) || typeof parsed.recommendedDoctor.timelineDays !== 'number' || !Number.isFinite(parsed.recommendedDoctor.timelineDays) || parsed.recommendedDoctor.timelineDays < 0) {
    throw new Error('Gemini returned an invalid follow-up suggestion.');
  }
  if (typeof parsed.observedCondition !== 'string' || typeof parsed.answerText !== 'string' || typeof parsed.speechText !== 'string') {
    throw new Error('Gemini returned an incomplete screening support response.');
  }
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

  const { json: responseJson } = await callGeminiApi(payload);
  const textOutput = extractCandidateText(responseJson);

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
