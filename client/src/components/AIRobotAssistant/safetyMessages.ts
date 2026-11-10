/**
 * AAROGYA-DRISHTI CLINICAL SAFETY & MULTILINGUAL VOICE MESSAGES
 * 
 * Centralized, clinician-reviewable file for:
 * 1. AI Voice session disclaimers ("I am an AI assistant, not a doctor")
 * 2. Red-flag clinical escalation guidance (ulcers > 2-3 weeks, white/red patches, lumps, bleeding, dysphagia)
 * 3. Voice UI status messages, error handling, and permission prompts in Telugu, Hindi, and English.
 * 
 * INVARIANT COMPLIANCE:
 * - Invariant 1: No diagnostic claims or definitive staging.
 * - Always directs the patient to an in-person clinician examination.
 */

export type VoiceLanguage = 'te-IN' | 'hi-IN' | 'en-IN';
export type VoiceLanguageCode = 'te' | 'hi' | 'en';

export interface SafetyDisclaimer {
  spokenText: string;
  writtenText: string;
}

export interface RedFlagRule {
  id: string;
  keywords: {
    en: string[];
    te: string[];
    hi: string[];
  };
  spokenAdvice: Record<VoiceLanguageCode, string>;
  writtenAdvice: Record<VoiceLanguageCode, string>;
  urgency: 'high' | 'immediate';
}

/**
 * Voice session start disclaimer.
 * Spoken once when a user initiates a voice session.
 */
export const VOICE_SESSION_DISCLAIMER: Record<VoiceLanguageCode, SafetyDisclaimer> = {
  te: {
    spokenText: 'నేను ఒక ఏఐ సహాయకురాలిని మాత్రమే, వైద్యురాలిని కాదు. నా సలహాలు సాధారణ సమాచారం కొరకు మాత్రమే. డాక్టర్ పరీక్ష తప్పనిసరి.',
    writtenText: '⚠️ **గమనిక:** నేను ఆరోగ్య దృష్టి ఏఐ సహాయకురాలిని మాత్రమే, అర్హత కలిగిన వైద్యురాలిని కాదు. నా సమాచారం ప్రాథమిక ఆరోగ్య అవగాహన కొరకు మాత్రమే. రోగ నిర్ధారణ లేదా చికిత్స కోసం తప్పనిసరిగా వైద్యుడిని లేదా ఆశా కార్యకర్తను సంప్రదించండి.',
  },
  hi: {
    spokenText: 'मैं एक एआई सहायक हूँ, डॉक्टर नहीं। मेरी सलाह केवल सामान्य जानकारी के लिए है। डॉक्टर की जांच आवश्यक है।',
    writtenText: '⚠️ **सूचना:** मैं आरोग्य दृष्टि एआई सहायक हूँ, प्रमाणित डॉक्टर नहीं। मेरी सलाह केवल प्राथमिक स्वास्थ्य मार्गदर्शन के लिए है। किसी भी चिकित्सीय जांच या दवा के लिए कृपया स्वास्थ्य केंद्र में डॉक्टर या आशा कार्यकर्ता से मिलें।',
  },
  en: {
    spokenText: 'I am an AI assistant, not a doctor. My advice is for general health guidance only. A clinical examination by a doctor is required.',
    writtenText: '⚠️ **Notice:** I am an AI health assistant, not a medical doctor. My responses are for informational and triage guidance only. Always consult a qualified clinician or health worker for in-person evaluation and care.',
  },
};

/**
 * Clinical Red-Flag Escalation Rules
 * Any red-flag symptom immediately prompts the assistant to advise seeing a clinician or emergency care.
 */
