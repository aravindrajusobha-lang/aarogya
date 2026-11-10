import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

const imagePath = "C:\\Users\\YTC CHINTAPALLI\\.gemini\\antigravity\\brain\\8c1db4b6-392c-492b-8d90-54b83ee44c6d\\.user_uploaded\\media_1794224616130_ec7b6cf0.jpg";

if (!fs.existsSync(imagePath)) {
  console.error("Image file not found at:", imagePath);
  process.exit(1);
}

const imageBuffer = fs.readFileSync(imagePath);
const base64Data = imageBuffer.toString('base64');

console.log("Image loaded successfully. Size:", imageBuffer.length, "bytes");

const systemPrompt = `You are "Drishti AI", an advanced clinical triage and navigation assistant for the Aarogya-Drishti community healthcare platform in ITDA Paderu, Alluri Sitharama Raju (ASR) District, Andhra Pradesh.

MANDATORY CLINICAL SAFETY GUIDELINES:
1. You provide preliminary screening and specialist referral guidance. You DO NOT provide a final definitive clinical determination.
2. Explicitly specify WHICH SPECIALIST DOCTOR the patient should consult (e.g. Dental Surgeon, Oral & Maxillofacial Surgeon, ENT Specialist, Head & Neck Surgical Specialist).
3. Recommend referral facilities in ASR district or Visakhapatnam (e.g. Community Health Centre CHC Paderu, Area Hospital Araku, King George Hospital KGH Visakhapatnam).
4. Identify potential mucosal observations (e.g., leukoplakia, erythroplakia, aphthous stomatitis, oral lichen planus, dental caries, submucous fibrosis, gingival inflammation).
5. Specify triage risk tier: 'low_risk_support', 'moderate_risk_support', or 'high_risk_support'.
6. Provide immediate supportive lifestyle advice (immediate cessation of betel nut, tobacco, gutka, alcohol, warm saline mouth rinses).
7. Generate comprehensive responses in both TELUGU (తెలుగు) and ENGLISH.
8. Plain speech text: The "speechTextTe" field will be read aloud by browser Text-to-Speech in Telugu. Never include markdown asterisks, emojis, bullet symbols, or URLs in speechTextTe.

Respond ONLY with a valid JSON object matching this schema:
{
  "observedCondition": "short name of visual mucosal finding",
  "conditionCategory": "white_lesion | red_lesion | ulcerative | pigmented | dental_caries | benign_mucosa | other",
  "riskTier": "low_risk_support | moderate_risk_support | high_risk_support",
  "confidenceScore": 0.88,
  "anatomicalSite": "e.g. Lower Labial Mucosa / Lower Lip",
  "visualFindings": ["finding 1", "finding 2"],
  "clinicalImpression": "Detailed clinical differential assessment (e.g. Oral Lichen Planus vs Leukoplakia)",
  "recommendedDoctor": {
    "specialty": "e.g. Dental Surgeon or Oral & Maxillofacial Specialist",
    "facility": "e.g. Community Health Centre (CHC) Paderu or Area Hospital Araku",
    "urgency": "routine | priority | urgent",
    "timelineDays": 7,
    "consultationReason": "Clinical evaluation and biopsy if indicated"
  },
  "urgentRedFlags": ["warning sign 1", "warning sign 2"],
  "lifestyleAdviceTe": ["తక్షణమే పొగాకు, గుట్కా మానేయండి", "గోరువెచ్చని ఉప్పునీటితో పుక్కిలించండి"],
  "lifestyleAdviceEn": ["Avoid tobacco/betel nut", "Warm saline rinses"],
  "answerTextTe": "స్పష్టమైన తెలుగు వివరణ (ఏమి కనిపించింది, ఏ వైద్యుడిని సంప్రదించాలి, తదుపరి చర్యలు)",
  "answerTextEn": "Clear English explanation (findings, recommended specialist, next steps)",
  "speechTextTe": "సహజమైన తెలుగు సంభాషణ టెక్స్ట్-టు-స్పీచ్ కొరకు",
  "disclaimer": "DEMO AI SCREENING SUPPORT ONLY — NOT FOR CLINICAL USE. REQUIRES IN-PERSON CLINICIAN REVIEW."
}`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

const payload = {
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: `Please analyze this clinical photo of the lower lip / oral mucosa for screening triage. Observe the mucosal plaque/lesion, determine the risk tier, clinical impressions, and give specific guidance for rural tribal patients in ASR District in both Telugu and English.`
        },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        }
      ]
    }
  ],
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 2000,
    responseMimeType: 'application/json'
  },
  systemInstruction: {
    parts: [{ text: systemPrompt }]
  }
};

try {
  console.log("Calling Gemini Vision API with model:", model);
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const duration = Date.now() - start;
  console.log(`Response received in ${duration}ms, status:`, res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error("API error response:", errorText);
    process.exit(1);
  }

  const json = await res.json();
  const content = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("\n=== GEMINI CLINICAL TRIAGE OUTPUT ===");
  console.log(content);
} catch (err) {
  console.error("Fetch error:", err);
}

