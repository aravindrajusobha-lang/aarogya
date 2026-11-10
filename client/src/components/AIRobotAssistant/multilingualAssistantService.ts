import { LanguageCode } from '../../i18n';

export interface AssistantAnswer {
  answerText: string;
  speechText: string;
  language: LanguageCode;
  topic: string;
  animation: 'idle' | 'speaking' | 'thinking' | 'success' | 'error';
  navigateTo?: string | null;
  suggestedActions?: string[];
  doctorRecommendation?: {
    specialty: string;
    facility: string;
    urgency: string;
    timelineDays: number;
    consultationReason: string;
  };
  photoAnalysis?: any;
}

interface ModuleDoc {
  name: Record<LanguageCode, string>;
  summary: Record<LanguageCode, string>;
  instructions: Record<LanguageCode, string[]>;
  tabId: string;
}

export const APPLICATION_MODULES: Record<string, ModuleDoc> = {
  dashboard: {
    tabId: 'dashboard',
    name: {
      en: 'Operations Dashboard',
      te: 'కమాండ్ డాష్‌బోర్డ్',
      hi: 'ऑपरेशंस डैशबोर्ड',
      ta: 'கட்டளை டாஷ்போர்டு',
      kn: 'ಕಾರ್ಯಾಚರಣೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
      ml: 'ഓപ്പറേഷൻസ് ഡാഷ്‌ബോർഡ്',
    },
    summary: {
      en: 'The Operations Dashboard displays real-time screening metrics, clinical triage queues, outreach statistics, and district-level operational health data across Alluri Sitharama Raju district.',
      te: 'ఆపరేషన్స్ డాష్‌బోర్డ్ అల్లూరి సీతారామరాజు జిల్లా అంతటా రియల్-టైమ్ స్క్రీనింగ్ గణాంకాలు, క్లినికల్ సమీక్ష క్యూ మరియు శిబిరాల పురోగతిని ప్రదర్శిస్తుంది.',
      hi: 'ऑपरेशंस डैशबोर्ड अल्लूरी सीताराम राजू जिले में रियल-टाइम स्क्रीनिंग आंकड़े, क्लिनिकल समीक्षा कतार और स्वास्थ्य शिविर प्रगति प्रदर्शित करता है।',
      ta: 'கட்டளை டாஷ்போர்டு அல்லூரி சீதாராம ராஜு மாவட்டம் முழுவதும் நிகழ்நேர பரிசோதனை புள்ளிவிவரங்கள் மற்றும் சுகாதார முகாம் முன்னேற்றத்தைக் காட்டுகிறது.',
      kn: 'ಕಾರ್ಯಾಚರಣೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಎಎಸ್‌ಆರ್ ಜಿಲ್ಲೆಯಾದ್ಯಂತ ನೈಜ-ಸಮಯದ ತಪಾಸಣಾ ಅಂಕಿಅಂಶಗಳು ಮತ್ತು ಆರೋಗ್ಯ ಶಿಬಿರಗಳ ಪ್ರಗತಿಯನ್ನು ಪ್ರದರ್ಶಿಸುತ್ತದೆ.',
      ml: 'ഓപ്പറേഷൻസ് ഡാഷ്‌ബോർഡ് തത്സമയ സ്ക്രീനിംഗ് വിവരങ്ങളും ആരോഗ്യ ക്യാമ്പുകളുടെ പുരോഗതിയും കാണിക്കുന്നു.',
    },
    instructions: {
      en: [
        'Review total screenings recorded across tribal habitations.',
        'Inspect preliminary risk tier distribution (Tier 1 Routine, Tier 2 PHC MO, Tier 3 Priority).',
        'Monitor Medical Officer review queue backlog and referral status.',
      ],
      te: [
        'గిరిజన ప్రాంతాల్లో నమోదైన మొత్తం స్క్రీనింగ్‌లను సమీక్షించండి.',
        'ప్రాథమిక ప్రమాద వర్గీకరణ పంపిణీని తనిఖీ చేయండి (టైర్ 1, టైర్ 2, టైర్ 3).',
        'మెడికల్ ఆఫీసర్ సమీక్ష మరియు రెఫరల్ స్థితిని పర్యవేక్షించండి.',
      ],
      hi: [
        'आदिवासी बस्तियों में कुल स्क्रीनिंग रिकॉर्ड की समीक्षा करें।',
        'प्राथमिक जोखिम श्रेणी वितरण की जाँच करें।',
        'चिकित्सा अधिकारी समीक्षा कतार की स्थिति पर नजर रखें।',
      ],
      ta: [
        'பழங்குடியினர் குடியிருப்புகளில் பதிவு செய்யப்பட்ட பரிசோதனைகளை மதிப்பாய்வு செய்யவும்.',
        'பரிசோதனை இடர் வகைப்பாட்டைச் சரிபார்க்கவும்.',
        'மருத்துவ அதிகாரி மறுஆய்வு நிலையை கண்காணிக்கவும்.',
      ],
      kn: [
        'ದಾಖಲಾದ ಒಟ್ಟು ತಪಾಸಣೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
        'ಪ್ರಾಥಮಿಕ ಅಪಾಯದ ವರ್ಗೀಕರಣವನ್ನು ವೀಕ್ಷಿಸಿ.',
        'ವೈದ್ಯಾಧಿಕಾರಿ ಪರಿಶೀಲನಾ ಸರತಿಯನ್ನು ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಿ.',
      ],
      ml: [
        'രേഖപ്പെടുത്തിയ സ്ക്രീനിംഗുകൾ അവലോകനം ചെയ്യുക.',
        'പ്രാഥമിക റിസ്ക് വിവരങ്ങൾ പരിശോധിക്കുക.',
        'മെഡിക്കൽ ഓഫീസർ അവലോകന പുരോഗതി നിരീക്ഷിക്കുക.',
      ],
    },
  },

  'asr-map': {
    tabId: 'asr-map',
    name: {
      en: 'ASR District Map',
      te: 'ASR జిల్లా మ్యాప్',
      hi: 'ASR जिला मानचित्र',
      ta: 'ASR மாவட்ட வரைபடம்',
      kn: 'ASR ಜಿಲ್ಲಾ ನಕ್ಷೆ',
      ml: 'ASR ജില്ലാ ഭൂപടം',
    },
    summary: {
      en: 'Interactive GIS spatial visualization of Alluri Sitharama Raju district covering 22 mandals and over 3,900 tribal habitations with privacy-preserving small-count cell suppression (< 5).',
      te: '22 మండలాలు మరియు 3,900 పైగా గిరిజన గ్రామాలతో కూడిన ASR జిల్లా ఇంటరాక్టివ్ భౌగోళిక మ్యాప్. రోగి గోప్యత కోసం 5 కంటే తక్కువ గణనలు నిరోధించబడతాయి.',
      hi: 'अल्लूरी सीताराम राजू जिले का इंटरएक्टिव जीआईएस मानचित्र, जिसमें 22 मंडल और 3,900 से अधिक बस्तियां शामिल हैं। डेटा गोपनीयता हेतु 5 से कम संख्या छिपाई जाती है।',
      ta: '22 மண்டலங்களை உள்ளடக்கிய ASR மாவட்ட வரைபடம். நோயாளி தனியுரிமைக்காக 5 க்கும் குறைவான எண்ணிக்கை மறைக்கப்படுகிறது.',
      kn: '22 ಮಂಡಲಗಳನ್ನು ಒಳಗೊಂಡ ASR ಜಿಲ್ಲೆಯ ನಕ್ಷೆ. ರೋಗಿಯ ಗೌಪ್ಯತೆಗಾಗಿ 5 ಕ್ಕಿಂತ ಕಡಿಮೆ ಸಂಖ್ಯೆಯನ್ನು ಮರೆಮಾಡಲಾಗಿದೆ.',
      ml: '22 മണ്ഡലങ്ങൾ ഉൾക്കൊള്ളുന്ന എഎസ്ആർ ജില്ലാ ഭൂപടം. രോഗികളുടെ സ്വകാര്യതയ്ക്കായി ചെറിയ സംഖ്യകൾ (< 5) മറച്ചിരിക്കുന്നു.',
    },
    instructions: {
      en: [
        'Select any mandal (e.g. Paderu, Araku Valley, Dumbriguda, Chintapalli) to inspect local habitations.',
        'View screening coverage density and health facility proximities.',
        'Filter habitations by accessibility status and connectivity.',
      ],
      te: [
        'స్థానిక నివాసాలను పరిశీలించడానికి ఏదైనా మండలాన్ని ఎంచుకోండి (పాడేరు, అరకు, డుంబ్రిగుడ).',
        'స్క్రీనింగ్ సాంద్రత మరియు ఆరోగ్య కేంద్రాల దూరాన్ని చూడండి.',
        'రవాణా సౌకర్యాల ఆధారంగా గ్రామాలను ఫిల్టర్ చేయండి.',
      ],
      hi: [
        'स्थानीय बस्तियों को देखने के लिए किसी भी मंडल (पाडेरु, अराकू, डुम्ब्रिगुडा) का चयन करें।',
        'स्क्रीनिंग घनत्व और स्वास्थ्य केंद्रों की दूरी देखें।',
      ],
      ta: [
        'இருப்பிடங்களை ஆய்வு செய்ய ஏதேனும் ஒரு மண்டலத்தைத் தேர்ந்தெடுக்கவும்.',
        'பரிசோதனை அடர்த்தி மற்றும் சுகாதார நிலையங்களை காண்க.',
      ],
      kn: [
        'ಸ್ಥಳೀಯ ವಾಸಸ್ಥಳಗಳನ್ನು ಪರಿಶೀಲಿಸಲು ಯಾವುದೇ ಮಂಡಲವನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
        'ಆರೋಗ್ಯ ಸೌಲಭ್ಯಗಳ ನಿಕಟತೆಯನ್ನು ವೀಕ್ಷಿಸಿ.',
      ],
      ml: [
        'നിവാസസ്ഥലങ്ങൾ കാണാൻ ഏതെങ്കിലും മണ്ഡലം തിരഞ്ഞെടുക്കുക.',
        'ആരോഗ്യ കേന്ദ്രങ്ങളുടെ സാമീപ്യം കാണുക.',
      ],
    },
  },

  screening: {
    tabId: 'screening',
    name: {
      en: 'Clinical Screening',
      te: 'క్లినికల్ స్క్రీనింగ్',
      hi: 'नैदानिक स्क्रीनिंग',
      ta: 'மருத்துவப் பரிசோதனை',
      kn: 'ಕ್ಲಿನಿಕಲ್ ತಪಾಸಣೆ',
      ml: 'ക്ലിനിക്കൽ സ്ക്രീനിംഗ്',
    },
    summary: {
      en: 'Field oral mucosal examination survey capturing tobacco habits, anatomical sites, visual lesion features, and photo attachments with demo AI screening support.',
      te: 'పొగాకు అలవాట్లు, నోటి భాగాల పరిశీలన మరియు ఫోటోలతో కూడిన ప్రాథమిక ఓరల్ మ్యూకోసల్ సర్వే.',
      hi: 'तंबाकू की आदतें, दृश्य म्यूकोसल निरीक्षण और फोटो संलग्नक सहित प्रारंभिक ओरल स्क्रीनिंग सर्वेक्षण।',
      ta: 'புகையிலைப் பழக்கவழக்கங்கள், வாய்வழி ஆய்வு மற்றும் புகைப்படங்களுடன் கூடிய பரிசோதனைப் படிவம்.',
      kn: 'ತಂಬಾಕು ಸೇವನೆ, ಬಾಯಿಯ ಮ್ಯೂಕೋಸಲ್ ತಪಾಸಣೆ ಮತ್ತು ಫೋಟೋಗಳೊಂದಿಗೆ ಪ್ರಾಥಮಿಕ ಸಮೀಕ್ಷೆ.',
      ml: 'പുകയില ശീലങ്ങൾ, വാക്കാലുള്ള പരിശോധന, ഫോട്ടോകൾ എന്നിവ ഉൾക്കൊള്ളുന്ന സ്ക്രീനിംഗ് സർവേ.',
    },
    instructions: {
      en: [
        'Enter or select the patient intake ID.',
        'Record substance usage (tobacco chewing, smoking, alcohol duration in years).',
        'Mark visual mucosal inspection findings (leukoplakia, erythroplakia, ulceration, submucous fibrosis).',
        'Specify anatomical location (buccal mucosa, tongue, palate, lip).',
        'Capture clear clinical photograph under proper illumination.',
        'Submit to queue for Medical Officer review or save draft locally if offline.',
      ],
      te: [
        'రోగి ఐడిని నమోదు చేయండి లేదా ఎంచుకోండి.',
        'పొగాకు మరియు ఇతర అలవాట్ల వివరాలను నమోదు చేయండి.',
        'నోటి లోపల కనిపించిన లక్షణాలను గుర్తించండి (తెల్లటి మచ్చ, ఎర్రటి మచ్చ, పుండు మొదలైనవి).',
        'స్పష్టమైన ఫోటో తీసి మెడికల్ ఆఫీసర్ సమీక్ష కోసం సమర్పించండి.',
      ],
      hi: [
        'रोगी आईडी दर्ज करें या चुनें।',
        'तंबाकू और अन्य आदतों की अवधि दर्ज करें।',
        'दिखाई देने वाले घाव या पैच (सफेद, लाल, छाला) का चयन करें।',
        'स्पष्ट फोटो खींचकर समीक्षा हेतु जमा करें।',
      ],
      ta: [
        'நோயாளி எண்ணை உள்ளிடவும்.',
        'புகையிலைப் பழக்கவழக்கங்களின் விவரங்களைப் பதிவு செய்யவும்.',
        'சளிச்சவ்வு மாற்றங்களை (வெள்ளைத் திட்டு, சிவப்புத் திட்டு, புண்) குறிப்பிடவும்.',
        'புகைப்படம் எடுத்து மருத்துவ அதிகாரி மறுஆய்வுக்குச் சமர்ப்பிக்கவும்.',
      ],
      kn: [
        'ರೋಗಿ ಐಡಿಯನ್ನು ನಮೂದಿಸಿ.',
        'ತಂಬಾಕು ಬಳಕೆಯ ಅವಧಿಯನ್ನು ದಾಖಲಿಸಿ.',
        'ಕಂಡುಬಂದ ಲಕ್ಷಣಗಳನ್ನು (ಬಿಳಿ ತೇಪೆ, ಕೆಂಪು ತೇಪೆ, ಹುಣ್ಣು) ಗುರುತಿಸಿ.',
        'ಫೋಟೋ ತೆಗೆದು ವೈದ್ಯಾಧಿಕಾರಿಯ ಪರಿಶೀಲನೆಗೆ ಸಲ್ಲಿಸಿ.',
      ],
      ml: [
        'രോഗി ഐഡി നൽകുക.',
        'പുകയില ഉപയോഗ വിവരങ്ങൾ രേഖപ്പെടുത്തുക.',
        'വ്രണം അല്ലെങ്കിൽ പാടുകൾ അടയാളപ്പെടുത്തുക.',
        'വ്യക്തമായ ഫോട്ടോ എടുത്ത് പരിശോധനയ്ക്കായി സമർപ്പിക്കുക.',
      ],
    },
  },

  patients: {
    tabId: 'patients',
    name: {
      en: 'Patients & Offline Sync',
      te: 'రోగులు & ఆఫ్‌లైన్ సింక్',
      hi: 'मरीज एवं ऑफलाइन सिंक',
      ta: 'நோயாளிகள் & ஆஃப்லைன் ஒத்திசைவு',
      kn: 'ರೋಗಿಗಳು ಮತ್ತು ಆಫ್‌ಲೈನ್ ಸಿಂಕ್',
      ml: 'രോഗികളും ഓഫ്‌ലൈൻ സിങ്കും',
    },
    summary: {
      en: 'Frontline patient registry with local IndexedDB storage, encrypted offline queue, and duplicate intake resolution.',
      te: 'ఆఫ్‌లైన్ నిల్వ, ఎన్‌క్రిప్టెడ్ క్యూ మరియు డూప్లికేట్ రోగి రికార్డుల సరిపోలికలతో కూడిన రోగుల రిజిస్ట్రీ.',
      hi: 'लोकल इंडेक्सडीडीबी स्टोरेज, एन्क्रिप्टेड कतार और डुप्लिकेट समाधान के साथ मरीज रजिस्ट्री।',
      ta: 'ஆஃப்லைன் சேமிப்பு மற்றும் நோயாளிகளின் பதிவு மேலாண்மை.',
      kn: 'ಆಫ್‌ಲೈನ್ ಸಂಗ್ರಹಣೆ ಮತ್ತು ರೋಗಿಗಳ ನೋಂದಣಿ ನಿರ್ವಹಣೆ.',
      ml: 'ഓഫ്‌ലൈൻ സംഭരണവും രോഗികളുടെ രജിസ്ട്രിയും.',
    },
    instructions: {
      en: [
        'Register new tribal citizens even when disconnected from cellular network.',
        'Records are securely stored in IndexedDB and queued with unique mutation IDs.',
        'When cellular coverage resumes, sync queue uploads records idempotently to the central server.',
      ],
      te: [
        'నెట్‌వర్క్ లేనప్పుడు కూడా కొత్త రోగులను నమోదు చేయవచ్చు.',
        'డేటా సురక్షితంగా పరికరంలో నిల్వ చేయబడుతుంది.',
        'నెట్‌వర్క్ వచ్చినప్పుడు ఒకే క్లిక్‌తో కేంద్ర సర్వర్‌కు సమకాలీకరించబడుతుంది.',
      ],
      hi: [
        'नेटवर्क न होने पर भी नए मरीजों का पंजीकरण करें।',
        'डेटा सुरक्षित रूप से डिवाइस में स्टोर होता है।',
        'इंटरनेट उपलब्ध होने पर डेटा स्वतः सिंक हो जाता है।',
      ],
      ta: [
        'இணையம் இல்லாதபோதும் புதிய நோயாளிகளைப் பதிவு செய்யலாம்.',
        'இணையம் கிடைத்தவுடன் தரவு தானாகவே ஒத்திசைக்கப்படும்.',
      ],
      kn: [
        'ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲದಿದ್ದರೂ ಹೊಸ ರೋಗಿಗಳನ್ನು ನೋಂದಾಯಿಸಿ.',
        'ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕ ಬಂದಾಗ ಡೇಟಾ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸಿಂಕ್ ಆಗುತ್ತದೆ.',
      ],
      ml: [
        'നെറ്റ്‌വർക്ക് ഇല്ലാത്തപ്പോഴും പുതിയ രോഗികളെ ചേർക്കാം.',
        'ഇന്റർനെറ്റ് ലഭിക്കുമ്പോൾ ഡാറ്റ സമന്വയിപ്പിക്കപ്പെടും.',
      ],
    },
  },

  camps: {
    tabId: 'camps',
    name: {
      en: 'Outreach Camps',
      te: 'గ్రామీణ శిబిరాలు',
      hi: 'आउटरीच कैंप',
      ta: 'கள முகாம்கள்',
      kn: 'ಹೊರಸಂಪರ್ಕ ಶಿಬಿರಗಳು',
      ml: 'ക്യാമ്പുകൾ',
    },
    summary: {
      en: 'Community screening camp lifecycle management: Draft -> Published -> In-Progress -> Completed.',
      te: 'కమ్యూనిటీ స్క్రీనింగ్ శిబిరాల సమగ్ర నిర్వహణ: ముసాయిదా -> ప్రచురించబడింది -> పురోగతిలో ఉంది -> పూర్తయింది.',
      hi: 'सामुदायिक स्क्रीनिंग कैंप प्रबंधन: ड्राफ्ट -> प्रकाशित -> प्रगति पर -> पूर्ण।',
      ta: 'சமூகப் பரிசோதனை முகாம்களின் வாழ்க்கைச் சுழற்சி மேலாண்மை.',
      kn: 'ಸಮುದಾಯ ತಪಾಸಣಾ ಶಿಬಿರಗಳ ಸಮಗ್ರ ನಿರ್ವಹಣೆ.',
      ml: 'കമ്മ്യൂണിറ്റി സ്ക്രീനിംഗ് ക്യാമ്പുകളുടെ മാനേജ്മെന്റ്.',
    },
    instructions: {
      en: [
        'Create new screening camp specifying target habitation, dates, and coordinator.',
        'Publish the camp so assigned health workers receive dispatch notifications.',
        'Start the camp on the designated day to record community screenings.',
        'Complete the camp to finalize aggregate metrics with privacy cell suppression.',
      ],
      te: [
        'గ్రామం, తేదీలు మరియు సిబ్బందిని ఎంచుకుని కొత్త శిబిరాన్ని సృష్టించండి.',
        'సిబ్బందికి తెలియజేయడానికి శిబిరాన్ని ప్రచురించండి.',
        'నిర్దేశిత రోజున శిబిరాన్ని ప్రారంభించి స్క్రీనింగ్‌లను నమోదు చేయండి.',
      ],
      hi: [
        'लक्ष्य बस्ती, तिथियां और समन्वयक चुनकर नया कैंप बनाएं।',
        'स्वास्थ्य कर्मियों को सूचित करने के लिए कैंप प्रकाशित करें।',
      ],
      ta: [
        'இடம் மற்றும் தேதிகளைத் தேர்ந்தெடுத்து புதிய முகாமை உருவாக்கவும்.',
        'பணியாளர்களுக்குத் தெரிவிக்க முகாமை வெளியிடவும்.',
      ],
      kn: [
        'ಹೊಸ ಶಿಬಿರವನ್ನು ರಚಿಸಿ ಮತ್ತು ಪ್ರಕಟಿಸಿ.',
        'ತಪಾಸಣೆಗಳನ್ನು ದಾಖಲಿಸಲು ಶಿಬಿರವನ್ನು ಪ್ರಾರಂಭಿಸಿ.',
      ],
      ml: [
        'പുതിയ ക്യാമ്പ് രൂപീകരിക്കുകയും പ്രസിദ്ധീകരിക്കുകയും ചെയ്യുക.',
      ],
    },
  },
};