export const RED_FLAG_SYMPTOM_RULES: RedFlagRule[] = [
  {
    id: 'emergency-bleeding-breathing',
    keywords: {
      en: ['choking', 'cannot breathe', 'difficulty breathing', 'severe bleeding', 'heavy bleeding', 'uncontrolled bleeding', 'chest pain', 'unconscious'],
      te: ['రక్తం ఆగడం లేదు', 'శ్వాస ఆడటం లేదు', 'ఊపిరి ఆడట్లేదు', 'రక్తం కారుతోంది', 'తీవ్రమైన నొప్పి', 'స్పృహ తప్పడం'],
      hi: ['खून नहीं रुक रहा', 'सांस नहीं आ रही', 'सांस लेने में तकलीफ', 'भारी रक्तस्राव', 'बेहोश', 'गंभीर स्थिति'],
    },
    urgency: 'immediate',
    spokenAdvice: {
      te: 'ఇది అత్యవసర పరిస్థితి. దయచేసి వెంటనే అత్యవసర అంబులెన్స్ నంబర్ 108 కి కాల్ చేయండి లేదా దగ్గరలోని ఆసుపత్రి ఎమర్జెన్సీ విభాగానికి వెళ్ళండి.',
      hi: 'यह एक आपातकालीन स्थिति है। कृपया तुरंत 108 एम्बुलेंस को कॉल करें या निकटतम अस्पताल के आपातकालीन विभाग में जाएं।',
      en: 'This requires immediate emergency care. Please call emergency services at 108 immediately or go to the nearest hospital casualty department.',
    },
    writtenAdvice: {
      te: '🚨 **తక్షణ అత్యవసర హెచ్చరిక:** ఈ లక్షణాలకు వెంటనే అత్యవసర వైద్య సంరక్షణ అవసరం. దయచేసి ఆలస్యం చేయకుండా 108 అంబులెన్స్‌కు కాల్ చేయండి లేదా సమీప ప్రభుత్వ ఆసుపత్రి అత్యవసర విభాగాన్ని ఆశ్రయించండి.',
      hi: '🚨 **तत्काल आपातकालीन सूचना:** इन लक्षणों में तुरंत चिकित्सीय सहायता आवश्यक है। कृपया बिना देरी किए 108 एम्बुलेंस को कॉल करें या नजदीकी अस्पताल के आपातकालीन कक्ष में जाएं।',
      en: '🚨 **Immediate Emergency Alert:** These symptoms require prompt in-person medical care. Please call 108 emergency ambulance or visit your nearest hospital emergency department immediately.',
    },
  },
  {
    id: 'persistent-ulcer-patch',
    keywords: {
      en: ['ulcer', 'sore', 'patch', 'white patch', 'red patch', 'more than 2 weeks', 'more than 3 weeks', 'not healing', 'burning sensation', 'lesion'],
      te: ['పుండు', 'పుండ్లు', 'తెల్లటి మచ్చ', 'ఎర్రటి మచ్చ', 'రెండు వారాలు', 'మూడు వారాలు', 'మానడం లేదు', 'మంట', 'నొప్పి'],
      hi: ['छाला', 'छाले', 'सफेद दाग', 'लाल दाग', 'दो हफ्ते', 'तीन हफ्ते', 'ठीक नहीं हो रहा', 'घाव', 'जलन'],
    },
    urgency: 'high',
    spokenAdvice: {
      te: 'నోటిలో రెండు లేదా మూడు వారాల కంటే ఎక్కువ రోజులు తగ్గని పుండ్లు లేదా మచ్చలు ఉంటే వెంటనే డాక్టర్‌కు చూపించుకోవాలి. మీ స్థానిక ఆశా కార్యకర్తను లేదా పిహెచ్‌సి వైద్యుడిని సంప్రదించండి.',
      hi: 'यदि मुंह का छाला या दाग दो से तीन सप्ताह से ठीक नहीं हो रहा है, तो तुरंत डॉक्टर को दिखाना चाहिए। अपनी आशा कार्यकर्ता या नजदीकी स्वास्थ्य केंद्र में परामर्श लें।',
      en: 'Any mouth ulcer or patch that does not heal within 2 to 3 weeks should be examined by a clinician. Please visit your local Primary Health Centre or consult your ASHA worker promptly.',
    },
    writtenAdvice: {
      te: '⚠️ **క్లినికల్ మార్గదర్శకం:** నోటిలో 2-3 వారాలకు మించి తగ్గని పుండ్లు, ఎర్రటి లేదా తెల్లటి మచ్చలు ముందస్తు పరిశీలన కోరతాయి. దయచేసి మీ ప్రాంత ప్రాథమిక ఆరోగ్య కేంద్రం (PHC) లేదా పాడేరు జిల్లా ఆసుపత్రిలో పరీక్ష చేయించుకోండి.',
      hi: '⚠️ **क्लिनिकल परामर्श:** मुंह में दो से तीन सप्ताह से अधिक समय से मौजूद छाले, सफेद या लाल पैच की चिकित्सकीय जांच जरूरी है। कृपया अपने नजदीकी प्राथमिक स्वास्थ्य केंद्र या जिला अस्पताल में डॉक्टर से संपर्क करें।',
      en: '⚠️ **Clinical Guidance:** Any mouth ulcer, white patch, or red patch persisting beyond 2 to 3 weeks requires direct clinical visual examination. Please visit your Primary Health Centre (PHC) or Community Health Centre for screening.',
    },
  },
  {
    id: 'lump-swelling-difficulty-swallowing',
    keywords: {
      en: ['lump', 'swelling', 'difficulty swallowing', 'cannot open mouth', 'restricted mouth opening', 'hoarseness', 'loose teeth', 'numbness'],
      te: ['గడ్డ', 'వాపు', 'మింగలేక పోవడం', 'నోరు తెరవలేకపోవడం', 'గొంతు బొంగురుపోవడం', 'పళ్ళు కదలడం', 'తిమ్మిరి'],
      hi: ['गांठ', 'सूजन', 'निगलने में परेशानी', 'मुंह नहीं खुल रहा', 'गला बैठना', 'दांत हिलना', 'सुन्न होना'],
    },
    urgency: 'high',
    spokenAdvice: {
      te: 'నోటిలో లేదా మెడలో గడ్డలు, నోరు తెరవడంలో లేదా మింగడంలో ఇబ్బంది ఉంటే ఏమాత్రం ఆలస్యం చేయకుండా వైద్యుడిని సంప్రదించండి.',
      hi: 'मुंह या गर्दन में गांठ, निगलने में कठिनाई या मुंह पूरा न खुलने पर बिना देरी के डॉक्टर से परामर्श लें।',
      en: 'A lump in the mouth or neck, difficulty swallowing, or restricted mouth opening should be evaluated by a healthcare professional without delay.',
    },
    writtenAdvice: {
      te: '⚠️ **ముఖ్యమైన సూచన:** నోటిలో గడ్డలు, దవడ కదలికలో ఇబ్బంది లేదా ఆహారం మింగడంలో సమస్యలు ఉన్నప్పుడు డాక్టర్ శారీరక పరీక్ష అవసరం. మీ దగ్గరి ఆసుపత్రిలో సంప్రదించండి.',
      hi: '⚠️ **महत्वपूर्ण सूचना:** मुंह या गर्दन में गांठ, मुंह खोलने में दिक्कत या निगलने में कठिनाई होने पर डॉक्टर से प्रत्यक्ष जांच आवश्यक है। नजदीकी स्वास्थ्य केंद्र से संपर्क करें।',
      en: '⚠️ **Important Guidance:** Palpable lumps in the mouth or neck, restricted jaw movement, or difficulty swallowing require in-person clinical palpation and assessment by a medical officer.',
    },
  },
];

