/**
 * Notification Templates Registry
 *
 * CLINICAL SAFETY INVARIANT:
 * All notification templates must contain ZERO clinical diagnostic claims, staging assertions,
 * or treatment outcome promises. All oral examinations are described as visual screenings
 * requiring specialist consultation for clinical evaluation.
 */

export type SupportedLanguage = 'en' | 'te' | 'hi';

export interface LocalizedTemplateText {
  title: string;
  body: string;
}

export interface NotificationTemplateDefinition {
  templateId: string;
  category: 'screening' | 'referral' | 'camp' | 'duplicate_alert' | 'security' | 'advisory' | 'appointment' | 'urgent' | 'otp';
  description: string;
  requiredParams: string[];
  translations: Record<SupportedLanguage, LocalizedTemplateText>;
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplateDefinition> = {
  SCREENING_RECORDED: {
    templateId: 'SCREENING_RECORDED',
    category: 'screening',
    description: 'Triggered when a frontline visual oral health screening session is submitted.',
    requiredParams: ['patientId'],
    translations: {
      en: {
        title: 'Oral Health Screening Recorded',
        body: 'Visual oral health screening session for patient {patientId} has been recorded. Review visual findings and follow-up recommendations.',
      },
      te: {
        title: 'నోటి ఆరోగ్య స్క్రీనింగ్ నమోదు చేయబడింది',
        body: 'రోగి {patientId} కోసం దృశ్య నోటి ఆరోగ్య స్క్రీనింగ్ సెషన్ నమోదు చేయబడింది. పరిశీలనలు మరియు తదుపరి సిఫార్సులను సమీక్షించండి.',
      },
      hi: {
        title: 'मौखिक स्वास्थ्य स्क्रीनिंग दर्ज की गई',
        body: 'रोगी {patientId} के लिए दृश्य मौखिक स्वास्थ्य स्क्रीनिंग सत्र दर्ज किया गया है। दृश्य निष्कर्षों और अनुवर्ती सिफारिशों की समीक्षा करें।',
      },
    },
  },

  REFERRAL_DISPATCHED: {
    templateId: 'REFERRAL_DISPATCHED',
    category: 'referral',
    description: 'Triggered when a patient referral is submitted for specialist evaluation.',
    requiredParams: ['patientId', 'facilityName'],
    translations: {
      en: {
        title: 'Clinical Referral Consultation Requested',
        body: 'Patient {patientId} has been referred for specialist clinical review at {facilityName}.',
      },
      te: {
        title: 'క్లినికల్ రిఫరల్ సంప్రదింపు అభ్యర్థించబడింది',
        body: 'రోగి {patientId} {facilityName} వద్ద నిపుణుల క్లినికల్ సమీక్ష కోసం రిఫర్ చేయబడ్డారు.',
      },
      hi: {
        title: 'नैदानिक रेफरल परामर्श का अनुरोध किया गया',
        body: 'रोगी {patientId} को {facilityName} में विशेषज्ञ नैदानिक समीक्षा के लिए संदर्भित किया गया है।',
      },
    },
  },

  CAMP_SCHEDULED: {
    templateId: 'CAMP_SCHEDULED',
    category: 'camp',
    description: 'Triggered when a community screening outreach camp is scheduled.',
    requiredParams: ['villageName', 'campDate'],
    translations: {
      en: {
        title: 'Oral Screening Camp Scheduled',
        body: 'Community oral health outreach screening camp scheduled at {villageName} on {campDate}.',
      },
      te: {
        title: 'నోటి స్క్రీనింగ్ శిబిరం షెడ్యూల్ చేయబడింది',
        body: '{campDate} తేదీన {villageName} వద్ద కమ్యూనిటీ నోటి ఆరోగ్య స్క్రీనింగ్ శిబిరం షెడ్యూల్ చేయబడింది.',
      },
      hi: {
        title: 'मौखिक स्क्रीनिंग शिविर निर्धारित किया गया',
        body: '{campDate} को {villageName} में सामुदायिक मौखिक स्वास्थ्य स्क्रीनिंग शिविर निर्धारित किया गया है।',
      },
    },
  },

  DUPLICATE_ALERT: {
    templateId: 'DUPLICATE_ALERT',
    category: 'duplicate_alert',
    description: 'Triggered when a new intake has demographic similarity with an existing patient record.',
    requiredParams: ['patientId', 'score'],
    translations: {
      en: {
        title: 'Duplicate Patient Intake Review Required',
        body: 'Potential duplicate intake flagged for patient {patientId} with similarity score {score}%. Manual resolution required.',
      },
      te: {
        title: 'సారూప్య రోగి నమోదు సమీక్ష అవసరం',
        body: 'రోగి {patientId} కోసం {score}% సారూప్యతతో సంభావ్య నకిలీ నమోదు గుర్తించబడింది. మాన్యువల్ పరిష్కారం అవసరం.',
      },
      hi: {
        title: 'समान रोगी पंजीकरण समीक्षा आवश्यक',
        body: 'रोगी {patientId} के लिए {score}% समानता स्कोर के साथ संभावित डुप्लिकेट पंजीकरण ध्वजांकित किया गया है। मैन्युअल समाधान आवश्यक है।',
      },
    },
  },

  SECURITY_ALERT: {
    templateId: 'SECURITY_ALERT',
    category: 'security',
    description: 'Triggered when a login session or device change is authenticated.',
    requiredParams: ['deviceInfo', 'timestamp'],
    translations: {
      en: {
        title: 'New Device Authentication Session',
        body: 'A login was authenticated from {deviceInfo} at {timestamp}. Review active devices if unrecognized.',
      },
      te: {
        title: 'కొత్త పరికర ప్రమాణీకరణ సెషన్',
        body: '{timestamp} సమయానికి {deviceInfo} నుండి లాగిన్ ప్రమాణీకరించబడింది. తెలియని పరికరం అయితే సమీక్షించండి.',
      },
      hi: {
        title: 'नया उपकरण प्रमाणीकरण सत्र',
        body: '{timestamp} पर {deviceInfo} से नया लॉगिन प्रमाणित किया गया। अपरिचित होने पर सक्रिय उपकरणों की समीक्षा करें।',
      },
    },
  },

  SYSTEM_ADVISORY: {
    templateId: 'SYSTEM_ADVISORY',
    category: 'advisory',
    description: 'Triggered for operational announcements and system notices.',
    requiredParams: ['message'],
    translations: {
      en: {
        title: 'Aarogya Drishti System Advisory',
        body: '{message}',
      },
      te: {
        title: 'ఆరోగ్య దృష్టి సిస్టమ్ ప్రకటన',
        body: '{message}',
      },
      hi: {
        title: 'आरोग्य दृष्टि सिस्टम सूचना',
        body: '{message}',
      },
    },
  },

  OTP_DELIVERY: {
    templateId: 'OTP_DELIVERY',
    category: 'otp',
    description: 'Triggered when a patient requests a mobile authentication code.',
    requiredParams: ['otpCode', 'validMinutes'],
    translations: {
      en: {
        title: 'Aarogya Drishti Login Code',
        body: 'Your verification code is {otpCode}. Valid for {validMinutes} minutes. Never share this code with anyone.',
      },
      te: {
        title: 'ఆరోగ్య దృష్టి లాగిన్ కోడ్',
        body: 'మీ ధృవీకరణ కోడ్ {otpCode}. ఇది {validMinutes} నిమిషాల వరకు చెల్లుబాటు అవుతుంది. ఎవరితోనూ పంచుకోవద్దు.',
      },
      hi: {
        title: 'आरोग्य दृष्टि लॉगिन कोड',
        body: 'आपका सत्यापन कोड {otpCode} है। यह {validMinutes} मिनट के लिए मान्य है। इसे किसी के साथ साझा न करें।',
      },
    },
  },

  APPOINTMENT_REQUESTED: {
    templateId: 'APPOINTMENT_REQUESTED',
    category: 'appointment',
    description: 'Triggered when an appointment consultation is requested.',
    requiredParams: ['patientName', 'slotTime', 'hospitalName'],
    translations: {
      en: {
        title: 'Appointment Consultation Requested',
        body: 'Appointment requested for {patientName} at {hospitalName} for slot {slotTime}. Awaiting facility confirmation.',
      },
      te: {
        title: 'అపాయింట్‌మెంట్ సంప్రదింపు అభ్యర్థించబడింది',
        body: '{patientName} కోసం {hospitalName} వద్ద {slotTime} సమయానికి అపాయింట్‌మెంట్ అభ్యర్థించబడింది. ఆసుపత్రి ధృవీకరణ పెండింగ్‌లో ఉంది.',
      },
      hi: {
        title: 'अपॉइंटमेंट परामर्श का अनुरोध किया गया',
        body: '{hospitalName} में {slotTime} स्लॉट के लिए {patientName} के लिए अपॉइंटमेंट का अनुरोध किया गया है। अस्पताल की पुष्टि की प्रतीक्षा है।',
      },
    },
  },

  APPOINTMENT_CONFIRMED: {
    templateId: 'APPOINTMENT_CONFIRMED',
    category: 'appointment',
    description: 'Triggered when destination hospital confirms an appointment.',
    requiredParams: ['patientName', 'slotTime', 'hospitalName'],
    translations: {
      en: {
        title: 'Appointment Consultation Confirmed',
        body: 'Consultation confirmed for {patientName} at {hospitalName} on {slotTime}. Please arrive 15 minutes prior.',
      },
      te: {
        title: 'అపాయింట్‌మెంట్ సంప్రదింపు ధృవీకరించబడింది',
        body: '{hospitalName} వద్ద {patientName} కోసం {slotTime} సమయానికి సంప్రదింపు ధృవీకరించబడింది. 15 నిమిషాల ముందుగా హాజరుకాగలరు.',
      },
      hi: {
        title: 'अपॉइंटमेंट परामर्श की पुष्टि की गई',
        body: '{hospitalName} में {slotTime} को {patientName} के लिए परामर्श की पुष्टि की गई है। कृपया 15 मिनट पहले पहुंचे।',
      },
    },
  },

  APPOINTMENT_CANCELLED: {
    templateId: 'APPOINTMENT_CANCELLED',
    category: 'appointment',
    description: 'Triggered when an appointment is cancelled.',
    requiredParams: ['patientName', 'reason'],
    translations: {
      en: {
        title: 'Appointment Consultation Cancelled',
        body: 'Appointment consultation for {patientName} was cancelled. Reason: {reason}.',
      },
      te: {
        title: 'అపాయింట్‌మెంట్ సంప్రదింపు రద్దు చేయబడింది',
        body: '{patientName} కోసం అపాయింట్‌మెంట్ సంప్రదింపు రద్దు చేయబడింది. కారణం: {reason}.',
      },
      hi: {
        title: 'अपॉइंटमेंट परामर्श रद्द किया गया',
        body: '{patientName} के लिए अपॉइंटमेंट परामर्श रद्द कर दिया गया है। कारण: {reason}।',
      },
    },
  },

  URGENT_CONSULT_ALERT: {
    templateId: 'URGENT_CONSULT_ALERT',
    category: 'urgent',
    description: 'Triggered when an urgent consultation request is submitted.',
    requiredParams: ['patientId', 'urgencyReason', 'hospitalName'],
    translations: {
      en: {
        title: 'URGENT: Oral Consultation Alert',
        body: 'Urgent consultation flagged for patient {patientId} at {hospitalName}. Reason: {urgencyReason}. Immediate clinician triage requested.',
      },
      te: {
        title: 'అత్యవసరం: నోటి సంప్రదింపు హెచ్చరిక',
        body: '{hospitalName} వద్ద రోగి {patientId} కోసం అత్యవసర సంప్రదింపు గుర్తించబడింది. కారణం: {urgencyReason}. తక్షణ వైద్య సమీక్ష అవసరం.',
      },
      hi: {
        title: 'अति आवश्यक: मौखिक परामर्श अलर्ट',
        body: '{hospitalName} में मरीज {patientId} के लिए तत्काल परामर्श ध्वजांकित किया गया है। कारण: {urgencyReason}। तत्काल नैदानिक ट्राइएज का अनुरोध।',
      },
    },
  },

  NEW_REPORT_RELEASED: {
    templateId: 'NEW_REPORT_RELEASED',
    category: 'screening',
    description: 'Triggered when a Medical Officer authorizes and releases screening summary for patient viewing.',
    requiredParams: ['patientId'],
    translations: {
      en: {
        title: 'Screening Summary Released',
        body: 'Your visual oral health screening summary for patient {patientId} has been reviewed and released by your Medical Officer. You can now download your report.',
      },
      te: {
        title: 'స్క్రీనింగ్ నివేదిక విడుదల చేయబడింది',
        body: 'రోగి {patientId} కోసం మీ దృశ్య నోటి ఆరోగ్య స్క్రీనింగ్ నివేదిక మెడికల్ ఆఫీసర్ ద్వారా సమీక్షించబడి విడుదల చేయబడింది. మీరు ఇప్పుడు మీ నివేదికను డౌన్‌లోడ్ చేసుకోవచ్చు.',
      },
      hi: {
        title: 'स्क्रीनिंग सारांश जारी किया गया',
        body: 'रोगी {patientId} के लिए आपका दृश्य मौखिक स्वास्थ्य स्क्रीनिंग सारांश आपके चिकित्सा अधिकारी द्वारा समीक्षा कर जारी कर दिया गया है। अब आप अपनी रिपोर्ट डाउनलोड कर सकते हैं।',
      },
    },
  },

  FOLLOWUP_REMINDER: {
    templateId: 'FOLLOWUP_REMINDER',
    category: 'referral',
    description: 'Triggered for navigation follow-up clinic attendance.',
    requiredParams: ['patientId', 'facilityName', 'dueDate'],
    translations: {
      en: {
        title: 'Oral Health Follow-Up Reminder',
        body: 'Reminder: Scheduled oral health review for patient {patientId} at {facilityName} is due on {dueDate}.',
      },
      te: {
        title: 'నోటి ఆరోగ్య తదుపరి సమీక్ష రిమైండర్',
        body: 'రిమైండర్: {facilityName} వద్ద రోగి {patientId} కోసం షెడ్యూల్ చేయబడిన నోటి ఆరోగ్య సమీక్ష {dueDate} నాటికి గడువు ఉంది.',
      },
      hi: {
        title: 'मौखिक स्वास्थ्य फॉलो-अप रिमाइंडर',
        body: 'स्मरण पत्र: {facilityName} में रोगी {patientId} के लिए निर्धारित मौखिक स्वास्थ्य समीक्षा {dueDate} को नियत है।',
      },
    },
  },
};

/**
 * Renders a template given templateId, language, and interpolation parameters.
 */
export function renderTemplate(
  templateId: string,
  language: SupportedLanguage = 'en',
  params: Record<string, string | number> = {}
): LocalizedTemplateText {
  const tpl = NOTIFICATION_TEMPLATES[templateId];
  if (!tpl) {
    return {
      title: 'Aarogya Drishti Notification',
      body: String(params.message || 'Notification details recorded.'),
    };
  }

  const lang = (tpl.translations[language] ? language : 'en') as SupportedLanguage;
  const translation = tpl.translations[lang];

  let title = translation.title;
  let body = translation.body;

  for (const [key, val] of Object.entries(params)) {
    const placeholder = `{${key}}`;
    title = title.replaceAll(placeholder, String(val));
    body = body.replaceAll(placeholder, String(val));
  }

  return { title, body };
}
