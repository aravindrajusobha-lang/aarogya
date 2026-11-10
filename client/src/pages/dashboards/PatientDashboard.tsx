import React, { useState, useRef, useEffect } from 'react';
import { AuthUser } from '../../components/AuthPanel';
import {
  analyzeMucosalLesion,
  IMucosalLesionResult,
  verifyAndRefineWithGemini,
  IGeminiRefinementResult,
} from '../../services/aiEngineService';
import { LanguageCode } from '../../i18n';
import { LiveVideoConsultationModal } from '../../components/LiveVideoConsultationModal';
import { PrescriptionCardView } from '../../components/PrescriptionCardView';
import { ThemeToggle } from '../../components/ThemeToggle';
import '../../styles/Dashboard.css';

export interface PatientDashboardProps {
  currentUser: AuthUser | null;
  onNavigateTab?: (tab: string) => void;
  currentLang?: LanguageCode;
  onOpenLanguageModal?: () => void;
  onToggleAIAssistant?: () => void;
}

interface DiseaseInfo {
  title: Record<LanguageCode, string>;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  riskBadge: Record<LanguageCode, string>;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  icon: string;
  description: Record<LanguageCode, string>;
  medicationsAndCare: Record<LanguageCode, string[]>;
  habitsAndDiet: Record<LanguageCode, string[]>;
  clinicalAction: Record<LanguageCode, string>;
}

