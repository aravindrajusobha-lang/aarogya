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
 * Calls Gemini REST API using native fetch with multi-model fallback & timeout
 */
async function callGeminiApi(payload: any): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const primaryModel = getGeminiModelName();
  const fallbackCandidates = Array.from(new Set([
    primaryModel,
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
  ]));

  let lastError: Error | null = null;

  for (const model of fallbackCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);

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
        logger.warn({ status: res.status, errText: errText.slice(0, 160), model }, 'Gemini API candidate error, attempting fallback');
        lastError = new Error(`Gemini API returned HTTP ${res.status} on ${model}: ${errText.slice(0, 180)}`);
        // If 404 or 503 (model deprecated or busy), continue loop to next candidate
        if (res.status === 404 || res.status === 503 || res.status === 429) {
          continue;
        }
        throw lastError;
      }

      return await res.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        logger.warn({ model }, 'Gemini model call timed out, attempting next candidate');
        lastError = new Error(`Gemini API call timed out after 28 seconds on ${model}`);
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

  const langPrompt =
    language === 'te'
      ? 'The patient communicates in Telugu (తెలుగు). Generate answerText and speechText in natural, warm, conversational Telugu script. Explain medical terms simply.'
      : language === 'hi'
      ? 'The patient communicates in Hindi (हिंदी). Generate answerText and speechText in clear conversational Devanagari Hindi. Explain medical terms simply.'
      : 'The patient communicates in Indian English. Generate answerText and speechText in clear, accessible English.';

  const systemPrompt = `You are "Drishti AI", an advanced clinical triage and navigation assistant for the Aarogya-Drishti community healthcare platform in ITDA Paderu, Alluri Sitharama Raju (ASR) District, Andhra Pradesh.

MANDATORY CLINICAL SAFETY GUIDELINES:
1. You provide preliminary screening and specialist referral guidance. You DO NOT provide a final definitive clinical determination.
2. Explicitly specify WHICH SPECIALIST DOCTOR the patient should consult (e.g. Dental Surgeon, Oral & Maxillofacial Surgeon, ENT Specialist, Head & Neck Surgical Specialist).
3. Recommend referral facilities in ASR district or Visakhapatnam (e.g. Community Health Centre CHC Paderu, Area Hospital Araku, King George Hospital KGH Visakhapatnam).
4. Identify potential mucosal observations (e.g., leukoplakia, erythroplakia, aphthous stomatitis, oral lichen planus, dental caries, submucous fibrosis, gingival inflammation).
5. Specify triage risk tier: 'low_risk_support', 'moderate_risk_support', or 'high_risk_support'.
6. Provide immediate supportive lifestyle advice (immediate cessation of betel nut, tobacco, gutka, alcohol, warm saline mouth rinses).
7. ${langPrompt}
8. Plain speech text: The "speechText" field will be read aloud by browser Text-to-Speech. Never include markdown asterisks, emojis, bullet symbols, or URLs in speechText.

You must respond ONLY with a valid JSON object matching this schema:
{
  "observedCondition": "short name of visual mucosal finding",
  "conditionCategory": "white_lesion | red_lesion | ulcerative | pigmented | dental_caries | benign_mucosa | other",
  "riskTier": "low_risk_support | moderate_risk_support | high_risk_support",
  "confidenceScore": 0.88,
  "anatomicalSite": "e.g. Right Buccal Mucosa or Lateral Tongue",
  "visualFindings": ["finding 1", "finding 2"],
  "recommendedDoctor": {
    "specialty": "e.g. Dental Surgeon or Oral & Maxillofacial Specialist",
    "facility": "e.g. Community Health Centre (CHC) Paderu or KGH Visakhapatnam",
    "urgency": "routine | priority | urgent",
    "timelineDays": 7,
    "consultationReason": "Clear reason why this specialist should examine the lesion"
  },
  "urgentRedFlags": ["warning sign 1", "warning sign 2"],
  "lifestyleAdvice": ["Immediate tobacco cessation", "Warm saline rinse twice daily"],
  "answerText": "Comprehensive markdown response explaining what was observed, which doctor to consult, and next steps.",
  "speechText": "Natural spoken explanation in requested language without emojis or markdown symbols.",
  "suggestedActions": ["Book CHC Dental Appointment", "Find Nearest PHC", "Oral Self-Care Guide"]
}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Please analyze this oral cavity photo for screening triage. Patient notes: "${patientNote || 'Checking mouth spot / lesion'}". Identify the observed mucosal condition, triage risk tier, and state clearly which doctor/specialist to consult.`,
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
      maxOutputTokens: 1400,
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

  return {
    observedCondition: parsed.observedCondition || 'Unspecified Mucosal Finding',
    conditionCategory: parsed.conditionCategory || 'other',
    riskTier: ['low_risk_support', 'moderate_risk_support', 'high_risk_support'].includes(parsed.riskTier)
      ? parsed.riskTier
      : 'moderate_risk_support',
    confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.85,
    anatomicalSite: parsed.anatomicalSite || 'Oral Mucosa',
    visualFindings: Array.isArray(parsed.visualFindings) ? parsed.visualFindings : [],
    recommendedDoctor: {
      specialty: parsed.recommendedDoctor?.specialty || 'Dental Surgeon',
      facility: parsed.recommendedDoctor?.facility || 'Community Health Centre (CHC) Paderu',
      urgency: parsed.recommendedDoctor?.urgency || 'priority',
      timelineDays: parsed.recommendedDoctor?.timelineDays || 14,
      consultationReason:
        parsed.recommendedDoctor?.consultationReason ||
        'Clinical in-person examination and assessment of oral mucosal tissue.',
    },
    urgentRedFlags: Array.isArray(parsed.urgentRedFlags) ? parsed.urgentRedFlags : [],
    lifestyleAdvice: Array.isArray(parsed.lifestyleAdvice) ? parsed.lifestyleAdvice : [],
    answerText: parsed.answerText || 'Please consult your nearest Community Health Centre dental officer for an in-person evaluation.',
    speechText: parsed.speechText || 'We have analyzed your oral photo. Please consult a dental surgeon at your nearest health centre.',
    language,
    suggestedActions: Array.isArray(parsed.suggestedActions) && parsed.suggestedActions.length > 0
      ? parsed.suggestedActions
      : ['Consult Dental Surgeon', 'Find Nearest PHC', 'Screening Queue'],
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
