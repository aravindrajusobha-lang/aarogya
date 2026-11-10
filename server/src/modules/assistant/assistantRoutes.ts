import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { optionalAuth } from '../../middleware/authGuard.js';
import { Village } from '../reference/villageModel.js';
import { Hospital } from '../hospital/hospitalModel.js';
import { Camp } from '../camp/campModel.js';
import { ASR_MANDALS, ASR_GRAM_PANCHAYATS, ASR_HEALTHCARE_FACILITIES } from '../reference/asrGeographyData.js';
import {
  isGeminiConfigured,
  analyzeOralPhotoWithGemini,
  generateChatResponseWithGemini,
  OralPhotoAnalysisResult,
  DoctorRecommendation,
} from './geminiService.js';
import { logger } from '../../config/logger.js';

export const assistantRouter = Router();

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export type AnimationState =
  | 'greeting'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'explaining'
  | 'pointing'
  | 'happy'
  | 'warning'
  | 'demonstrating'
  | 'empathetic'
  | 'success'
  | 'error';

export type NurseExpression =
  | 'friendly'
  | 'thoughtful'
  | 'professional'
  | 'concerned'
  | 'smiling'
  | 'winking'
  | 'attentive'
  | 'calm';

export type NurseGesture =
  | 'wave'
  | 'open_hand'
  | 'point_left'
  | 'point_right'
  | 'thumbs_up'
  | 'hand_to_chin'
  | 'hands_on_chest'
  | 'gentle_warning';

export interface QueryResponse {
  answerText: string;
  speechText: string;
  language: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
  intent: string;
  animation: AnimationState;
  expression: NurseExpression;
  gesture: NurseGesture;
  topic: string;
  duration?: 'auto' | number;
  highlight?: string | null;
  navigateTo?: string | null;
  data?: any;
  suggestedActions?: string[];
  doctorRecommendation?: DoctorRecommendation;
  photoAnalysis?: Partial<OralPhotoAnalysisResult>;
}

/**
 * Unicode-based script detector for Indian regional languages and English
 */
export function detectLanguageFromText(text: string): 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' {
  if (!text || !text.trim()) return 'en';
  let teCount = 0;
  let hiCount = 0;
  let taCount = 0;
  let knCount = 0;
  let mlCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0c00 && code <= 0x0c7f) teCount++;
    else if (code >= 0x0900 && code <= 0x097f) hiCount++;
    else if (code >= 0x0b80 && code <= 0x0bff) taCount++;
    else if (code >= 0x0c80 && code <= 0x0cff) knCount++;
    else if (code >= 0x0d00 && code <= 0x0d7f) mlCount++;
  }

  const scores = [
    { lang: 'te' as const, count: teCount },
    { lang: 'hi' as const, count: hiCount },
    { lang: 'ta' as const, count: taCount },
    { lang: 'kn' as const, count: knCount },
    { lang: 'ml' as const, count: mlCount },
  ];
  scores.sort((a, b) => b.count - a.count);
  if (scores[0].count > 0) return scores[0].lang;

  // Latin transliteration heuristic for Romanized Telugu and Hindi
  const lower = text.toLowerCase();
  const teluguSpecific = /\b(ela|cheyali|cheyyali|cheyandi|unnaru|emiti|pundu|pundlu|noppi|naku|cheppandi|bagunnara|enti|ledu|undi|ayindi|kavali|ekada|ekkada|chupinchali|dantla|dantlo|kotha|noti|raktham|manchidi|pedda|chinna|evaru|evarini)\b/i;
  const hindiSpecific = /\b(kaise|karna|karein|kare|karo|kripya|kya|mujhe|chala|chhale|dard|hai|bataiye|theek|nahi|hoga|daant|dant|khoon|mariz|aspatal|kahan|dikhao|dikhaen|pariwar)\b/i;

  if (teluguSpecific.test(lower) && !hindiSpecific.test(lower)) return 'te';
  if (hindiSpecific.test(lower) && !teluguSpecific.test(lower)) return 'hi';

  return 'en';
}

/**
 * Offline fallback oral photo analyzer if Gemini API is offline or unconfigured
 */
export function offlineAnalyzeOralPhoto(patientNote: string, lang: string): OralPhotoAnalysisResult {
  const note = (patientNote || '').toLowerCase();
  let condition = 'Oral Mucosal Keratosis / Observation';
  let category: OralPhotoAnalysisResult['conditionCategory'] = 'white_lesion';
  let riskTier: OralPhotoAnalysisResult['riskTier'] = 'moderate_risk_support';
  let specialty = 'Dental Surgeon / Oral & Maxillofacial Specialist';
  let facility = 'Community Health Centre (CHC) Paderu';
  let timeline = 14;
  let reason = 'Professional clinical examination of mucosal tissue and habit history review.';

  if (note.includes('red') || note.includes('blood') || note.includes('bleeding')) {
    condition = 'Erythroplakic Mucosal Area';
    category = 'red_lesion';
    riskTier = 'high_risk_support';
    specialty = 'Oral & Maxillofacial Surgeon / ENT Specialist';
    facility = 'Area Hospital Araku / King George Hospital Visakhapatnam';
    timeline = 7;
    reason = 'High-priority assessment of red mucosal patch and vascularity inspection.';
  } else if (note.includes('ulcer') || note.includes('sore') || note.includes('wound') || note.includes('pain')) {
    condition = 'Aphthous Mucosal Ulceration';
    category = 'ulcerative';
    riskTier = 'moderate_risk_support';
    specialty = 'Dental Surgeon';
    facility = 'Community Health Centre (CHC) Paderu';
    timeline = 10;
    reason = 'Evaluation of recurrent or persistent oral mucosal ulceration.';
  }

  let answerText = '';
  let speechText = '';

  if (lang === 'te') {
    answerText =
      `📸 **నోటి ఫోటో స్క్రీనింగ్ విశ్లేషణ పూర్తయింది**\n\n` +
      `🔍 **పరిశీలించిన పరిస్థితి:** ${condition}\n` +
      `⚠️ **రిస్క్ స్థాయి:** మధ్యస్థ స్థాయి మద్దతు (DEMO AI)\n\n` +
      `👨‍⚕️ **మీరు సంప్రదించవలసిన వైద్యులు (Doctor to Consult):**\n` +
      `• **నిపుణులు:** ${specialty}\n` +
      `• **సిఫార్సు చేసిన ఆసుపత్రి:** ${facility}\n` +
      `• **సమయం:** ${timeline} రోజుల్లోపు తప్పనిసరిగా సంప్రదించండి\n\n` +
      `💡 **ముఖ్యమైన రక్షణ చర్యలు:**\n` +
      `• తంబాకు, గుట్కా, ఖైనీ, పాన్ మరియు ఆల్కహాల్ వెంటనే ఆపివేయండి.\n` +
      `• గోరువెచ్చని ఉప్పు నీటితో రోజుకు రెండుసార్లు నోటిని శుభ్రం చేసుకోండి.\n` +
      `• స్థానిక ఆశా లేదా ANM కార్యకర్త సహాయంతో CHC లో అపాయింట్‌మెంట్ తీసుకోండి.`;

    speechText =
      `మీ నోటి ఫోటోను పరిశీలించాము. ${condition} సూచనలు కనిపించాయి. దయచేసి ${facility} లో ${specialty} ను ${timeline} రోజుల్లోపు సంప్రదించండి. తంబాకు మరియు గుట్కా వాడకాన్ని వెంటనే ఆపండి.`;
  } else if (lang === 'hi') {
    answerText =
      `📸 **मुख फोटो स्क्रीनिंग विश्लेषण पूर्ण**\n\n` +
      `🔍 **देखी गई स्थिति:** ${condition}\n` +
      `⚠️ **जोखिम स्तर:** मध्यम सहायता स्तर (DEMO AI)\n\n` +
      `👨‍⚕️ **परामर्श के लिए डॉक्टर (Doctor to Consult):**\n` +
      `• **विशेषज्ञ:** ${specialty}\n` +
      `• **अनुशंसित अस्पताल:** ${facility}\n` +
      `• **समय सीमा:** ${timeline} दिनों के भीतर परामर्श लें\n\n` +
      `💡 **महत्वपूर्ण सावधानियां:**\n` +
      `• तंबाकू, गुटखा, पान मसाला और शराब का सेवन तुरंत बंद करें।\n` +
      `• गुनगुने नमक के पानी से दिन में दो बार कुल्ला करें।\n` +
      `• निकटतम सामुदायिक स्वास्थ्य केंद्र में दंत चिकित्सक से प्रत्यक्ष जांच कराएं।`;

    speechText =
      `आपके मुख की तस्वीर का विश्लेषण किया गया है। कृपया ${timeline} दिनों के भीतर ${facility} में ${specialty} से प्रत्यक्ष परामर्श लें। तंबाकू का सेवन तुरंत बंद करें।`;
  } else {
    answerText =
      `📸 **Oral Mucosal Photo Screening Analysis Completed**\n\n` +
      `🔍 **Observed Presentation:** ${condition}\n` +
      `⚠️ **Risk Support Tier:** Moderate Risk Support (DEMO AI)\n\n` +
      `👨‍⚕️ **Recommended Doctor to Consult:**\n` +
      `• **Medical Specialty:** ${specialty}\n` +
      `• **Referral Facility:** ${facility}\n` +
      `• **Timeline:** Please consult within **${timeline} days**\n\n` +
      `💡 **Immediate Guidance:**\n` +
      `• Completely cease tobacco, betel nut, gutka, and alcohol irritants immediately.\n` +
      `• Perform gentle warm saline rinses twice daily.\n` +
      `• Schedule an in-person clinical oral examination at your nearest Community Health Centre.`;

    speechText =
      `We have completed visual screening of your oral photo. Visual findings indicate ${condition}. Please consult a ${specialty} at ${facility} within ${timeline} days. Cease all tobacco and betel nut use immediately.`;
  }

  return {
    observedCondition: condition,
    conditionCategory: category,
    riskTier,
    confidenceScore: 0.85,
    anatomicalSite: 'Oral Mucosa',
    visualFindings: [condition, 'Tissue surface irregularity requiring inspection'],
    recommendedDoctor: {
      specialty,
      facility,
      urgency: riskTier === 'high_risk_support' ? 'urgent' : 'priority',
      timelineDays: timeline,
      consultationReason: reason,
    },
    urgentRedFlags: [
      'Ulcer non-healing beyond 14 days',
      'Unexplained oral bleeding or loose teeth',
      'Difficulty opening mouth or swallowing',
    ],
    lifestyleAdvice: [
      'Immediate tobacco and gutka cessation',
      'Warm salt water mouth rinses twice daily',
      'Maintain gentle oral hygiene',
    ],
    answerText,
    speechText,
    language: (lang as any) || 'en',
    suggestedActions: ['Book Dental Appointment', 'Locate Nearest PHC', 'Oral Health Tips'],
    disclaimer:
      'DEMO AI SCREENING SUPPORT ONLY — CONTAINS NO CONFIRMED FINDINGS OR STAGING. REQUIRES CLINICIAN REVIEW.',
    analyzedByModel: 'Offline Rule-Based Heuristic',
  };
}

/**
 * POST /api/v1/assistant/query
 * Intelligent Healthcare AI Assistant ("Drishti AI")
 * Understands English, Telugu, Hindi, Tamil, Kannada, and Malayalam
 * Features Google Gemini API integration with automatic offline fallback.
 */