/**
 * Status strings and error prompts across all supported languages
 */
export const VOICE_STATUS_TEXT: Record<VoiceLanguageCode, {
  idle: string;
  listening: string;
  processing: string;
  speaking: string;
  error: string;
  micPermissionDenied: string;
  micPermissionHowTo: string;
  noMicrophoneFound: string;
  sttUnsupported: string;
  noSpeechDetected: string;
  networkOffline: string;
  aiTimeout: string;
  noSuitableVoice: string;
  ttsFailed: string;
  stopSpeaking: string;
  continuousModeOn: string;
  continuousModeOff: string;
  textFallbackHint: string;
  restartConversation: string;
  micPrivacyDisclosure: string;
}> = {
  te: {
    idle: 'మాట్లాడటానికి మైక్ నొక్కండి',
    listening: 'వింటున్నాను... మాట్లాడండి',
    processing: 'ఆలోచిస్తున్నాను...',
    speaking: 'సమాధానం చెబుతున్నాను...',
    error: 'సమస్య ఎదురైంది',
    micPermissionDenied: 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది.',
    micPermissionHowTo: 'మైక్రోఫోన్ ప్రారంభించడానికి: బ్రౌజర్ చిరునామా పట్టీలోని తాళం గుర్తు (Lock) లేదా కెమెరా/మైక్ ఐకాన్‌ను క్లిక్ చేసి, మైక్రోఫోన్‌ను Allow (అనుమతించు) చేయండి.',
    noMicrophoneFound: 'మీ పరికరంలో మైక్రోఫోన్ కనుగొనబడలేదు. దయచేసి టైప్ చేయండి.',
    sttUnsupported: 'ఈ బ్రౌజర్‌లో వాయిస్ రికగ్నిషన్ సదుపాయం లేదు. దయచేసి Google Chrome లేదా Safari బ్రౌజర్ ఉపయోగించండి లేదా టైప్ చేయండి.',
    noSpeechDetected: 'మాటలు స్పష్టంగా వినబడలేదు. దయచేసి మరలా మాట్లాడండి లేదా టైప్ చేయండి.',
    networkOffline: 'ఇంటర్నెట్ కనెక్షన్ అందుబాటులో లేదు. ఆఫ్‌లైన్ నాలెడ్జ్ బేస్ ఉపయోగించబడుతోంది.',
    aiTimeout: 'సమాధానం ఇవ్వడంలో ఆలస్యం అయింది. దయచేసి మరొకసారి ప్రయత్నించండి.',
    noSuitableVoice: 'ఈ పరికరంలో తెలుగు వాయిస్ అందుబాటులో లేదు. సమాధానం టెక్స్ట్ రూపంలో చూపబడుతుంది.',
    ttsFailed: 'వాయిస్ ప్లే చేయడంలో సమస్య ఏర్పడింది. దయచేసి టెక్స్ట్ చదవండి.',
    stopSpeaking: 'మాట్లాడటం ఆపు',
    continuousModeOn: 'నిరంతర సంభాషణ: ఆన్',
    continuousModeOff: 'నిరంతర సంభాషణ: ఆఫ్',
    textFallbackHint: 'మీరు ఎప్పుడైనా క్రింద ఉన్న బాక్స్‌లో టైప్ చేయవచ్చు.',
    restartConversation: 'సంభాషణను మళ్ళీ ప్రారంభించండి',
    micPrivacyDisclosure: 'గమనిక: బ్రౌజర్ వాయిస్ రికగ్నిషన్ ద్వారా మీ మాటలు బ్రౌజర్ సర్వర్‌లకు పంపబడవచ్చు. వ్యక్తిగత గుర్తింపు వివరాలను చాట్‌లో చెప్పవద్దు.',
  },
  hi: {
    idle: 'बोलने के लिए माइक दबाएं',
    listening: 'सुन रही हूँ... बोलिए',
    processing: 'सोच रही हूँ...',
    speaking: 'बोल रही हूँ...',
    error: 'त्रुटि हुई',
    micPermissionDenied: 'माइक्रोफ़ोन की अनुमति अस्वीकृत कर दी गई है।',
    micPermissionHowTo: 'माइक चालू करने के लिए: ब्राउज़र एड्रेस बार में ताले के निशान (Lock icon) पर क्लिक करें और Microphone को Allow (अनुमति) दें।',
    noMicrophoneFound: 'माइक्रोफ़ोन नहीं मिला। कृपया टेक्स्ट बॉक्स में टाइप करें।',
    sttUnsupported: 'इस ब्राउज़र में वॉइस पहचान उपलब्ध नहीं है। कृपया Chrome का उपयोग करें या टाइप करें।',
    noSpeechDetected: 'कोई आवाज़ सुनाई नहीं दी। कृपया फिर से बोलें या लिखकर पूछें।',
    networkOffline: 'नेटवर्क उपलब्ध नहीं है। ऑफलाइन स्वास्थ्य जानकारी दिखाई जा रही है।',
    aiTimeout: 'उत्तर मिलने में समय लग रहा है। कृपया पुनः प्रयास करें।',
    noSuitableVoice: 'इस डिवाइस पर हिंदी वॉइस उपलब्ध नहीं है। उत्तर स्क्रीन पर प्रदर्शित है।',
    ttsFailed: 'आवाज़ सुनाने में समस्या हुई। कृपया टेक्स्ट पढ़ें।',
    stopSpeaking: 'बोलना रोकें',
    continuousModeOn: 'निरंतर बातचीत: चालू',
    continuousModeOff: 'निरंतर बातचीत: बंद',
    textFallbackHint: 'आप नीचे दिए गए बॉक्स में कभी भी टाइप कर सकते हैं।',
    restartConversation: 'बातचीत रीस्टार्ट करें',
    micPrivacyDisclosure: 'सूचना: ब्राउज़र वॉइस सेवा के माध्यम से आपकी आवाज़ ब्राउज़र सर्वर पर जा सकती है। कोई व्यक्तिगत गोपनीय जानकारी न बताएं।',
  },
  en: {
    idle: 'Tap mic to speak',
    listening: 'Listening… speak now',
    processing: 'Thinking…',
    speaking: 'Speaking…',
    error: 'An issue occurred',
    micPermissionDenied: 'Microphone permission was denied.',
    micPermissionHowTo: 'To enable microphone: Click the padlock or site settings icon in the browser address bar, and set Microphone to "Allow".',
    noMicrophoneFound: 'No microphone was detected on this device. You can type your query below.',
    sttUnsupported: 'Speech recognition is not supported in this browser. Please use Chrome or Safari, or continue by typing.',
    noSpeechDetected: 'No speech was detected. Please tap the mic and speak again, or type below.',
    networkOffline: 'Network connection is unavailable. Using offline healthcare knowledge.',
    aiTimeout: 'The response timed out. Please try your question again.',
    noSuitableVoice: 'A suitable voice is not available for this language on this device. Displaying text response.',
    ttsFailed: 'Speech playback could not be started. Please read the text response.',
    stopSpeaking: 'Stop Speaking',
    continuousModeOn: 'Continuous Conversation: ON',
    continuousModeOff: 'Continuous Conversation: OFF',
    textFallbackHint: 'You can always type your message below.',
    restartConversation: 'Restart Conversation',
    micPrivacyDisclosure: 'Note: Browser speech recognition may process audio through browser vendor servers. Avoid sharing sensitive personal IDs in voice.',
  },
};