/**
 * Intelligent multilingual assistant response generator.
 */
export function generateLocalAssistantResponse(
  query: string,
  lang: LanguageCode,
  activeTab = 'dashboard'
): AssistantAnswer {
  const q = (query || '').toLowerCase().trim();

  // =========================================================================
  // 1. STEP 1: PATIENT REGISTRATION & ONBOARDING GUIDANCE
  // =========================================================================
  if (
    q.includes('register') ||
    q.includes('registration') ||
    q.includes('step 1') ||
    q.includes('create account') ||
    q.includes('sign up') ||
    q.includes('new patient') ||
    q.includes('aadhaar') ||
    q.includes('adhaar') ||
    // Telugu Script & Transliteration
    q.includes('నమోదు') ||
    q.includes('రిజిస్ట్రేషన్') ||
    q.includes('ఖాతా') ||
    q.includes('ఆధార్') ||
    q.includes('కొత్త రోగి') ||
    q.includes('ela register') ||
    q.includes('register cheyyali') ||
    q.includes('register cheyali') ||
    q.includes('patient ni register') ||
    q.includes('registration ela') ||
    q.includes('kotha patient') ||
    q.includes('aadhaar tho') ||
    q.includes('patient ela add') ||
    // Hindi Script & Transliteration
    q.includes('पंजीकरण') ||
    q.includes('रजिस्ट्रेशन') ||
    q.includes('खाता') ||
    q.includes('आधार') ||
    q.includes('नया मरीज') ||
    q.includes('registration kaise') ||
    q.includes('mariz ko kaise') ||
    q.includes('patient register kaise') ||
    q.includes('aadhaar se registration') ||
    q.includes('kaise jode')
  ) {
    const regAnswers: Record<LanguageCode, { text: string; speech: string }> = {
      te: {
        text: `📝 **మొదటి దశ: స్మార్ట్ రోగి నమోదు మార్గదర్శకత్వం (Step 1 — Patient Registration)**\n\nఆరోగ్య దృష్టిలో రోగిని నమోదు చేయడం ఎంతో సులభం:\n\n1. **ఆధార్-సహాయక నమోదు (Aadhaar OCR):** రోగి ఆధార్ కార్డు ముందు, వెనుక ఫోటో తీయండి. సిస్టమ్ స్వయంచాలకంగా పేరు, పుట్టిన తేదీ మరియు చిరునామాను సేకరిస్తుంది. ఆధార్ నంబర్ పూర్తిగా సురక్షితంగా మాస్క్ చేయబడుతుంది (XXXX-XXXX-1234).\n2. **మాన్యువల్ నమోదు (Manual Form):** ఆధార్ లేకపోయినా రోగి పేరు, వయస్సు, లింగం, మొబైల్ నంబర్ మరియు గిరిజన నివాస గ్రామాన్ని నేరుగా నమోదు చేయవచ్చు.\n3. **ఆఫ్‌లైన్ రక్షణ:** ఇంటర్నెట్ లేని మారుమూల కొండ ప్రాంతాల్లో కూడా డేటా లోకల్ IndexedDB లో భద్రపరచబడుతుంది.\n\n👉 **తదుపరి చర్య:** రోగిని నమోదు చేసిన వెంటనే రెండవ దశగా "నోటి స్క్రీనింగ్" ఫోటోను తీయండి.`,
        speech: `నమస్కారం! నేను దృష్టిని. మొదటి దశగా దయచేసి రోగి నమోదును పూర్తి చేయండి. మీరు స్మార్ట్ ఆధార్ ద్వారా లేదా మాన్యువల్ ఫారమ్ ద్వారా రోగి వివరాలను నమోదు చేయవచ్చు. నమోదు పూర్తయిన తర్వాత నోటి ఫోటో తీసి AI స్క్రీనింగ్ నిర్వహించండి.`,
      },
      hi: {
        text: `📝 **पहला कदम: स्मार्ट मरीज पंजीकरण मार्गदर्शन (Step 1 — Patient Registration)**\n\nआरोग्य दृष्टि में मरीज को पंजीकृत करना बहुत सरल है:\n\n1. **आधार-सहायता पंजीकरण (Aadhaar OCR):** मरीज के आधार कार्ड के दोनों तरफ की फोटो खींचें। नाम, जन्मतिथि और गांव का पता स्वतः भर जाएगा। आधार संख्या पूरी तरह मास्क (XXXX-XXXX-1234) रहती है।\n2. **मैन्युअल फॉर्म:** बिना आधार के भी मरीज का नाम, आयु, लिंग, मोबाइल नंबर और आदिवासी बस्ती का पता दर्ज कर सकते हैं।\n3. **ऑफलाइन सुरक्षा:** नेटवर्क न होने पर भी सारा डेटा IndexedDB में सुरक्षित रहता है।\n\n👉 **अगला कदम:** पंजीकरण के तुरंत बाद दूसरे चरण में मरीज के मुंह की फोटो लेकर "मुख स्क्रीनिंग" करें।`,
        speech: `नमस्ते! मैं दृष्टि हूँ। पहले चरण में कृपया मरीज का पंजीकरण पूरा करें। आप स्मार्ट आधार या सामान्य फॉर्म द्वारा मरीज को जोड़ सकते हैं। इसके बाद मुंह की फोटो लेकर AI स्क्रीनिंग करें।`,
      },
      en: {
        text: `📝 **Step 1: Smart Patient Registration Guidance**\n\nRegistering a beneficiary on Aarogya-Drishti is fast and secure:\n\n1. **Aadhaar-Assisted OCR:** Capture the front and back of the Aadhaar card. The system automatically extracts name, date of birth, and village address with zero manual typing. Complete Aadhaar numbers are cryptographically masked (XXXX-XXXX-1234).\n2. **Manual Registration:** If Aadhaar is unavailable, enter patient demographics (Name, Age, Gender, Mobile, Tribal Habitation Landmark).\n3. **Offline Reliability:** Frontline entries persist securely in IndexedDB even without cellular connectivity.\n\n👉 **Next Action:** Immediately following registration, proceed to Step 2: Capture oral mucosal photos for instant AI risk screening.`,
        speech: `Hello! I am Drishti. Step 1: Please register the patient using Smart Aadhaar OCR or manual intake form. Once registered, proceed to Step 2 for oral mucosal screening.`,
      },
      ta: {
        text: `📝 படி 1: நோயாளி பதிவு வழிகாட்டல். ஆதார் அல்லது படிவம் மூலம் நோயாளியை பதிவு செய்யவும்.`,
        speech: `படி 1: நோயாளியை பதிவு செய்யவும். பிறகு வாய்வழி பரிசோதனை செய்யவும்.`,
      },
      kn: {
        text: `📝 ಹಂತ 1: ರೋಗಿ ನೋಂದಣಿ ಮಾರ್ಗದರ್ಶನ. ಆಧಾರ್ ಅಥವಾ ಫಾರ್ಮ್ ಮೂಲಕ ರೋಗಿಯನ್ನು ನೋಂದಾಯಿಸಿ.`,
        speech: `ಹಂತ 1: ದಯವಿಟ್ಟು ರೋಗಿಯನ್ನು ನೋಂದಾಯಿಸಿ. ನಂತರ ತಪಾಸಣೆ ಮಾಡಿ.`,
      },
      ml: {
        text: `📝 ഘട്ടം 1: രോഗി രജിസ്ട്രേഷൻ. ആധാർ അല്ലെങ്കിൽ ഫോം വഴി രോഗിയെ രജിസ്റ്റർ ചെയ്യുക.`,
        speech: `ഘട്ടം 1: രോഗിയെ രജിസ്റ്റർ ചെയ്യുക. തുടർന്ന് പരിശോധന നടത്തുക.`,
      },
    };

    const item = regAnswers[lang] || regAnswers.en;
    return {
      answerText: item.text,
      speechText: item.speech,
      language: lang,
      topic: 'patient_registration',
      animation: 'speaking',
      navigateTo: 'patients',
      suggestedActions: [
        '📸 How to take oral screening photo? (Step 2)',
        '👨‍⚕️ Which doctor should I consult?',
        '🏥 Show hospitals in Paderu / ASR',
      ],
    };
  }

  // =========================================================================
  // 2. STEP 2: ORAL SCREENING & PHOTO CAPTURE GUIDANCE
  // =========================================================================
  if (
    q.includes('screening photo') ||
    q.includes('take photo') ||
    q.includes('camera') ||
    q.includes('how to take') ||
    q.includes('oral photo') ||
    q.includes('step 2') ||
    // Telugu Script & Transliteration
    q.includes('ఫోటో ఎలా') ||
    q.includes('నోటి ఫోటో') ||
    q.includes('కెమెరా') ||
    q.includes('ఫోటో తీయడం') ||
    q.includes('photo ela') ||
    q.includes('photo theeyali') ||
    q.includes('screening ela') ||
    q.includes('photo upload') ||
    // Hindi Script & Transliteration
    q.includes('फोटो कैसे') ||
    q.includes('मुंह की फोटो') ||
    q.includes('फोटो लेना') ||
    q.includes('photo kaise') ||
    q.includes('photo khinche') ||
    q.includes('screening kaise')
  ) {
    const screenAnswers: Record<LanguageCode, { text: string; speech: string }> = {
      te: {
        text: `📸 **రెండవ దశ: నోటి స్క్రీనింగ్ ఫోటో తీయడం (Step 2 — Oral Screening Photo)**\n\nస్పష్టమైన నోటి ఫోటో తీయడానికి సూచనలు:\n\n1. **లైటింగ్:** మంచి సూర్యకాంతి లేదా ఫోన్ ఫ్లాష్‌లైట్ ఉపయోగించండి.\n2. **నాలుక & బుగ్గలు:** చెక్క స్పాటులా లేదా శుభ్రమైన చెంచాతో బుగ్గ లోపలి భాగాన్ని సున్నితంగా పక్కకు జరిపి తెల్లటి లేదా ఎర్రటి మచ్చలను ఫోకస్ చేయండి.\n3. **దూరం:** కెమెరాను నోటికి 10–15 సెం.మీ దూరంలో ఉంచి స్పష్టమైన ఫోకస్ వచ్చేలా చూడండి.\n4. **డెమో AI విశ్లేషణ:** ఫోటో అప్‌లోడ్ చేయగానే సిస్టమ్ తక్షణమే డెమో AI రిస్క్ స్కోర్ మరియు తగిన వైద్యుని సిఫార్సును అందిస్తుంది.\n\n⚠️ **ముఖ్య గమనిక:** 2 వారాల కంటే ఎక్కువ కాలం మానని పుండ్లు కనిపిస్తే వెంటనే స్క్రీనింగ్ రికార్డ్ చేసి CHC పాడేరు డాక్టర్‌కు పంపండి.`,
        speech: `రెండవ దశ: నోటి లోపల మంచి కాంతిలో స్పష్టమైన ఫోటో తీయండి. బుగ్గల లోపల లేదా నాలుకపై తెల్లటి, ఎర్రటి మచ్చలు ఉంటే ఫోకస్ చేసి అప్‌లోడ్ చేయండి. డెమో AI తక్షణమే రిస్క్ విశ్లేషణ అందిస్తుంది.`,
      },
      hi: {
        text: `📸 **दूसरा कदम: मुख स्क्रीनिंग फोटो लेना (Step 2 — Oral Screening Photo)**\n\nसटीक मुख फोटो लेने के दिशा-निर्देश:\n\n1. **पर्याप्त रोशनी:** प्राकृतिक रोशनी या टॉर्च का प्रयोग करें।\n2. **गाल व जीभ का निरीक्षण:** साफ चम्मच या लकड़ी के स्पैटुला से गाल को थोड़ा हटाकर सफेद या लाल धब्बे पर फोकस करें।\n3. **दूरी:** कैमरा 10-15 सेमी की दूरी पर स्थिर रखें।\n4. **डेमो AI विश्लेषण:** फोटो अपलोड होते ही प्रणाली प्राथमिक जोखिम श्रेणी और डॉक्टर परामर्श सुझाएगी।\n\n⚠️ **चेतावनी:** 2 सप्ताह से अधिक पुराने न भरने वाले छालों को तुरंत सीएचसी पाडेरू डॉक्टर को रेफर करें।`,
        speech: `दूसरा कदम: अच्छी रोशनी में मुंह के भीतरी भाग की स्पष्ट फोटो लें। सफेद या लाल पैच पर कैमरा स्थिर रखें और अपलोड करें। AI तुरंत प्राथमिक स्क्रीनिंग परिणाम देगा।`,
      },
      en: {
        text: `📸 **Step 2: Oral Screening & Photo Capture Guidance**\n\nBest practices for high-quality mucosal imaging:\n\n1. **Illumination:** Ensure focused torchlight or bright natural daylight onto the oral cavity.\n2. **Retraction:** Use a clean wooden spatula to gently retract the buccal cheek, exposing retro-molar trigone and lateral tongue margins.\n3. **Macro Focus:** Hold the phone camera 10–15 cm from the mucosal site without motion blur.\n4. **Instant AI Triage:** Upon upload, Gemini Multimodal Vision conducts non-diagnostic risk screening (Tier 1 Low, Tier 2 Moderate, Tier 3 Priority Support) and recommends a specialist doctor.\n\n⚠️ **Safety Rule:** Persistent ulcers > 14 days or red velvety patches auto-route to Medical Officer review.`,
        speech: `Step 2: Ensure bright lighting and use a spatula to expose oral lesions clearly. Capture a sharp photograph 10 to 15 centimeters away for instant AI risk triage.`,
      },
      ta: {
        text: `📸 படி 2: நல்ல வெளிச்சத்தில் வாயின் உட்புறத்தை புகைப்படம் எடுத்து பதிவேற்றவும்.`,
        speech: `படி 2: வாயின் உட்புறத்தை புகைப்படம் எடுத்து பதிவேற்றவும்.`,
      },
      kn: {
        text: `📸 ಹಂತ 2: ಉತ್ತಮ ಬೆಳಕಿನಲ್ಲಿ ಬಾಯಿಯ ಒಳಗಿನ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆದು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.`,
        speech: `ಹಂತ 2: ಬಾಯಿಯ ಸ್ಪಷ್ಟ ಫೋಟೋ ತೆಗೆದು ತಪಾಸಣೆ ನಡೆಸಿ.`,
      },
      ml: {
        text: `📸 ഘട്ടം 2: നല്ല വെളിച്ചത്തിൽ വായയുടെ ഉൾഭാഗം ഫോട്ടോയെടുത്ത് സമർപ്പിക്കുക.`,
        speech: `ഘട്ടം 2: വായയുടെ വ്യക്തമായ ഫോട്ടോയെടുത്ത് അപ്‌ലോഡ് ചെയ്യുക.`,
      },
    };

    const item = screenAnswers[lang] || screenAnswers.en;
    return {
      answerText: item.text,
      speechText: item.speech,
      language: lang,
      topic: 'oral_screening_guidance',
      animation: 'speaking',
      navigateTo: 'screening',
      suggestedActions: [
        '👨‍⚕️ Which doctor should I consult?',
        '🏥 Show hospitals in Paderu / ASR',
        '📝 Please register patient (Step 1)',
      ],
    };
  }

  // =========================================================================
  // 3. STEP 3: DOCTOR & HOSPITAL REFERRAL GUIDANCE
  // =========================================================================
  if (
    q.includes('which doctor') ||
    q.includes('doctor') ||
    q.includes('dentist') ||
    q.includes('specialist') ||
    q.includes('hospital') ||
    q.includes('paderu') ||
    q.includes('araku') ||
    q.includes('step 3') ||
    // Telugu Script & Transliteration
    q.includes('ఏ డాక్టర్') ||
    q.includes('వైద్యులు') ||
    q.includes('దంత వైద్యుడు') ||
    q.includes('పాడేరు ఆసుపత్రి') ||
    q.includes('అరకు ఆసుపత్రి') ||
    q.includes('ఆసుపత్రులు ఎక్కడ') ||
    q.includes('ye doctor') ||
    q.includes('doctor evaru') ||
    q.includes('dentist ekkada') ||
    q.includes('hospital ekkada') ||
    q.includes('paderu hospital') ||
    q.includes('araku hospital') ||
    // Hindi Script & Transliteration
    q.includes('किस डॉक्टर') ||
    q.includes('डॉक्टर कौन') ||
    q.includes('दंत चिकित्सक') ||
    q.includes('अस्पताल कहाँ') ||
    q.includes('पाडेरू अस्पताल') ||
    q.includes('kis doctor') ||
    q.includes('doctor kaun') ||
    q.includes('dant ke doctor') ||
    q.includes('aspatal kahan') ||
    q.includes('paderu aspatal')
  ) {
    const docAnswers: Record<LanguageCode, { text: string; speech: string }> = {
      te: {
        text: `👨‍⚕️ **మూడవ దశ: వైద్యుల సంప్రదింపులు & సమీప ఆసుపత్రులు (Step 3 — Doctor Consultation)**\n\nమీ రోగి లక్షణాల ఆధారంగా సిఫార్సు చేయబడిన వైద్యులు మరియు ఆసుపత్రులు:\n\n1. 🏥 **కమ్యూనిటీ హెల్త్ సెంటర్ (CHC) పాడేరు:**\n   • **వైద్యులు:** డాక్టర్ కె. రమేష్ (దంత శస్త్రచికిత్స నిపుణులు - Dental Surgeon)\n   • **ఓపీడీ రోజులు:** మంగళవారం, గురువారం, శనివారం (ఉదయం 9:00 నుండి మధ్యాహ్నం 1:00 వరకు)\n   • **పరిధి:** సాధారణ దంత సమస్యలు, చిగుళ్ల వ్యాధులు, నోటి పుండ్ల ప్రాథమిక పరిశీలన.\n\n2. 🏥 **ఏరియా హాస్పిటల్ (AH) అరకు లోయ:**\n   • **వైద్యులు:** డాక్టర్ ఎం. అనూరాధ (ఓరల్ & మ్యాక్సిల్లోఫేషియల్ స్పెషలిస్ట్)\n   • **ఓపీడీ రోజులు:** సోమవారం, బుధవారం, శుక్రవారం (ఉదయం 9:30 నుండి మధ్యాహ్నం 2:00 వరకు)\n   • **పరిధి:** 2 వారాల కంటే ఎక్కువ రోజులు మానని పుండ్లు, తెల్లటి/ఎర్రటి మచ్చల అధునాతన బయాప్సీ మరియు సమీక్ష.\n\n💡 **ఆశా కార్యకర్తలకు సూచన:** రోగికి వ్యాధి పేరు చెప్పకుండా, ముందస్తు నివారణ కోసం 7 నుండి 14 రోజుల్లోపు డాక్టర్‌ను కలవాలని నావిగేట్ చేయండి.`,
        speech: `మూడవ దశ: పాడేరు కమ్యూనిటీ హెల్త్ సెంటర్‌లో దంత వైద్యులు డాక్టర్ రమేష్, మరియు అరకు ఏరియా హాస్పిటల్‌లో డాక్టర్ అనూరాధ అందుబాటులో ఉన్నారు. నోటి పుండ్లు రెండు వారాలు దాటితే వెంటనే అరకు లేదా పాడేరు ఆసుపత్రికి వెళ్ళండి.`,
      },
      hi: {
        text: `👨‍⚕️ **तीसरा कदम: डॉक्टर परामर्श एवं निकटतम अस्पताल (Step 3 — Doctor Guidance)**\n\nलक्षणों के आधार पर अनुशंसित विशेषज्ञ और अस्पताल:\n\n1. 🏥 **सामुदायिक स्वास्थ्य केंद्र (CHC) पाडेरू:**\n   • **डॉक्टर:** डॉ. के. रमेश (दंत शल्य चिकित्सक - Dental Surgeon)\n   • **ओपीडी दिन:** मंगलवार, गुरुवार, शनिवार (सुबह 9:00 से दोपहर 1:00 बजे)\n   • **सेवाएं:** सामान्य दंत चिकित्सा, मसूड़ों की जांच, प्राथमिक मुख छाला परीक्षण।\n\n2. 🏥 **एरिया अस्पताल अराकु घाटी:**\n   • **डॉक्टर:** डॉ. एम. अनुराधा (ओरल एवं मैक्सिलोफेशियल विशेषज्ञ)\n   • **ओपीडी दिन:** सोमवार, बुधवार, शुक्रवार (सुबह 9:30 से दोपहर 2:00 बजे)\n   • **सेवाएं:** 2 सप्ताह से अधिक पुराने छालों की बायोप्सी, पैच मूल्यांकन।\n\n💡 **आशा कार्यकर्ताओं के लिए सलाह:** मरीज को 7 से 14 दिनों के भीतर नजदीकी सीएचसी या एरिया अस्पताल में डॉक्टर से प्रत्यक्ष परामर्श दिलाएं।`,
        speech: `तीसरा कदम: पाडेरू सीएचसी में दंत चिकित्सक डॉ. रमेश और अराकु एरिया अस्पताल में विशेषज्ञ डॉ. अनुराधा उपलब्ध हैं। मुंह में छाले अधिक दिनों से हों तो तुरंत अस्पताल में दिखाएं।`,
      },
      en: {
        text: `👨‍⚕️ **Step 3: Specialist Doctor & Referral Hospital Guidance**\n\nRecommended clinicians and referral facilities across Alluri Sitharama Raju district:\n\n1. 🏥 **Community Health Centre (CHC) Paderu:**\n   • **Specialist:** Dr. K. Ramesh (Dental Surgeon / Oral Health MO)\n   • **OPD Schedule:** Tuesday, Thursday, Saturday (9:00 AM – 1:00 PM)\n   • **Scope:** General dental care, periodontal disease, primary mucosal inspection.\n\n2. 🏥 **Area Hospital Araku Valley:**\n   • **Specialist:** Dr. M. Anuradha (Oral & Maxillofacial Specialist / Biopsy Lead)\n   • **OPD Schedule:** Monday, Wednesday, Friday (9:30 AM – 2:00 PM)\n   • **Scope:** High-risk mucosal erythroplakia/leukoplakia, persistent sores > 14 days, histopathological biopsy.\n\n💡 **Clinical Frontline Tip:** Do not state diagnostic labels to the beneficiary. Guide them to schedule an in-person OPD consultation within 7 to 14 days.`,
        speech: `Step 3: Dr. K. Ramesh is available at CHC Paderu for dental care, and Dr. M. Anuradha at Area Hospital Araku for specialized mucosal examination. Please consult within 7 to 14 days.`,
      },
      ta: {
        text: `👨‍⚕️ படி 3: பாடேரு ஆரம்ப சுகாதார நிலைய பல் மருத்துவர் அல்லது அரக்கு மருத்துவமனை நிபுணரை அணுகவும்.`,
        speech: `படி 3: பல் மருத்துவரை அணுகவும்.`,
      },
      kn: {
        text: `👨‍⚕️ ಹಂತ 3: ಪಾಡೇರು ಸಮುದಾಯ ಆರೋಗ್ಯ ಕೇಂದ್ರದ ದಂತ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.`,
        speech: `ಹಂತ 3: ದಂತ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.`,
      },
      ml: {
        text: `👨‍⚕️ ഘട്ടം 3: പാടേരു ആരോഗ്യ കേന്ദ്രത്തിലെ ദന്ത ഡോക്ടറെ സമീപിക്കുക.`,
        speech: `ഘട്ടം 3: ദന്ത ഡോക്ടറെ കാണുക.`,
      },
    };

    const item = docAnswers[lang] || docAnswers.en;
    return {
      answerText: item.text,
      speechText: item.speech,
      language: lang,
      topic: 'doctor_referral_guidance',
      animation: 'speaking',
      navigateTo: 'specialists',
      doctorRecommendation: {
        specialty: 'Dental Surgeon / Oral & Maxillofacial Specialist',
        facility: 'Community Health Centre (CHC) Paderu & Area Hospital Araku',
        urgency: 'priority',
        timelineDays: 14,
        consultationReason: 'Clinical mucosal evaluation, visual inspection, and habit history assessment.',
      },
      suggestedActions: [
        '📝 Please register patient (Step 1)',
        '📸 How to take oral screening photo? (Step 2)',
        '🏥 View All District Facilities',
      ],
    };
  }

  // =========================================================================
  // 4. GENERAL APPLICATION PURPOSE QUERY
  // =========================================================================
  if (
    q.includes('what is this') ||
    q.includes('what is aarogya') ||
    q.includes('about app') ||
    q.includes('ఏమిటి') ||
    q.includes('ఆరోగ్య దృష్టి అంటే') ||
    q.includes('क्या है') ||
    q.includes('आरोग्य दृष्टि क्या') ||
    q.includes('என்ன') ||
    q.includes('ಆರೋಗ್ಯ ದೃಷ್ಟಿ ಎಂದರೇನು') ||
    q.includes('എന്താണ്')
  ) {
    const answers: Record<LanguageCode, string> = {
      en: 'Aarogya-Drishti is a community-based oral mucosal screening and healthcare navigation platform engineered for remote tribal settlements across ITDA Paderu and Alluri Sitharama Raju district.\n\nFrontline ASHA and ANM workers use this offline-first system to record mucosal visual checks, navigate referrals to Medical Officers, and coordinate outreach medical camps.\n\n⚠️ Strict Clinical Safety Notice: This platform provides screening support only; it never diagnoses diseases or recommends curative treatments.',
      te: 'ఆరోగ్య దృష్టి అనేది అల్లూరి సీతారామరాజు జిల్లాలోని గిరిజన ప్రాంతాల కోసం రూపొందించబడిన కమ్యూనిటీ ఓరల్ మ్యూకోసల్ స్క్రీనింగ్ మరియు రోగి నావిగేషన్ వేదిక.\n\nఆశా మరియు ANM కార్యకర్తలు నెట్‌వర్క్ లేని మారుమూల ప్రాంతాల్లో కూడా ఆఫ్‌లైన్‌లో పరీక్షలను నమోదు చేసి, ప్రాథమిక ఆరోగ్య కేంద్రాల మెడికల్ ఆఫీసర్ల సమీక్షకు సమర్పించవచ్చు.\n\n⚠️ భద్రతా సూచన: ఈ వ్యవస్థ కేవలం ప్రాథమిక పరిశీలన మరియు స్క్రీనింగ్ మద్దతు మాత్రమే అందిస్తుంది; ఎలాంటి వ్యాధి నిర్ధారణ చేయదు.',
      hi: 'आरोग्य दृष्टि अल्लूरी सीताराम राजू जिले के दूरदराज आदिवासी क्षेत्रों के लिए निर्मित ओरल म्यूकोसल स्क्रीनिंग और मरीज मार्गदर्शन मंच है।\n\nआशा और एएनएम कार्यकर्ता नेटवर्क न होने पर भी ऑफलाइन स्क्रीनिंग दर्ज कर सकते हैं और चिकित्सा अधिकारी को भेज सकते हैं।\n\n⚠️ सुरक्षा सूचना: यह प्रणाली केवल प्राथमिक स्क्रीनिंग सहायता प्रदान करती है; कोई चिकित्सीय निदान नहीं करती।',
      ta: 'ஆரோக்கிய திருஷ்டி என்பது தொலைதூர பழங்குடியினர் பகுதிகளுக்கான வாய்வழி சளிச்சவ்வு பரிசோதனை மற்றும் நோயாளி வழிகாட்டல் தளமாகும்.\n\nஆஷா பணியாளர்கள் இணையம் இல்லாத மலைப்பகுதிகளிலும் ஆஃப்லைனில் தகவல்களைப் பதிவு செய்து மருத்துவ அதிகாரிகளுக்கு அனுப்பலாம்.\n\n⚠️ பாதுகாப்பு குறிப்பு: இது ஆரம்பகட்ட பரிசோதனை ஆதரவு மட்டுமே; மருத்துவ நோயறிதலை வழங்காது.',
      kn: 'ಆರೋಗ್ಯ ದೃಷ್ಟಿಯು ದೂರದ ಬುಡಕಟ್ಟು ಪ್ರದೇಶಗಳಿಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಬಾಯಿಯ ಮ್ಯೂಕೋಸಲ್ ತಪಾಸಣೆ ಮತ್ತು ರೋಗಿ ಮಾರ್ಗದರ್ಶನ ವೇದಿಕೆಯಾಗಿದೆ.\n\nಆಶಾ ಕಾರ್ಯಕರ್ತೆಯರು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ತಪಾಸಣೆಗಳನ್ನು ದಾಖಲಿಸಿ ವೈದ್ಯಾಧಿಕಾರಿಗಳ ಪರಿಶೀಲನೆಗೆ ಕಳುಹಿಸಬಹುದು.\n\n⚠️ ಸುರಕ್ಷತಾ ಸೂಚನೆ: ಇದು ಕೇವಲ ಪ್ರಾಥಮಿಕ ತಪಾಸಣಾ ಬೆಂಬಲ ಮಾತ್ರ; ಯಾವುದೇ ರೋಗನಿರ್ಣಯವನ್ನು ಮಾಡುವುದಿಲ್ಲ.',
      ml: 'ആരോഗ്യ ദൃഷ്ടി വിദൂര ഗോത്രമേഖലകൾക്കായുള്ള ഓറൽ മ്യൂക്കോസൽ സ്ക്രീനിംഗും രോഗി നാവിഗേഷൻ പ്ലാറ്റ്‌ഫോവുമാണ്.\n\nആശ പ്രവർത്തകർക്ക് ഓഫ്‌ലൈനായി വിവരങ്ങൾ രേഖപ്പെടുത്താനും മെഡിക്കൽ ഓഫീസർമാർക്ക് കൈമാറാനും കഴിയും.\n\n⚠️ സുരക്ഷാ മുന്നറിയിപ്പ്: ഇത് പ്രാഥമിക സ്ക്രീനിംഗ് പിന്തുണ മാത്രമാണ്; ക്ലിനിക്കൽ രോഗനിർണയം നടത്തുന്നില്ല.',
    };

    return {
      answerText: answers[lang] || answers.en,
      speechText:
        lang === 'te'
          ? 'ఆరోగ్య దృష్టి గిరిజన ప్రాంతాలలో ఓరల్ హెల్త్ స్క్రీనింగ్ కోసం రూపొందించిన డిజిటల్ వేదిక.'
          : lang === 'hi'
          ? 'आरोग्य दृष्टि आदिवासी क्षेत्रों में ओरल हेल्थ स्क्रीनिंग के लिए एक डिजिटल मंच है।'
          : 'Aarogya Drishti is a digital community health screening platform for remote tribal settlements.',
      language: lang,
      topic: 'app_overview',
      animation: 'speaking',
      suggestedActions: [
        'How does Offline Sync work?',
        'How to record an oral screening?',
        'Show District Map',
      ],
    };
  }

  // 2. Offline Sync Queries
  if (
    q.includes('offline') ||
    q.includes('sync') ||
    q.includes('network') ||
    q.includes('internet') ||
    q.includes('ఆఫ్‌లైన్') ||
    q.includes('సింక్') ||
    q.includes('ऑफलाइन') ||
    q.includes('सिंक') ||
    q.includes('ஆஃப்லைன்') ||
    q.includes('ಆಫ್‌ಲೈನ್') ||
    q.includes('ഓഫ്‌ലൈൻ')
  ) {
    const answers: Record<LanguageCode, string> = {
      en: 'Aarogya-Drishti is built with a resilient Offline-First architecture:\n\n1. **IndexedDB Local Storage:** Patient registrations and visual screening data are stored locally in the browser/PWA database when cellular coverage is absent.\n2. **Encrypted Queue:** Each record receives an encrypted mutationId (UUID v4) to prevent data loss.\n3. **Idempotent Sync:** Once back in network range, clicking "Sync Records" uploads everything without creating duplicates.\n4. **Audit Ledgers:** The backend checks sync ledgers to ensure zero loss or double-counting.',
      te: 'ఆరోగ్య దృష్టి బలమైన ఆఫ్‌లైన్-ఫస్ట్ ఆర్కిటెక్చర్‌తో రూపొందించబడింది:\n\n1. **ఇండెక్స్‌డ్ డిబి నిల్వ:** సెల్యులార్ నెట్‌వర్క్ లేనప్పుడు రోగి సమాచారం మరియు స్క్రీనింగ్ వివరాలు బ్రౌజర్‌లో సురక్షితంగా నిల్వ చేయబడతాయి.\n2. **ఎన్‌క్రిప్టెడ్ క్యూ:** ప్రతి రికార్డుకు ప్రత్యేక UUID కేటాయించబడుతుంది.\n3. **సమకాలీకరణ:** సిగ్నల్ వచ్చిన వెంటనే "సింక్" బటన్ నొక్కడం ద్వారా రికార్డులు డూప్లికేట్ కాకుండా సర్వర్‌కు చేరుతాయి.',
      hi: 'आरोग्य दृष्टि ऑफलाइन-फर्स्ट तकनीक पर काम करती है:\n\n1. नेटवर्क न होने पर डेटा ब्राउज़र के IndexedDB में सुरक्षित रहता है।\n2. प्रत्येक प्रविष्टि को सुरक्षित UUID मिलता है।\n3. कनेक्टिविटी मिलने पर एक क्लिक में डेटा बिना डुप्लिकेट हुए सर्वर पर सिंक हो जाता है।',
      ta: 'ஆரோக்கிய திருஷ்டி வலுவான ஆஃப்லைன் தொழில்நுட்பத்துடன் செயல்படுகிறது:\n\n1. இணையம் இல்லாதபோது தரவு பாதுகாப்பாக சேமிக்கப்படும்.\n2. இணைப்பு கிடைத்தவுடன் ஒரு கிளிக்கில் சர்வரில் ஒத்திசைக்கப்படும்.',
      kn: 'ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲದಿದ್ದರೂ IndexedDB ಮೂಲಕ ಡೇಟಾ ಸುರಕ್ಷಿತವಾಗಿರುತ್ತದೆ ಮತ್ತು ಇಂಟರ್ನೆಟ್ ಬಂದಾಗ ಸುಲಭವಾಗಿ ಸಿಂಕ್ ಆಗುತ್ತದೆ.',
      ml: 'നെറ്റ്‌വർക്ക് ഇല്ലാത്തപ്പോഴും പ്രാദേശികമായി വിവരങ്ങൾ സൂക്ഷിക്കുകയും പിന്നീട് സമന്വയിപ്പിക്കുകയും ചെയ്യുന്നു.',
    };

    return {
      answerText: answers[lang] || answers.en,
      speechText:
        lang === 'te'
          ? 'ఆరోగ్య దృష్టిలో నెట్‌వర్క్ లేకపోయినా స్క్రీనింగ్ వివరాలను సురక్షితంగా నమోదు చేయవచ్చు.'
          : 'You can record screenings offline in remote hamlets without cellular coverage.',
      language: lang,
      topic: 'offline_sync',
      animation: 'speaking',
      navigateTo: 'patients',
      suggestedActions: ['Go to Patient Sync Page', 'How to record screening?'],
    };
  }

  // 3. Urgent Red-Flag Symptom Alert (Ulcers > 14 days, difficulty swallowing, bleeding)
  const isUrgentSymptom =
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

  if (isUrgentSymptom) {
    const urgentAnswers: Record<LanguageCode, { text: string; speech: string }> = {
      en: {
        text: '⚠️ **Clinical Safety Warning:**\nAny non-healing oral ulcer, mucosal plaque, localized lump, or difficulty swallowing lasting more than 14 days requires immediate clinical evaluation by a Medical Officer.\n\n🏥 **Urgent Recommendation:** Please visit your nearest Primary Health Centre (PHC), Community Health Centre (CHC), or District Hospital Paderu for visual inspection.\n\n*(Notice: General health guidance and screening support only; does not replace in-person doctor evaluation).*',
        speech: 'Any oral sore or patch lasting over two weeks must be examined promptly by a doctor. Please visit your nearest Primary Health Centre or District Hospital right away.',
      },
      te: {
        text: '⚠️ **ముఖ్యమైన ఆరోగ్య హెచ్చరిక:**\nనోటిలో 14 రోజుల కంటే ఎక్కువ కాలం మానని పుండ్లు, తెల్లటి లేదా ఎర్రటి మచ్చలు, గడ్డలు, లేదా మింగడంలో ఇబ్బంది ఉన్నట్లయితే వెంటనే వైద్యుడిని సంప్రదించాలి.\n\n🏥 **సిఫార్సు:** దయచేసి ఆలస్యం చేయకుండా మీ దగ్గరి ప్రాథమిక ఆరోగ్య కేంద్రం (PHC) లేదా పాడేరు జిల్లా ఆసుపత్రిలోని వైద్యుడిని సంప్రదించండి.\n\n*(గమనిక: ఇది సాధారణ సమాచారం మాత్రమే; ఖచ్చితమైన రోగ నిర్ధారణ కాదు.)*',
        speech: 'నోటిలో పద్నాలుగు రోజుల కంటే ఎక్కువ రోజులు తగ్గని పుండ్లు ఉంటే ఏమాత్రం నిర్లక్ష్యం చేయవద్దు. వెంటనే దగ్గరి డాక్టర్‌ను సంప్రదించండి.',
      },
      hi: {
        text: '⚠️ **महत्वपूर्ण स्वास्थ्य चेतावनी:**\nयदि मुंह में छाले, सफेद या लाल दाग, गांठ या निगलने में कठिनाई 14 दिनों से अधिक समय से है, तो तुरंत डॉक्टर से जांच कराएं।\n\n🏥 **सिफारिश:** कृपया नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC) या जिला अस्पताल में डॉक्टर से तुरंत संपर्क करें।\n\n*(नोट: यह सामान्य स्वास्थ्य जानकारी है; चिकित्सीय निदान नहीं।)*',
        speech: 'यदि मुंह में छाले दो सप्ताह से अधिक समय से ठीक नहीं हो रहे हैं, तो तुरंत नजदीकी स्वास्थ्य केंद्र में डॉक्टर को दिखाएं।',
      },
      ta: {
        text: '⚠️ **முக்கியமான சுகாதார எச்சரிக்கை:**\nவாயில் 14 நாட்களுக்கு மேலாக குணமாகாத புண்கள், வெள்ளை/சிவப்பு திட்டுகள், அல்லது விழுங்குவதில் சிரமம் இருந்தால் உடனடியாக மருத்துவரை அணுகவும்.\n\n🏥 **பரிந்துரை:** அருகிலுள்ள ஆரம்ப சுகாதார நிலையம் (PHC) அல்லது மாவட்ட மருத்துவமனையில் உள்ள மருத்துவரை அணுகவும்.\n\n*(குறிப்பு: இது பொதுவான சுகாதார தகவல் மட்டுமே; நோய் கண்டறிதல் அல்ல).*',
        speech: 'வாயில் இரண்டு வாரங்களுக்கு மேலாக குணமாகாத புண்கள் இருந்தால் உடனடியாக அருகிலுள்ள ஆரம்ப சுகாதார நிலைய மருத்துவரிடம் செல்லவும்.',
      },
      kn: {
        text: '⚠️ **ಪ್ರಮುಖ ಆರೋಗ್ಯ ಎಚ್ಚರಿಕೆ:**\nಬಾಯಿಯಲ್ಲಿ 14 ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಗುಣವಾಗದ ಹುಣ್ಣುಗಳು, ಬಿಳಿ/ಕೆಂಪು ತೇಪೆಗಳು ಅಥವಾ ನುಂಗಲು ಕಷ್ಟವಾಗಿದ್ದರೆ ತಕ್ಷಣ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.\n\n🏥 **ಶಿಫಾರಸು:** ದಯವಿಟ್ಟು ವಿಳಂಬ ಮಾಡದೆ ಹತ್ತಿರದ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರ (PHC) ಅಥವಾ ಜಿಲ್ಲಾ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.\n\n*(ಗಮನಿಸಿ: ಇದು ಸಾಮಾನ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ; ಖಚಿತ ರೋಗ ನಿರ್ಣಯವಲ್ಲ).*',
        speech: 'ಬಾಯಿಯಲ್ಲಿ ಎರಡು ವಾರಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಗುಣವಾಗದ ಹುಣ್ಣುಗಳಿದ್ದರೆ ತಕ್ಷಣವೇ ಹತ್ತಿರದ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರಕ್ಕೆ ಭೇಟಿ ನೀಡಿ.',
      },
      ml: {
        text: '⚠️ **പ്രധാനപ്പെട്ട ആരോഗ്യ മുന്നറിയിപ്പ്:**\nവായിൽ രണ്ടാഴ്ചയിലധികം നീണ്ടുനിൽക്കുന്ന ഉണങ്ങാത്ത വ്രണങ്ങൾ, പാടുകൾ അല്ലെങ്കിൽ വിഴുങ്ങാൻ ബുദ്ധിമുട്ട് ഉണ്ടെങ്കിൽ ഉടൻ ഡോക്ടറെ കാണുക.\n\n🏥 **ശുപാർശ:** അടുത്തുള്ള പ്രാഥമിക ആരോഗ്യ കേന്ദ്രം (PHC) അല്ലെങ്കിൽ ജില്ലാ ആശുപത്രിയിലെ ഡോക്ടറെ സമീപിക്കുക.\n\n*(ശ്രദ്ധിക്കുക: ഇത് പൊതുവായ വിവരങ്ങൾ മാത്രമാണ്; കൃത്യമായ രോഗനിർണ്ണയമല്ല).*',
        speech: 'വായിൽ രണ്ടാഴ്ചയിലധികം ഉണങ്ങാത്ത വ്രണങ്ങൾ ഉണ്ടെങ്കിൽ ഉടൻ തന്നെ അടുത്തുള്ള ആരോഗ്യ കേന്ദ്രത്തിലെ ഡോക്ടറെ കണ്ട് പരിശോധിക്കുക.',
      },
    };

    const item = urgentAnswers[lang] || urgentAnswers.en;
    return {
      answerText: item.text,
      speechText: item.speech,
      language: lang,
      topic: 'medical_safety',
      animation: 'error',
      navigateTo: 'hospitals',
      suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
    };
  }

  // 3b. Fever, Headache & Acute Symptoms (Female Healthcare Companion)
  if (
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
    const feverAnswers: Record<LanguageCode, { text: string; speech: string }> = {
      en: {
        text: 'Hello. I understand that you are experiencing fever or body discomfort.\n\n**To help understand your condition better, one quick question:**\nAlong with this fever, do you have any severe chills, chest tightness, or difficulty breathing?\n\n💡 **General Supportive Care:**\n• Get plenty of bed rest and drink clean, boiled water or oral rehydration fluids.\n• Eat light, easily digestible meals and monitor your temperature periodically.\n• If the fever exceeds 101°F or does not subside within two to three days, please contact your local ASHA worker or visit the nearest Primary Health Centre (PHC) for clinical assessment.\n*(Notice: General health education and supportive guidance only; does not replace in-person doctor evaluation).*',
        speech: 'Hello. I understand you have a fever. Along with this, do you have any chills, cough, or difficulty breathing? Please rest well and stay hydrated. If the fever persists, please visit your local health center or doctor promptly.',
      },
      te: {
        text: 'నమస్కారం అండీ. మీకు జ్వరం లేదా తలనొప్పి ఉందని నేను గమనించాను.\n\n**లక్షణాలను అర్థం చేసుకోవడానికి ఒక ప్రశ్న:**\nమీకు ఈ జ్వరం లేదా తలనొప్పితో పాటు చలి, తీవ్రమైన దగ్గు లేదా శ్వాస తీసుకోవడంలో ఇబ్బంది ఏమైనా ఉందా?\n\n💡 **ప్రాథమిక సంరక్షణ సలహాలు:**\n• తగినంత విశ్రాంతి తీసుకోండి మరియు కాచి చల్లార్చిన నీటిని లేదా ఓఆర్ఎస్ పుష్కలంగా తాగండి.\n• సులభంగా జీర్ణమయ్యే తేలికపాటి ఆహారం తీసుకోండి.\n• శరీర ఉష్ణోగ్రతను ఎప్పటికప్పుడు గమనిస్తూ ఉండండి.\n• జ్వరం ఎక్కువగా ఉంటే లేదా రెండు మూడు రోజుల్లో తగ్గకపోతే వెంటనే మీ గ్రామ ఆశా కార్యకర్తను లేదా సమీప ప్రాథమిక ఆరోగ్య కేంద్రం (PHC) వైద్యుడిని సంప్రదించండి.\n*(గమనిక: ఇది ప్రాథమిక ఆరోగ్య విద్య మరియు సంరక్షణ మార్గదర్శకత్వం మాత్రమే; రోగ నిర్ధారణ కాదు.)*',
        speech: 'నమస్కారం అండీ. మీకు జ్వరం ఉందని అర్థమైంది. దీనితో పాటు మీకు చలి, దగ్గు లేదా శ్వాస తీసుకోవడంలో ఇబ్బంది ఏమైనా ఉందా? దయచేసి పుష్కలంగా విశ్రాంతి తీసుకోండి మరియు నీరు తాగండి. జ్వరం తగ్గకపోతే వెంటనే మీ ఆశా కార్యకర్తను లేదా డాక్టర్‌ను సంప్రదించండి.',
      },
      hi: {
        text: 'नमस्ते। मैंने समझा कि आपको बुखार या सिरदर्द की परेशानी है।\n\n**लक्षणों को समझने के लिए एक प्रश्न:**\nक्या बुखार के साथ आपको ठंड लगना, तेज खांसी या सांस लेने में कोई तकलीफ भी हो रही है?\n\n💡 **प्राथमिक देखभाल सलाह:**\n• भरपूर आराम करें और गुनगुना उबला पानी पिएं।\n• हल्का और सुपाच्य भोजन लें।\n• शरीर का तापमान नोट करते रहें।\n• यदि बुखार तेज है या दो-तीन दिनों में ठीक नहीं होता है, तो तुरंत अपनी आशा कार्यकर्ता या नजदीकी प्राथमिक स्वास्थ्य केंद्र (PHC) में डॉक्टर को दिखाएं।\n*(नोट: यह सामान्य स्वास्थ्य शिक्षा है; चिकित्सीय निदान नहीं।)*',
        speech: 'नमस्ते। मैं समझ रही हूँ कि आपको बुखार है। क्या इसके साथ आपको ठंड या खांसी भी महसूस हो रही है? कृपया पर्याप्त आराम करें और पानी पिएं। यदि बुखार न उतरे तो नजदीकी स्वास्थ्य केंद्र में डॉक्टर को जरूर दिखाएं।',
      },
      ta: {
        text: 'வணக்கம். உங்களுக்கு காய்ச்சல் அல்லது உடல் வலி இருப்பது தெரிகிறது.\n\n**ஒரு கேள்வி:**\nகாய்ச்சலுடன் குளிர்நடுக்கம், கடுமையான இருமல் அல்லது மூச்சுத்திணறல் ஏதேனும் உள்ளதா?\n\n💡 **பொதுவான பராமரிப்பு:**\n• போதிய ஓய்வு எடுங்கள், காய்ச்சிய குடிநீரை அதிகமாக அருந்துங்கள்.\n• இரண்டு நாட்களுக்கு மேல் நீடித்தால் ஆரம்ப சுகாதார நிலைய மருத்துவரை அணுகவும்.\n*(குறிப்பு: இது பொதுவான தகவல் மட்டுமே; நோய் கண்டறிதல் அல்ல).*',
        speech: 'வணக்கம். உங்களுக்கு காய்ச்சல் இருப்பது புரிகிறது. இத்துடன் நடுக்கம் அல்லது இருமல் உள்ளதா? ஓய்வெடுத்து நீர் அருந்துங்கள். காய்ச்சல் குறையவில்லை என்றால் ஆரம்ப சுகாதார நிலைய மருத்துவரை அணுகவும்.',
      },
      kn: {
        text: 'ನಮಸ್ಕಾರ. ನಿಮಗೆ ಜ್ವರ ಅಥವಾ ತಲೆನೋವು ಇರುವುದು ತಿಳಿಯಿತು.\n\n**ಒಂದು ಪ್ರಶ್ನೆ:**\nಜ್ವರದೊಂದಿಗೆ ನಡುಕ, ಕೆಮ್ಮು ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆಯೇ?\n\n💡 **ಪ್ರಾಥಮಿಕ ಸಲಹೆ:**\n• ಸಾಕಷ್ಟು ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ ಮತ್ತು ಕಾಯಿಸಿ ಆರಿಸಿದ ನೀರನ್ನು ಕುಡಿಯಿರಿ.\n• ಎರಡು ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಮುಂದುವರಿದರೆ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರದ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.\n*(ಗಮನಿಸಿ: ಇದು ಸಾಮಾನ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ; ರೋಗ ನಿರ್ಣಯವಲ್ಲ).*',
        speech: 'ನಮಸ್ಕಾರ. ನಿಮಗೆ ಜ್ವರವಿದೆ ಎಂದು ಅರ್ಥವಾಯಿತು. ಇದರೊಂದಿಗೆ ಕೆಮ್ಮು ಅಥವಾ ನಡುಕ ಇದೆಯೇ? ದಯವಿಟ್ಟು ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ. ಜ್ವರ ಮುಂದುವರಿದರೆ ಹತ್ತಿರದ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      },
      ml: {
        text: 'നമസ്കാരം. നിങ്ങൾക്ക് പനിയോ തലവേദനയോ ഉള്ളതായി മനസ്സിലാക്കുന്നു.\n\n**ഒരു ചോദ്യം:**\nപനിയോടൊപ്പം വിറയലോ, ചുമയോ, ശ്വാസമെടുക്കാൻ ബുദ്ധിമുട്ടോ ഉണ്ടോ?\n\n💡 **പ്രാഥമിക പരിചരണം:**\n• ആവശ്യത്തിന് വിശ്രമിക്കുകയും ധാരാളം തിളപ്പിച്ചാറിയ വെള്ളം കുടിക്കുകയും ചെയ്യുക.\n• രണ്ടു ദിവസത്തിലധികം തുടരുകയാണെങ്കിൽ പ്രാഥമിക ആരോഗ്യ കേന്ദ്രത്തിലെ ഡോക്ടറെ കാണുക.\n*(ശ്രദ്ധിക്കുക: ഇത് പൊതുവായ വിവരങ്ങൾ മാത്രമാണ്; രോഗനിർണ്ണയമല്ല).*',
        speech: 'നമസ്കാരം. നിങ്ങൾക്ക് പനിയുണ്ടെന്ന് മനസ്സിലായി. ഇതിനൊപ്പം വിറയലോ ചുമയോ ഉണ്ടോ? വിശ്രമിക്കുക, വെള്ളം കുടിക്കുക. പനി മാറിയില്ലെങ്കിൽ ഉടൻ ഡോക്ടറെ കാണുക.',
      },
    };

    const item = feverAnswers[lang] || feverAnswers.en;
    return {
      answerText: item.text,
      speechText: item.speech,
      language: lang,
      topic: 'general_symptoms',
      animation: 'speaking',
      navigateTo: 'hospitals',
      suggestedActions: ['Find Nearest PHC', 'Check Oral Symptoms', 'Consult ASHA Worker'],
    };
  }

  // 4. General Oral Symptoms & Follow-Up Inquiries
  if (
    q.includes('symptom') ||
    q.includes('ulcer') ||
    q.includes('patch') ||
    q.includes('tobacco') ||
    q.includes('gutkha') ||
    q.includes('burning') ||
    q.includes('pain') ||
    q.includes('పుండు') ||
    q.includes('మచ్చ') ||
    q.includes('నొప్పి') ||
    q.includes('మంట') ||
    q.includes('గుట్కా') ||
    q.includes('छाला') ||
    q.includes('दर्द') ||
    q.includes('जलन') ||
    q.includes('तंबाकू') ||
    q.includes('புண்') ||
    q.includes('வலி') ||
    q.includes('ಹುಣ್ಣು') ||
    q.includes('ನೋವು') ||
    q.includes('വ്രണം') ||
    q.includes('വേദന')
  ) {
    const generalAnswers: Record<LanguageCode, { text: string; speech: string }> = {
      en: {
        text: 'Oral Mucosa Health & Care Guidelines:\n\n**Helpful follow-up questions to understand your situation:**\n1. How long have you had this ulcer, pain, or patch?\n2. Do you chew gutkha, khaini, betel quid, or use tobacco?\n3. Can you open your mouth comfortably (at least 3 fingers vertically)?\n\n💡 **General Health Care Advice:**\n• Avoid hot, spicy, or abrasive foods that irritate the mucosa.\n• Maintain gentle twice-daily brushing and clean oral hygiene.\n• Strictly abstain from chewing tobacco, gutkha, and betel nut.\n• Consult your local ASHA worker or visit the nearest Primary Health Centre (PHC) for a visual check.\n*(Notice: General health education and screening guidance only; does not replace in-person doctor evaluation).*',
        speech: 'Practice good oral hygiene and avoid all tobacco. If any sore or patch lasts longer than two weeks, please see a health worker or doctor.',
      },
      te: {
        text: 'నోటి ఆరోగ్య సంరక్షణ సూచనలు:\n\n**మీ పరిస్థితిని సరిగ్గా అర్థం చేసుకోవడానికి కొన్ని ప్రశ్నలు:**\n1. ఈ పుండు లేదా నొప్పి ఎన్ని రోజులుగా ఉంది?\n2. మీరు పొగాకు, గుట్కా, లేదా ఖైనీ వాడుతున్నారా?\n3. మీ నోరు మూడు వేళ్లు పట్టేంత సులభంగా తెరవగలరా?\n\n💡 **సాధారణ జాగ్రత్తలు:**\n• కారమైన ఆహారాలను తగ్గించండి, రోజూ నోటిని శుభ్రంగా ఉంచుకోండి.\n• పొగాకు, గుట్కా వాడకాన్ని తక్షణమే మానివేయండి.\n• మీ స్థానిక ఆశా కార్యకర్త లేదా దగ్గరి పిహెచ్‌సిలో వైద్యుడిని సంప్రదించండి.\n*(గమనిక: ఇది సాధారణ సమాచారం మాత్రమే; రోగ నిర్ధారణ కాదు.)*',
        speech: 'నోటి పరిశుభ్రత పాటించండి మరియు పొగాకు వాడకాన్ని ఆపండి. ఈ లక్షణాలు రెండు వారాల కంటే ఎక్కువ ఉంటే మీ ఆశా కార్యకర్త లేదా డాక్టర్‌ను సంప్రదించండి.',
      },
      hi: {
        text: 'मुंह के स्वास्थ्य के लिए दिशानिर्देश:\n\n**आपकी स्थिति समझने के लिए कुछ प्रश्न:**\n1. यह छाला या दर्द कितने दिनों से है?\n2. क्या आप गुटखा, खैनी या तंबाकू का उपयोग करते हैं?\n3. क्या आप आसानी से अपना मुंह पूरा खोल पाते हैं?\n\n💡 **सामान्य सलाह:**\n• अधिक तीखे-मसालेदार भोजन से बचें और दिन में दो बार कुल्ला करें।\n• तंबाकू और गुटखा तुरंत बंद करें।\n• स्थानीय आशा कार्यकर्ता या नजदीकी प्राथमिक स्वास्थ्य केंद्र में डॉक्टर से जांच कराएं।\n*(नोट: यह सामान्य स्वास्थ्य जानकारी है; चिकित्सीय निदान नहीं।)*',
        speech: 'मुंह की सफाई रखें और तंबाकू से दूर रहें। यदि यह छाला दो सप्ताह से अधिक रहता है तो स्वास्थ्य केंद्र में दिखाएं।',
      },
      ta: {
        text: 'வாய்வழி சுகாதார வழிகாட்டுதல்கள்:\n\n**உங்கள் நிலையைப் புரிந்து கொள்ள சில கேள்விகள்:**\n1. இந்த புண் அல்லது வலி எத்தனை நாட்களாக உள்ளது?\n2. நீங்கள் புகையிலை அல்லது குட்கா பயன்படுத்துகிறீர்களா?\n3. வாயை முழுமையாக எளிதாகத் திறக்க முடிகிறதா?\n\n💡 **பொதுவான ஆலோசனை:**\n• காரமான உணவுகளைத் தவிர்க்கவும், வாயைத் தூய்மையாக வைத்திருக்கவும்.\n• புகையிலை மற்றும் குட்காவை முற்றிலும் தவிர்க்கவும்.\n• ஆஷா பணியாளர் அல்லது ஆரம்ப சுகாதார நிலைய மருத்துவரிடம் ஆலோசனை பெறவும்.\n*(குறிப்பு: இது பொதுவான தகவல் மட்டுமே; நோய் கண்டறிதல் அல்ல.)*',
        speech: 'வாய்வழி தூய்மையைப் பேணுங்கள், புகையிலையைத் தவிர்க்கவும். புண் இரண்டு வாரங்களுக்கு மேல் நீடித்தால் மருத்துவரை அணுகவும்.',
      },
      kn: {
        text: 'ಬಾಯಿಯ ಆರೋಗ್ಯ ರಕ್ಷಣಾ ಮಾರ್ಗದರ್ಶಿಗಳು:\n\n**ನಿಮ್ಮ ಪರಿಸ್ಥಿತಿಯನ್ನು ತಿಳಿಯಲು ಕೆಲವು ಪ್ರಶ್ನೆಗಳು:**\n1. ಈ ಹುಣ್ಣು ಅಥವಾ ನೋವು ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ?\n2. ನೀವು ತಂಬಾಕು, ಗುಟ್ಕಾ ಅಥವಾ ಪಾನ್ ಮಸಾಲಾ ಬಳಸುತ್ತೀರಾ?\n3. ಬಾಯಿಯನ್ನು ಸರಾಗವಾಗಿ ತೆರೆಯಲು ಸಾಧ್ಯವೇ?\n\n💡 **ಸಾಮಾನ್ಯ ಸಲಹೆಗಳು:**\n• ಖಾರವಾದ ಆಹಾರ ತಪ್ಪಿಸಿ ಮತ್ತು ನಿತ್ಯ ಬಾಯಿಯ ನೈರ್ಮಲ್ಯ ಕಾಪಾಡಿ.\n• ತಂಬಾಕು ಮತ್ತು ಗುಟ್ಕಾ ಸೇವನೆ ತಕ್ಷಣ ನಿಲ್ಲಿಸಿ.\n• ನಿಮ್ಮ ಆಶಾ ಕಾರ್ಯಕರ್ತೆ ಅಥವಾ ಪ್ರಾಥಮಿಕ ಆರೋಗ್ಯ ಕೇಂದ್ರದ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.\n*(ಗಮನಿಸಿ: ಇದು ಸಾಮಾನ್ಯ ಮಾಹಿತಿ ಮಾತ್ರ; ಖಚಿತ ರೋಗ ನಿರ್ಣಯವಲ್ಲ.)*',
        speech: 'ಬಾಯಿಯ ನೈರ್ಮಲ್ಯ ಕಾಪಾಡಿ ಮತ್ತು ತಂಬಾಕು ಬಳಸಬೇಡಿ. ಹುಣ್ಣು ಎರಡು ವಾರಗಳಿಗಿಂತ ಹೆಚ್ಚು ಕಾಲ ಉಳಿದರೆ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.',
      },
      ml: {
        text: 'വായയുടെ ആരോഗ്യ സംരക്ഷണ നിർദ്ദേശങ്ങൾ:\n\n**നിങ്ങളുടെ അവസ്ഥ മനസ്സിലാക്കാൻ ചില ചോദ്യങ്ങൾ:**\n1. ഈ വ്രണമോ വേദനയോ എത്ര ദിവസമായി ഉണ്ട്?\n2. നിങ്ങൾ പുകയിലയോ ഗുട്കയോ ഉപയോഗിക്കാറുണ്ടോ?\n3. വായ സാധാരണ പോലെ തുറക്കാൻ സാധിക്കുന്നുണ്ടോ?\n\n💡 **പൊതുവായ നിർദ്ദേശങ്ങൾ:**\n• എരിവുള്ള ഭക്ഷണം ഒഴിവാക്കുക, വായ വൃത്തിയായി സൂക്ഷിക്കുക.\n• പുകയിലയും ഗുട്കയും പൂർണ്ണമായി ഉപേക്ഷിക്കുക.\n• ആശാ പ്രവർത്തകയെയോ അടുത്തുള്ള പ്രാഥമിക ആരോഗ്യ കേന്ദ്രത്തിലെ ഡോക്ടറെയോ സമീപിക്കുക.\n*(ശ്രദ്ധിക്കുക: ഇത് പൊതുവായ വിവരങ്ങൾ മാത്രമാണ്; കൃത്യമായ രോഗനിർണ്ണയമല്ല.)*',
        speech: 'വായ വൃത്തിയായി സൂക്ഷിക്കുക, പുകയില ഒഴിവാക്കുക. വ്രണം രണ്ടാഴ്ചയിലധികം നീണ്ടുനിന്നാൽ ഡോക്ടറെ കണ്ട് പരിശോധിക്കുക.',
      },
    };

    const item = generalAnswers[lang] || generalAnswers.en;
    return {
      answerText: item.text,
      speechText: item.speech,
      language: lang,
      topic: 'oral_health_guidance',
      animation: 'speaking',
      suggestedActions: ['Start Visual Screening', 'Find Screening Camp', 'Consult ASHA Worker'],
    };
  }

  // 5. Clinical Screening Guidelines
  if (
    q.includes('screening') ||
    q.includes('guidelines') ||
    q.includes('స్క్రీనింగ్') ||
    q.includes('स्क्रीनिंग') ||
    q.includes('பரிசோதனை') ||
    q.includes('ತಪಾಸಣೆ') ||
    q.includes('സ്ക്രീനിംഗ്')
  ) {
    const answers: Record<LanguageCode, string> = {
      en: 'Field Oral Mucosal Screening Guidelines:\n\n1. **Patient Intake:** Enter demographic details and record tobacco/gutkha chewing history.\n2. **Visual Inspection:** Inspect buccal mucosa, tongue borders, palate, and lips with a clean wooden spatula and focused torch.\n3. **Mucosal Observations:** Look for persistent white patches (leukoplakia), red velvety patches (erythroplakia), non-healing ulcers (> 2 weeks), or restricted mouth opening (submucous fibrosis).\n4. **Photo Attachment:** Take a well-lit oral photo for Medical Officer verification.\n\n⚠️ Safety Reminder: Never state disease stage or diagnosis to the beneficiary; recommend clinical evaluation at the nearest PHC.',
      te: 'ఓరల్ మ్యూకోసల్ స్క్రీనింగ్ మార్గదర్శకాలు:\n\n1. **రోగి వివరాలు:** వ్యక్తిగత వివరాలు మరియు పొగాకు/గుట్కా అలవాట్ల కాలాన్ని నమోదు చేయండి.\n2. **నోటి పరిశీలన:** టార్చ్ లైట్ సహాయంతో బుగ్గల లోపలి భాగం, నాలుక అంచులు, అంగిలి పరిశీలించండి.\n3. **ముఖ్యమైన లక్షణాలు:** తెల్లటి మచ్చలు, ఎర్రటి మచ్చలు, 2 వారాల కంటే ఎక్కువ కాలం మానని పుండ్లు లేదా నోరు తెరవడం కష్టంగా ఉండటం వంటివి గమనించండి.\n4. **ఫోటో:** స్పష్టమైన ఫోటో తీసి మెడికల్ ఆఫీసర్ సమీక్ష కోసం పంపండి.\n\n⚠️ భద్రత: రోగికి వ్యాధి పేరు చెప్పవద్దు; దగ్గరలోని ప్రాథమిక ఆరోగ్య కేంద్రంలో చూపించుకోవాలని సూచించండి.',
      hi: 'ओरल स्क्रीनिंग निर्देश:\n\n1. मरीज की जानकारी और तंबाकू के उपयोग की अवधि दर्ज करें।\n2. रोशनी में गाल के भीतरी भाग, जीभ और तालु का ध्यानपूर्वक निरीक्षण करें।\n3. सफेद धब्बे, लाल पैच या 2 सप्ताह से अधिक पुराने न भरने वाले छालों को दर्ज करें।\n4. फोटो खींचकर चिकित्सा अधिकारी को भेजें।',
      ta: 'வாய்வழி பரிசோதனை வழிகாட்டுதல்கள்: வெள்ளை திட்டுக்கள், சிவப்பு திட்டுகள் அல்லது 2 வாரங்களுக்கு மேலாக குணமாகாத புண்களைக் கவனித்து புகைப்படம் எடுக்கவும்.',
      kn: 'ತಪಾಸಣಾ ಮಾರ್ಗದರ್ಶಿಗಳು: ಬಿಳಿ ತೇಪೆ, ಕೆಂಪು ತೇಪೆ ಅಥವಾ 2 ವಾರಕ್ಕಿಂತ ಹಳೆಯದಾದ ಹುಣ್ಣುಗಳನ್ನು ಗಮನಿಸಿ ಫೋಟೋ ತೆಗೆಯಿರಿ.',
      ml: 'വെളുത്ത പാടുകൾ, ചുവന്ന പാടുകൾ, ഉണങ്ങാത്ത വ്രണങ്ങൾ എന്നിവ രേഖപ്പെടുത്തി ഫോട്ടോ സമർപ്പിക്കുക.',
    };

    return {
      answerText: answers[lang] || answers.en,
      speechText:
        lang === 'te'
          ? 'నోటి లోపల తెల్లటి లేదా ఎర్రటి మచ్చలు, మానని పుండ్లు కనిపిస్తే వెంటనే ఫోటో తీసి నమోదు చేయండి.'
          : 'Observe for persistent patches or non-healing ulcers and capture a clear photograph.',
      language: lang,
      topic: 'screening_workflow',
      animation: 'speaking',
      navigateTo: 'screening',
      suggestedActions: ['Open Screening Form', 'View MO Queue'],
    };
  }

  // 4. Current Page / Context-Aware Assistance
  const currentModule = APPLICATION_MODULES[activeTab] || APPLICATION_MODULES.dashboard;
  const moduleName = currentModule.name[lang] || currentModule.name.en;
  const moduleSummary = currentModule.summary[lang] || currentModule.summary.en;
  const moduleSteps = currentModule.instructions[lang] || currentModule.instructions.en;

  const formattedInstructions = moduleSteps.map((step, idx) => `${idx + 1}. ${step}`).join('\n');

  const answer = `📍 **${moduleName}**\n\n${moduleSummary}\n\n**Key Actions on this screen:**\n${formattedInstructions}`;

  return {
    answerText: answer,
    speechText: `${moduleName}: ${moduleSummary.substring(0, 160)}...`,
    language: lang,
    topic: 'context_help',
    animation: 'speaking',
    suggestedActions: [
      'What is Aarogya-Drishti?',
      'How does Offline Sync work?',
      'How to record an oral screening?',
    ],
  };
}

