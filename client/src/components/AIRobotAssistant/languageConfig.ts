import { LanguageCode } from '../../i18n';

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  nativeName: string;
  bcp47: string;
  speechVoiceNames: string[];
  femaleVoiceLabel: string;
  sampleGreeting: string;
  spokenWelcome: string;
  suggestedQuestions: string[];
}

export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    bcp47: 'en-IN',
    speechVoiceNames: ['en-IN', 'English India', 'en-GB', 'en-US'],
    femaleVoiceLabel: 'Female Voice (Neerja / Jenny)',
    sampleGreeting:
      '👋 **Welcome to Aarogya-Drishti!**\n\nI am **Drishti**, your AI clinical navigation companion.\n\n📋 **Essential Frontline Steps:**\n1. 📝 **Step 1 — Register Patient:** Tap "Register Patient" to record demographics via Smart Aadhaar OCR or manual intake.\n2. 📸 **Step 2 — Oral Screening:** Capture mucosal photos for instant AI risk triage.\n3. 👨‍⚕️ **Step 3 — Doctor Guidance:** Review referral recommendations (Dental Surgeon, Oral Specialist) for CHC Paderu or Area Hospital Araku.\n\n*How can I assist you with your patient today?*',
    spokenWelcome:
      'Welcome to Aarogya Drishti! I am Drishti. Step 1: Please register the patient using Smart Aadhaar or manual intake. Step 2: Capture oral photos for instant AI screening. I am here to guide you.',
    suggestedQuestions: [
      '📝 Please register patient (Step 1)',
      '📸 How to take oral screening photo? (Step 2)',
      '👨‍⚕️ Which doctor should I consult?',
      '🏥 Show hospitals in Paderu / ASR',
      'I have had a mouth ulcer for two weeks',
    ],
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    bcp47: 'te-IN',
    speechVoiceNames: ['te-IN', 'Telugu India', 'Telugu'],
    femaleVoiceLabel: 'మహిళా వాయిస్ (శృతి / దృష్టి)',
    sampleGreeting:
      '👋 **నమస్కారం! ఆరోగ్య దృష్టికి స్వాగతం.**\n\nనేను **దృష్టిని**, మీ AI ఆరోగ్య సహాయకురాలిని.\n\n📋 **ముఖ్యమైన మార్గదర్శక దశలు:**\n1. 📝 **మొదటి దశ — రోగి నమోదు:** "రోగి నమోదు" పై క్లిక్ చేసి స్మార్ట్ ఆధార్ లేదా సాధారణ వివరాలతో పేషెంట్‌ను నమోదు చేయండి.\n2. 📸 **రెండవ దశ — నోటి స్క్రీనింగ్:** రోగి నోటి ఫోటో తీసి తక్షణ డెమో AI రిస్క్ విశ్లేషణ పొందండి.\n3. 👨‍⚕️ **మూడవ దశ — వైద్యుల సిఫార్సు:** దంత వైద్యులు, పాడేరు CHC లేదా అరకు ఆసుపత్రి వివరాలు తెలుసుకోండి.\n\n*ఈ రోజు నేను మీ రోగికి ఎలా సహాయపడగలను? నాతో మాట్లాడండి!*',
    spokenWelcome:
      'నమస్కారం! ఆరోగ్య దృష్టికి స్వాగతం. నేను దృష్టిని. మొదటి దశ: దయచేసి రోగి నమోదు లేదా ఆధార్ రిజిస్ట్రేషన్ పూర్తి చేయండి. రెండవ దశ: రోగి నోటి ఫోటో తీసి AI స్క్రీనింగ్ నిర్వహించండి. నేను మీకు సహాయం చేయడానికి సిద్ధంగా ఉన్నాను.',
    suggestedQuestions: [
      '📝 రోగిని ఎలా నమోదు చేయాలి? (మొదటి దశ)',
      '📸 నోటి స్క్రీనింగ్ ఎలా చేయాలి? (రెండవ దశ)',
      '👨‍⚕️ ఏ డాక్టర్‌ని సంప్రదించాలి?',
      '🏥 పాడేరు దగ్గరి ఆసుపత్రులు ఎక్కడ ఉన్నాయి?',
      'నోటిలో పుండు రెండు వారాలుగా మానడం లేదు',
    ],
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    bcp47: 'hi-IN',
    speechVoiceNames: ['hi-IN', 'Hindi India', 'Hindi'],
    femaleVoiceLabel: 'महिला आवाज (कल्पना / स्वरा)',
    sampleGreeting:
      '👋 **नमस्ते! आरोग्य दृष्टि में आपका स्वागत है।**\n\nमैं **दृष्टि**, आपकी AI स्वास्थ्य साथी हूँ।\n\n📋 **आवश्यक मार्गदर्शन चरण:**\n1. 📝 **चरण 1 — मरीज का पंजीकरण:** "मरीज पंजीकरण" पर क्लिक करके स्मार्ट आधार या सामान्य फॉर्म द्वारा मरीज को रजिस्टर करें।\n2. 📸 **चरण 2 — मुख स्क्रीनिंग:** मुंह की फोटो लेकर त्वरित AI जोखिम विश्लेषण प्राप्त करें।\n3. 👨‍⚕️ **चरण 3 — डॉक्टर परामर्श:** दंत विशेषज्ञ, सीएचसी पाडेरू या अराकु अस्पताल का मार्गदर्शन देखें।\n\n*आज मैं आपके मरीज के लिए क्या सहायता कर सकती हूँ? बोलकर या लिखकर पूछें।*',
    spokenWelcome:
      'नमस्ते! आरोग्य दृष्टि में आपका स्वागत है। मैं दृष्टि हूँ। पहला कदम: कृपया मरीज का पंजीकरण करें या आधार से रजिस्टर करें। दूसरा कदम: मुंह की फोटो लेकर AI स्क्रीनिंग करें। मैं आपकी सहायता के लिए तैयार हूँ।',
    suggestedQuestions: [
      '📝 मरीज का पंजीकरण कैसे करें? (चरण 1)',
      '📸 मुख स्क्रीनिंग कैसे करें? (चरण 2)',
      '👨‍⚕️ किस डॉक्टर से परामर्श लें?',
      '🏥 पाडेरू / अराकु में नजदीकी अस्पताल',
      'मुंह में दो सप्ताह से छाला है',
    ],
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    bcp47: 'ta-IN',
    speechVoiceNames: ['ta-IN', 'Tamil India', 'Tamil'],
    femaleVoiceLabel: 'பெண் குரல் (பல்லவி / சரண்யா)',
    sampleGreeting:
      'வணக்கம்! நான் டாக்டர் திருஷ்டி. படி 1: நோயாளியை பதிவு செய்யவும். படி 2: வாய்வழி பரிசோதனை செய்யவும்.',
    spokenWelcome:
      'வணக்கம்! ஆரோக்கிய திருஷ்டிக்கு வரவேற்கிறோம். முதலில் நோயாளியை பதிவு செய்யவும்.',
    suggestedQuestions: ['📝 நோயாளி பதிவு', '📸 பரிசோதனை தொடங்கு'],
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    bcp47: 'kn-IN',
    speechVoiceNames: ['kn-IN', 'Kannada India', 'Kannada'],
    femaleVoiceLabel: 'ಮಹಿಳಾ ಧ್ವನಿ (ಸ್ವಪ್ನಾ / ಡಾ. ದೃಷ್ಟಿ)',
    sampleGreeting:
      'ನಮಸ್ಕಾರ! ನಾನು ಡಾ. ದೃಷ್ಟಿ. ಹಂತ 1: ರೋಗಿಯನ್ನು ನೋಂದಾಯಿಸಿ. ಹಂತ 2: ಬಾಯಿಯ ತಪಾಸಣೆ ಮಾಡಿ.',
    spokenWelcome:
      'ನಮಸ್ಕಾರ! ಆರೋಗ್ಯ ದೃಷ್ಟಿಗೆ ಸುಸ್ವಾಗತ. ದಯವಿಟ್ಟು ರೋಗಿಯನ್ನು ನೋಂದಾಯಿಸಿ.',
    suggestedQuestions: ['📝 ರೋಗಿ ನೋಂದಣಿ', '📸 ತಪಾಸಣೆ ಪ್ರಾರಂಭಿಸಿ'],
  },
  ml: {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    bcp47: 'ml-IN',
    speechVoiceNames: ['ml-IN', 'Malayalam India', 'Malayalam'],
    femaleVoiceLabel: 'സ്ത്രീ ശബ്ദം (ശോഭന / ഡോ. ദൃഷ്ടി)',
    sampleGreeting:
      'നമസ്കാരം! ഞാൻ ഡോ. ദൃഷ്ടി. ഘട്ടം 1: രോഗിയെ രജിസ്റ്റർ ചെയ്യുക. ഘട്ടം 2: വായ പരിശോധന നടത്തുക.',
    spokenWelcome:
      'നമസ്കാരം! ആരോഗ്യ ദൃഷ്ടിയിലേക്ക് സ്വാഗതം. ആദ്യം രോഗിയെ രജിസ്റ്റർ ചെയ്യുക.',
    suggestedQuestions: ['📝 രോഗി രജിസ്ട്രേഷൻ', '📸 സ്ക്രീനിംഗ് ആരംഭിക്കുക'],
  },
};