const DISEASE_KNOWLEDGE_BASE: Record<string, DiseaseInfo> = {
  normal: {
    title: {
      te: 'సాధారణ ఆరోగ్యకరమైన శ్లేష్మం (Healthy Mucosa)',
      en: 'Normal / Healthy Oral Mucosa',
      hi: 'सामान्य स्वस्थ म्यूकोसा (Healthy Oral Tissue)',
      ta: 'ஆரோக்கியமான வாய் திசு (Healthy Mucosa)',
      kn: 'ಆರೋಗ್ಯಕರ ಬಾಯಿಯ ಮ್ಯೂಕೋಸಾ',
      ml: 'ആരോഗ്യമുള്ള വായ ടിഷ്യു',
    },
    riskLevel: 'LOW',
    riskBadge: {
      te: '🟢 తక్కువ రిస్క్ (Low Risk)',
      en: '🟢 Low Risk (Optimal Health)',
      hi: '🟢 कम जोखिम (Low Risk)',
      ta: '🟢 குறைந்த ஆபத்து (Low Risk)',
      kn: '🟢 ಕಡಿಮೆ ಅಪಾಯ (Low Risk)',
      ml: '🟢 കുറഞ്ഞ റിസ്ക് (Low Risk)',
    },
    badgeColor: 'var(--success-text)',
    badgeBg: 'var(--success-bg)',
    badgeBorder: 'var(--success-text)',
    icon: '✨',
    description: {
      te: 'మీ నోటి లోపలి భాగం మరియు చిగుళ్ళు ఎటువంటి అసాధారణ మచ్చలు లేకుండా సాధారణ పింక్ రంగుతో ఆరోగ్యంగా ఉన్నాయి.',
      en: 'Healthy uniform pink oral lining. Epithelial tissue is intact with no suspicious white, red, or ulcerated patches.',
      hi: 'आपके मुंह की अंदरूनी परत और मसूड़े स्वस्थ गुलाबी रंग के हैं। कोई असामान्य सफेद या लाल पैच नहीं है।',
      ta: 'உங்கள் வாய் ஆரோக்கியமாக உள்ளது. அசாதாரண தழும்புகள் இல்லை.',
      kn: 'ನಿಮ್ಮ ಬಾಯಿಯ ಒಳಪದರವು ಯಾವುದೇ ಅಸಹಜ ಕಲೆಗಳಿಲ್ಲದೆ ಆರೋಗ್ಯಕರವಾಗಿದೆ.',
      ml: 'നിങ്ങളുടെ വായയുടെ അകം ആരോഗ്യകരമായ പിങ്ക് നിറത്തിലാണ്.',
    },
    medicationsAndCare: {
      te: [
        '🪥 రోజుకు రెండుసార్లు మృదువైన బ్రష్‌తో పళ్ళు శుభ్రం చేసుకోండి (ఉదయం & రాత్రి).',
        '💧 భోజనం తర్వాత ఎల్లప్పుడూ మంచినీటితో నోటిని పుక్కిలించి ఊయండి.',
        '🦷 ఫ్లోరైడ్ టూత్‌పేస్ట్ ఉపయోగించండి.',
      ],
      en: [
        '🪥 Gentle twice-daily brushing with soft bristles (morning & before bed).',
        '💧 Thorough clean water rinse after every meal to clear food residues.',
        '🦷 Use fluoride toothpaste to keep enamel strong.',
      ],
      hi: [
        '🪥 दिन में दो बार मुलायम ब्रश से दांत साफ करें (सुबह और रात सोने से पहले)।',
        '💧 भोजन के बाद हमेशा साफ पानी से कुल्ला करें।',
        '🦷 फ्लोराइड युक्त टूथपेस्ट का उपयोग करें।',
      ],
      ta: ['🪥 தினமும் இருமுறை பல்துலக்குங்கள்.', '💧 சாப்பிட்ட பின் வாய் கொப்பளிக்கவும்.'],
      kn: ['🪥 ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ ಮೃದುವಾದ ಬ್ರಷ್‌ನಿಂದ ಹಲ್ಲುಜ್ಜಿಕೊಳ್ಳಿ.', '💧 ಊಟದ ನಂತರ ಬಾಯಿ ಮುಕ್ಕಳಿಸಿ.'],
      ml: ['🪥 ദിവസവും രണ്ടുതവണ പല്ല് തേക്കുക.', '💧 ഭക്ഷണത്തിന് ശേഷം വായ കഴുകുക.'],
    },
    habitsAndDiet: {
      te: [
        '🚫 గుట్కా, ఖైనీ, తంబాకు, చుట్టకు ఎల్లప్పుడూ దూరంగా ఉండండి.',
        '🥗 తాజా పండ్లు, ఆకుకూరలు, పుష్కలంగా నీరు తీసుకోండి.',
        '📅 ప్రతి 6 నెలలకు సమీపంలోని దంత క్లినిక్‌లో సాధారణ తనిఖీ చేయించుకోండి.',
      ],
      en: [
        '🚫 100% Tobacco & Gutka cessation prevents oral disorders.',
        '🥗 Consume fresh seasonal vegetables, hydration, and vitamin-rich fruits.',
        '📅 Schedule a routine preventive dental checkup every 6 months.',
      ],
      hi: [
        '🚫 गुटखा, खैनी, तंबाकू और बीड़ी से पूरी तरह दूर रहें।',
        '🥗 ताजे फल, हरी सब्जियां और पर्याप्त पानी पिएं।',
        '📅 हर 6 महीने में नजदीकी डेंटल क्लीनिक में सामान्य जांच कराएं।',
      ],
      ta: ['🚫 புகையிலை மற்றும் குட்காவை தவிர்க்கவும்.', '🥗 சத்தான உணவுகளை உண்ணுங்கள்.'],
      kn: ['🚫 ತಂಬಾಕು, ಗುಟ್ಕಾ ಸೇವನೆ ತ್ಯಜಿಸಿ.', '🥗 ಹಸಿರು ತರಕಾರಿಗಳನ್ನು ಸೇವಿಸಿ.'],
      ml: ['🚫 പുകയില ഉൽപ്പന്നങ്ങൾ ഒഴിവാക്കുക.', '🥗 പഴങ്ങളും പച്ചക്കറികളും കഴിക്കുക.'],
    },
    clinicalAction: {
      te: 'ఏ విధమైన తక్షణ వైద్యం అవసరం లేదు. సాధారణ ఆరోగ్యకరమైన అలవాట్లను కొనసాగించండి.',
      en: 'No urgent clinical intervention needed. Continue regular oral hygiene.',
      hi: 'किसी आपातकालीन उपचार की आवश्यकता नहीं है। नियमित स्वच्छता जारी रखें।',
      ta: 'அவசர சிகிச்சை தேவையில்லை. வழக்கமான பழக்கங்களை தொடரவும்.',
      kn: 'ತುರ್ತು ಚಿಕಿತ್ಸೆಯ ಅಗತ್ಯವಿಲ್ಲ. ನಿಯಮಿತ ಸ್ವಚ್ಛತೆ ಕಾಪಾಡಿಕೊಳ್ಳಿ.',
      ml: 'അടിയന്തിര ചികിത്സ ആവശ്യമില്ല. പതിവ് ശുചിത്വം തുടരുക.',
    },
  },

  benign_inflammatory: {
    title: {
      te: 'నోటి పూత / అల్సర్ లేదా వాపు (Aphthous Stomatitis / Ulcer)',
      en: 'Benign Inflammatory Condition (Oral Ulcer / Canker Sore / Stomatitis)',
      hi: 'मुंह का छाला या सूजन (Oral Ulcer / Benign Inflammation)',
      ta: 'வாய் புண் அல்லது வீக்கம் (Oral Ulcer)',
      kn: 'ಬಾಯಿಯ ಹುಣ್ಣು ಅಥವಾ ಊತ (Mouth Ulcer)',
      ml: 'വായയിലെ വ്രണം അല്ലെങ്കിൽ വീക്കം (Oral Ulcer)',
    },
    riskLevel: 'MODERATE',
    riskBadge: {
      te: '🟡 మధ్యస్థ రిస్క్ (Moderate Risk - శ్రద్ధ అవసరం)',
      en: '🟡 Moderate Risk (Care & Monitoring Needed)',
      hi: '🟡 मध्यम जोखिम (ध्यान देने की आवश्यकता)',
      ta: '🟡 நடுத்தர ஆபத்து (கவனிப்பு தேவை)',
      kn: '🟡 ಮಧ್ಯಮ ಅಪಾಯ (ಕಾಳಜಿ ಅಗತ್ಯ)',
      ml: '🟡 മിതമായ റിസ്ക് (ശ്രദ്ധിക്കുക)',
    },
    badgeColor: 'var(--warning-text)',
    badgeBg: 'var(--warning-bg)',
    badgeBorder: 'var(--warning-text)',
    icon: '🩹',
    description: {
      te: 'నోటి లోపల చిన్న పుండు (నోటి పూత) లేదా చిగుళ్ళ వాపు కనిపించింది. ఇది సాధారణంగా విటమిన్ల లోపం, ఒత్తిడి లేదా కడుపులో వేడి వల్ల వస్తుంది.',
      en: 'Mild localized mucosal ulceration or inflammation detected. Typically non-malignant, related to canker sores, accidental bite, or nutritional deficiency.',
      hi: 'मुंह के अंदर छोटा छाला या मसूड़े में हल्की सूजन पाई गई है। यह आमतौर पर विटामिन की कमी या पेट की गर्मी से होता है।',
      ta: 'வாயில் சிறிய புண் அல்லது ஈறு வீக்கம் காணப்படுகிறது.',
      kn: 'ಬಾಯಿಯ ಒಳಗೆ ಸಣ್ಣ ಹುಣ್ಣು ಅಥವಾ ಒಸಡಿನ ಊತ ಕಂಡುಬಂದಿದೆ.',
      ml: 'വായയ്ക്കുള്ളിൽ ചെറിയ വ്രണമോ വീക്കമോ കണ്ടെത്തി.',
    },
    medicationsAndCare: {
      te: [
        '🧂 గోరువెచ్చని ఉప్పునీటి పుక్కిలింత: 1 గ్లాసు గోరువెచ్చని నీటిలో అర చెంచా ఉప్పు కలిపి రోజుకు 3-4 సార్లు భోజనం తర్వాత పుక్కిలించండి.',
        '🧴 పూత జెల్ (Soothing Oral Gel): నొప్పి తగ్గడానికి క్లినికల్ అనుమతితో కోలిన్ సాలిసిలేట్ లేదా క్లోరెక్సిడైన్ జెల్ పూయవచ్చు.',
        '💊 విటమిన్ బి-కాంప్లెక్స్ & విటమిన్ సి: వైద్యుల సలహా మేరకు బి-కాంప్లెక్స్ మాత్రలు తీసుకోవడం వల్ల పుండు త్వరగా మానుతుంది.',
      ],
      en: [
        '🧂 Warm Saline Mouthwash: Dissolve 1/2 tsp salt in warm water; rinse 3-4 times daily after meals to accelerate healing.',
        '🧴 Soothing Mucosal Gel: Apply over-the-counter oral antiseptic/anesthetic gel (e.g. Chlorhexidine or Choline Salicylate) for pain relief.',
        '💊 B-Complex & Vitamin C: Take daily multivitamin supplements to restore epithelial mucosal resilience.',
      ],
      hi: [
        '🧂 गुनगुने नमक के पानी से कुल्ला: 1 गिलास गुनगुने पानी में आधा चम्मच नमक मिलाकर दिन में 3-4 बार कुल्ला करें।',
        '🧴 दर्द निवारक ओरल जेल: छालों पर आराम के लिए कोलीन सैलिसिलेट या क्लोरहेक्सिडीन जेल लगाएं।',
        '💊 बी-कॉम्प्लेक्स और विटामिन सी: डॉक्टर की सलाह से बी-कॉम्प्लेक्स की गोली लें।',
      ],
      ta: ['🧂 வெதுவெதுப்பான உப்பு நீரால் வாய் கொப்பளிக்கவும்.', '🧴 வாய் புண் ஜெல் பயன்படுத்தவும்.'],
      kn: ['🧂 ಬೆಚ್ಚಗಿನ ಉಪ್ಪು ನೀರಿನಿಂದ ಬಾಯಿ ಮುಕ್ಕಳಿಸಿ.', '🧴 ಹುಣ್ಣಿನ ಜೆಲ್ ಹಚ್ಚಿ.'],
      ml: ['🧂 ചെറുചൂടുള്ള ഉപ്പുവെള്ളം കൊണ്ട് വായ കഴുകുക.', '🧴 വ്രണത്തിന് ജെൽ പുരട്ടുക.'],
    },
    habitsAndDiet: {
      te: [
        '🌶️ కారంగా, చాలా వేడిగా మరియు పులుపుగా ఉండే ఆహారాలు తాత్కాలికంగా మానుకోండి.',
        '🥛 పెరుగు, మజ్జిగ, చలువ చేసే పదార్థాలు మరియు కొబ్బరినీళ్ళు ఎక్కువగా తాగండి.',
        '🚫 పొగాకు, సిగరెట్లు, ఖైనీ పూర్తిగా నిలిపివేయండి.',
      ],
      en: [
        '🌶️ Avoid spicy, hot, crunchy, and acidic foods until the ulcer heals.',
        '🥛 Consume buttermilk, curd, coconut water, and high-hydration foods.',
        '🚫 Completely cease tobacco and alcohol use to prevent mucosal aggravation.',
      ],
      hi: [
        '🌶️ मसालेदार, गर्म और खट्टे भोजन से कुछ दिनों के लिए परहेज करें।',
        '🥛 छाछ, दही, नारियल पानी का अधिक सेवन करें।',
        '🚫 तंबाकू, बीड़ी, गुटखा का सेवन तुरंत बंद करें।',
      ],
      ta: ['🌶️ காரமான உணவுகளை தவிர்க்கவும்.', '🥛 மோர் மற்றும் தயிர் அதிகம் சாப்பிடவும்.'],
      kn: ['🌶️ ಖಾರ ಮತ್ತು ಬಿಸಿ ಆಹಾರವನ್ನು ತಪ್ಪಿಸಿ.', '🥛 ಮಜ್ಜಿಗೆ ಮತ್ತು ಮೊಸರು ಸೇವಿಸಿ.'],
      ml: ['🌶️ എരിവുള്ള ഭക്ഷണങ്ങൾ ഒഴിവാക്കുക.', '🥛 മോരും തൈരും കഴിക്കുക.'],
    },
    clinicalAction: {
      te: 'ఈ పుండు 7 నుండి 10 రోజుల్లో తగ్గకపోతే, వెంటనే CHC పాడేరు లేదా సమీప ప్రాథమిక ఆరోగ్య కేంద్రాన్ని (PHC) సంప్రదించండి.',
      en: 'If this ulcer does not heal within 7 to 10 days, visit CHC Paderu Dental Outpost for an in-person clinical checkup.',
      hi: 'यदि यह छाला 7 से 10 दिनों में ठीक नहीं होता है, तो तुरंत CHC पाडेरु या नजदीकी अस्पताल जाएं।',
      ta: '7-10 நாட்களில் புண் ஆறவில்லை என்றால், மருத்துவரை அணுகவும்.',
      kn: '7-10 ದಿನಗಳಲ್ಲಿ ಹುಣ್ಣು ಗುಣವಾಗದಿದ್ದರೆ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.',
      ml: '7-10 ദിവസത്തിനകം മാറിയില്ലെങ്കിൽ ഡോക്ടറെ കാണുക.',
    },
  },

  opmd: {
    title: {
      te: 'తెల్లటి లేదా ఎర్రటి మచ్చల పొర - OPMD (Oral Lichen Planus / Leukoplakia)',
      en: 'Oral Potentially Malignant Disorder (OPMD / Leukoplakia / Lichen Planus)',
      hi: 'सफेद या लाल पैच - OPMD (Oral Lichen Planus / Leukoplakia)',
      ta: 'வெள்ளை அல்லது சிவப்பு தழும்பு (OPMD)',
      kn: 'ಬಿಳಿ ಅಥವಾ ಕೆಂಪು ಕಲೆ - OPMD',
      ml: 'വെള്ളയോ ചുവപ്പോ ആയ പാട് (OPMD)',
    },
    riskLevel: 'HIGH',
    riskBadge: {
      te: '🔴 అధిక రిస్క్ (High Risk - తక్షణ వైద్య పరీక్ష అవసరం)',
      en: '🔴 High Risk (Urgent Specialist Review Recommended)',
      hi: '🔴 उच्च जोखिम (तत्काल डॉक्टर की जांच आवश्यक)',
      ta: '🔴 அதிக ஆபத்து (உடனடி மருத்துவ ஆலோசனை தேவை)',
      kn: '🔴 ಹೆಚ್ಚಿನ ಅಪಾಯ (ತುರ್ತು ತಪಾಸಣೆ ಅಗತ್ಯ)',
      ml: '🔴 ഉയർന്ന റിസ്ക് (ഉടൻ ഡോക്ടറെ കാണുക)',
    },
    badgeColor: 'var(--danger-text)',
    badgeBg: 'var(--danger-bg)',
    badgeBorder: 'var(--danger-text)',
    icon: '⚠️',
    description: {
      te: 'నోటి లోపల తెల్లటి లేదా ఎర్రటి మచ్చల పొర కనిపించింది. ఇది పొగాకు, గుట్కా లేదా దీర్ఘకాలిక రాపిడి వల్ల వచ్చే ప్రమాద సూచిక (OPMD) కావచ్చు.',
      en: 'Mucosal keratinization, persistent white plaque, or reticular striae detected. Classified as a Potentially Malignant Disorder requiring visual confirmation by a Dental Specialist.',
      hi: 'मुंह के अंदर सफेद या लाल धब्बे की परत दिखाई दी है। यह तंबाकू या गुटखे के कारण होने वाला संभावित पूर्व-कैंसर (OPMD) लक्षण हो सकता है।',
      ta: 'வாயில் வெள்ளை அல்லது சிவப்பு தழும்பு காணப்படுகிறது.',
      kn: 'ಬಾಯಿಯ ಒಳಗೆ ಬಿಳಿ ಅಥವಾ ಕೆಂಪು ಕಲೆಗಳ ಪದರ ಕಂಡುಬಂದಿದೆ.',
      ml: 'വായയ്ക്കുള്ളിൽ വെള്ളയോ ചുവപ്പോ ആയ പാടുകൾ കണ്ടെത്തി.',
    },
    medicationsAndCare: {
      te: [
        '🚨 తక్షణ క్లినికల్ తనిఖీ: CHC పాడేరు దంత వైద్య నిపుణులను (Dental Officer) వెంటనే సంప్రదించండి.',
        '🚫 పొగాకు 100% ఆపండి: గుట్కా, ఖైనీ, పాన్, బీడీని తక్షణమే పూర్తిగా నిలిపివేయాలి. ఇది అత్యంత ముఖ్యం.',
        '💊 యాంటీఆక్సిడెంట్ చికిత్స: వైద్యుల పర్యవేక్షణలో లైకోపీన్ (Lycopene) లేదా విటమిన్ ఏ/ఈ థెరపీ తీసుకోవాలి.',
        '⚠️ మచ్చపై వేలితో లేదా బ్రష్‌తో గట్టిగా రుద్దకండి.',
      ],
      en: [
        '🚨 Urgent In-Person Clinical Exam: Consult the Dental Specialist at CHC Paderu Dental Outpost.',
        '🚫 100% Complete Cessation: Cease all betel nut, khaini, gutka, and bidi use immediately.',
        '💊 Prescribed Antioxidant Therapy: Medical Officer may prescribe high-potency Lycopene, Vitamin A/E.',
        '⚠️ Never scrub or scrape the white patch with fingers or sharp tools.',
      ],
      hi: [
        '🚨 तुरंत डॉक्टर से जांच: CHC पाडेरु के दंत रोग विशेषज्ञ से तुरंत जांच कराएं।',
        '🚫 तंबाकू पूरी तरह बंद: गुटखा, खैनी, पान और बीड़ी का सेवन तुरंत 100% बंद करें।',
        '💊 एंटीऑक्सीडेंट दवा: डॉक्टर की सलाह से लाइकोपीन और आवश्यक दवाएं लें।',
        '⚠️ पैच को उंगली या किसी नुकीली चीज से न खुरचें।',
      ],
      ta: ['🚨 உடனடியாக மருத்துவரை அணுகவும்.', '🚫 புகையிலை பழக்கத்தை உடனடியாக கைவிடவும்.'],
      kn: ['🚨 ತಕ್ಷಣ ದಂತ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.', '🚫 ತಂಬಾಕು ಸೇವನೆಯನ್ನು ತಕ್ಷಣ ನಿಲ್ಲಿಸಿ.'],
      ml: ['🚨 ഉടൻ ഡോക്ടറെ കാണുക.', '🚫 പുകയില ഉൽപ്പന്നങ്ങൾ പൂർണ്ണമായും നിർത്തുക.'],
    },
    habitsAndDiet: {
      te: [
        '👩‍⚕️ మీ గ్రామంలోని ఆశా (ASHA) కార్యకర్తను సంప్రదించండి; ఆమె మిమ్మల్ని పాడేరు ఆసుపత్రికి తీసుకెళ్లడంలో సహాయపడుతుంది.',
        '🥦 యాంటీఆక్సిడెంట్ ఆహారం: పచ్చి కూరగాయలు, క్యారెట్లు, టమాటాలు, బొప్పాయి ఎక్కువగా తినండి.',
      ],
      en: [
        '👩‍⚕️ Inform your village ASHA worker (Lakshmi Devi); she will arrange clinical escort to CHC Paderu.',
        '🥦 High-antioxidant diet: Carrots, tomatoes, green leafy vegetables, and citrus fruits.',
      ],
      hi: [
        '👩‍⚕️ अपनी आशा कार्यकर्ता से संपर्क करें, वह अस्पताल जाने में सहायता करेंगी।',
        '🥦 एंटीऑक्सीडेंट युक्त भोजन: गाजर, टमाटर, हरी सब्जियां खाएं।',
      ],
      ta: ['👩‍⚕️ உங்கள் ஆஷா பணியாளரை அணுகவும்.'],
      kn: ['👩‍⚕️ ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆಯನ್ನು ಸಂಪರ್ಕಿಸಿ.'],
      ml: ['👩‍⚕️ ആശാ വർക്കറെ സമീപിക്കുക.'],
    },
    clinicalAction: {
      te: 'CHC పాడేరు డెంటల్ విభాగంలో రాబోయే 3-5 రోజుల్లో తప్పనిసరిగా ఇన్-పర్సన్ పరీక్ష చేయించుకోండి.',
      en: 'Schedule an in-person clinical examination at CHC Paderu Dental Department within 3 to 5 days.',
      hi: 'अगले 3-5 दिनों के भीतर CHC पाडेरु के दंत विभाग में जांच कराएं।',
      ta: '3-5 நாட்களுக்குள் CHC மருத்துவமனைக்கு செல்லவும்.',
      kn: 'ಮುಂದಿನ 3-5 ದಿನಗಳಲ್ಲಿ CHC ಪಾಡೇರು ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.',
      ml: '3-5 ദിവസത്തിനകം ആശുപത്രിയിൽ പരിശോധന നടത്തുക.',
    },
  },

  suspected_malignant: {
    title: {
      te: 'తీవ్రమైన పుండు / అత్యవసర నిపుణుల పరీక్ష (Suspicious Mucosal Alteration)',
      en: 'High-Risk Mucosal Alteration (Urgent Biopsy / Specialist Consultation)',
      hi: 'संदिग्ध गहरा छाला / तत्काल विशेषज्ञ जांच (High-Risk Alteration)',
      ta: 'அவசர சிறப்பு மருத்துவ ஆலோசனை (High-Risk Alteration)',
      kn: 'ತೀವ್ರವಾದ ಬಾಯಿಯ ಹುಣ್ಣು / ತುರ್ತು ಪರೀಕ್ಷೆ',
      ml: 'അടിയന്തിര വിദഗ്ദ്ധ പരിശോധന ആവശ്യമാണ്',
    },
    riskLevel: 'CRITICAL',
    riskBadge: {
      te: '🔴 అత్యవసర నిపుణుల సంప్రదింపు (Critical Priority)',
      en: '🔴 Critical Priority (Immediate Specialist Hospital Referral)',
      hi: '🔴 सर्वोच्च प्राथमिकता (अस्पताल में तत्काल जांच)',
      ta: '🔴 மிக அவசரம் (Immediate Specialist Referral)',
      kn: '🔴 ತುರ್ತು ಗಮನ ಅಗತ್ಯ (Critical Priority)',
      ml: '🔴 അതീവ ജാഗ്രത (Immediate Specialist Referral)',
    },
    badgeColor: 'var(--danger-text)',
    badgeBg: 'var(--danger-bg)',
    badgeBorder: 'var(--danger-text)',
    icon: '🚨',
    description: {
      te: 'నోటి కణజాలంలో గట్టిదనం లేదా మానని లోతైన ఎరుపు/తెలుపు గాయం కనిపించింది. దీనికి వెంటనే జిల్లా లేదా ఏరియా ఆసుపత్రి నిపుణులు పరీక్ష చేయాలి.',
      en: 'Erosive, indurated, or chronic non-healing mucosal alteration detected. Requires prioritized clinical biopsy and histopathological verification by an ENT/Oral Surgeon.',
      hi: 'मुंह में गहरा न भरने वाला घाव या कठोरता पाई गई है। इसे तुरंत जिला अस्पताल के विशेषज्ञ डॉक्टर को दिखाना अनिवार्य है।',
      ta: 'ஆறாத புண் காணப்படுகிறது. உடனடியாக அரசு மருத்துவமனைக்கு செல்லவும்.',
      kn: 'ಗುಣವಾಗದ ತೀವ್ರ ಗಾಯ ಕಂಡುಬಂದಿದೆ. ತಕ್ಷಣ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.',
      ml: 'ഉണങ്ങാത്ത വ്രണം കണ്ടെത്തി. ഉടൻ തന്നെ വിദഗ്ദ്ധ പരിശോധന നടത്തുക.',
    },
    medicationsAndCare: {
      te: [
        '🏥 ఏరియా హాస్పిటల్ పాడేరు (Area Hospital Paderu) లేదా కేజీహెచ్ విశాఖపట్నంకు వెంటనే వెళ్ళండి.',
        '🩺 డాక్టర్ ఆధ్వర్యంలో బయాప్సీ (Biopsy) నిర్ధారణ పరీక్ష తప్పనిసరిగా చేయించుకోండి.',
        '🚫 ఎలాంటి నాటు మందులు లేదా ఆకుల పసర్లు రాయవద్దు; ఇది సమస్యను తీవ్రం చేయవచ్చు.',
      ],
      en: [
        '🏥 Immediate referral to Area Hospital Paderu / King George Hospital (KGH) Visakhapatnam ENT-Dental Unit.',
        '🩺 Undergo clinical biopsy and diagnostic confirmation as ordered by Medical Officer.',
        '🚫 Do NOT apply unverified herbal remedies or caustic substances to the lesion.',
      ],
      hi: [
        '🏥 तुरंत एरिया अस्पताल पाडेरु या केजीएच विशाखापट्टनम जाएं।',
        '🩺 डॉक्टर की देखरेख में बायोप्सी जांच कराएं।',
        '🚫 किसी भी प्रकार की घरेलू जड़ी-बूटी या चूर्ण घाव पर न लगाएं।',
      ],
      ta: ['🏥 உடனடியாக அரசு தலைமை மருத்துவமனைக்கு செல்லவும்.'],
      kn: ['🏥 ತಕ್ಷಣ ತಾಲೂಕು ಅಥವಾ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗೆ ತೆರಳಿ.'],
      ml: ['🏥 ഉടൻ തന്നെ അടുത്തുള്ള വലിയ ആശുപത്രിയിൽ എത്തുക.'],
    },
    habitsAndDiet: {
      te: [
        '📞 104 హెల్త్‌లైన్ లేదా మీ గ్రామ ఏఎన్ఎం (ANM) కు తక్షణమే సమాచారం ఇవ్వండి.',
        '🍲 సులభంగా మింగగలిగే చల్లని, మృదువైన ద్రవ ఆహారం తీసుకోండి.',
      ],
      en: [
        '📞 Call 104 Health Helpline or contact your village ANM/ASHA immediately.',
        '🍲 Consume soft, bland, cooled food that is easy to swallow without pain.',
      ],
      hi: [
        '📞 104 स्वास्थ्य हेल्पलाइन या अपनी एएनएम से तुरंत संपर्क करें।',
        '🍲 नरम, हल्का और ठंडा खाना खाएं।',
      ],
      ta: ['📞 104 அவசர உதவிக்கு அழைக்கவும்.'],
      kn: ['📞 104 ಸಹಾಯವಾಣಿಗೆ ಕರೆ ಮಾಡಿ.'],
      ml: ['📞 104 ഹെൽപ്പ് ലൈനിൽ വിളിക്കുക.'],
    },
    clinicalAction: {
      te: 'ఈరోజే లేదా రేపటిలోగా పాడేరు ప్రభుత్వ ఆసుపత్రిలోని ఈఎన్‌టీ / డెంటల్ విభాగానికి వెళ్ళండి.',
      en: 'Proceed immediately today or tomorrow to Area Hospital Paderu Oral Oncology/Dental unit.',
      hi: 'आज ही या कल सुबह पाडेरु सरकारी अस्पताल के दंत विभाग में संपर्क करें।',
      ta: 'இன்றே மருத்துவரை அணுகவும்.',
      kn: 'ಇಂದೇ ಅಥವಾ ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.',
      ml: 'ഇന്നുതന്നെ ആശുപത്രിയിൽ എത്തുക.',
    },
  },
};

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  currentUser,
  onNavigateTab,
  currentLang = 'te',
  onOpenLanguageModal,
  onToggleAIAssistant,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'appointments' | 'referrals' | 'prescriptions' | 'history' | 'hospitals' | 'education' | 'care-team' | 'reports'
  >('overview');

  // Video Consultation & Telemedicine Modal State (Module 4)
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);
  const [activeConsultationId] = useState<string>('CONS-PAD-8492');
  const [isDoctorCallActive, setIsDoctorCallActive] = useState<boolean>(false);

  // Digital Prescription Viewer Modal State (Module 6 & 7)
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null);
  const [prescriptionsList] = useState<any[]>([
    {
      prescriptionId: 'RX-PAD-981240',
      patientId: currentUser?.patientId || 'DEMO-PAD-8492',
      patientName: currentUser?.fullName || 'Balaraju Somulu',
      doctorName: 'Dr. K. Somasekhar (MO)',
      doctorSpecialty: 'Dental Surgeon & Oral Medicine',
      hospitalName: 'Community Health Centre (CHC) Paderu',
      clinicalObservations: 'Superficial creamy white plaques on lower labial mucosa, erythematous background.',
      diagnosisImpression: 'Oral Pseudomembranous Candidiasis (Oral Thrush)',
      createdAt: new Date().toISOString(),
      followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'active',
      medicines: [
        {
          medicineName: 'Clotrimazole 1% Mouth Paint',
          dosage: '10 to 15 drops',
          frequency: '3-4 times daily (Apply locally)',
          durationDays: 7,
          instructions: 'Swish and hold over lesions for 2 minutes after meals.',
        },
        {
          medicineName: 'Warm Saline Gargle',
          dosage: '1 Glass warm water + salt',
          frequency: '3 times daily after food',
          durationDays: 10,
          instructions: 'Soothes inflamed mucosa and clears plaques.',
        },
        {
          medicineName: 'Vitamin B-Complex Tablets',
          dosage: '1 Tablet',
          frequency: '1-0-0 (After breakfast)',
          durationDays: 14,
          instructions: 'Take with warm water.',
        },
      ],
      dietaryLifestyleAdvice: [
        'Strict 100% cessation of betel nut, tobacco, and gutka.',
        'Avoid spicy, acidic, crunchy, or very hot foods.',
      ],
    },
  ]);

  // Referrals List State (Module 5)
  const [referralsList] = useState<any[]>([
    {
      referralId: 'REF-PAD-2026-081',
      patientId: currentUser?.patientId || 'DEMO-PAD-8492',
      patientName: currentUser?.fullName || 'Balaraju Somulu',
      referringDoctorName: 'Dr. K. Somasekhar (CHC Paderu)',
      destinationHospitalName: 'King George Hospital (KGH) Visakhapatnam',
      specialty: 'Oral & Maxillofacial Oncology & Biopsy Unit',
      priority: 'high_priority',
      status: 'SCHEDULED',
      reasonForReferral: 'Suspicious persistent mucosal lesion evaluation and punch biopsy verification.',
      scheduledFollowUpDate: new Date(Date.now() + 4 * 86400000).toISOString(),
    },
    {
      referralId: 'REF-PAD-2026-039',
      patientId: currentUser?.patientId || 'DEMO-PAD-8492',
      patientName: currentUser?.fullName || 'Balaraju Somulu',
      referringDoctorName: 'Dr. Ananya Roy (PHC Dumbriguda)',
      destinationHospitalName: 'Community Health Centre (CHC) Paderu',
      specialty: 'Dental Surgeon & Oral Medicine',
      priority: 'routine',
      status: 'ATTENDED',
      reasonForReferral: 'Initial oral mucosal evaluation and routine scaling.',
      scheduledFollowUpDate: new Date(Date.now() - 12 * 86400000).toISOString(),
    },
  ]);

  // Voice Guidance (Module 11) - Web Speech API
  const speakText = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (currentLang === 'te') {
        utterance.lang = 'te-IN';
      } else if (currentLang === 'hi') {
        utterance.lang = 'hi-IN';
      } else {
        utterance.lang = 'en-IN';
      }
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };
  
  // Real-Time Camera & Upload Studio States
  const [activeInputMode, setActiveInputMode] = useState<'camera' | 'upload'>('upload');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImagePreview, setCapturedImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [liveScreeningResult, setLiveScreeningResult] = useState<IMucosalLesionResult | null>(null);
  const [screeningDate, setScreeningDate] = useState<string>('09 Nov 2026');

  // Gemini Multimodal Verification States
  const [geminiResult, setGeminiResult] = useState<IGeminiRefinementResult | null>(null);
  const [isVerifyingGemini, setIsVerifyingGemini] = useState<boolean>(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('aarogya_gemini_api_key') || '';
    } catch {
      return '';
    }
  });
  const [tempApiKey, setTempApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Daily Habits Tracker
  const [habitChecked, setHabitChecked] = useState<{ morningBrush: boolean; eveningBrush: boolean; salineRinse: boolean }>({
    morningBrush: true,
    eveningBrush: false,
    salineRinse: true,
  });

  const patientName = currentUser?.fullName || 'Balaraju Somulu';
  const patientId = currentUser?.patientId || 'DEMO-PAD-8492';
  const village = 'Dumbriguda Settlement';
  const mandal = 'Paderu Agency';

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  };

  const startCameraStream = async (targetFacing: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);
    setCameraLoading(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this browser. Please upload an image.');
      }
      let stream: MediaStream;
      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: targetFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback for laptop/desktop webcams that do not support environment facing mode
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      setFacingMode(targetFacing);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        currentLang === 'te'
          ? 'కెమెరా ప్రారంభించలేకపోయాము. దయచేసి కెమెరా అనుమతిని ఇవ్వండి లేదా ఫోటో అప్‌లోడ్ చేయండి.'
          : currentLang === 'hi'
          ? 'कैमरा शुरू नहीं हो सका। कृपया अनुमति दें या गैलरी से फोटो अपलोड करें।'
          : 'Could not start camera. Please grant camera permission or upload a photo from your gallery.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const handleToggleCameraFacing = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    startCameraStream(nextFacing);
  };

  // Run Real-Time AI Inference on Canvas
  const processCanvasImage = async (canvas: HTMLCanvasElement) => {
    setIsAnalyzing(true);
    setGeminiResult(null);
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setCapturedImagePreview(dataUrl);

      // Step 1: Run Primary Neural Model (ONNX WebAssembly)
      const result = await analyzeMucosalLesion(canvas, patientId);
      setLiveScreeningResult(result);
      setScreeningDate(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));

      // Step 2: Intelligent Multi-Tier Gate:
      // Invoke Google Gemini Multimodal Vision to analyze mucosal observations, recommend specialist doctor & home remedies
      setIsVerifyingGemini(true);
      try {
        const gemini = await verifyAndRefineWithGemini(canvas, result, currentLang, geminiApiKey);
        setGeminiResult(gemini);
      } catch (gErr) {
        console.warn('Gemini verification error:', gErr);
      } finally {
        setIsVerifyingGemini(false);
      }
    } catch (err) {
      console.error('Error running oral screening inference:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleManualGeminiVerification = async () => {
    if (!canvasRef.current || !liveScreeningResult) return;
    setIsVerifyingGemini(true);
    try {
      const gemini = await verifyAndRefineWithGemini(canvasRef.current, liveScreeningResult, currentLang, geminiApiKey);
      setGeminiResult(gemini);
    } catch (gErr) {
      console.warn('Manual Gemini verification failed:', gErr);
    } finally {
      setIsVerifyingGemini(false);
    }
  };

  // Capture snapshot from Live Video
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCameraStream();
    processCanvasImage(canvas);
  };

  // Handle Image File Upload (Clicked Photos / Gallery)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    stopCameraStream();
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        // Limit max dimension to 1200px for high performance
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        processCanvasImage(canvas);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Sample quick test triggers for testing the UI
  const handleQuickTestSample = (sampleType: 'normal' | 'benign_inflammatory' | 'opmd' | 'suspected_malignant') => {
    stopCameraStream();
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (sampleType === 'normal') {
      ctx.fillStyle = '#f8a5a5';
      ctx.fillRect(0, 0, 224, 224);
    } else if (sampleType === 'benign_inflammatory') {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, 0, 224, 224);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(112, 112, 35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(0, 0, 224, 224);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(40, 40, 144, 144);
    }

    processCanvasImage(canvas);
  };

  const getGreeting = () => {
    if (currentLang === 'te') {
      return `నమస్కారం, ${patientName} గారు! మీ నోటి ఆరోగ్యం మరియు క్లినికల్ రికార్డులు.`;
    }
    if (currentLang === 'hi') {
      return `नमस्ते, ${patientName} जी! आपका ओरल स्वास्थ्य एवं देखभाल पोर्टल।`;
    }
    return `Welcome back, ${patientName}! Your personal oral health & care portal.`;
  };

  // Get active disease knowledge block
  const rawKey = liveScreeningResult?.label || 'normal';
  const diseaseInfo = DISEASE_KNOWLEDGE_BASE[rawKey] || DISEASE_KNOWLEDGE_BASE.normal;

  const navTabs = [
    { id: 'overview' as const, label: currentLang === 'te' ? '📋 ఆరోగ్య హోమ్ & స్క్రీనింగ్' : currentLang === 'hi' ? '📋 स्वास्थ्य होम' : '📋 Health Home & AI' },
    { id: 'appointments' as const, label: currentLang === 'te' ? '📅 నా అపాయింట్‌మెంట్లు' : currentLang === 'hi' ? '📅 अपॉइंटमेंट' : '📅 My Appointments' },
    { id: 'referrals' as const, label: currentLang === 'te' ? '🔄 నా రిఫరల్స్' : currentLang === 'hi' ? '🔄 मेरे रेफरल' : '🔄 My Referrals' },
    { id: 'prescriptions' as const, label: currentLang === 'te' ? '💊 నా మందుల చీటీలు' : currentLang === 'hi' ? '💊 दवाई के पर्चे' : '💊 Prescriptions' },
    { id: 'history' as const, label: currentLang === 'te' ? '📜 నా ఆరోగ్య చరిత్ర' : currentLang === 'hi' ? '📜 स्वास्थ्य इतिहास' : '📜 Health History' },
    { id: 'hospitals' as const, label: currentLang === 'te' ? '🏥 సమీప ఆసుపత్రులు' : currentLang === 'hi' ? '🏥 नजदीकी अस्पताल' : '🏥 Nearby Hospitals' },
    { id: 'education' as const, label: currentLang === 'te' ? '🪥 నోటి సంరక్షణ సూచనలు' : currentLang === 'hi' ? '🪥 ओरल स्वास्थ्य' : '🪥 Oral Care' },
  ];

  return (
    <div className="patient-dashboard-root" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* 1. Warm Patient Welcome Hero with Instant Language Button */}
      <div
        className="patient-welcome-hero"
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: '18px',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
          color: 'var(--text-primary)',
          marginTop: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 800,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              flexShrink: 0,
            }}
          >
            {patientName.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              ITDA Paderu Tribal Health Initiative • ఆరోగ్య దృష్టి
            </div>
            <h2 style={{ margin: '4px 0 4px 0', fontSize: '1.38rem', color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.3 }}>
              {getGreeting()}
            </h2>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              📍 <strong style={{ color: 'var(--text-primary)' }}>{village}</strong>, {mandal} • Health ID:{' '}
              <code style={{ color: 'var(--accent)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid var(--border)' }}>
                {patientId}
              </code>
              {' '}• ABHA:{' '}
              <code style={{ color: 'var(--btn-primary-bg)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, border: '1px solid var(--border)' }}>
                {currentUser?.abhaNumber || '14-8492-3814-7731'}
              </code>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Theme Mode Toggle (Light / Dark) */}
          <ThemeToggle currentLang={currentLang} />

          {/* Language Selector Button */}
          {onOpenLanguageModal && (
            <button
              type="button"
              onClick={onOpenLanguageModal}
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-primary)',
                border: '1.5px solid var(--border)',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.18s ease',
              }}
            >
              <span>🌐</span>
              <span>{currentLang === 'te' ? 'భాష: తెలుగు' : currentLang === 'hi' ? 'भाषा: हिन्दी' : 'Language: EN'}</span>
              <span style={{ fontSize: '0.72rem', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '2px 6px', borderRadius: '6px' }}>మార్చండి</span>
            </button>
          )}

          <span
            style={{
              background: 'rgba(16, 185, 129, 0.25)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.5)',
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ● Citizen Verified
          </span>

          {onNavigateTab && (
            <button
              type="button"
              style={{
                background: '#10b981',
                color: '#022c22',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.86rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onClick={() => onNavigateTab('appointments')}
            >
              📅 {currentLang === 'te' ? 'అపాయింట్‌మెంట్' : currentLang === 'hi' ? 'अपॉइंटमेंट लें' : 'Book Appointment'}
            </button>
          )}
        </div>
      </div>

      {/* 2. Patient Health Overview KPI Grid */}
      <div className="dash-kpi-grid">
        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">Health ID Card</span>
            <div className="dash-kpi-icon-wrap icon-emerald">🪪</div>
          </div>
          <div className="dash-kpi-value" style={{ fontSize: '1.35rem' }}>{patientId}</div>
          <div className="dash-kpi-footer">
            <span className="dash-kpi-trend-up">● Active</span>
            <span>ABHA Linked Profile</span>
          </div>
        </div>

        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">Latest Oral Screening</span>
            <div className="dash-kpi-icon-wrap icon-blue">🩺</div>
          </div>
          <div className="dash-kpi-value" style={{ fontSize: '1.25rem', color: diseaseInfo.badgeColor }}>
            {diseaseInfo.riskBadge[currentLang] || diseaseInfo.riskBadge.en}
          </div>
          <div className="dash-kpi-footer">
            <span>{screeningDate}</span>
            <span style={{ color: '#94a3b8' }}>• {diseaseInfo.title[currentLang] || diseaseInfo.title.en}</span>
          </div>
        </div>

        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">
              {currentLang === 'te' ? 'తదుపరి ఓపీడీ అపాయింట్‌మెంట్' : currentLang === 'hi' ? 'अगला ओपीडी अपॉइंटमेंट' : 'Next OPD Appointment'}
            </span>
            <div className="dash-kpi-icon-wrap icon-amber">📅</div>
          </div>
          <div className="dash-kpi-value" style={{ fontSize: '1.2rem' }}>
            {currentLang === 'te' ? 'నేడు 10:30 AM' : 'Today 10:30 AM'}
          </div>
          <div className="dash-kpi-footer">
            <span>
              {currentLang === 'te' ? 'సీహెచ్‌సీ పాడేరు డెంటల్ విభాగం' : 'CHC Paderu Dental Outpost'}
            </span>
          </div>
        </div>

        <div className="dash-kpi-card">
          <div className="dash-kpi-header">
            <span className="dash-kpi-label">
              {currentLang === 'te' ? 'పొగాకు రహిత రోజుల రికార్డు' : currentLang === 'hi' ? 'तंबाकू मुक्त दिन' : 'Tobacco-Free Streak'}
            </span>
            <div className="dash-kpi-icon-wrap icon-rose">🌿</div>
          </div>
          <div className="dash-kpi-value" style={{ fontSize: '1.35rem', color: '#10b981' }}>
            {currentLang === 'te' ? '42 రోజులు' : '42 Days'}
          </div>
          <div className="dash-kpi-footer">
            <span className="dash-kpi-trend-up">
              ★ {currentLang === 'te' ? 'అత్యుత్తమ పురోగతి' : currentLang === 'hi' ? 'उत्कृष्ट प्रगति' : 'Excellent Progress'}
            </span>
          </div>
        </div>
      </div>

      {/* 2.5. TEN MAIN PATIENT ACTIONS (Module 1 - Accessible, Clean Unified Cards) */}
      <div style={{ marginTop: '10px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌟</span>
            <span>{currentLang === 'te' ? 'ముఖ్యమైన రోగి సేవలు (Main Healthcare Actions)' : currentLang === 'hi' ? 'मुख्य स्वास्थ्य सेवाएं' : 'Main Healthcare Actions'}</span>
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onToggleAIAssistant && (
              <button
                type="button"
                onClick={onToggleAIAssistant}
                style={{
                  background: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                }}
              >
                <span>🤖</span>
                <span>{currentLang === 'te' ? 'దృష్టి ఏఐ రోబోట్' : currentLang === 'hi' ? 'दृष्टि एआई चैटबॉट' : 'Chat with Drishti AI'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => speakText(
                currentLang === 'te'
                  ? 'ముఖ్యమైన రోగి సేవలు: ఆరోగ్య ఫోటో అప్‌లోడ్, ఏఐ పరీక్ష, డాక్టర్‌తో వీడియో కాల్, ఆసుపత్రులు, అపాయింట్‌మెంట్లు, రిఫరల్స్, మందుల చీటీలు, అత్యవసర సహాయం 108.'
                  : 'Main healthcare actions: Upload health image, AI screening, Video call doctor, Find hospitals, Appointments, Referrals, Prescriptions, Emergency 108.'
              )}
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🔊 {currentLang === 'te' ? 'వినండి (Listen)' : 'Listen'}
            </button>
          </div>
        </div>

        <div className="patient-actions-grid">
          {/* Action 1: Upload Health Image */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={() => {
              setActiveTab('overview');
              setActiveInputMode('upload');
              if (fileInputRef.current) fileInputRef.current.click();
            }}
          >
            <span className="patient-action-icon">📸</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '1. ఫోటో అప్‌లోడ్' : '1. Upload Image'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'గ్యాలరీ నుండి ఎంచుకోండి' : 'Upload from phone'}
            </span>
          </button>

          {/* Action 2: AI Health Screening */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={() => {
              setActiveTab('overview');
              setActiveInputMode('camera');
              startCameraStream('environment');
            }}
          >
            <span className="patient-action-icon">🔬</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '2. ఏఐ స్క్రీనింగ్' : '2. AI Screening'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'రియల్-టైమ్ కెమెరా' : 'Live Camera Scan'}
            </span>
          </button>

          {/* Action 3: Talk to a Doctor (WebRTC Live Video Consultation) */}
          <button
            type="button"
            className={`patient-action-btn ${isDoctorCallActive ? 'call-active' : ''}`}
            onClick={() => setShowVideoModal(true)}
          >
            <span className="patient-action-icon">{isDoctorCallActive ? '🟢' : '🩺'}</span>
            <strong className="patient-action-title">
              {currentLang === 'te'
                ? isDoctorCallActive
                  ? '3. డాక్టర్ ఆన్‌లైన్‌లో ఉన్నారు!'
                  : '3. డాక్టర్‌తో మాట్లాడండి'
                : isDoctorCallActive
                ? '3. Doctor is Online Now!'
                : '3. Talk to Doctor'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te'
                ? isDoctorCallActive
                  ? 'కాల్‌లో చేరడానికి నొక్కండి'
                  : 'ప్రత్యక్ష వీడియో సంప్రదింపు'
                : isDoctorCallActive
                ? 'Click to Join Call'
                : 'Live WebRTC Video'}
            </span>
          </button>

          {/* Action 4: Find Nearby Hospital */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={() => setActiveTab('hospitals')}
          >
            <span className="patient-action-icon">🏥</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '4. సమీప ఆసుపత్రి' : '4. Nearby Hospital'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'పాడేరు CHC & అరకు' : 'CHC Paderu & GPS'}
            </span>
          </button>

          {/* Action 5: My Appointments */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={() => setActiveTab('appointments')}
          >
            <span className="patient-action-icon">📅</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '5. నా అపాయింట్‌మెంట్లు' : '5. Appointments'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'తేదీ & సమయం బుకింగ్' : 'Upcoming & History'}
            </span>
          </button>

          {/* Action 6: My Referrals */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={() => setActiveTab('referrals')}
          >
            <span className="patient-action-icon">🔄</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '6. నా రిఫరల్స్' : '6. My Referrals'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'KGH & నిపుణుల కేంద్రాలు' : 'Specialist Tracking'}
            </span>
          </button>

          {/* Action 7: My Prescriptions */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={() => setActiveTab('prescriptions')}
          >
            <span className="patient-action-icon">💊</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '7. మందుల చీటీలు' : '7. Prescriptions'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'మోతాదు & ప్రింట్' : 'Medicines & Dosage'}
            </span>
          </button>

          {/* Action 8: My Health History */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={() => setActiveTab('history')}
          >
            <span className="patient-action-icon">📜</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '8. ఆరోగ్య చరిత్ర' : '8. Health History'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'గత పరీక్షలు & ఫలితాలు' : 'Clinical Records'}
            </span>
          </button>

          {/* Action 9: Emergency Help 108 */}
          <a
            href="tel:108"
            className="patient-action-btn emergency-btn"
          >
            <span className="patient-action-icon">🚨</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '9. అత్యవసర సహాయం 108' : '9. Emergency 108'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'ఉచిత అంబులెన్స్ కాల్' : 'Free Tribal Ambulance'}
            </span>
          </a>

          {/* Action 10: Language Settings */}
          <button
            type="button"
            className="patient-action-btn"
            onClick={onOpenLanguageModal}
          >
            <span className="patient-action-icon">🌐</span>
            <strong className="patient-action-title">
              {currentLang === 'te' ? '10. భాష ఎంపిక' : '10. Language Settings'}
            </strong>
            <span className="patient-action-desc">
              {currentLang === 'te' ? 'తెలుగు / हिन्दी / English' : 'Select Language'}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Section Navigation Switcher */}
      <div
        className="patient-section-nav"
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          borderBottom: '1.5px solid #cbd5e1',
          paddingBottom: '16px',
          marginTop: '4px',
        }}
      >
        {navTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`dash-btn ${isActive ? 'dash-btn-primary' : 'dash-btn-outline'}`}
              style={{
                background: isActive ? 'var(--btn-primary-bg)' : 'var(--surface)',
                color: isActive ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                border: isActive ? '1.5px solid var(--btn-primary-bg)' : '1.5px solid var(--border)',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.88rem',
                padding: '10px 18px',
                borderRadius: '10px',
                boxShadow: isActive ? '0 4px 14px rgba(5, 150, 105, 0.35)' : '0 2px 4px rgba(0, 0, 0, 0.04)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.18s ease',
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab View with In-Place Switch Transition */}
      <div key={activeTab} className="tab-pane-transition">
        {/* -------------------- TAB: OVERVIEW & REAL-TIME SCREENING STUDIO -------------------- */}
        {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          
          {/* REAL-TIME SCREENING STUDIO CARD (Clean, Simple, High-Contrast) */}
          <div
            className="dash-panel"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '18px',
              padding: '24px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div className="dash-panel-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '18px' }}>
              <div>
                <h3 className="dash-panel-title" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  <span>📸</span>
                  <span>{currentLang === 'te' ? 'రియల్-టైమ్ నోటి స్క్రీనింగ్ & పరీక్ష స్టూడియో' : currentLang === 'hi' ? 'रीयल-टाइम ओरल स्क्रीनिंग स्टूडियो' : 'Real-Time Oral Screening & Disease Check'}</span>
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  {currentLang === 'te'
                    ? 'మీ నోరు, నాలుక లేదా చిగురు ఫోటో తీసి లేదా అప్‌లోడ్ చేసి క్షణాల్లో రియల్-టైమ్ వ్యాధి పరిస్థితిని మరియు సంరక్షణను తెలుసుకోండి.'
                    : currentLang === 'hi'
                    ? 'अपने मुंह, जीभ या मसूड़े की फोटो लें या अपलोड करें और तुरंत स्वास्थ्य स्थिति व देखभाल सलाह पाएं।'
                    : 'Capture with camera or upload a clicked photo for immediate real-time AI disease triaging & home care guidance.'}
                </p>
              </div>
            </div>

            {/* Input Switcher: Camera vs. File Upload */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setActiveInputMode('camera');
                  startCameraStream(facingMode);
                }}
                style={{
                  background: activeInputMode === 'camera' && isCameraActive ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
                  color: activeInputMode === 'camera' && isCameraActive ? '#022c22' : '#ffffff',
                  border: '1.5px solid ' + (activeInputMode === 'camera' && isCameraActive ? '#10b981' : 'rgba(255, 255, 255, 0.2)'),
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.18s ease',
                }}
              >
                <span>📷</span>
                <span>
                  {cameraLoading
                    ? (currentLang === 'te' ? 'కెమెరా ప్రారంభమవుతోంది...' : 'Starting Camera...')
                    : (currentLang === 'te' ? 'కెమెరా ఉపయోగించండి (Live Camera)' : currentLang === 'hi' ? 'कैमरा शुरू करें' : 'Open Camera (Live Video)')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveInputMode('upload');
                  stopCameraStream();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                    fileInputRef.current.click();
                  }
                }}
                style={{
                  background: activeInputMode === 'upload' && !isCameraActive ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff',
                  border: '1.5px solid ' + (activeInputMode === 'upload' && !isCameraActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'),
                  padding: '10px 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.18s ease',
                }}
              >
                <span>🖼️</span>
                <span>{currentLang === 'te' ? 'ఫోటో అప్‌లోడ్ చేయండి (Upload Clicked Image)' : currentLang === 'hi' ? 'फोटो अपलोड करें' : 'Upload Clicked Photo / Gallery'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              />
            </div>

            {/* LIVE CAMERA VIEWFINDER */}
            {isCameraActive && (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '560px',
                  margin: '0 auto 20px auto',
                  background: '#000000',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '2px solid #10b981',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '420px', objectFit: 'cover' }}
                />

                {/* Target Focus Guide for Mouth */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '220px',
                    height: '140px',
                    border: '2px dashed rgba(52, 211, 153, 0.85)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: '0.78rem',
                    textAlign: 'center',
                    background: 'rgba(0, 0, 0, 0.15)',
                    padding: '8px',
                  }}
                >
                  {currentLang === 'te' ? 'నోరు లేదా చిగురును ఇక్కడ ఉంచండి' : currentLang === 'hi' ? 'मुंह को इस घेरे में रखें' : 'Align mouth or gums inside'}
                </div>

                {/* Camera Bottom Controls */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '14px',
                    left: 0,
                    right: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '16px',
                    alignItems: 'center',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleToggleCameraFacing}
                    style={{
                      background: 'rgba(0, 0, 0, 0.65)',
                      color: '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🔄 {facingMode === 'environment' ? 'Front Camera' : 'Back Camera'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCaptureSnapshot}
                    style={{
                      background: '#10b981',
                      color: '#022c22',
                      border: '3px solid #ffffff',
                      padding: '12px 28px',
                      borderRadius: '30px',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(16, 185, 129, 0.6)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    📸 {currentLang === 'te' ? 'ఫోటో తీసి స్కాన్ చేయండి' : currentLang === 'hi' ? 'फोटो लें और स्कैन करें' : 'Snap & Analyze Now'}
                  </button>

                  <button
                    type="button"
                    onClick={stopCameraStream}
                    style={{
                      background: 'rgba(239, 68, 68, 0.75)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '20px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ {currentLang === 'te' ? 'మూసివేయి' : 'Close'}
                  </button>
                </div>
              </div>
            )}

            {/* Camera Error Message */}
            {cameraError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  color: '#fca5a5',
                  fontSize: '0.86rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {cameraError}
              </div>
            )}

            {/* Analyzing Progress State */}
            {isAnalyzing && (
              <div
                style={{
                  background: 'rgba(2, 132, 199, 0.18)',
                  border: '1.5px solid #38bdf8',
                  borderRadius: '14px',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '18px',
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '8px', animation: 'spin 1s infinite linear' }}>⚙️</div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#38bdf8', fontWeight: 700 }}>
                  {currentLang === 'te' ? 'ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ విశ్లేషిస్తోంది...' : currentLang === 'hi' ? 'एआई मॉडल फोटो का विश्लेषण कर रहा है...' : 'Running Real-Time AI Inference...'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.86rem', color: '#cbd5e1' }}>
                  Testing with on-device ONNX WebAssembly neural weights &amp; mucosal colorimetric filters.
                </p>
              </div>
            )}

            {/* Quick Testing Shortcut Triggers */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '18px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                💡 {currentLang === 'te' ? 'నమూనా పరీక్షలు (Quick Test):' : currentLang === 'hi' ? 'नमूना परीक्षण:' : 'Quick Test Triggers:'}
              </span>
              <button
                type="button"
                onClick={() => handleQuickTestSample('normal')}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  color: '#34d399',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✨ Normal Mouth
              </button>
              <button
                type="button"
                onClick={() => handleQuickTestSample('benign_inflammatory')}
                style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid #f59e0b',
                  color: '#fbbf24',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🩹 Ulcer / Stomatitis
              </button>
              <button
                type="button"
                onClick={() => handleQuickTestSample('opmd')}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ⚠️ Lichen Planus (OPMD)
              </button>
            </div>

            {/* ========================================================================= */}
            {/* REAL-TIME COMPREHENSIVE RESULT CARD (DISEASE, RISK, MEDICATION & CARE) */}
            {/* ========================================================================= */}
            <div
              style={{
                background: diseaseInfo.badgeBg,
                border: `1.5px solid ${diseaseInfo.badgeBorder}`,
                borderRadius: '16px',
                padding: '22px',
                color: 'var(--text-primary)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              }}
            >
              {/* Result Header & Risk Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '14px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.6rem' }}>{diseaseInfo.icon}</span>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.25rem', color: diseaseInfo.badgeColor, fontWeight: 800 }}>
                        {diseaseInfo.title[currentLang] || diseaseInfo.title.en}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Screening ID: <code>SCR-PAD-2026-LIVE</code> • Date: {screeningDate} • Engine: ONNX WebAssembly
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span
                    style={{
                      background: diseaseInfo.badgeColor,
                      color: 'var(--surface)',
                      padding: '8px 18px',
                      borderRadius: '24px',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      letterSpacing: '0.02em',
                      boxShadow: `0 4px 12px ${diseaseInfo.badgeBorder}`,
                    }}
                  >
                    {diseaseInfo.riskBadge[currentLang] || diseaseInfo.riskBadge.en}
                  </span>
                </div>
              </div>

              {/* TWO-TIER MODEL STATUS & GEMINI VERIFICATION PANEL */}
              {isVerifyingGemini && (
                <div
                  style={{
                    background: 'var(--info-bg)',
                    border: '1.5px solid var(--info-text)',
                    color: 'var(--info-text)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <span style={{ fontSize: '1.3rem', animation: 'spin 1s infinite linear' }}>✨</span>
                  <div>
                    <strong style={{ color: 'var(--info-text)', fontSize: '0.9rem' }}>
                      {currentLang === 'te'
                        ? 'జెమినీ క్లినికల్ ఏఐతో నిర్ధారణ జరుగుతోంది...'
                        : 'Verifying with Gemini 1.5 Multimodal Clinical Vision...'}
                    </strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--info-text)' }}>
                      {currentLang === 'te'
                        ? 'ప్రాథమిక మోడల్ ఫలితాన్ని క్లినికల్ చిత్ర విశ్లేషణతో సరిపోల్చుతోంది.'
                        : 'Double-checking preliminary neural findings against stomatology visual criteria.'}
                    </div>
                  </div>
                </div>
              )}

              {geminiResult && (
                <div
                  style={{
                    background: geminiResult.isCorrected ? 'var(--warning-bg)' : 'var(--success-bg)',
                    border: `1.5px solid ${geminiResult.isCorrected ? 'var(--warning-text)' : 'var(--success-text)'}`,
                    color: 'var(--text-primary)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    marginBottom: '18px',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.15rem' }}>✨</span>
                      <strong style={{ color: geminiResult.isCorrected ? 'var(--warning-text)' : 'var(--success-text)', fontSize: '0.96rem' }}>
                        {geminiResult.isCorrected
                          ? (currentLang === 'te' ? 'జెమినీ ఏఐ ఫలితాన్ని సవరించి నిర్ధారించింది (Corrected by Gemini)' : 'Gemini Multimodal AI Refined & Corrected This Finding')
                          : (currentLang === 'te' ? 'జెమినీ ఏఐ ప్రాథమిక ఫలితాన్ని ధృవీకరించింది (Confirmed by Gemini)' : 'Gemini Multimodal AI Confirmed Primary Finding')}
                      </strong>
                    </div>
                    <span style={{ fontSize: '0.72rem', background: 'var(--surface)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                      Engine: {geminiResult.source}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '6px' }}>
                    <strong>{currentLang === 'te' ? 'సవరించిన వ్యాధి నిర్ధారణ:' : 'Refined Condition:'}</strong>{' '}
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{geminiResult.refinedCondition}</span>
                  </div>

                  {geminiResult.correctionNote && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', lineHeight: 1.45 }}>
                      💡 <strong>Note:</strong> {geminiResult.correctionNote}
                    </div>
                  )}

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    👨‍⚕️ <strong>{currentLang === 'te' ? 'సిఫార్సు చేయబడిన వైద్యులు:' : 'Recommended Doctor:'}</strong>{' '}
                    {geminiResult.recommendedDoctor.specialty} at {geminiResult.recommendedDoctor.facility} ({geminiResult.recommendedDoctor.consultationReason})
                  </div>
                </div>
              )}

              {/* Image Preview & Description */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: capturedImagePreview ? '140px 1fr' : '1fr',
                  gap: '18px',
                  alignItems: 'center',
                  marginBottom: '20px',
                }}
              >
                {capturedImagePreview && (
                  <div
                    style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: `2px solid ${diseaseInfo.badgeColor}`,
                    }}
                  >
                    <img
                      src={capturedImagePreview}
                      alt="Captured Screening"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {currentLang === 'te' ? 'పరిస్థితి వివరణ (What this looks like):' : currentLang === 'hi' ? 'स्थिति का विवरण:' : 'Condition Analysis:'}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.94rem', lineHeight: 1.55, color: 'var(--text-primary)' }}>
                    {diseaseInfo.description[currentLang] || diseaseInfo.description.en}
                  </p>
                </div>
              </div>

              {/* Two Column Layout: Needed Care & Diet/Habits */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px',
                }}
              >
                {/* Column 1: Needed Medication & Home Care */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--success-text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💊</span>
                    <span>{currentLang === 'te' ? 'అవసరమైన సంరక్షణ & మందులు (Medication & Home Care):' : currentLang === 'hi' ? 'आवश्यक देखभाल एवं दवाएं:' : 'Needed Care & Home Remedies:'}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {(diseaseInfo.medicationsAndCare[currentLang] || diseaseInfo.medicationsAndCare.en).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                {/* Column 2: Habits & Dietary Guidelines */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                  }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--warning-text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🥗</span>
                    <span>{currentLang === 'te' ? 'ఆహార నియమాలు & జాగ్రత్తలు (Diet & Prevention):' : currentLang === 'hi' ? 'आहार एवं परहेज:' : 'Diet & Habits Guidance:'}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {(diseaseInfo.habitsAndDiet[currentLang] || diseaseInfo.habitsAndDiet.en).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Clinical Next Steps & Action Banner */}
              <div
                style={{
                  background: 'var(--info-bg)',
                  border: '1px solid var(--info-text)',
                  color: 'var(--info-text)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--info-text)', fontSize: '0.88rem', marginBottom: '2px' }}>
                    🏥 {currentLang === 'te' ? 'సిఫార్సు చేయబడిన తదుపరి చర్య (Clinical Next Steps):' : currentLang === 'hi' ? 'अगला चिकित्सीय कदम:' : 'Recommended Clinical Action:'}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                    {diseaseInfo.clinicalAction[currentLang] || diseaseInfo.clinicalAction.en}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('appointments')}
                      style={{
                        background: '#10b981',
                        color: '#022c22',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      📅 {currentLang === 'te' ? 'పాడేరు దంత క్లినిక్‌లో అపాయింట్‌మెంట్ తీసుకోండి' : currentLang === 'hi' ? 'अस्पताल अपॉइंटमेंट बुक करें' : 'Book Dental OPD Visit'}
                    </button>
                  )}
                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('specialists')}
                      style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                      }}
                    >
                      👩‍⚕️ {currentLang === 'te' ? 'వైద్యుల డైరెక్టరీ' : currentLang === 'hi' ? 'विशेषज्ञ सूची' : 'Specialist Directory'}
                    </button>
                  )}
                  {!isVerifyingGemini && (
                    <button
                      type="button"
                      onClick={handleManualGeminiVerification}
                      style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        color: '#ffffff',
                        border: '1px solid #38bdf8',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>✨</span>
                      <span>{geminiResult ? (currentLang === 'te' ? 'జెమినీతో మళ్లీ తనిఖీ చేయండి' : 'Re-verify with Gemini') : (currentLang === 'te' ? 'జెమినీతో నిర్ధారించండి' : 'Verify with Gemini Vision')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Safety Non-Diagnosis Banner (Invariant 1 Compliance) */}
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#94a3b8',
                  lineHeight: 1.4,
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  paddingTop: '10px',
                }}
              >
                ⚠️ <strong>DEMO AI Screening Assistance:</strong> This tool provides preliminary algorithmic triage support for remote tribal habitations and does NOT constitute a definitive medical diagnosis. All official diagnoses, prescriptions, and therapeutic plans are performed exclusively in person by qualified Medical Officers and Dental Officers at CHC Paderu.
              </div>
            </div>
          </div>

          {/* Daily Oral Hygiene Progress & Habits Card */}
          <div className="dash-panel">
            <div className="dash-panel-header">
              <h3 className="dash-panel-title">
                <span>🌿</span>
                <span>{currentLang === 'te' ? 'రోజువారీ నోటి సంరక్షణ పురోగతి & అలవాట్లు' : currentLang === 'hi' ? 'दैनिक ओरल देखभाल एवं आदतें' : 'Treatment Progress & Daily Hygiene Tracker'}</span>
              </h3>
              <span className="dash-status-pill status-completed">DAILY TRACKER</span>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5, marginBottom: '14px' }}>
              {currentLang === 'te'
                ? 'పాడేరు దంత వైద్యాధికారి సిఫార్సు చేసిన ఈ రోజువారీ అలవాట్లను పూర్తి చేయండి:'
                : 'Follow these simple daily habits recommended by your CHC dental officer for optimal oral recovery:'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={habitChecked.morningBrush}
                  onChange={(e) => setHabitChecked({ ...habitChecked, morningBrush: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span
                  style={{
                    textDecoration: habitChecked.morningBrush ? 'line-through' : 'none',
                    color: habitChecked.morningBrush ? '#94a3b8' : '#ffffff',
                    fontWeight: 500,
                  }}
                >
                  🪥 {currentLang === 'te' ? 'ఉదయం మృదువైన బ్రష్‌తో 2 నిమిషాలు పళ్ళు తోమడం' : 'Morning gentle tooth brushing with soft bristles (2 minutes)'}
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={habitChecked.salineRinse}
                  onChange={(e) => setHabitChecked({ ...habitChecked, salineRinse: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span
                  style={{
                    textDecoration: habitChecked.salineRinse ? 'line-through' : 'none',
                    color: habitChecked.salineRinse ? '#94a3b8' : '#ffffff',
                    fontWeight: 500,
                  }}
                >
                  💧 {currentLang === 'te' ? 'మధ్యాహ్న భోజనం తర్వాత గోరువెచ్చని ఉప్పునీటి పుక్కిలింత' : 'Warm salt-water mouth gargle after noon meal'}
                </span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={habitChecked.eveningBrush}
                  onChange={(e) => setHabitChecked({ ...habitChecked, eveningBrush: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span
                  style={{
                    textDecoration: habitChecked.eveningBrush ? 'line-through' : 'none',
                    color: habitChecked.eveningBrush ? '#94a3b8' : '#ffffff',
                    fontWeight: 500,
                  }}
                >
                  🌙 {currentLang === 'te' ? 'రాత్రి నిద్రపోయే ముందు బ్రష్ చేసుకోవడం' : 'Evening brushing before sleep (removes dinner plaque)'}
                </span>
              </label>
            </div>

            <div
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.82rem',
                color: '#e0f2fe',
                lineHeight: 1.5,
              }}
            >
              💡 <strong>Follow-up Reminder:</strong> Routine in-person clinical checkup due on <strong>14 Nov 2026</strong> at CHC Paderu. ASHA Lakshmi Devi will accompany your habitation group.
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: UPCOMING APPOINTMENTS -------------------- */}
      {activeTab === 'appointments' && (
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3 className="dash-panel-title">
              <span>📅</span>
              <span>
                {currentLang === 'te'
                  ? 'నా షెడ్యూల్ చేయబడిన వైద్య సంప్రదింపులు'
                  : currentLang === 'hi'
                  ? 'मेरे निर्धारित परामर्श'
                  : 'My Scheduled OPD & Telemedicine Appointments'}
              </span>
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {/* Appointment Card 1: Dedicated Online Video Consultation with Treating Doctor */}
            <div
              style={{
                background: isDoctorCallActive
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)'
                  : 'rgba(255, 255, 255, 0.03)',
                border: isDoctorCallActive
                  ? '2px solid #10b981'
                  : '1.5px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '16px',
                padding: '22px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                boxShadow: isDoctorCallActive ? '0 8px 24px rgba(16, 185, 129, 0.25)' : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                    {currentLang === 'te'
                      ? 'డాక్టర్ కె. సోమశేఖర్, BDS, MDS (ఓరల్ మెడిసిన్ & డెంటల్ సర్జన్)'
                      : 'Dr. K. Somasekhar, BDS, MDS (Oral Medicine & Dental Surgeon)'}
                  </span>
                  <span
                    className="dash-status-pill"
                    style={{
                      background: isDoctorCallActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      border: isDoctorCallActive ? '1px solid #10b981' : '1px solid #f59e0b',
                      color: isDoctorCallActive ? '#34d399' : '#fbbf24',
                      fontWeight: 700,
                    }}
                  >
                    {isDoctorCallActive
                      ? currentLang === 'te'
                        ? '🟢 డాక్టర్ ఆన్‌లైన్‌లో ఉన్నారు'
                        : '🟢 DOCTOR ONLINE'
                      : currentLang === 'te'
                      ? '🕒 వైద్యుల కోసం వేచి ఉంది'
                      : '🕒 WAITING FOR DOCTOR'}
                  </span>
                </div>

                <div style={{ fontSize: '0.86rem', color: '#cbd5e1', marginBottom: '6px' }}>
                  🏥 <strong>{currentLang === 'te' ? 'కమ్యూనిటీ హెల్త్ సెంటర్ (CHC) పాడేరు' : 'Community Health Centre (CHC) Paderu'}</strong> • {currentLang === 'te' ? 'టెలిమెడిసిన్ కన్సల్టేషన్ డెస్క్' : 'Telemedicine Room 02'}
                </div>

                <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600, marginBottom: '8px' }}>
                  📅 <strong>{currentLang === 'te' ? 'నేడు ఉదయం 10:30 AM' : 'Today at 10:30 AM'}</strong> • {currentLang === 'te' ? 'ఆన్‌లైన్ వీడియో సంప్రదింపు' : 'Online Video Consultation'}
                </div>

                <div
                  style={{
                    fontSize: '0.76rem',
                    color: isDoctorCallActive ? '#a7f3d0' : '#94a3b8',
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  {isDoctorCallActive
                    ? currentLang === 'te'
                      ? '✓ మీ చికిత్సా వైద్యులు డాక్టర్ సోమశేఖర్ సెషన్‌ను ప్రారంభించారు. దయచేసి క్రింది బటన్ నొక్కి కాల్లో చేరండి.'
                      : '✓ Your treating doctor Dr. Somasekhar has started the call. Please join now.'
                    : currentLang === 'te'
                      ? '🔒 నిబంధన: మీ చికిత్సా వైద్యులు కాల్ ప్రారంభించినప్పుడు మాత్రమే మీరు చేరగలరు. రోగులు స్వయంగా కాల్ ప్రారంభించలేరు.'
                      : '🔒 Rule: The treating doctor initiates the call. Patient joins once the doctor is online.'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  style={{
                    background: isDoctorCallActive
                      ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                      : 'rgba(56, 189, 248, 0.15)',
                    color: '#ffffff',
                    border: isDoctorCallActive ? 'none' : '1px solid #38bdf8',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: isDoctorCallActive ? '0 4px 18px rgba(16, 185, 129, 0.4)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{isDoctorCallActive ? '📹' : '🔒'}</span>
                  <span>
                    {isDoctorCallActive
                      ? currentLang === 'te'
                        ? 'కాల్లో చేరండి (Join Call)'
                        : 'Join Video Consultation'
                      : currentLang === 'te'
                        ? 'వేచి ఉండే గది (Waiting Lobby)'
                        : 'Enter Waiting Lobby'}
                  </span>
                </button>

                {/* Simulation Trigger Toggle for Testing */}
                <button
                  type="button"
                  onClick={() => setIsDoctorCallActive(!isDoctorCallActive)}
                  style={{
                    background: 'transparent',
                    border: '1px dashed rgba(255, 255, 255, 0.25)',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                  }}
                  title="Simulate doctor starting or ending the consultation room"
                >
                  {isDoctorCallActive
                    ? currentLang === 'te'
                      ? '🔄 డెమో: డాక్టర్ కాల్ ఆపివేయండి (End Call)'
                      : currentLang === 'hi'
                      ? '🔄 डेमो: डॉक्टर कॉल समाप्त करें (End Call)'
                      : '🔄 Demo: Simulate Doctor End Call'
                    : currentLang === 'te'
                      ? '⚡ డెమో: డాక్టర్ కాల్ ప్రారంభించినట్లు చేయండి (Doctor Join)'
                      : currentLang === 'hi'
                      ? '⚡ डेमो: डॉक्टर कॉल शुरू करें (Doctor Join)'
                      : '⚡ Demo: Simulate Doctor Join Call'}
                </button>
              </div>
            </div>

            {/* Appointment Card 2: Completed In-Person Visit */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '18px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
                opacity: 0.9,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0' }}>
                    {currentLang === 'te'
                      ? 'డాక్టర్ రమేష్ కుమార్, MBBS (మెడికల్ ఆఫీసర్)'
                      : 'Dr. Ramesh Kumar, MBBS (Medical Officer)'}
                  </span>
                  <span className="dash-status-pill status-completed">
                    {currentLang === 'te' ? 'పూర్తయింది' : 'VISIT COMPLETED'}
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  🏥 {currentLang === 'te' ? 'సీహెచ్‌సీ పాడేరు • జనరల్ ఓపీడీ తనిఖీ' : 'CHC Paderu • General OPD Checkup'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  📅 04 Nov 2026 • {currentLang === 'te' ? 'నోటి శ్లేష్మ తనిఖీ పూర్తయింది. గోరువెచ్చని ఉప్పునీటి పుక్కిలింత సూచించబడింది.' : 'Verified no mucosal ulcerations. Prescribed warm saline gargle.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: MY MEDICAL REPORTS -------------------- */}
      {activeTab === 'reports' && (
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h3 className="dash-panel-title">
              <span>📄</span>
              <span>Diagnostic Reports &amp; Verified Records</span>
            </h3>
            <span className="dash-status-pill status-completed">CRYPTOGRAPHICALLY VERIFIED</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.96rem', marginBottom: '4px' }}>
                  Oral Mucosal Biopsy &amp; Screening Summary
                </div>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '4px' }}>
                  Report ID: <code>REP-PAD-2026-0819</code> • CHC Paderu Pathology Lab
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  Verified by Dr. K. Srinivas (BDS, MDS) • Cryptographic Hash: <code>a7b2...9f41</code>
                </div>
              </div>
              <button
                type="button"
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid #10b981',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
                onClick={() => alert('Diagnostic Report PDF generated successfully for patient ' + patientId)}
              >
                📥 Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: ORAL HEALTH EDUCATION -------------------- */}
      {activeTab === 'education' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="dash-panel">
            <h4 style={{ color: '#34d399', fontSize: '1.05rem', margin: '0 0 10px 0' }}>
              {currentLang === 'te' ? '🪥 1. సరైన బ్రషింగ్ విధానం' : '🪥 1. Proper Brushing Technique'}
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
              {currentLang === 'te'
                ? 'చిగుళ్ళ అంచు వద్ద 45 డిగ్రీల కోణంలో బ్రష్‌ను పట్టుకోండి. అటుఇటు గట్టిగా రుద్దకుండా గుండ్రంగా సున్నితంగా తిప్పండి. ప్రతి దంతం వెలుపలి, లోపలి మరియు నమిలే భాగాలను క్రమం తప్పకుండా శుభ్రం చేయండి.'
                : 'Hold the brush at a 45-degree angle towards the gumline. Use gentle, small circular motions rather than scrubbing side to side. Clean outer, inner, and chewing surfaces of every tooth.'}
            </p>
          </div>

          <div className="dash-panel">
            <h4 style={{ color: '#fbbf24', fontSize: '1.05rem', margin: '0 0 10px 0' }}>
              {currentLang === 'te' ? '🧂 2. గోరువెచ్చని ఉప్పునీటి పుక్కిలింత ప్రయోజనాలు' : '🧂 2. Benefits of Warm Saline Gargles'}
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
              {currentLang === 'te'
                ? 'గోరువెచ్చని ఉప్పునీటితో పుక్కిలించడం వల్ల నోటిలోని బ్యాక్టీరియా నశిస్తుంది, చిగుళ్ళ వాపు తగ్గుతుంది మరియు నోటి శ్లేష్మ పొర సహజంగా త్వరగా కోలుకుంటుంది.'
                : 'Warm salt-water rinsing reduces bacterial swelling, cleanses food debris from dental pockets, and creates an alkaline oral environment that speeds mucosal healing naturally.'}
            </p>
          </div>

          <div className="dash-panel">
            <h4 style={{ color: '#ef4444', fontSize: '1.05rem', margin: '0 0 10px 0' }}>
              {currentLang === 'te' ? '🚫 3. పొగాకు మరియు గుట్కా విముక్తి' : '🚫 3. Tobacco & Gutka De-Addiction'}
            </h4>
            <p style={{ color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
              {currentLang === 'te'
                ? 'తమలపాకులు, వక్కపొడి, గుట్కా మరియు ఖైనీ నమలడం వల్ల నోరు తెరుచుకోకపోవడం (OSMF) మరియు తీవ్రమైన మార్పులు వస్తాయి. సీహెచ్‌సీ పాడేరులో ఉచిత కౌన్సెలింగ్ మరియు నికోటిన్ నివారణ సహాయం అందుబాటులో ఉంది.'
                : 'Areca nut and processed tobacco contain chemical irritants that restrict mouth opening (OSMF) and alter mucosa. Free counseling and nicotine-replacement support are available at CHC Paderu.'}
            </p>
          </div>
        </div>
      )}

      {/* -------------------- TAB: DOCTOR & ASHA CARE TEAM -------------------- */}
      {activeTab === 'care-team' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <div className="dash-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                🩺
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1rem' }}>Dr. K. Srinivas, BDS, MDS</h4>
                <div style={{ color: '#38bdf8', fontSize: '0.82rem' }}>Senior Dental Officer • CHC Paderu</div>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45 }}>
              {currentLang === 'te'
                ? 'ఓపీడీ రోజులు: సోమ, బుధ, శుక్రవారాలు (ఉదయం 09:00 – మధ్యాహ్నం 01:30). నోటి శ్లేష్మ వ్యాధులు మరియు దంత చికిత్సలను పర్యవేక్షిస్తారు.'
                : 'Available OPD Days: Monday, Wednesday, Friday (09:00 AM – 01:30 PM). Handles advanced oral mucosal triage and restorations.'}
            </p>
          </div>

          <div className="dash-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
                👩‍⚕️
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1rem' }}>
                  {currentLang === 'te' ? 'లక్ష్మీ దేవి, ఆశా కార్యకర్త' : 'Lakshmi Devi, ASHA Staff'}
                </h4>
                <div style={{ color: '#34d399', fontSize: '0.82rem' }}>
                  {currentLang === 'te' ? 'డుంబ్రిగుడ గిరిజన ఆవాస సెక్టార్ 02' : 'Dumbriguda Tribal Habitation Sector 02'}
                </div>
              </div>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45 }}>
              {currentLang === 'te'
                ? 'మీ ప్రాంత ఫ్రంట్‌లైన్ ఆరోగ్య కార్యకర్త. ఇంటింటి తనిఖీలు, స్క్రీనింగ్ ఫాలో-అప్ మరియు సీహెచ్‌సీ పాడేరు ఆసుపత్రికి తోడుగా రావడంలో సహాయపడతారు.'
                : 'Your designated frontline health worker. Assists with home visits, screening follow-up, and accompaniment to CHC Paderu on OPD days.'}
            </p>
          </div>
        </div>
      )}

      {/* -------------------- TAB: NEARBY HOSPITALS -------------------- */}
      {activeTab === 'hospitals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <h4 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: '1.05rem' }}>
              🏥 {currentLang === 'te' ? 'కమ్యూనిటీ హెల్త్ సెంటర్ (CHC) పాడేరు' : 'Community Health Centre (CHC) Paderu'}
            </h4>
            <div style={{ color: '#38bdf8', fontSize: '0.84rem', marginBottom: '8px' }}>
              {currentLang === 'te' ? 'గిరిజన ప్రాంత ప్రాథమిక రిఫరల్ ఆసుపత్రి • దూరం: 8.4 కి.మీ' : 'Primary Referral Centre for Tribal Agency Area • Distance: 8.4 km from Dumbriguda'}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45, margin: 0 }}>
              {currentLang === 'te'
                ? 'దంత చికిత్సాలయం, డిజిటల్ రేడియోగ్రఫీ, అత్యవసర చికిత్స మరియు మైనర్ సర్జికల్ వార్డు సౌకర్యాలు ఉన్నాయి. 24/7 అత్యవసర సేవలు అందుబాటులో ఉంటాయి.'
                : 'Equipped with Dental Clinic, Digital Radiography, Emergency Care, and Minor Surgical Ward. Open 24/7 for emergency casualty.'}
            </p>
          </div>

          <div className="dash-panel">
            <h4 style={{ margin: '0 0 6px 0', color: '#ffffff', fontSize: '1.05rem' }}>
              🏥 {currentLang === 'te' ? 'ఏరియా హాస్పిటల్ అరకు లోయ' : 'Area Hospital Araku Valley'}
            </h4>
            <div style={{ color: '#38bdf8', fontSize: '0.84rem', marginBottom: '8px' }}>
              {currentLang === 'te' ? 'ద్వితీయ శ్రేణి ప్రభుత్వ ఆసుపత్రి • దూరం: పాడేరు నుండి 24 కి.మీ' : 'Secondary Hospital Centre • Distance: 24 km from Paderu'}
            </div>
            <p style={{ color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.45, margin: 0 }}>
              {currentLang === 'te'
                ? 'ఈఎన్‌టీ స్పెషలిస్ట్, ముఖ మరియు దవడ శస్త్రచికిత్స, సాధారణ శస్త్రచికిత్స మరియు కింగ్ జార్జ్ హాస్పిటల్ (KGH) విశాఖపట్నంతో టెలిమెడిసిన్ లింక్ కలిగి ఉంది.'
                : 'Specialist ENT, Maxillofacial, General Surgery, and Tele-medicine Consultation Link with King George Hospital (KGH) Visakhapatnam.'}
            </p>
          </div>
        </div>
      )}

      {/* -------------------- TAB: MY REFERRALS (Module 5) -------------------- */}
      {activeTab === 'referrals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                  {currentLang === 'te'
                    ? '🔄 నా స్పెషలిస్ట్ రిఫరల్స్ (Specialist Hospital Referrals)'
                    : currentLang === 'hi'
                    ? '🔄 मेरे विशेषज्ञ रेफरल (Specialist Hospital Referrals)'
                    : '🔄 My Specialist Hospital Referrals'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '2px' }}>
                  {currentLang === 'te'
                    ? 'పాడేరు CHC లేదా విశాఖ KGH ఆసుపత్రులకు వైద్యులు జారీ చేసిన అధికారిక రిఫరల్స్ మరియు స్థితి.'
                    : currentLang === 'hi'
                    ? 'पाडेरु सीएचसी या विशाखा केजीएच अस्पतालों के लिए डॉक्टरों द्वारा जारी आधिकारिक रेफरल और स्थिति।'
                    : 'Official specialist referrals issued by doctors to CHC Paderu or KGH Visakhapatnam.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => speakText(
                  currentLang === 'te'
                    ? 'మీకు కింగ్ జార్జ్ హాస్పిటల్ విశాఖపట్నంకు ఓరల్ సర్జరీ రిఫరల్ షెడ్యూల్ చేయబడింది. దయచేసి నిర్ణీత తేదీకి వెళ్లండి.'
                    : 'You have a referral to King George Hospital Visakhapatnam for specialist evaluation.'
                )}
                style={{ background: 'rgba(236, 72, 153, 0.2)', border: '1px solid #ec4899', color: '#f472b6', padding: '6px 12px', borderRadius: '16px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}
              >
                🔊 {currentLang === 'te' ? 'వినండి' : currentLang === 'hi' ? 'सुनें' : 'Listen'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              {referralsList.map((ref, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px 18px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🏥</span>
                      <strong style={{ color: '#ffffff', fontSize: '1rem' }}>{ref.destinationHospitalName}</strong>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: ref.status === 'SCHEDULED' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: ref.status === 'SCHEDULED' ? '#38bdf8' : '#34d399',
                        border: `1px solid ${ref.status === 'SCHEDULED' ? '#0284c7' : '#10b981'}`,
                      }}
                    >
                      ● {ref.status === 'SCHEDULED'
                        ? (currentLang === 'te' ? 'అపాయింట్‌మెంట్ షెడ్యూల్ అయింది' : currentLang === 'hi' ? 'अपॉइंटमेंट निर्धारित है' : 'Appointment Scheduled')
                        : (currentLang === 'te' ? 'హాజరయ్యారు' : currentLang === 'hi' ? 'उपस्थित हुए' : 'Attended')}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {currentLang === 'te' ? 'స్పెషాలిటీ:' : currentLang === 'hi' ? 'विशेषज्ञता:' : 'Specialty:'}{' '}
                    <strong style={{ color: '#f472b6' }}>{ref.specialty}</strong> •{' '}
                    {currentLang === 'te' ? 'రిఫర్ చేసిన వైద్యులు:' : currentLang === 'hi' ? 'रेफर करने वाले डॉक्टर:' : 'Referring Doctor:'}{' '}
                    {ref.referringDoctorName}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {currentLang === 'te' ? 'కారణం:' : currentLang === 'hi' ? 'कारण:' : 'Reason:'} {ref.reasonForReferral}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '2px' }}>
                    📅 {currentLang === 'te' ? 'షెడ్యూల్ తేదీ:' : currentLang === 'hi' ? 'निर्धारित तिथि:' : 'Scheduled Date:'}{' '}
                    {new Date(ref.scheduledFollowUpDate).toLocaleDateString(currentLang === 'te' ? 'te-IN' : currentLang === 'hi' ? 'hi-IN' : 'en-IN')} •{' '}
                    {currentLang === 'te' ? 'రిఫరల్ కోడ్:' : currentLang === 'hi' ? 'रेफरल कोड:' : 'Referral Code:'}{' '}
                    <code style={{ fontWeight: 700 }}>{ref.referralId}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: MY PRESCRIPTIONS (Module 6 & 7) -------------------- */}
      {activeTab === 'prescriptions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
                  {currentLang === 'te'
                    ? '💊 నా డిజిటల్ మందుల చీటీలు (My Prescriptions)'
                    : currentLang === 'hi'
                    ? '💊 मेरे डिजिटल नुस्खे (My Prescriptions)'
                    : '💊 My Digital Prescriptions'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '2px' }}>
                  {currentLang === 'te'
                    ? 'వైద్యులు ధృవీకరించి సూచించిన మందులు, మోతాదు మరియు జీవనశైలి మార్గదర్శకాలు.'
                    : currentLang === 'hi'
                    ? 'डॉक्टरों द्वारा प्रमाणित और निर्धारित दवाएं, खुराक और जीवनशैली दिशानिर्देश।'
                    : 'Doctor-verified prescribed medications, dosages, and lifestyle care instructions.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => speakText(
                  currentLang === 'te'
                    ? 'మీకు డాక్టర్ సోమశేఖర్ గారు క్లోట్రిమజోల్ మౌత్ పెయింట్ మరియు విటమిన్ బి కాంప్లెక్స్ మాత్రలు సూచించారు.'
                    : 'Your active prescription includes Clotrimazole mouth paint and Vitamin B-Complex.'
                )}
                style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', padding: '6px 12px', borderRadius: '16px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 700 }}
              >
                🔊 {currentLang === 'te' ? 'వినండి' : currentLang === 'hi' ? 'सुनें' : 'Listen'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {prescriptionsList.map((rx, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1.5px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '1.05rem' }}>
                        {rx.diagnosisImpression}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        {currentLang === 'te' ? 'చీటీ సంఖ్య:' : currentLang === 'hi' ? 'पर्चा सं.:' : 'Rx ID:'}{' '}
                        <code style={{ color: '#38bdf8', fontWeight: 700 }}>{rx.prescriptionId}</code> •{' '}
                        {currentLang === 'te' ? 'వైద్యులు:' : currentLang === 'hi' ? 'डॉक्टर:' : 'Doctor:'} {rx.doctorName} ({rx.hospitalName})
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedPrescription(rx)}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        background: '#059669',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                      }}
                    >
                      {currentLang === 'te'
                        ? '🖨️ పూర్తి చీటీ చూడండి (View & Print Rx)'
                        : currentLang === 'hi'
                        ? '🖨️ पूरा पर्चा देखें (View & Print Rx)'
                        : '🖨️ View & Print Prescription (Rx)'}
                    </button>
                  </div>

                  {/* Medicines Summary */}
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#a7f3d0', fontWeight: 700, marginBottom: '6px' }}>
                      {currentLang === 'te' ? 'సూచించిన మందులు (Medicines):' : currentLang === 'hi' ? 'निर्धारित दवाएं (Medicines):' : 'Prescribed Medicines:'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {rx.medicines.map((m: any, mIdx: number) => (
                        <div
                          key={mIdx}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            fontSize: '0.78rem',
                            color: '#f8fafc',
                          }}
                        >
                          <strong>{m.medicineName}</strong> • <span style={{ color: '#38bdf8' }}>{m.dosage}</span> ({m.frequency})
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB: HEALTH HISTORY (Module 1 & 6) -------------------- */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dash-panel">
            <h3 style={{ margin: '0 0 12px 0', color: '#ffffff', fontSize: '1.2rem', fontWeight: 800 }}>
              {currentLang === 'te'
                ? '📜 నా వైద్య & స్క్రీనింగ్ చరిత్ర (Medical History Timeline)'
                : currentLang === 'hi'
                ? '📜 मेरा चिकित्सा एवं स्क्रीनिंग इतिहास (Medical History Timeline)'
                : '📜 My Medical & Screening History Timeline'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', borderLeft: '4px solid #10b981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <span>09 Nov 2026</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>AI + Multimodal Vision Complete</span>
                </div>
                <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>
                  {currentLang === 'te'
                    ? 'ఓరల్ శ్లేష్మ ఫోటో స్క్రీనింగ్ (Lower Labial Mucosa)'
                    : currentLang === 'hi'
                    ? 'ओरल म्यूकोसा फोटो स्क्रीनिंग (Lower Labial Mucosa)'
                    : 'Oral Mucosa Photo Screening (Lower Labial Mucosa)'}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  {currentLang === 'te'
                    ? 'ప్రాథమిక మోడల్ మరియు జెమినీ క్లినికల్ విజన్ విశ్లేషణ: కాండిడియాసిస్ పూత పరిశీలించబడింది. CHC పాడేరు దంత విభాగానికి రిఫర్ చేయబడింది.'
                    : currentLang === 'hi'
                    ? 'प्राथमिक मॉडल और जेमिनी क्लीनिकल विज़न विश्लेषण: कैंडिडिआसिस पैच पाया गया। सीएचसी पाडेरु दंत चिकित्सा विभाग को रेफर किया गया।'
                    : 'Primary neural model & Gemini Clinical Vision analysis: Candidiasis lesion observed. Referred to CHC Paderu Dental Department.'}
                </p>
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.03)', borderLeft: '4px solid #38bdf8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <span>24 Oct 2026</span>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>Frontline Camp Screened</span>
                </div>
                <div style={{ fontWeight: 700, color: '#ffffff', marginTop: '4px' }}>
                  {currentLang === 'te'
                    ? 'డుంబ్రిగుడ మొబైల్ ట్రైబల్ హెల్త్ క్యాంప్'
                    : currentLang === 'hi'
                    ? 'डुंब्रिगुडा मोबाइल आदिवासी स्वास्थ्य शिविर'
                    : 'Dumbriguda Mobile Tribal Health Camp'}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  {currentLang === 'te'
                    ? 'ఆశా కార్యకర్త ఆధ్వర్యంలో పౌష్టికాహార పంపిణీ మరియు ప్రాథమిక నోటి తనిఖీ నిర్వహించబడింది.'
                    : currentLang === 'hi'
                    ? 'आशा कार्यकर्ता की देखरेख में पोषण आहार वितरण और प्राथमिक मौखिक जांच की गई।'
                    : 'Frontline screening and nutritional counseling conducted by ASHA worker.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WEBRTC LIVE VIDEO CONSULTATION MODAL (Module 4) */}
      {showVideoModal && (
        <LiveVideoConsultationModal
          consultationId={activeConsultationId}
          patientName={patientName}
          doctorName="Dr. K. Somasekhar (MO)"
          doctorSpecialty="Dental Surgeon & Oral Medicine"
          hospitalName="Community Health Centre (CHC) Paderu"
          userRole="patient"
          currentLang={currentLang}
          onClose={() => setShowVideoModal(false)}
        />
      )}

      {/* PRINTABLE DIGITAL PRESCRIPTION CARD VIEW (Module 6 & 7) */}
      {selectedPrescription && (
        <PrescriptionCardView
          prescription={selectedPrescription}
          currentLang={currentLang}
          onClose={() => setSelectedPrescription(null)}
        />
      )}

      {/* GEMINI API KEY CONFIGURATION MODAL */}
      {showApiKeyModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              background: '#0d1b2a',
              border: '1.5px solid #10b981',
              borderRadius: '16px',
              padding: '24px',
              color: '#ffffff',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, color: '#34d399', fontSize: '1.18rem', fontWeight: 700 }}>
                ✨ Google Gemini Multimodal API Key
              </h3>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '14px' }}>
              Enter your Google AI Studio Gemini API key to enable direct 2-tier multimodal clinical verification. When the primary neural model has low confidence or ambiguity, Gemini will analyze the photo to verify and correct the diagnosis.
            </p>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '0.9rem',
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setGeminiApiKey('');
                  try {
                    localStorage.removeItem('aarogya_gemini_api_key');
                  } catch {}
                  setShowApiKeyModal(false);
                }}
                style={{
                  background: 'transparent',
                  color: '#f87171',
                  border: '1px solid #ef4444',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                Clear Key
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = tempApiKey.trim();
                    setGeminiApiKey(trimmed);
                    try {
                      if (trimmed) {
                        localStorage.setItem('aarogya_gemini_api_key', trimmed);
                      } else {
                        localStorage.removeItem('aarogya_gemini_api_key');
                      }
                    } catch {}
                    setShowApiKeyModal(false);
                  }}
                  style={{
                    background: '#10b981',
                    color: '#022c22',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                  }}
                >
                  Save Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default PatientDashboard;

