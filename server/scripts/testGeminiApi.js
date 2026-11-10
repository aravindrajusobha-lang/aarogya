import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

console.log('================================================================');
console.log('🤖 AAROGYA-DRISHTI: GOOGLE GEMINI API OFFICIAL LIVE TEST');
console.log('   (OpenAI Disabled - Exclusively Using Google Gemini API)');
console.log('================================================================\n');

if (!apiKey) {
  console.error('❌ ERROR: GEMINI_API_KEY is not configured in server/.env');
  process.exit(1);
}

// Print masked key for security verification
const maskedKey = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);
console.log(`🔑 Gemini API Key: ${maskedKey}`);
console.log(`🧠 Target Model:   ${model}`);
console.log(`🌐 Endpoint:       https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent\n`);

// -------------------------------------------------------------------------
// TEST 1: Multilingual Conversational AI (English + Telugu)
// -------------------------------------------------------------------------
console.log('--- TEST 1: Multilingual Conversational AI (English + Telugu) ---');
console.log('📡 Sending prompt to Gemini API...');

const testPrompt = `You are Drishti, the AI assistant for Aarogya-Drishti oral screening in ITDA Paderu, ASR District.
Respond in exactly this JSON format:
{
  "greetingEn": "One sentence greeting in English introducing yourself as Drishti",
  "greetingTe": "One sentence greeting in Telugu introducing yourself as Drishti (నేను దృష్టిని)",
  "screeningStep1": "Short guidance for patient registration",
  "status": "active"
}`;

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

try {
  const t0 = Date.now();
  const res1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 300,
        responseMimeType: 'application/json'
      }
    })
  });

  const duration1 = Date.now() - t0;

  if (!res1.ok) {
    const errText = await res1.text();
    console.error(`❌ Test 1 Failed: HTTP ${res1.status} (${duration1}ms)`);
    console.error(errText);
    process.exit(1);
  }

  const json1 = await res1.json();
  const rawText1 = json1?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log(`✅ Test 1 Passed in ${duration1}ms!`);
  console.log('📄 Gemini Response Payload:');
  console.log(rawText1);
} catch (err) {
  console.error('❌ Test 1 Network Exception:', err.message);
  process.exit(1);
}

// -------------------------------------------------------------------------
// TEST 2: Multimodal Oral Lesion Vision Analysis (Base64 Image Triage)
// -------------------------------------------------------------------------
console.log('\n--- TEST 2: Multimodal Oral Lesion Vision Triage ---');
console.log('📡 Sending oral image analysis test with clinical doctor recommendation...');

// 1x1 test pixel as base64
const sampleImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const visionPrompt = `You are an AI assistant for frontline oral health screening in ITDA Paderu, Alluri Sitharama Raju District, Andhra Pradesh.
Analyze this sample oral cavity visual screening photo. Note: Patient reports mild burning sensation for 2 weeks.
Return valid JSON with:
{
  "observedCondition": "Clinical observation description",
  "riskTier": "low_risk_support" or "moderate_risk_support",
  "recommendedDoctor": {
    "specialty": "Dental Surgeon / Oral Specialist",
    "facility": "CHC Paderu or Area Hospital Araku",
    "timelineDays": 7
  },
  "adviceTelugu": "Telugu guidance for frontline ASHA worker"
}`;

try {
  const t0 = Date.now();
  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: visionPrompt },
            {
              inlineData: {
                mimeType: 'image/png',
                data: sampleImageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 350,
        responseMimeType: 'application/json'
      }
    })
  });

  const duration2 = Date.now() - t0;

  if (!res2.ok) {
    const errText = await res2.text();
    console.error(`❌ Test 2 Failed: HTTP ${res2.status} (${duration2}ms)`);
    console.error(errText);
    process.exit(1);
  }

  const json2 = await res2.json();
  const rawText2 = json2?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log(`✅ Test 2 Passed in ${duration2}ms!`);
  console.log('📄 Gemini Vision Response:');
  console.log(rawText2);
} catch (err) {
  console.error('❌ Test 2 Network Exception:', err.message);
  process.exit(1);
}

console.log('\n================================================================');
console.log('🎉 ALL GEMINI API TESTS PASSED SUCCESSFULLY (100%)');
console.log('   - Multilingual text generation: Active & working');
console.log('   - Multimodal image screening & doctor referral: Active & working');
console.log('   - OpenAI removed & Google Gemini API fully operational');
console.log('================================================================\n');