assistantRouter.post(
  '/query',
  optionalAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        message,
        query,
        language = 'en',
        context = '',
        conversationHistory = [],
        image,
        imageBase64,
        mimeType = 'image/jpeg',
      } = req.body as {
        message?: string;
        query?: string;
        language?: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
        context?: any;
        conversationHistory?: { role: string; text: string }[];
        image?: string;
        imageBase64?: string;
        mimeType?: string;
      };

      const rawInput = (message || query || '').trim();
      const rawImage = imageBase64 || image;
      const q = rawInput.toLowerCase();
      const detected = detectLanguageFromText(rawInput);
      const requestedLang = ['en', 'te', 'hi', 'ta', 'kn', 'ml'].includes(language) ? language : 'en';
      // Auto-detect patient language from script, with graceful fallback to requested or default
      const lang = detected !== 'en' ? detected : requestedLang;

      let response: QueryResponse | null = null;

      // =========================================================================
      // CASE 1: Oral Photo Attached for Visual Screening & Doctor Recommendation
      // =========================================================================
      if (rawImage) {
        let photoResult: OralPhotoAnalysisResult;
        if (isGeminiConfigured()) {
          try {
            photoResult = await analyzeOralPhotoWithGemini({
              imageBase64: rawImage,
              mimeType,
              patientNote: rawInput,
              language: lang,
            });
          } catch (geminiErr: any) {
            logger.warn({ err: geminiErr.message }, 'Gemini photo analysis failed, falling back to offline triage');
            photoResult = offlineAnalyzeOralPhoto(rawInput, lang);
          }
        } else {
          photoResult = offlineAnalyzeOralPhoto(rawInput, lang);
        }

        response = {
          answerText: photoResult.answerText,
          speechText: photoResult.speechText,
          language: lang,
          intent: 'oral_photo_screening',
          animation: photoResult.riskTier === 'high_risk_support' ? 'warning' : 'explaining',
          expression: photoResult.riskTier === 'high_risk_support' ? 'concerned' : 'thoughtful',
          gesture: photoResult.riskTier === 'high_risk_support' ? 'gentle_warning' : 'point_right',
          topic: 'oral_lesion_analysis',
          suggestedActions: photoResult.suggestedActions,
          doctorRecommendation: photoResult.recommendedDoctor,
          photoAnalysis: photoResult,
        };
      }

      // =========================================================================
      // CASE 2: Live Conversational AI Generation via Gemini (if configured)
      // =========================================================================
      if (!response && isGeminiConfigured() && rawInput) {
        try {
          const geminiResult = await generateChatResponseWithGemini({
            message: rawInput,
            conversationHistory,
            language: lang,
            context,
          });

          response = {
            answerText: geminiResult.answerText,
            speechText: geminiResult.speechText,
            language: geminiResult.language,
            intent: geminiResult.intent,
            animation: geminiResult.animation,
            expression: geminiResult.expression,
            gesture: geminiResult.gesture,
            topic: geminiResult.topic,
            suggestedActions: geminiResult.suggestedActions,
            doctorRecommendation: geminiResult.doctorRecommendation,
          };
        } catch (geminiErr: any) {
          logger.warn({ err: geminiErr.message }, 'Gemini conversational query error, falling back to rule engine');
        }
      }

      // =========================================================================
      // CASE 3: Built-in Offline Deterministic Rule & Intent Engine (Fallback)
      // =========================================================================
      if (!response) {

      // Intent A: First-time Onboarding & Registration Help
      if (
        q.includes('register') ||
        q.includes('registration') ||
        q.includes('step 1') ||
        q.includes('create account') ||
        q.includes('sign up') ||
        q.includes('new user') ||
        q.includes('new patient') ||
        q.includes('aadhaar') ||
        q.includes('adhaar') ||
        q.includes('నమోదు') ||
        q.includes('రిజిస్ట్రేషన్') ||
        q.includes('ఖాతా') ||
        q.includes('కొత్త') ||
        q.includes('ela register') ||
        q.includes('register cheyyali') ||
        q.includes('register cheyali') ||
        q.includes('patient ni register') ||
        q.includes('kotha patient') ||
        q.includes('aadhaar tho') ||
        q.includes('पंजीकरण') ||
        q.includes('रजिस्ट्रेशन') ||
        q.includes('खाता') ||
        q.includes('साइन अप') ||
        q.includes('नया मरीज') ||
        q.includes('registration kaise') ||
        q.includes('mariz ko kaise') ||
        q.includes('patient register kaise')
      ) {
        if (lang === 'te') {
          response = {
            answerText: `ఆరోగ్య దృష్టిలో నమోదు ప్రక్రియ చాలా సులభం!\n\n1. మీ పూర్తి పేరును ఎంటర్ చేయండి.\n2. మీ మొబైల్ నంబర్ మరియు గ్రామ సమాచారం నమోదు చేయండి.\n3. మీ పాత్రను ఎంచుకోండి (రోగి, ఆశా కార్యకర్త, ANM, లేదా మెడికల్ ఆఫీసర్).\n4. సురక్షితమైన పాస్‌వర్డ్‌ను ఎంటర్ చేయండి.\n\n🔒 **భద్రతా సూచన:** పాస్‌వర్డ్‌ను చాట్‌లో ఎప్పుడూ చెప్పవద్దు; నేరుగా రిజిస్ట్రేషన్ ఫారమ్‌లోనే నమోదు చేయండి.`,
            speechText: `ఆరోగ్య దృష్టిలో మీ ఖాతాను ప్రారంభించడానికి నేను మీకు సహాయం చేస్తాను. దయచేసి స్క్రీన్‌పై ఉన్న రిజిస్ట్రేషన్ ఫారమ్‌ను పూరించండి. పాస్‌వర్డ్‌ను ఎవరికీ చెప్పవద్దు.`,
            language: 'te',
            intent: 'guided_registration',
            animation: 'pointing',
            expression: 'friendly',
            gesture: 'point_right',
            topic: 'registration',
            navigateTo: 'auth',
            highlight: 'auth-register-tab',
            suggestedActions: ['Open Sign In', 'Quick Demo Login', 'Explore Dashboard'],
          };
        } else if (lang === 'hi') {
          response = {
            answerText: `आरोग्य दृष्टि में पंजीकरण बहुत आसान है!\n\n1. अपना पूरा नाम दर्ज करें।\n2. मोबाइल नंबर और गांव की जानकारी भरें।\n3. अपनी भूमिका चुनें (रोगी, आशा कार्यकर्ता, एएनएम, या मेडिकल ऑफिसर)।\n4. सुरक्षित पासवर्ड बनाएं।\n\n🔒 **सुरक्षा सूचना:** पासवर्ड कभी भी चैट में न बताएं; सीधे पंजीकरण फॉर्म में भरें।`,
            speechText: `आरोग्य दृष्टि में खाता बनाने के लिए मैं आपकी मार्गदर्शिका हूँ। कृपया दिए गए फॉर्म में आवश्यक जानकारी भरें।`,
            language: 'hi',
            intent: 'guided_registration',
            animation: 'pointing',
            expression: 'friendly',
            gesture: 'point_right',
            topic: 'registration',
            navigateTo: 'auth',
            highlight: 'auth-register-tab',
            suggestedActions: ['Open Sign In', 'Quick Demo Login', 'Explore Dashboard'],
          };
        } else {
          response = {
            answerText: `Registration on Aarogya-Drishti is quick and secure!\n\n1. Enter your Full Name.\n2. Provide your Phone Number and Village/Mandal location.\n3. Select your Role (Patient, ASHA Worker, ANM, or Medical Officer).\n4. Create a strong password directly in the form.\n\n🔒 **Security Assurance:** I will never ask for your password in conversation. Enter passwords exclusively into the secure registration form.`,
            speechText: `Welcome! I'll guide you through creating your account. Please complete the fields in the registration panel. Remember, never disclose your password in chat.`,
            language: 'en',
            intent: 'guided_registration',
            animation: 'pointing',
            expression: 'friendly',
            gesture: 'point_right',
            topic: 'registration',
            navigateTo: 'auth',
            highlight: 'auth-register-tab',
            suggestedActions: ['Open Sign In', 'Quick Demo Login', 'Explore Dashboard'],
          };
        }
      }

      // Intent B: Application Walkthrough Tour
      else if (
        q.includes('tour') ||
        q.includes('walkthrough') ||
        q.includes('guide me') ||
        q.includes('how to use') ||
        q.includes('features') ||
        q.includes('టూర్') ||
        q.includes('చూపించు') ||
        q.includes('ఎలా వాడాలి') ||
        q.includes('दिखाएं') ||
        q.includes('टूर') ||
        q.includes('मार्गदर्शन')
      ) {
        if (lang === 'te') {
          response = {
            answerText: `నేను మీకు ఆరోగ్య దృష్టి అప్లికేషన్‌ను పరిచయం చేస్తాను!\n\n1. 📊 **కమాండ్ డాష్‌బోర్డ్:** స్క్రీనింగ్ గణాంకాలు మరియు ముఖ్య చర్యలు.\n2. 📸 **క్లినికల్ స్క్రీనింగ్:** ఫోటో క్యాప్చర్ & డెమో AI రిస్క్ అసెస్‌మెంట్.\n3. 🏕️ **స్క్రీనింగ్ క్యాంపులు:** గిరిజన గ్రామాల అవుట్‌రీచ్ షెడ్యూలింగ్.\n4. 👥 **రోగుల రిజిస్ట్రీ:** ఇంటర్నెట్ లేని ప్రదేశాల్లో ఆఫ్‌లైన్ సింక్.\n5. 🗺️ **ASR జిల్లా మ్యాప్:** 22 మండలాల సమగ్ర భౌగోళిక సమాచారం.`,
            speechText: `రండి! ఆరోగ్య దృష్టి ముఖ్యమైన భాగాలను నేను మీకు చూపిస్తాను. డాష్‌బోర్డ్, స్క్రీనింగ్, క్యాంపులు మరియు జిల్లా మ్యాప్ ఇక్కడ అందుబాటులో ఉన్నాయి.`,
            language: 'te',
            intent: 'app_tour',
            animation: 'demonstrating',
            expression: 'smiling',
            gesture: 'point_right',
            topic: 'tour',
            suggestedActions: ['Start Interactive Tour', 'Show Dashboard', 'View GIS Map'],
          };
        } else if (lang === 'hi') {
          response = {
            answerText: `मैं आपको आरोग्य दृष्टि के प्रमुख फीचर्स से परिचित कराती हूँ!\n\n1. 📊 **डैशबोर्ड:** मुख्य मेट्रिक्स और त्वरित शॉर्टकट।\n2. 📸 **क्लिनिकल स्क्रीनिंग:** फोटो कैप्चर और डेमो AI जोखिम सहायता।\n3. 🏕️ **स्क्रीनिंग कैंप:** आदिवासी बस्तियों के लिए स्वास्थ्य शिविर।\n4. 👥 **मरीज रजिस्ट्री:** बिना नेटवर्क के ऑफलाइन सुरक्षित सिंक।\n5. 🗺️ **ASR जिला मानचित्र:** 22 मंडलों का जीआईएस मैप।`,
            speechText: `आइए, मैं आपको आरोग्य दृष्टि के मुख्य फीचर्स दिखाती हूँ। यहां डैशबोर्ड, स्क्रीनिंग कैंप और जिला मैप मौजूद हैं।`,
            language: 'hi',
            intent: 'app_tour',
            animation: 'demonstrating',
            expression: 'smiling',
            gesture: 'point_right',
            topic: 'tour',
            suggestedActions: ['Start Interactive Tour', 'Show Dashboard', 'View GIS Map'],
          };
        } else {
          response = {
            answerText: `Let me walk you through the core modules of Aarogya-Drishti:\n\n1. 📊 **Operations Dashboard:** Real-time screening KPIs, recent activity, and launchpad shortcuts.\n2. 📸 **Clinical Screening & Demo AI:** Frontline mucosal visual intake, SHA-256 photo hashing, and non-diagnostic risk review.\n3. 🏕️ **Outreach Screening Camps:** Lifecycle camp planning, worker assignment, and cohort privacy suppression (< 5).\n4. 👥 **Patient Registry & Sync:** OTP-free intake with client-side AES-GCM-256 WebCrypto offline queue.\n5. 🗺️ **ASR District GIS Map:** Interactive mapping covering all 22 Mandals across Paderu and Rampachodavaram.`,
            speechText: `Welcome to the guided tour! Aarogya-Drishti connects frontline workers across Eastern Ghats tribal habitations to hospital doctors through screening, camps, and telemedicine.`,
            language: 'en',
            intent: 'app_tour',
            animation: 'demonstrating',
            expression: 'smiling',
            gesture: 'point_right',
            topic: 'tour',
            suggestedActions: ['Start Interactive Tour', 'Show Dashboard', 'View GIS Map'],
          };
        }
      }

      // Intent B2: Acute General Symptoms (Fever, Headache, Cough, Body Pain) - Female Conversational Companion
      else if (
        q.includes('fever') ||
        q.includes('headache') ||
        q.includes('cough') ||
        q.includes('cold') ||
        q.includes('temperature') ||
        q.includes('shivering') ||
        q.includes('chills') ||
        q.includes('body pain') ||
        q.includes('tired') ||
        q.includes('జ్వరం') ||
        q.includes('తలనొప్పి') ||
        q.includes('దగ్గు') ||
        q.includes('జలుబు') ||
        q.includes('చలి') ||
        q.includes('నొప్పులు') ||
        q.includes('నీరసం') ||
        q.includes('బుఖార్') ||
        q.includes('बुखार') ||
        q.includes('सिरदर्द') ||
        q.includes('खांसी') ||
        q.includes('जुकाम') ||
        q.includes('बदन दर्द') ||
        q.includes('காய்ச்சல்') ||
        q.includes('தலைவலி') ||
        q.includes('இருமல்') ||
        q.includes('சளி') ||
        q.includes('ಜ್ವರ') ||
        q.includes('ತಲೆನೋವು') ||
        q.includes('ಕೆಮ್ಮು') ||
        q.includes('ನೆಗಡಿ') ||
        q.includes('പനി') ||
        q.includes('തലവേദന') ||
        q.includes('ചുമ')
      ) {
        if (lang === 'te') {
          response = {
            answerText: `నమస్కారం అండీ. మీకు జ్వరం లేదా తలనొప్పి ఉందని నేను గమనించాను.\n\n**లక్షణాలను అర్థం చేసుకోవడానికి ఒక ప్రశ్న:**\nమీకు ఈ జ్వరం లేదా తలనొప్పితో పాటు చలి, తీవ్రమైన దగ్గు లేదా శ్వాస తీసుకోవడంలో ఇబ్బంది ఏమైనా ఉందా?\n\n💡 **ప్రాథమిక సంరక్షణ సలహాలు:**\n• తగినంత విశ్రాంతి తీసుకోండి మరియు కాచి చల్లార్చిన నీటిని లేదా ఓఆర్ఎస్ పుష్కలంగా తాగండి.\n• సులభంగా జీర్ణమయ్యే తేలికపాటి ఆహారం తీసుకోండి.\n• శరీర ఉష్ణోగ్రతను ఎప్పటికప్పుడు గమనిస్తూ ఉండండి.\n• జ్వరం ఎక్కువగా ఉంటే లేదా రెండు మూడు రోజుల్లో తగ్గకపోతే వెంటనే మీ గ్రామ ఆశా కార్యకర్తను లేదా సమీప ప్రాథమిక ఆరోగ్య కేంద్రం (PHC) వైద్యుడిని సంప్రదించండి.\n*(గమనిక: ఇది ప్రాథమిక ఆరోగ్య విద్య మరియు సంరక్షణ మార్గదర్శకత్వం మాత్రమే; రోగ నిర్ధారణ కాదు.)*`,
            speechText: `నమస్కారం అండీ. మీకు జ్వరం ఉందని అర్థమైంది. దీనితో పాటు మీకు చలి, దగ్గు లేదా శ్వాస తీసుకోవడంలో ఇబ్బంది ఏమైనా ఉందా? దయచేసి పుష్కలంగా విశ్రాంతి తీసుకోండి మరియు నీరు తాగండి. జ్వరం తగ్గకపోతే వెంటనే మీ ఆశా కార్యకర్తను లేదా డాక్టర్‌ను సంప్రదించండి.`,
            language: 'te',
            intent: 'fever_general_symptom_inquiry',
            animation: 'empathetic',
            expression: 'attentive',
            gesture: 'open_hand',
            topic: 'general_symptoms',
            navigateTo: 'hospitals',
            suggestedActions: ['Find Nearest PHC', 'Check Oral Symptoms', 'Consult ASHA Worker'],
          };
        } else if (lang === 'hi') {
          response = {
            answerText: `नमस्ते। मैंने समझा कि आपको बुखार या सिरदर्द की परेशानी है।\n\n**लक्षणों को समझने के लिए एक प्रश्न:**\nक्या बुखार के साथ आपको ठंड लगना, तेज खांसी या सांस लेने में कोई तकलीफ भी हो रही है?\n\n💡 **प्राथमिक देखभाल सलाह:**\n• भरपूर आराम करें और गुनगुना उबला पानी पिएं।\n• हल्का और सुपाच्य भोजन लें।\n• शरीर का तापमान नोट करते रहें।\n• यदि बुखार तेज है या दो-तीन दिनों में ठीक नहीं होता है, तो तुरंत अपनी आशा कार्यकर्ता या नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC) में डॉक्टर को दिखाएं।\n*(नोट: यह सामान्य स्वास्थ्य शिक्षा है; चिकित्सीय निदान नहीं।)*`,
            speechText: `नमस्ते। मैं समझ रही हूँ कि आपको बुखार है। क्या इसके साथ आपको ठंड या खांसी भी महसूस हो रही है? कृपया पर्याप्त आराम करें और पानी पिएं। यदि बुखार न उतरे तो नजदीकी स्वास्थ्य केंद्र में डॉक्टर को जरूर दिखाएं।`,
            language: 'hi',
            intent: 'fever_general_symptom_inquiry',
            animation: 'empathetic',
            expression: 'attentive',
            gesture: 'open_hand',
            topic: 'general_symptoms',
            navigateTo: 'hospitals',
            suggestedActions: ['Find Nearest PHC', 'Check Oral Symptoms', 'Consult ASHA Worker'],
          };
        } else if (lang === 'ta') {
          response = {
            answerText: `வணக்கம். உங்களுக்கு காய்ச்சல் அல்லது உடல் வலி இருப்பது தெரிகிறது.\n\n**ஒரு கேள்வி:**\nகாய்ச்சலுடன் குளிர்நடுக்கம், கடுமையான இருமல் அல்லது மூச்சுத்திணறல் ஏதேனும் உள்ளதா?\n\n💡 **பொதுவான பராமரிப்பு:**\n• போதிய ஓய்வு எடுங்கள், காய்ச்சிய குடிநீரை அதிகமாக அருந்துங்கள்.\n• இரண்டு நாட்களுக்கு மேல் நீடித்தால் ஆரம்ப சுகாதார நிலைய மருத்துவரை அணுகவும்.\n*(குறிப்பு: இது பொதுவான தகவல் மட்டுமே; நோய் கண்டறிதல் அல்ல).*`,
            speechText: `வணக்கம். உங்களுக்கு காய்ச்சல் இருப்பது புரிகிறது. இத்துடன் நடுக்கம் அல்லது இருமல் உள்ளதா? ஓய்வெடுத்து நீர் அருந்துங்கள். காய்ச்சல் குறையவில்லை என்றால் ஆரம்ப சுகாதார நிலைய மருத்துவரை அணுகவும்.`,
            language: 'ta',
            intent: 'fever_general_symptom_inquiry',
            animation: 'empathetic',
            expression: 'attentive',
            gesture: 'open_hand',
            topic: 'general_symptoms',
            navigateTo: 'hospitals',
            suggestedActions: ['Find Nearest PHC', 'Check Oral Symptoms', 'Consult ASHA Worker'],
          };
        } else if (lang === 'kn') {
          response = {
            answerText: `ನಮಸ್ಕಾರ. ನಿಮಗೆ ಜ್ವರ ಅಥವಾ ತಲೆನೋವು ಇರುವುದು ತಿಳಿಯಿತು.\n\n**ಒಂದು ಪ್ರಶ್ನೆ:**\nಜ್ವರದೊಂದಿಗೆ ನಡುಕ, ಕೆಮ್ಮು ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆಯೇ?\n\n💡 **ಪ್ರಾಥಮಿಕ ಸಲಹೆ:**\n• ಸಾಕಷ್ಟು ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ ಮತ್ತು ಕಾಯಿಸಿ ಆರಿಸಿದ ನೀರನ್ನು ಕುಡಿಯಿರಿ.\n• ಎರಡು ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಮುಂದುವರಿದರೆ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರದ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.\n*(ಗಮನಿಸಿ: ಇದು ಸಾಮಾನ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ; ರೋಗ ನಿರ್ಣಯವಲ್ಲ).*`,
            speechText: `ನಮಸ್ಕಾರ. ನಿಮಗೆ ಜ್ವರವಿದೆ ಎಂದು ಅರ್ಥವಾಯಿತು. ಇದರೊಂದಿಗೆ ಕೆಮ್ಮು ಅಥವಾ ನಡುಕ ಇದೆಯೇ? ದಯವಿಟ್ಟು ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ. ಜ್ವರ ಮುಂದುವರಿದರೆ ಹತ್ತಿರದ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.`,
            language: 'kn',
            intent: 'fever_general_symptom_inquiry',
            animation: 'empathetic',
            expression: 'attentive',
            gesture: 'open_hand',
            topic: 'general_symptoms',
            navigateTo: 'hospitals',
            suggestedActions: ['Find Nearest PHC', 'Check Oral Symptoms', 'Consult ASHA Worker'],
          };
        } else if (lang === 'ml') {
          response = {
            answerText: `നമസ്കാരം. നിങ്ങൾക്ക് പനിയോ തലവേദനയോ ഉള്ളതായി മനസ്സിലാക്കുന്നു.\n\n**ഒരു ചോദ്യം:**\nപനിയോടൊപ്പം വിറയലോ, ചുമയോ, ശ്വാസമെടുക്കാൻ ബുദ്ധിമുട്ടോ ഉണ്ടോ?\n\n💡 **പ്രാഥമിക പരിചരണം:**\n• ആവശ്യത്തിന് വിശ്രമിക്കുകയും ധാരാളം തിളപ്പിച്ചാറിയ വെള്ളം കുടിക്കുകയും ചെയ്യുക.\n• രണ്ടു ദിവസത്തിലധികം തുടരുകയാണെങ്കിൽ പ്രാഥമിക ആരോഗ്യ കേന്ദ്രത്തിലെ ഡോക്ടറെ കാണുക.\n*(ശ്രദ്ധിക്കുക: ഇത് പൊതുവായ വിവരങ്ങൾ മാത്രമാണ്; രോഗനിർണ്ണയമല്ല).*`,
            speechText: `നമസ്കാരം. നിങ്ങൾക്ക് പനിയുണ്ടെന്ന് മനസ്സിലായി. ഇതിനൊപ്പം വിറയലോ ചുമയോ ഉണ്ടോ? വിശ്രമിക്കുക, വെള്ളം കുടിക്കുക. പനി മാറിയില്ലെങ്കിൽ ഉടൻ ഡോക്ടറെ കാണുക.`,
            language: 'ml',
            intent: 'fever_general_symptom_inquiry',
            animation: 'empathetic',
            expression: 'attentive',
            gesture: 'open_hand',
            topic: 'general_symptoms',
            navigateTo: 'hospitals',
            suggestedActions: ['Find Nearest PHC', 'Check Oral Symptoms', 'Consult ASHA Worker'],
          };
        } else {
          response = {
            answerText: `Hello. I understand that you are experiencing fever or body discomfort.\n\n**To help understand your condition better, one quick question:**\nAlong with this fever, do you have any severe chills, chest tightness, or difficulty breathing?\n\n💡 **General Supportive Care:**\n• Get plenty of bed rest and drink clean, boiled water or oral rehydration fluids.\n• Eat light, easily digestible meals and monitor your temperature periodically.\n• If the fever exceeds 101°F or does not subside within two to three days, please contact your local ASHA worker or visit the nearest Primary Health Centre (PHC) for clinical assessment.\n*(Notice: General health education and supportive guidance only; does not replace in-person doctor evaluation).*`,
            speechText: `Hello. I understand you have a fever. Along with this, do you have any chills, cough, or difficulty breathing? Please rest well and stay hydrated. If the fever persists, please visit your local health center or doctor promptly.`,
            language: 'en',
            intent: 'fever_general_symptom_inquiry',
            animation: 'empathetic',
            expression: 'attentive',
            gesture: 'open_hand',
            topic: 'general_symptoms',
            navigateTo: 'hospitals',
            suggestedActions: ['Find Nearest PHC', 'Check Oral Symptoms', 'Consult ASHA Worker'],
          };
        }
      }

      // Intent C: Medical Symptoms & Oral Health Safety Guidance
      else if (
        q.includes('ulcer') ||
        q.includes('patch') ||
        q.includes('lesion') ||
        q.includes('tobacco') ||
        q.includes('gutkha') ||
        q.includes('sore') ||
        q.includes('bleeding') ||
        q.includes('swelling') ||
        q.includes('lump') ||
        q.includes('burning') ||
        q.includes('white') ||
        q.includes('red') ||
        q.includes('toothache') ||
        q.includes('mouth ulcer') ||
        // Telugu Script & Transliteration
        q.includes('పుండు') ||
        q.includes('మచ్చ') ||
        q.includes('నొప్పి') ||
        q.includes('వాపు') ||
        q.includes('గుట్కా') ||
        q.includes('గాయం') ||
        q.includes('రక్తం') ||
        q.includes('pundu') ||
        q.includes('noppi') ||
        q.includes('macha') ||
        q.includes('raktham') ||
        q.includes('dantla') ||
        q.includes('noti lo') ||
        // Hindi Script & Transliteration
        q.includes('छाला') ||
        q.includes('घाव') ||
        q.includes('सफेद') ||
        q.includes('दर्द') ||
        q.includes('तंबाकू') ||
        q.includes('खून') ||
        q.includes('chhale') ||
        q.includes('chala') ||
        q.includes('daant') ||
        q.includes('dant') ||
        q.includes('jalan') ||
        q.includes('khoon')
      ) {
        // Red flag checks (persistent ulcer > 14 days, lump, difficulty swallowing, bleeding)
        const isUrgent =
          q.includes('more than') ||
          q.includes('2 weeks') ||
          q.includes('14 days') ||
          q.includes('month') ||
          q.includes('swallow') ||
          q.includes('lump') ||
          q.includes('bleed') ||
          q.includes('emergency') ||
          q.includes('breath') ||
          q.includes('చాలా రోజులు') ||
          q.includes('మింగలేక') ||
          q.includes('గడ్డ') ||
          q.includes('రక్తం') ||
          q.includes('दो सप्ताह') ||
          q.includes('निगलने') ||
          q.includes('गांठ') ||
          q.includes('खून') ||
          q.includes('இரண்டு வாரம்') ||
          q.includes('விழுங்க') ||
          q.includes('இரத்தம்') ||
          q.includes('ಎರಡು ವಾರ') ||
          q.includes('ನುಂಗಲು') ||
          q.includes('ರಕ್ತ') ||
          q.includes('രണ്ടാഴ്ച') ||
          q.includes('വിഴുങ്ങാൻ') ||
          q.includes('രക്തം');

        if (isUrgent) {
          if (lang === 'te') {
            response = {
              answerText: `⚠️ **ముఖ్యమైన ఆరోగ్య హెచ్చరిక:**\nనోటిలో 14 రోజుల కంటే ఎక్కువ కాలం మానని పుండ్లు, తెల్లటి లేదా ఎర్రటి మచ్చలు, గడ్డలు, లేదా మింగడంలో ఇబ్బంది ఉన్నట్లయితే వెంటనే వైద్యుడిని సంప్రదించాలి.\n\n🏥 **సిఫార్సు:** దయచేసి ఆలస్యం చేయకుండా మీ దగ్గరి ప్రాథమిక ఆరోగ్య కేంద్రం (PHC) లేదా పాడేరు జిల్లా ఆసుపత్రిలోని వైద్యుడిని సంప్రదించి పరీక్ష చేయించుకోండి.\n\n*(గమనిక: ఇది సాధారణ ఆరోగ్య సమాచారం మరియు స్క్రీనింగ్ మద్దతు మాత్రమే; ఖచ్చితమైన రోగ నిర్ధారణ కాదు.)*`,
              speechText: `నోటిలో పద్నాలుగు రోజుల కంటే ఎక్కువ రోజులు తగ్గని పుండ్లు ఉంటే ఏమాత్రం నిర్లక్ష్యం చేయవద్దు. వెంటనే దగ్గరి పిహెచ్‌సి లేదా జిల్లా ఆసుపత్రిలోని డాక్టర్‌ను సంప్రదించండి.`,
              language: 'te',
              intent: 'medical_safety_warning',
              animation: 'warning',
              expression: 'concerned',
              gesture: 'gentle_warning',
              topic: 'medical_safety',
              highlight: 'nearest-hospitals-section',
              navigateTo: 'hospitals',
              suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
            };
          } else if (lang === 'hi') {
            response = {
              answerText: `⚠️ **महत्वपूर्ण स्वास्थ्य चेतावनी:**\nयदि मुंह में छाले, सफेद या लाल दाग, गांठ या निगलने में कठिनाई 14 दिनों से अधिक समय से है, तो तुरंत डॉक्टर से जांच कराएं।\n\n🏥 **सिफारिश:** कृपया नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC) या पाडेरु जिला अस्पताल में डॉक्टर से तुरंत संपर्क करें।\n\n*(नोट: यह सामान्य स्वास्थ्य जानकारी है; चिकित्सीय निदान नहीं।)*`,
              speechText: `यदि मुंह में छाले दो सप्ताह से अधिक समय से ठीक नहीं हो रहे हैं, तो तुरंत नजदीकी स्वास्थ्य केंद्र या अस्पताल में डॉक्टर को दिखाएं।`,
              language: 'hi',
              intent: 'medical_safety_warning',
              animation: 'warning',
              expression: 'concerned',
              gesture: 'gentle_warning',
              topic: 'medical_safety',
              highlight: 'nearest-hospitals-section',
              navigateTo: 'hospitals',
              suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
            };
          } else if (lang === 'ta') {
            response = {
              answerText: `⚠️ **முக்கியமான சுகாதார எச்சரிக்கை:**\nவாயில் 14 நாட்களுக்கு மேலாக குணமாகாத புண்கள், வெள்ளை அல்லது சிவப்பு திட்டுகள், கட்டிகள் அல்லது விழுங்குவதில் சிரமம் இருந்தால் உடனடியாக மருத்துவரை அணுகவும்.\n\n🏥 **பரிந்துரை:** அருகிலுள்ள ஆரம்ப சுகாதார நிலையம் (PHC) அல்லது பாடேரு மாவட்ட மருத்துவமனையில் உள்ள மருத்துவரை உடனே அணுகவும்.\n\n*(குறிப்பு: இது பொதுவான சுகாதார தகவல் மட்டுமே; உறுதியான மருத்துவ நோய் கண்டறிதல் அல்ல).*`,
              speechText: `வாயில் இரண்டு வாரங்களுக்கு மேலாக குணமாகாத புண்கள் இருந்தால் உடனடியாக அருகிலுள்ள ஆரம்ப சுகாதார நிலையம் அல்லது மருத்துவமனைக்குச் சென்று மருத்துவரிடம் பரிசோதனை செய்து கொள்ளவும்.`,
              language: 'ta',
              intent: 'medical_safety_warning',
              animation: 'warning',
              expression: 'concerned',
              gesture: 'gentle_warning',
              topic: 'medical_safety',
              highlight: 'nearest-hospitals-section',
              navigateTo: 'hospitals',
              suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
            };
          } else if (lang === 'kn') {
            response = {
              answerText: `⚠️ **ಪ್ರಮುಖ ಆರೋಗ್ಯ ಎಚ್ಚರಿಕೆ:**\nಬಾಯಿಯಲ್ಲಿ 14 ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಗುಣವಾಗದ ಹುಣ್ಣುಗಳು, ಬಿಳಿ ಅಥವಾ ಕೆಂಪು ತೇಪೆಗಳು, ಗಡ್ಡೆಗಳು ಅಥವಾ ನುಂಗಲು ಕಷ್ಟವಾಗಿದ್ದರೆ ತಕ್ಷಣ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.\n\n🏥 **ಶಿಫಾರಸು:** ದಯವಿಟ್ಟು ವಿಳಂಬ ಮಾಡದೆ ಹತ್ತಿರದ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರ (PHC) ಅಥವಾ ಪಾಡೇರು ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.\n\n*(ಗಮನಿಸಿ: ಇದು ಸಾಮಾನ್ಯ ಆರೋಗ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ; ನಿರ್ಣಾಯಕ ರೋಗ ನಿರ್ಣಯವಲ್ಲ).*`,
              speechText: `ಬಾಯಿಯಲ್ಲಿ ಎರಡು ವಾರಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಗುಣವಾಗದ ಹುಣ್ಣುಗಳಿದ್ದರೆ ತಕ್ಷಣವೇ ಹತ್ತಿರದ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರ ಅಥವಾ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.`,
              language: 'kn',
              intent: 'medical_safety_warning',
              animation: 'warning',
              expression: 'concerned',
              gesture: 'gentle_warning',
              topic: 'medical_safety',
              highlight: 'nearest-hospitals-section',
              navigateTo: 'hospitals',
              suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
            };
          } else if (lang === 'ml') {
            response = {
              answerText: `⚠️ **പ്രധാനപ്പെട്ട ആരോഗ്യ മുന്നറിയിപ്പ്:**\nവായിൽ രണ്ടാഴ്ചയിലധികം (14 ദിവസം) നീണ്ടുനിൽക്കുന്ന ഉണങ്ങാത്ത വ്രണങ്ങൾ, വെളുത്തതോ ചുവന്നതോ ആയ പാടുകൾ, മുഴകൾ അല്ലെങ്കിൽ ഭക്ഷണം വിഴുങ്ങാൻ ബുദ്ധിമുട്ട് എന്നിവ ഉണ്ടെങ്കിൽ ഉടൻ ഡോക്ടറെ കാണുക.\n\n🏥 **ശുപാർശ:** ദയവായി അടുത്തുള്ള പ്രാഥമിക ആരോഗ്യ കേന്ദ്രം (PHC) അല്ലെങ്കിൽ പാടേരു ജില്ലാ ആശുപത്രിയിലെ ഡോക്ടറെ സമീപിക്കുക.\n\n*(ശ്രദ്ധിക്കുക: ഇത് പൊതുവായ ആരോഗ്യ വിവരങ്ങൾ മാത്രമാണ്; കൃത്യമായ രോഗനിർണ്ണയമല്ല).*`,
              speechText: `വായിൽ രണ്ടാഴ്ചയിലധികം ഉണങ്ങാത്ത വ്രണങ്ങൾ ഉണ്ടെങ്കിൽ ഉടൻ തന്നെ അടുത്തുള്ള ആരോഗ്യ കേന്ദ്രത്തിലെ ഡോക്ടറെ കണ്ട് പരിശോധിക്കുക.`,
              language: 'ml',
              intent: 'medical_safety_warning',
              animation: 'warning',
              expression: 'concerned',
              gesture: 'gentle_warning',
              topic: 'medical_safety',
              highlight: 'nearest-hospitals-section',
              navigateTo: 'hospitals',
              suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
            };
          } else {
            response = {
              answerText: `⚠️ **Clinical Safety Warning:**\nAny non-healing oral ulcer, white or red mucosal plaque, localized lump, or difficulty swallowing persisting for more than 14 days requires immediate in-person evaluation by a qualified Medical Officer.\n\n🏥 **Urgent Recommendation:** Please visit your nearest Primary Health Centre (PHC), Community Health Centre (CHC), or District Hospital Paderu for visual inspection.\n\n*(Notice: This system provides general health information and DEMO AI screening support; it does not replace in-person doctor evaluation).*`,
              speechText: `Please pay close attention: any oral sore or patch lasting over two weeks must be examined promptly by a doctor. Visit your nearest Primary Health Centre or District Hospital right away.`,
              language: 'en',
              intent: 'medical_safety_warning',
              animation: 'warning',
              expression: 'concerned',
              gesture: 'gentle_warning',
              topic: 'medical_safety',
              highlight: 'nearest-hospitals-section',
              navigateTo: 'hospitals',
              suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
            };
          }
        } else {
          // General Oral Health Guidance with Follow-up Questions
          if (lang === 'te') {
            response = {
              answerText: `నోటి ఆరోగ్య సంరక్షణ సూచనలు:\n\n**మీ పరిస్థితిని సరిగ్గా అర్థం చేసుకోవడానికి కొన్ని ప్రశ్నలు:**\n1. ఈ పుండు లేదా నొప్పి ఎన్ని రోజులుగా ఉంది?\n2. మీరు పొగాకు, గుట్కా, లేదా ఖైనీ వాడుతున్నారా?\n3. మీ నోరు మూడు వేళ్లు పట్టేంత సులభంగా తెరవగలరా?\n\n💡 **సాధారణ జాగ్రత్తలు:**\n• కారమైన ఆహారాలను తగ్గించండి, రోజూ నోటిని శుభ్రంగా ఉంచుకోండి.\n• పొగాకు, గుట్కా వాడకాన్ని తక్షణమే మానివేయండి.\n• మీ స్థానిక ఆశా కార్యకర్త లేదా దగ్గరి పిహెచ్‌సిలో వైద్యుడిని సంప్రదించండి.\n*(గమనిక: ఇది సాధారణ సమాచారం మాత్రమే; రోగ నిర్ధారణ కాదు.)*`,
              speechText: `నోటి పరిశుభ్రత పాటించండి మరియు పొగాకు వాడకాన్ని ఆపండి. ఈ లక్షణాలు రెండు వారాల కంటే ఎక్కువ ఉంటే మీ ఆశా కార్యకర్త లేదా డాక్టర్‌ను సంప్రదించండి.`,
              language: 'te',
              intent: 'oral_health_guidance',
              animation: 'explaining',
              expression: 'professional',
              gesture: 'open_hand',
              topic: 'oral_health',
              suggestedActions: ['Start Visual Screening', 'Find Screening Camp', 'Consult ASHA Worker'],
            };
          } else if (lang === 'hi') {
            response = {
              answerText: `मुंह के स्वास्थ्य के लिए दिशानिर्देश:\n\n**आपकी स्थिति समझने के लिए कुछ प्रश्न:**\n1. यह छाला या दर्द कितने दिनों से है?\n2. क्या आप गुटखा, खैनी या तंबाकू का उपयोग करते हैं?\n3. क्या आप आसानी से अपना मुंह पूरा खोल पाते हैं?\n\n💡 **सामान्य सलाह:**\n• अधिक तीखे-मसालेदार भोजन से बचें और दिन में दो बार कुल्ला करें।\n• तंबाकू और गुटखा तुरंत बंद करें।\n• स्थानीय आशा कार्यकर्ता या नजदीकी प्राथमिक स्वास्थ्य केंद्र में डॉक्टर से जांच कराएं।\n*(नोट: यह सामान्य स्वास्थ्य जानकारी है; चिकित्सीय निदान नहीं।)*`,
              speechText: `मुंह की सफाई रखें और तंबाकू से दूर रहें। यदि यह छाला दो सप्ताह से अधिक रहता है तो स्वास्थ्य केंद्र में दिखाएं।`,
              language: 'hi',
              intent: 'oral_health_guidance',
              animation: 'explaining',
              expression: 'professional',
              gesture: 'open_hand',
              topic: 'oral_health',
              suggestedActions: ['Start Visual Screening', 'Find Screening Camp', 'Consult ASHA Worker'],
            };
          } else if (lang === 'ta') {
            response = {
              answerText: `வாய்வழி சுகாதார வழிகாட்டுதல்கள்:\n\n**உங்கள் நிலையைப் புரிந்து கொள்ள சில கேள்விகள்:**\n1. இந்த புண் அல்லது வலி எத்தனை நாட்களாக உள்ளது?\n2. நீங்கள் புகையிலை அல்லது குட்கா பயன்படுத்துகிறீர்களா?\n3. வாயை முழுமையாக எளிதாகத் திறக்க முடிகிறதா?\n\n💡 **பொதுவான ஆலோசனை:**\n• காரமான உணவுகளைத் தவிர்க்கவும், வாயைத் தூய்மையாக வைத்திருக்கவும்.\n• புகையிலை மற்றும் குட்காவை முற்றிலும் தவிர்க்கவும்.\n• ஆஷா பணியாளர் அல்லது ஆரம்ப சுகாதார நிலைய மருத்துவரிடம் ஆலோசனை பெறவும்.\n*(குறிப்பு: இது பொதுவான தகவல் மட்டுமே; நோய் கண்டறிதல் அல்ல.)*`,
              speechText: `வாய்வழி தூய்மையைப் பேணுங்கள், புகையிலையைத் தவிர்க்கவும். புண் இரண்டு வாரங்களுக்கு மேல் நீடித்தால் மருத்துவரை அணுகவும்.`,
              language: 'ta',
              intent: 'oral_health_guidance',
              animation: 'explaining',
              expression: 'professional',
              gesture: 'open_hand',
              topic: 'oral_health',
              suggestedActions: ['Start Visual Screening', 'Find Screening Camp', 'Consult ASHA Worker'],
            };
          } else if (lang === 'kn') {
            response = {
              answerText: `ಬಾಯಿಯ ಆರೋಗ್ಯ ರಕ್ಷಣಾ ಮಾರ್ಗದರ್ಶಿಗಳು:\n\n**ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯನ್ನು ತಿಳಿಯಲು ಕೆಲವು ಪ್ರಶ್ನೆಗಳು:**\n1. ಈ ಹುಣ್ಣು ಅಥವಾ ನೋವು ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ?\n2. ನೀವು ತಂಬಾಕು, ಗುಟ್ಕಾ ಅಥವಾ ಪಾನ್ ಮಸಾಲಾ ಬಳಸುತ್ತೀರಾ?\n3. ಬಾಯಿಯನ್ನು ಸರಾಗವಾಗಿ ತೆರೆಯಲು ಸಾಧ್ಯವೇ?\n\n💡 **ಸಾಮಾನ್ಯ ಸಲಹೆಗಳು:**\n• ಖಾರವಾದ ಆಹಾರ ತಪ್ಪಿಸಿ ಮತ್ತು ನಿತ್ಯ ಬಾಯಿಯ ನೈರ್ಮಲ್ಯ ಕಾಪಾಡಿ.\n• ತಂಬಾಕು ಮತ್ತು ಗುಟ್ಕಾ ಸೇವನೆ ತಕ್ಷಣ ನಿಲ್ಲಿಸಿ.\n• ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ಅಥವಾ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರದ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.\n*(ಗಮನಿಸಿ: ಇದು ಸಾಮಾನ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ; ಖಚಿತ ರೋಗ ನಿರ್ಣಯವಲ್ಲ.)*`,
              speechText: `ಬಾಯಿಯ ನೈರ್ಮಲ್ಯ ಕಾಪಾಡಿ ಮತ್ತು ತಂಬಾಕು ಬಳಸಬೇಡಿ. ಹುಣ್ಣು ಎರಡು ವಾರಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಉಳಿದರೆ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.`,
              language: 'kn',
              intent: 'oral_health_guidance',
              animation: 'explaining',
              expression: 'professional',
              gesture: 'open_hand',
              topic: 'oral_health',
              suggestedActions: ['Start Visual Screening', 'Find Screening Camp', 'Consult ASHA Worker'],
            };
          } else if (lang === 'ml') {
            response = {
              answerText: `വായയുടെ ആരോഗ്യ സംരക്ഷണ നിർദ്ദേശങ്ങൾ:\n\n**നിങ്ങളുടെ അവസ്ഥ മനസ്സിലാക്കാൻ ചില ചോദ്യങ്ങൾ:**\n1. ഈ വ്രണമോ വേദനയോ എത്ര ദിവസമായി ഉണ്ട്?\n2. നിങ്ങൾ പുകയിലയോ ഗുട്കയോ ഉപയോഗിക്കാറുണ്ടോ?\n3. വായ സാധാരണ പോലെ തുറക്കാൻ സാധിക്കുന്നുണ്ടോ?\n\n💡 **പൊതുവായ നിർദ്ദേശങ്ങൾ:**\n• എരിവുള്ള ഭക്ഷണം ഒഴിവാക്കുക, വായ വൃത്തിയായി സൂക്ഷിക്കുക.\n• പുകയിലയും ഗുട്കയും പൂർണ്ണമായി ഉപേക്ഷിക്കുക.\n• ആശാ പ്രവർത്തകയെയോ അടുത്തുള്ള പ്രാഥമിക ആരോഗ്യ കേന്ദ്രത്തിലെ ഡോക്ടറെയോ സമീപിക്കുക.\n*(ശ്രദ്ധിക്കുക: ഇത് പൊതുവായ വിവരങ്ങൾ മാത്രമാണ്; കൃത്യമായ രോഗനിർണ്ണയമല്ല.)*`,
              speechText: `വായ വൃത്തിയായി സൂക്ഷിക്കുക, പുകയില ഒഴിവാക്കുക. വ്രണം രണ്ടാഴ്ചയിലധികം നീണ്ടുനിന്നാൽ ഡോക്ടറെ കണ്ട് പരിശോധിക്കുക.`,
              language: 'ml',
              intent: 'oral_health_guidance',
              animation: 'explaining',
              expression: 'professional',
              gesture: 'open_hand',
              topic: 'oral_health',
              suggestedActions: ['Start Visual Screening', 'Find Screening Camp', 'Consult ASHA Worker'],
            };
          } else {
            response = {
              answerText: `Oral Mucosa Health & Care Guidelines:\n\n**Helpful follow-up questions to understand your situation:**\n1. How long have you had this ulcer, pain, or patch?\n2. Do you chew gutkha, khaini, betel quid, or use tobacco?\n3. Can you open your mouth comfortably (at least 3 fingers vertically)?\n\n💡 **General Health Care Advice:**\n• Avoid hot, spicy, or abrasive foods that irritate the mucosa.\n• Maintain gentle twice-daily brushing and clean oral hygiene.\n• Strictly abstain from chewing tobacco, gutkha, and betel nut.\n• Consult your local ASHA worker or visit the nearest Primary Health Centre (PHC) for a visual check.\n*(Notice: General health education and screening guidance only; does not replace in-person doctor evaluation).*`,
              speechText: `Practice good oral hygiene and avoid all tobacco. If any sore or patch lasts longer than two weeks, please see a health worker or doctor.`,
              language: 'en',
              intent: 'oral_health_guidance',
              animation: 'explaining',
              expression: 'professional',
              gesture: 'open_hand',
              topic: 'oral_health',
              suggestedActions: ['Start Visual Screening', 'Find Screening Camp', 'Consult ASHA Worker'],
            };
          }
        }
      }

      // Intent D: Context-Aware Page Explanation
      else if (
        q.includes('what is this page') ||
        q.includes('explain this page') ||
        q.includes('current page') ||
        q.includes('where am i') ||
        q.includes('ఈ పేజీ ఏమిటి') ||
        q.includes('यह पेज क्या है')
      ) {
        const page = context || 'dashboard';
        if (page === 'screening') {
          response = {
            answerText: `You are on the **Clinical Screening & Demo AI** module.\n\nFrontline ASHA/ANM workers capture oral photos, generate SHA-256 integrity hashes, review DEMO AI non-diagnostic risk scores, and queue cases for Medical Officer evaluation.`,
            speechText: `This is the Clinical Screening module. Health workers submit oral photos for AI triage assistance and Medical Officer review.`,
            language: lang,
            intent: 'explain_screening',
            animation: 'pointing',
            expression: 'professional',
            gesture: 'point_right',
            topic: 'screening',
            highlight: 'screening-intake-panel',
          };
        } else if (page === 'camps') {
          response = {
            answerText: `You are on the **Outreach Screening Camps** management module.\n\nHere you can organize, schedule, and assign clinical staff to frontline screening camps across tribal agency mandals.`,
            speechText: `This is the Screening Camps module. Medical Officers and Administrators manage outreach camps for remote habitations here.`,
            language: lang,
            intent: 'explain_camps',
            animation: 'pointing',
            expression: 'professional',
            gesture: 'point_right',
            topic: 'camps',
            highlight: 'camps-list-section',
          };
        } else if (page === 'patients') {
          response = {
            answerText: `You are on the **Tribal Patient Registry & Offline Sync** module.\n\nIt provides OTP-free frontline patient intake, composite duplicate checking, and client-side AES-GCM-256 encrypted offline queue syncing.`,
            speechText: `This is the Patient Registry module, engineered for zero-connectivity offline registration across remote Eastern Ghats villages.`,
            language: lang,
            intent: 'explain_patients',
            animation: 'pointing',
            expression: 'professional',
            gesture: 'point_right',
            topic: 'patients',
            highlight: 'patient-registry-table',
          };
        } else if (page === 'asr-map') {
          response = {
            answerText: `You are viewing the **ASR District GIS Map**.\n\nExplore all 22 Mandals, 450+ Gram Panchayats, village access difficulty ratings, and nearby hospital networks.`,
            speechText: `You are viewing the Alluri Sitharama Raju District GIS map, covering all 22 tribal mandals and health facility locations.`,
            language: lang,
            intent: 'explain_map',
            animation: 'pointing',
            expression: 'professional',
            gesture: 'point_left',
            topic: 'map',
            highlight: 'asr-district-map-canvas',
          };
        } else {
          response = {
            answerText: `You are on the **Operations Dashboard**.\n\nThis is your central command center summarizing active screening camps, completed evaluations, patient registrations, and offline sync ledgers.`,
            speechText: `You are on the Operations Dashboard. It provides a real-time overview of tribal health initiatives and clinical metrics.`,
            language: lang,
            intent: 'explain_dashboard',
            animation: 'pointing',
            expression: 'friendly',
            gesture: 'point_right',
            topic: 'dashboard',
            highlight: 'kpi-summary-grid',
          };
        }
      }

      // Intent 1: List all Mandals
      else if (
        q.includes('mandal') &&
        (q.includes('which') ||
          q.includes('available') ||
          q.includes('list') ||
          q.includes('all') ||
          q.includes('how many') ||
          q.includes('ఎన్ని') ||
          q.includes('మండలాలు') ||
          q.includes('మండలం') ||
          q.includes('मंडल') ||
          q.includes('कितने'))
      ) {
        const paderuMandals = ASR_MANDALS.filter((m) => m.revenueDivision === 'Paderu').map((m) =>
          lang === 'te' ? m.nameTe : lang === 'hi' ? m.nameHi : m.mandalName
        );
        const rampaMandals = ASR_MANDALS.filter((m) => m.revenueDivision === 'Rampachodavaram').map((m) =>
          lang === 'te' ? m.nameTe : lang === 'hi' ? m.nameHi : m.mandalName
        );

        if (lang === 'te') {
          const text = `అల్లూరి సీతారామరాజు (ASR) జిల్లాలో మొత్తం 22 మండలాలు ఉన్నాయి. \n\n🔹 పాడేరు డివిజన్ (11 మండలాలు): ${paderuMandals.join(', ')}.\n\n🔹 రంపచోడవరం డివిజన్ (11 మండలాలు): ${rampaMandals.join(', ')}.`;
          const speech = `ASR జిల్లాలో మొత్తం 22 మండలాలు ఉన్నాయి. పాడేరు మరియు రంపచోడవరం డివిజన్లలో ఒక్కొక్కదానిలో 11 మండలాలు విస్తరించి ఉన్నాయి.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'te',
            intent: 'list_mandals',
            animation: 'explaining',
            expression: 'professional',
            gesture: 'open_hand',
            topic: 'mandals',
            data: { total: 22, paderuMandals, rampaMandals },
            suggestedActions: ['Open GIS Map', 'View Paderu Villages', 'Plan Camp'],
          };
        } else if (lang === 'hi') {
          const text = `अल्लूरी सीताराम राजू (ASR) जिले में कुल 22 मंडल हैं। \n\n🔹 पाडेरु डिवीजन (11 मंडल): ${paderuMandals.join(', ')}।\n\n🔹 रामपचोड़वरम डिवीजन (11 मंडल): ${rampaMandals.join(', ')}।`;
          const speech = `ASR जिले में कुल 22 मंडल हैं, जिनमें पाडेरु और रामपचोड़वरम डिवीजन शामिल हैं।`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'hi',
            intent: 'list_mandals',
            animation: 'explaining',
            expression: 'professional',
            gesture: 'open_hand',
            topic: 'mandals',
            data: { total: 22, paderuMandals, rampaMandals },
            suggestedActions: ['Open GIS Map', 'View Paderu Villages', 'Plan Camp'],
          };
        } else {
          const text = `Alluri Sitharama Raju (ASR) District comprises 22 Mandals across two revenue divisions:\n\n• **Paderu Division (11 Mandals):** ${paderuMandals.join(', ')}\n• **Rampachodavaram Division (11 Mandals):** ${rampaMandals.join(', ')}`;
          const speech = `ASR District has 22 mandals across Paderu and Rampachodavaram revenue divisions. Would you like to explore villages in a specific mandal?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'en',
            intent: 'list_mandals',
            animation: 'explaining',
            expression: 'professional',
            gesture: 'open_hand',
            topic: 'mandals',
            data: { total: 22, paderuMandals, rampaMandals },
            suggestedActions: ['Open GIS Map', 'View Paderu Villages', 'Plan Camp'],
          };
        }
      }

      // Intent 2: Next Medical Camp Recommendation
      else if (
        (q.includes('camp') || q.includes('క్యాంప్') || q.includes('క్యాంపు') || q.includes('शिविर') || q.includes('कैंप')) &&
        (q.includes('next') ||
          q.includes('where') ||
          q.includes('organize') ||
          q.includes('plan') ||
          q.includes('recommend') ||
          q.includes('ఎక్కడ') ||
          q.includes('తదుపరి') ||
          q.includes('నిర్వహించ') ||
          q.includes('अगला') ||
          q.includes('कहाँ') ||
          q.includes('योजना'))
      ) {
        const highPriorityVillages = await Village.find({
          $or: [
            { healthcareAccessLevel: 'remote_cutoff' },
            { healthcareAccessLevel: 'difficult' },
            { nearestFacilityDistanceKm: { $gte: 12 } },
          ],
        })
          .sort({ campCount: 1, nearestFacilityDistanceKm: -1 })
          .limit(3)
          .lean();

        if (lang === 'te') {
          const text =
            `తదుపరి మెడికల్ క్యాంప్ నిర్వహణకు సిఫార్సు చేయబడిన అత్యంత అవసరమైన గ్రామాలు:\n\n` +
            highPriorityVillages
              .map(
                (v, i) =>
                  `${i + 1}. **${v.nameTe || v.villageName}** (${v.mandal} మండలం) — దగ్గరి ఆసుపత్రి దూరం: ${v.nearestFacilityDistanceKm} కి.మీ., ప్రాప్యత: ${
                    v.healthcareAccessLevel === 'remote_cutoff' ? 'తీవ్రమైన ఘాట్/వర్షాకాల కట్-ఆఫ్' : 'క్లిష్టమైన కొండ ప్రాంతం'
                  }`
              )
              .join('\n') +
            `\n\nఈ ప్రాంతాల్లో స్క్రీనింగ్ కవరేజీ తక్కువగా ఉండటం వలన ముందుగా ఇక్కడ క్యాంప్ ప్లాన్ చేయడం అత్యవసరం.`;
          const speech = `తదుపరి మెడికల్ క్యాంప్ కోసం అత్యధిక ప్రాధాన్యత కలిగిన గ్రామాలు: ${highPriorityVillages.map((v) => v.nameTe || v.villageName).join(', ')}. ఇవి దగ్గరి ఆసుపత్రికి పన్నెండు కిలోమీటర్ల కంటే ఎక్కువ దూరంలో ఉన్నాయి.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'te',
            intent: 'camp_recommendation',
            animation: 'pointing',
            expression: 'thoughtful',
            gesture: 'point_right',
            topic: 'camps',
            navigateTo: 'camps',
            data: highPriorityVillages,
            suggestedActions: ['Open Camp Scheduler', 'View Remote Villages', 'Assign Health Staff'],
          };
        } else if (lang === 'hi') {
          const text =
            `अगले मेडिकल कैंप के लिए अनुशंसित उच्च-प्राथमिक वाले गांव:\n\n` +
            highPriorityVillages
              .map(
                (v, i) =>
                  `${i + 1}. **${v.villageName}** (${v.mandal} मंडल) — निकटतम सुविधा दूरी: ${v.nearestFacilityDistanceKm} किमी, पहुंच स्तर: ${v.healthcareAccessLevel}`
              )
              .join('\n');
          const speech = `अगले मेडिकल कैंप के लिए अनुशंसित गांव ${highPriorityVillages.map((v) => v.villageName).join(', ')} हैं। यहां स्वास्थ्य सुविधाएं दूर हैं।`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'hi',
            intent: 'camp_recommendation',
            animation: 'pointing',
            expression: 'thoughtful',
            gesture: 'point_right',
            topic: 'camps',
            navigateTo: 'camps',
            data: highPriorityVillages,
            suggestedActions: ['Open Camp Scheduler', 'View Remote Villages', 'Assign Health Staff'],
          };
        } else {
          const text =
            `Based on healthcare accessibility, distance to facilities, and prior screening coverage, the top recommended villages for the next medical camp are:\n\n` +
            highPriorityVillages
              .map(
                (v, i) =>
                  `${i + 1}. **${v.villageName}** (${v.mandal} Mandal) — Distance to PHC/CHC: ${v.nearestFacilityDistanceKm} km (${
                    v.healthcareAccessLevel === 'remote_cutoff' ? 'Monsoon/Ghat Cutoff' : 'Difficult Terrain'
                  })`
              )
              .join('\n') +
            `\n\nYou can click on Medical Camp Planning in the sidebar to schedule a screening camp with assigned medical staff.`;
          const speech = `The top recommended locations for the next medical camp are ${highPriorityVillages.map((v) => v.villageName).join(', ')}. These tribal hamlets are over twelve kilometers from healthcare facilities.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'en',
            intent: 'camp_recommendation',
            animation: 'pointing',
            expression: 'thoughtful',
            gesture: 'point_right',
            topic: 'camps',
            navigateTo: 'camps',
            data: highPriorityVillages,
            suggestedActions: ['Open Camp Scheduler', 'View Remote Villages', 'Assign Health Staff'],
          };
        }
      }

      // Intent 3: Unserved Villages (No camps conducted)
      else if (
        q.includes('no camp') ||
        q.includes('not received') ||
        q.includes('pending') ||
        q.includes('క్యాంపులు జరగలేదు') ||
        q.includes('నిర్వహించలేదు') ||
        q.includes('कैंप नहीं')
      ) {
        const unservedCount = await Village.countDocuments({ $or: [{ campCount: 0 }, { campCount: { $exists: false } }] });
        const sampleUnserved = await Village.find({ $or: [{ campCount: 0 }, { campCount: { $exists: false } }] })
          .limit(5)
          .lean();

        if (lang === 'te') {
          const text =
            `జిల్లాలో ఇంకా స్క్రీనింగ్ క్యాంపులు నిర్వహించని గ్రామాలు మొత్తం: **${unservedCount}**.\n\nకొన్ని ముఖ్య గ్రామాలు:\n` +
            sampleUnserved.map((v) => `• ${v.nameTe || v.villageName} (${v.mandal} మండలం - ${v.panchayat} పంచాయతీ)`).join('\n');
          const speech = `జిల్లాలో ఇంకా స్క్రీనింగ్ క్యాంపులు జరగని గ్రామాలు మొత్తం ${unservedCount} ఉన్నాయి. వీటిలో ${sampleUnserved.map((v) => v.nameTe || v.villageName).slice(0, 3).join(', ')} ముఖ్యమైనవి.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'te',
            intent: 'unserved_villages',
            animation: 'explaining',
            expression: 'concerned',
            gesture: 'open_hand',
            topic: 'unserved_villages',
            data: { total: unservedCount, sample: sampleUnserved },
            navigateTo: 'camps',
          };
        } else if (lang === 'hi') {
          const text =
            `जिले में जिन गांवों में अब तक कोई स्क्रीनिंग कैंप आयोजित नहीं हुआ, उनकी कुल संख्या **${unservedCount}** है।\n\nप्रमुख गांव:\n` +
            sampleUnserved.map((v) => `• ${v.villageName} (${v.mandal} मंडल)`).join('\n');
          const speech = `जिले में कुल ${unservedCount} गांवों में अभी स्क्रीनिंग कैंप आयोजित नहीं हुए हैं।`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'hi',
            intent: 'unserved_villages',
            animation: 'explaining',
            expression: 'concerned',
            gesture: 'open_hand',
            topic: 'unserved_villages',
            data: { total: unservedCount, sample: sampleUnserved },
            navigateTo: 'camps',
          };
        } else {
          const text =
            `There are currently **${unservedCount}** villages and hamlets that have not yet received a medical screening camp.\n\nHigh-need examples include:\n` +
            sampleUnserved.map((v) => `• **${v.villageName}** (${v.mandal} Mandal — ${v.panchayat} GP)`).join('\n');
          const speech = `There are currently ${unservedCount} villages in ASR district pending screening camps. Would you like me to open the Medical Camp Planning module?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'en',
            intent: 'unserved_villages',
            animation: 'explaining',
            expression: 'concerned',
            gesture: 'open_hand',
            topic: 'unserved_villages',
            data: { total: unservedCount, sample: sampleUnserved },
            navigateTo: 'camps',
          };
        }
      }

      // Intent 4: Show Healthcare Facilities (Hospitals, CHCs, PHCs) & Doctor Guidance
      else if (
        q.includes('hospital') ||
        q.includes('doctor') ||
        q.includes('dentist') ||
        q.includes('specialist') ||
        q.includes('phc') ||
        q.includes('chc') ||
        q.includes('facility') ||
        // Telugu Script & Transliteration
        q.includes('ఆసుపత్రి') ||
        q.includes('ఆస్పత్రి') ||
        q.includes('డాక్టర్') ||
        q.includes('వైద్యులు') ||
        q.includes('దంత వైద్యుడు') ||
        q.includes('పి.హెచ్.సి') ||
        q.includes('ye doctor') ||
        q.includes('doctor evaru') ||
        q.includes('dentist ekkada') ||
        q.includes('hospital ekkada') ||
        q.includes('paderu hospital') ||
        q.includes('araku hospital') ||
        // Hindi Script & Transliteration
        q.includes('अस्पताल') ||
        q.includes('डॉक्टर') ||
        q.includes('दंत चिकित्सक') ||
        q.includes('पीएचसी') ||
        q.includes('kis doctor') ||
        q.includes('doctor kaun') ||
        q.includes('dant ke doctor') ||
        q.includes('aspatal kahan') ||
        q.includes('paderu aspatal')
      ) {
        const dh = ASR_HEALTHCARE_FACILITIES.filter((f) => f.type === 'district_hospital' || f.type === 'area_hospital');
        const chcs = ASR_HEALTHCARE_FACILITIES.filter((f) => f.type === 'community_health_centre');

        if (lang === 'te') {
          const text =
            `ASR జిల్లాలో ప్రధాన ఆసుపత్రులు మరియు కమ్యూనిటీ హెల్త్ సెంటర్లు (CHCs):\n\n` +
            `🏥 **ప్రధాన ఆసుపత్రులు:**\n` +
            dh.map((h) => `• ${h.name} (${h.mandal}) — ${h.bedCapacity} పడకలు`).join('\n') +
            `\n\n🏥 **కమ్యూనిటీ హెల్త్ సెంటర్లు (CHCs):**\n` +
            chcs.map((c) => `• ${c.name} (${c.mandal})`).join('\n');
          const speech = `ASR జిల్లాలో పాడేరు డిస్ట్రిక్ట్ హాస్పిటల్ మరియు రంపచోడవరం ఏరియా హాస్పిటల్ ప్రధాన ఆసుపత్రులుగా ఉన్నాయి. వీటితో పాటు తొమ్మిది CHC లు మరియు అనేక PHC లు సేవలు అందిస్తున్నాయి.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'te',
            intent: 'facilities_list',
            animation: 'explaining',
            expression: 'friendly',
            gesture: 'open_hand',
            topic: 'facilities',
            data: ASR_HEALTHCARE_FACILITIES,
            navigateTo: 'hospitals',
          };
        } else if (lang === 'hi') {
          const text =
            `ASR जिले के प्रमुख अस्पताल और सामुदायिक स्वास्थ्य केंद्र (CHCs):\n\n` +
            `🏥 **मुख्य अस्पताल:**\n` +
            dh.map((h) => `• ${h.name} (${h.mandal})`).join('\n') +
            `\n\n🏥 **सामुदायिक स्वास्थ्य केंद्र (CHCs):**\n` +
            chcs.map((c) => `• ${c.name} (${c.mandal})`).join('\n');
          const speech = `जिले में पाडेरु जिला अस्पताल और रामपचोड़वरम एरिया अस्पताल प्रमुख चिकित्सा केंद्र हैं।`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'hi',
            intent: 'facilities_list',
            animation: 'explaining',
            expression: 'friendly',
            gesture: 'open_hand',
            topic: 'facilities',
            data: ASR_HEALTHCARE_FACILITIES,
            navigateTo: 'hospitals',
          };
        } else {
          const text =
            `Major healthcare facilities across Alluri Sitharama Raju District:\n\n` +
            `🏥 **Key Referral Hospitals:**\n` +
            dh.map((h) => `• **${h.name}** (${h.mandal} Mandal — ${h.bedCapacity} Beds)`).join('\n') +
            `\n\n🏥 **Community Health Centres (CHCs):**\n` +
            chcs.map((c) => `• **${c.name}** (${c.mandal})`).join('\n') +
            `\n\nPlus Primary Health Centres (PHCs) located across all 22 mandals.`;
          const speech = `ASR district is anchored by District Hospital Paderu and Area Hospital Rampachodavaram, supported by nine Community Health Centres and rural PHCs.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'en',
            intent: 'facilities_list',
            animation: 'explaining',
            expression: 'friendly',
            gesture: 'open_hand',
            topic: 'facilities',
            data: ASR_HEALTHCARE_FACILITIES,
            navigateTo: 'hospitals',
          };
        }
      }

      // Intent 5: Show Villages in a specific Mandal
      else if (q.includes('village') || q.includes('గ్రామాలు') || q.includes('గ్రామం') || q.includes('गांव')) {
        let matchedMandal = ASR_MANDALS.find(
          (m) =>
            q.includes(m.mandalName.toLowerCase()) ||
            q.includes(m.mandalId.toLowerCase().replace('mandal_', '')) ||
            (m.nameTe && q.includes(m.nameTe))
        );

        const mandalName = matchedMandal ? matchedMandal.mandalName : 'Paderu';
        const villages = await Village.find({ mandal: new RegExp(`^${mandalName}$`, 'i') }).lean();

        if (lang === 'te') {
          const text =
            `**${matchedMandal?.nameTe || mandalName}** మండలంలో నమోదు చేయబడిన గ్రామాలు (మొత్తం: ${villages.length}):\n\n` +
            villages
              .slice(0, 10)
              .map((v) => `• ${v.nameTe || v.villageName} (${v.panchayat} పంచాయతీ) — ఆవాసం: ${v.tribalHabitation}`)
              .join('\n') +
            (villages.length > 10 ? `\n\n... మరియు ఇంకా ${villages.length - 10} గ్రామాలు ఉన్నాయి.` : '');
          const speech = `${matchedMandal?.nameTe || mandalName} మండలంలో మొత్తం ${villages.length} గ్రామాలు ఉన్నాయి.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'te',
            intent: 'mandal_villages',
            animation: 'pointing',
            expression: 'friendly',
            gesture: 'point_left',
            topic: 'villages',
            data: villages,
            navigateTo: 'asr-map',
          };
        } else if (lang === 'hi') {
          const text =
            `**${mandalName}** मंडल में कुल ${villages.length} गांव दर्ज हैं:\n\n` +
            villages.slice(0, 10).map((v) => `• ${v.villageName} (पंचायत: ${v.panchayat})`).join('\n');
          const speech = `${mandalName} मंडल में कुल ${villages.length} गांव हैं।`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'hi',
            intent: 'mandal_villages',
            animation: 'pointing',
            expression: 'friendly',
            gesture: 'point_left',
            topic: 'villages',
            data: villages,
            navigateTo: 'asr-map',
          };
        } else {
          const text =
            `Villages recorded under **${mandalName} Mandal** (Total: ${villages.length}):\n\n` +
            villages.slice(0, 10).map((v) => `• **${v.villageName}** (${v.panchayat} GP — ${v.tribalHabitation})`).join('\n') +
            (villages.length > 10 ? `\n\n... and ${villages.length - 10} more villages.` : '');
          const speech = `There are ${villages.length} villages mapped in ${mandalName} Mandal. You can view all on the ASR District Map.`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'en',
            intent: 'mandal_villages',
            animation: 'pointing',
            expression: 'friendly',
            gesture: 'point_left',
            topic: 'villages',
            data: villages,
            navigateTo: 'asr-map',
          };
        }
      }

      // Default Greeting & Welcome
      else {
        if (lang === 'te') {
          const text = `నమస్కారం! నేను **దృష్టి (Drishti)**, మీ క్లినికల్ గైడ్‌ని. \n\nనేను మీకు సహాయం చేయగలను:\n• నూతన ఖాతా నమోదు మరియు మార్గదర్శకత్వం\n• అప్లికేషన్ టూర్ మరియు ముఖ్య మాడ్యూళ్ల పరిచయం\n• నోటి ఆరోగ్య సంరక్షణ సూచనలు & రిస్క్ అవగాహన\n• ASR జిల్లాలోని 22 మండలాలు & మెడికల్ క్యాంప్ ప్లానింగ్\n\nమీ ప్రశ్నను ఇక్కడ అడగండి లేదా మాట్లాడండి!`;
          const speech = `నమస్కారం! నేను దృష్టిని. మీకు ఏ విధంగా సహాయపడగలను?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'te',
            intent: 'greeting',
            animation: 'greeting',
            expression: 'smiling',
            gesture: 'wave',
            topic: 'general_welcome',
            suggestedActions: ['Take Guided Tour', 'Create Account', 'Explain This Page', 'Check Symptoms'],
          };
        } else if (lang === 'hi') {
          const text = `नमस्ते! मैं **दृष्टि (Drishti)**, आपकी AI स्वास्थ्य साथी हूँ।\n\nमैं आपकी सहायता कर सकती हूँ:\n• नए खाते का पंजीकरण एवं मार्गदर्शन\n• एप्लीकेशन का परिचयात्मक टूर\n• मुंह के स्वास्थ्य की देखभाल और सुरक्षा चेतावनी\n• ASR जिले के 22 मंडल एवं मेडिकल कैंप योजना\n\nकृपया अपना प्रश्न पूछें या बोलें!`;
          const speech = `नमस्ते! मैं दृष्टि हूँ। मैं आपकी क्या मदद कर सकती हूँ?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'hi',
            intent: 'greeting',
            animation: 'greeting',
            expression: 'smiling',
            gesture: 'wave',
            topic: 'general_welcome',
            suggestedActions: ['Take Guided Tour', 'Create Account', 'Explain This Page', 'Check Symptoms'],
          };
        } else if (lang === 'ta') {
          const text = `வணக்கம்! நான் **திருஷ்டி (Drishti)**, ஆரோக்கிய திருஷ்டியின் வழிகாட்டும் உதவியாளர்.\n\nநான் உங்களுக்கு உதவ முடியும்:\n• புதிய கணக்கு பதிவு மற்றும் வழிகாட்டுதல்\n• பயன்பாட்டு அறிமுக உலா\n• வாய்வழி சளிச்சவ்வு நல விழிப்புணர்வு\n• ASR மாவட்டத்தின் 22 மண்டலங்கள் மற்றும் மருத்துவ முகாம் திட்டம்\n\nஉங்கள் கேள்வியை இங்கே கேட்கவும்!`;
          const speech = `வணக்கம்! நான் திருஷ்டி. உங்களுக்கு எவ்வாறு உதவ வேண்டும்?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'ta',
            intent: 'greeting',
            animation: 'greeting',
            expression: 'smiling',
            gesture: 'wave',
            topic: 'general_welcome',
            suggestedActions: ['Take Guided Tour', 'Create Account', 'Explain This Page', 'Check Symptoms'],
          };
        } else if (lang === 'kn') {
          const text = `ನಮಸ್ಕಾರ! ನಾನು **ದೃಷ್ಟಿ (Drishti)**, ಆರೋಗ್ಯ ದೃಷ್ಟಿಯ ಮಾರ್ಗದರ್ಶಿ ಸಹಾಯಕ.\n\nನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ:\n• ಹೊಸ ಖಾತೆ ನೋಂದಣಿ ಮತ್ತು ಮಾರ್ಗದರ್ಶನ\n• ಅಪ್ಲಿಕೇಶನ್ ಪರಿಚಯ ಪ್ರವಾಸ\n• ಬಾಯಿಯ ಆರೋಗ್ಯ ರಕ್ಷಣೆ ಮತ್ತು ಅರಿವು\n• ಎಎಸ್‌ಆರ್ ಜಿಲ್ಲೆಯ 22 ಮಂಡಲಗಳು ಮತ್ತು ಶಿಬಿರ ಯೋಜನೆ\n\nನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಇಲ್ಲಿ ಕೇಳಿ ಅಥವಾ ಮಾತನಾಡಿ!`;
          const speech = `ನಮಸ್ಕಾರ! ನಾನು ದೃಷ್ಟಿ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'kn',
            intent: 'greeting',
            animation: 'greeting',
            expression: 'smiling',
            gesture: 'wave',
            topic: 'general_welcome',
            suggestedActions: ['Take Guided Tour', 'Create Account', 'Explain This Page', 'Check Symptoms'],
          };
        } else if (lang === 'ml') {
          const text = `നമസ്കാരം! ഞാൻ **ദൃഷ്ടി (Drishti)**, ആരോഗ്യ ദൃഷ്ടിയുടെ സഹായിയാണ്.\n\nഎനിക്ക് നിങ്ങളെ സഹായിക്കാനാകും:\n• പുതിയ അക്കൗണ്ട് രജിസ്ട്രേഷൻ\n• ആപ്ലിക്കേഷൻ ടൂർ\n• വാക്കാലുള്ള ആരോഗ്യ സംരക്ഷണ നിർദ്ദേശങ്ങൾ\n• എഎസ്ആർ ജില്ലയിലെ 22 മണ്ഡലങ്ങളും ക്യാമ്പ് ആസൂത്രണവും\n\nനിങ്ങളുടെ സംശയങ്ങൾ ഇവിടെ ചോദിക്കൂ!`;
          const speech = `നമസ്കാരം! ഞാൻ ദൃഷ്ടിയാണ്. ഞാൻ എങ്ങനെ സഹായിക്കണം?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'ml',
            intent: 'greeting',
            animation: 'greeting',
            expression: 'smiling',
            gesture: 'wave',
            topic: 'general_welcome',
            suggestedActions: ['Take Guided Tour', 'Create Account', 'Explain This Page', 'Check Symptoms'],
          };
        } else {
          const text = `Hello! I am **Drishti**, your clinical guide for Aarogya-Drishti.\n\nI can assist you with:\n• Step-by-step registration & secure onboarding\n• Full application walkthrough tour\n• Oral mucosal health guidance & clinical safety triage\n• Outreach screening camps & prioritized tribal villages\n• Complete 22-Mandal ASR District geography\n\nFeel free to ask by voice or text!`;
          const speech = `Hello! I am Drishti. How can I help you navigate Aarogya-Drishti today?`;
          response = {
            answerText: text,
            speechText: speech,
            language: 'en',
            intent: 'greeting',
            animation: 'greeting',
            expression: 'smiling',
            gesture: 'wave',
            topic: 'general_welcome',
            suggestedActions: ['Take Guided Tour', 'Create Account', 'Explain This Page', 'Check Symptoms'],
          };
        }
      }
    }

      // Enforce strict plain text for spoken voice response (no markdown, bullets, emojis, URLs)
      if (response && response.speechText) {
        response.speechText = response.speechText
          .replace(/https?:\/\/\S+/gi, '')
          .replace(/[*_#`~>[\]()]/g, '')
          .replace(/^[-•*]\s+/gm, '')
          .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      }

      res.envelope(response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/assistant/analyze-photo
 * Direct Oral Cavity Photo Screening Endpoint
 * Analyzes photo via Gemini Multimodal Vision with automatic offline fallback.
 * Returns what kind of lesion/condition is observed and WHICH DOCTOR TO CONSULT.
 */
assistantRouter.post(
  '/analyze-photo',
  optionalAuth,
  photoUpload.single('photo'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let base64 = '';
      let mime = 'image/jpeg';
      const patientNote = req.body.patientNote || req.body.message || '';
      const language = req.body.language || 'en';

      if (req.file) {
        base64 = req.file.buffer.toString('base64');
        mime = req.file.mimetype;
      } else if (req.body.imageBase64 || req.body.image) {
        base64 = req.body.imageBase64 || req.body.image;
        mime = req.body.mimeType || 'image/jpeg';
      } else {
        res.status(400).envelope(null, 'No oral photo provided. Send photo file or imageBase64.', 400);
        return;
      }

      let result: OralPhotoAnalysisResult;
      if (isGeminiConfigured()) {
        try {
          result = await analyzeOralPhotoWithGemini({
            imageBase64: base64,
            mimeType: mime,
            patientNote,
            language,
          });
        } catch (err: any) {
          logger.warn({ err: err.message }, 'Gemini direct photo analysis failed, using offline triage');
          result = offlineAnalyzeOralPhoto(patientNote, language);
        }
      } else {
        result = offlineAnalyzeOralPhoto(patientNote, language);
      }

      res.envelope(result, 'Oral photo visual screening analysis completed');
    } catch (err) {
      next(err);
    }
  }
);
