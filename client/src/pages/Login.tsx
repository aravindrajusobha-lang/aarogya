import React, { useState } from 'react';
import { AuthUser, AuthTokens } from '../components/AuthPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageCode } from '../i18n';
import { extractIdentityFromImages } from '../services/localIdentityOcr';
import { isValidAadhaarNumber } from '../services/aadhaarQr';
import { ExtractedIdentityFields } from '../services/identityOcrTypes';
import '../styles/Dashboard.css';

export interface LoginProps {
  currentLang?: LanguageCode;
  requireServerAuth?: boolean;
  onSelectLang?: (lang: LanguageCode) => void;
  onLoginSuccess?: (user: AuthUser, tokens: AuthTokens) => void;
  onNavigateHome?: () => void;
  onPlayIntro?: () => void;
}

// Comprehensive UI Translations Dictionary
const T = {
  te: {
    appTitle: 'ఆరోగ్య దృష్టి • Aarogya-Drishti',
    appSubtitle: 'ITDA పాడేరు ఏజెన్సీ • గిరిజన డిజిటల్ టెలిమెడిసిన్ & ఏఐ స్క్రీనింగ్ పోర్టల్',
    whoAreYou: 'మీరు ఎవరూ? దయచేసి ఎంచుకోండి',
    whoAreYouSub: 'సరైన డ్యాష్‌బోర్డ్‌ను చేరుకోవడానికి మీ పాత్రను ఎంచుకోండి',
    patientRoleTitle: 'నేను రోగిని / కుటుంబ సభ్యుడను',
    patientRoleSub: 'ఆధార్ లేదా ABHA కార్డుతో ఉచిత నమోదు, నోటి ఏఐ స్క్రీనింగ్, డాక్టర్ వీడియో సంప్రదింపులు & మందుల చీటీలు.',
    doctorRoleTitle: 'నేను వైద్యుడను / వైద్యాధికారిని',
    doctorRoleSub: 'పాడేరు, అరకు మరియు గిరిజన సీహెచ్‌సీ ఆసుపత్రుల క్లినికల్ సమీక్ష, వీడియో కాల్స్ & ప్రిస్క్రిప్షన్లు.',
    adminSectionTitle: '🏛️ ITDA జిల్లా పరిపాలనా విభాగం (District Administrative Portal)',
    adminSectionSub: 'జిల్లా నోడల్ అధికారులు, సూపర్ అడ్మినిస్ట్రేటర్లు & పర్యవేక్షక బృందాల కోసం ప్రత్యేక లాగిన్.',
    adminPortalBtn: 'అడ్మిన్ లాగిన్ తెరవండి (Admin Sign In)',
    backToRole: '← పాత్ర ఎంపికకు తిరిగి వెళ్ళండి (Back)',
    doctorLoginTitle: '👨‍⚕️ వైద్యాధికారుల లాగిన్ (Doctor Clinical Portal)',
    adminLoginTitle: '🏛️ ITDA సూపర్ అడ్మిన్ లాగిన్ (Administration Portal)',
    patientTabs: {
      aadhaar: '🪪 ఆధార్ కార్డు నమోదు (OCR)',
      abha: '🆔 ABHA నంబరు నమోదు (ABDM)',
      otp: '📱 మొబైల్ ఓటీపీ లాగిన్',
      qr: '📷 ఆరోగ్య సేతు QR స్కాన్',
    },
    qrSectionTitle: '📷 ఆరోగ్య సేతు / ABHA QR కోడ్ స్కాన్ లాగిన్',
    qrSectionSub: 'ఆరోగ్య సేతు లేదా ఆయుష్మాన్ భారత్ (ABHA) యాప్ నుండి QR కోడ్‌ను స్కాన్ చేయండి లేదా క్లినిక్ కియోస్క్ కోడ్‌ను మీ మొబైల్‌తో స్కాన్ చేయండి.',
    kioskQrTitle: '🏥 క్లినిక్ కియోస్క్ QR కోడ్ (మీ మొబైల్‌తో స్కాన్ చేయండి)',
    kioskQrSub: 'మీ ఫోన్‌లోని ఆరోగ్య సేతు లేదా ABDM యాప్‌తో క్రింది QR కోడ్‌ను స్కాన్ చేసి నేరుగా లాగిన్ అవ్వండి:',
    quickDemoQr: '⚡ నమూనా గిరిజన లబ్ధిదారుని QR కోడ్ స్కాన్ చేయండి (Quick Demo)',
    qrVerifiedTitle: '✅ ఆరోగ్య సేతు ప్రొఫైల్ గుర్తించబడింది',
    qrVerifiedSub: 'క్రింది వివరాలు ఆరోగ్య సేతు QR నుండి స్వయంచాలకంగా సేకరించబడ్డాయి. ధృవీకరణ కోసం 6 అంకెల ఓటీపీని నమోదు చేయండి.',
    aadhaarUploadTitle: 'ఆధార్ కార్డు ఫోటోలను అప్‌లోడ్ చేయండి',
    aadhaarUploadSub: 'కార్డు ముందు మరియు వెనుక భాగాల ఫోటోలను తీయండి లేదా గ్యాలరీ నుండి ఎంచుకోండి. వ్యవస్థ మీ వివరాలను స్వయంచాలకంగా గుర్తిస్తుంది.',
    frontCardLabel: '1. ఆధార్ ముందు భాగం (ఫోటో & పేరు ఉన్న వైపు)',
    backCardLabel: '2. ఆధార్ వెనుక భాగం (చిరునామా ఉన్న వైపు)',
    choosePhoto: '📷 ఫోటో తీయండి / అప్‌లోడ్ చేయండి',
    retakePhoto: 'మళ్లీ ఫోటో తీయండి',
    photoUploaded: '✅ ఫోటో అప్‌లోడ్ అయింది',
    ocrAnalyzing: '🔍 ఆధార్ వివరాలను AI విశ్లేషిస్తోంది...',
    extractedDetailsTitle: '📋 గుర్తించబడిన రోగి వివరాలు (Aadhaar Extracted)',
    fullNameLabel: 'రోగి పూర్తి పేరు (Full Name)',
    genderAgeLabel: 'లింగం & వయస్సు (Gender / Age)',
    genderLabel: 'లింగం',
    ageLabel: 'వయస్సు',
    addressLabel: 'నివాస గ్రామం & చిరునామా (Tribal Address)',
    villageLabel: 'గ్రామం',
    mandalLabel: 'మండలం',
    pincodeLabel: 'పిన్‌కోడ్',
    fromQr: 'QR నుండి ఆటో-ఫిల్',
    fromOcr: 'OCR నుండి ఆటో-ఫిల్',
    manualEntry: 'మాన్యువల్‌గా నమోదు చేయండి',
    contactPhoneLabel: 'సంప్రదింపు మొబైల్ (ఐచ్ఛికం)',
    confirmRegister: 'నిర్ధారించి నమోదు చేయండి',
    invalidAadhaar: 'ఆధార్ సంఖ్య చెల్లదు. కార్డు చదివిన సంఖ్యను సరిచూడండి.',
    invalidPincode: 'పిన్‌కోడ్ 6 అంకెలు ఉండాలి.',
    landmarkLabel: 'స్థానిక గుర్తింపు ల్యాండ్‌మార్క్ (Habitation Landmark)',
    maskedAadhaarLabel: 'ఆధార్ సంఖ్య (Masked Aadhaar ID)',
    aadhaarConsent: 'ఈ డెమోలో కార్డు వివరాలను ఈ పరికరంలో మాత్రమే చదవడానికి నేను సమ్మతిస్తున్నాను.',
    abhaSectionTitle: '🆔 ఆయుష్మాన్ భారత్ హెల్త్ అకౌంట్ (ABHA / ABDM)',
    abhaSectionSub: 'భారత ప్రభుత్వ ABDM నెట్‌వర్క్‌తో అనుసంధానించబడిన 14 అంకెల ABHA నంబరు లేదా చిరునామాను నమోదు చేయండి.',
    abhaInputLabel: '14 అంకెల ABHA నంబరు లేదా @abdm చిరునామా',
    abhaPlaceholder: 'ఉదా: 14-8492-3814-7731 లేదా bonangi@abdm',
    abhaVerifyBtn: '🔍 ABHA ప్రొఫైల్‌ను పరిశీలించండి (Verify ABDM)',
    abhaVerifying: '🔄 ABDM సర్వర్‌లో వివరాలు శోధిస్తోంది...',
    abhaVerifiedTitle: '✅ ధృవీకరించబడిన ABDM హెల్త్ రికార్డ్ (Profile Linked)',
    phoneForOtpLabel: 'ధృవీకరణ కొరకు 10 అంకెల మొబైల్ నంబరు',
    sendOtpBtn: 'ఓటీపీ పంపండి',
    enterOtpLabel: '6 అంకెల ఓటీపీని నమోదు చేయండి (డెమో కోడ్: 123456)',
    verifyAndLoginPatient: '✅ ఓటీపీ ధృవీకరించి రోగి డ్యాష్‌బోర్డ్‌లోకి వెళ్ళండి',
    loginPatientDirect: '📱 రోగి డ్యాష్‌బోర్డ్‌లోకి వెళ్ళండి',
    doctorUsernameLabel: 'డాక్టర్ యూజర్‌నేమ్ (Username)',
    doctorPasswordLabel: 'రహస్య సంకేతపదం (Password)',
    doctorSubmitBtn: 'డాక్టర్ పోర్టల్‌లోకి లాగిన్ అవ్వండి',
    adminUsernameLabel: 'అడ్మిన్ యూజర్‌నేమ్ (Admin Username)',
    adminPasswordLabel: 'రహస్య సంకేతపదం (Password)',
    adminSubmitBtn: 'అడ్మిన్ డ్యాష్‌బోర్డ్‌లోకి లాగిన్ అవ్వండి',
    simulationNotice: '⚠️ డెమో సిస్టమ్. పూర్తి ఆధార్ సంఖ్య లేదా కార్డు ఫోటోలు ఎప్పుడూ పంపబడవు లేదా నిల్వ చేయబడవు. సమ్మతించిన ప్రొఫైల్ వివరాలు నమోదు కోసం సేవ్ అవుతాయి.',
    verifyingText: 'ధృవీకరిస్తోంది...',
    loggingInText: 'లాగిన్ అవుతోంది...',
  },
  en: {
    appTitle: 'Aarogya-Drishti • ఆరోగ్య దృష్టి',
    appSubtitle: 'ITDA Paderu Agency • Tribal Digital Telemedicine & AI Screening Platform',
    whoAreYou: 'Who are you? Please choose',
    whoAreYouSub: 'Select your role to access your dedicated healthcare portal',
    patientRoleTitle: 'I am a Patient / Family Member',
    patientRoleSub: 'Free registration via Aadhaar or ABHA, AI oral mucosal screening, doctor video calls & digital prescriptions.',
    doctorRoleTitle: 'I am a Doctor / Medical Officer',
    doctorRoleSub: 'Clinical review, live telemedicine video consultations & digital Rx for Paderu and tribal CHC hospitals.',
    adminSectionTitle: '🏛️ ITDA District Administrative Portal',
    adminSectionSub: 'Dedicated portal for District Nodal Officers, System Administrators & Healthcare Supervisors.',
    adminPortalBtn: 'Access Admin Portal (Sign In)',
    backToRole: '← Back to Role Selection',
    doctorLoginTitle: '👨‍⚕️ Medical Officer & Clinician Login',
    adminLoginTitle: '🏛️ ITDA Super Administrator Login',
    patientTabs: {
      aadhaar: '🪪 Aadhaar Card OCR',
      abha: '🆔 ABHA Number (ABDM)',
      otp: '📱 Mobile OTP Login',
      qr: '📷 Aarogya Setu QR Scan',
    },
    qrSectionTitle: '📷 Aarogya Setu / ABHA QR Code Scan Login',
    qrSectionSub: 'Scan patient QR code from Aarogya Setu / ABHA app, or display clinic kiosk QR code to scan with your mobile phone.',
    kioskQrTitle: '🏥 Clinic Kiosk QR Code (Scan with Your Mobile Phone)',
    kioskQrSub: 'Open Aarogya Setu or ABHA app on your mobile and scan this kiosk code to connect instantly:',
    quickDemoQr: '⚡ Scan Sample Aarogya Setu Beneficiary QR (Quick Demo)',
    qrVerifiedTitle: '✅ Aarogya Setu Profile Recognized',
    qrVerifiedSub: 'Patient demographics extracted from Aarogya Setu QR code. Confirm 6-digit verification code to enter dashboard.',
    aadhaarUploadTitle: 'Upload Aadhaar Card Photos',
    aadhaarUploadSub: 'Capture or upload front and back photos of your Aadhaar card. The system automatically reads your details.',
    frontCardLabel: '1. Aadhaar Front (Photo & Name side)',
    backCardLabel: '2. Aadhaar Back (Address & Landmark side)',
    choosePhoto: '📷 Take Photo / Upload',
    retakePhoto: 'Retake photo',
    photoUploaded: '✅ Photo Uploaded',
    ocrAnalyzing: '🔍 AI is scanning Aadhaar details...',
    extractedDetailsTitle: '📋 Extracted Patient Details (Aadhaar OCR)',
    fullNameLabel: 'Full Patient Name',
    genderAgeLabel: 'Gender / Age',
    genderLabel: 'Gender',
    ageLabel: 'Age',
    addressLabel: 'Tribal Village & Mandal Address',
    villageLabel: 'Village',
    mandalLabel: 'Mandal',
    pincodeLabel: 'Pincode',
    fromQr: 'Auto-filled from QR',
    fromOcr: 'Auto-filled from OCR',
    manualEntry: 'Manual entry required',
    contactPhoneLabel: 'Contact mobile (optional)',
    confirmRegister: 'Confirm & Register',
    invalidAadhaar: 'Aadhaar number is invalid. Check the number read from the card.',
    invalidPincode: 'Pincode must contain 6 digits.',
    landmarkLabel: 'Habitation Landmark',
    maskedAadhaarLabel: 'Masked Aadhaar Number',
    aadhaarConsent: 'I consent to reading the card details on this device only in this demo.',
    abhaSectionTitle: '🆔 Ayushman Bharat Health Account (ABHA / ABDM)',
    abhaSectionSub: 'Enter your 14-digit ABHA number or @abdm address linked with National Health Authority network.',
    abhaInputLabel: '14-Digit ABHA Number or @abdm Address',
    abhaPlaceholder: 'e.g. 14-8492-3814-7731 or bonangi@abdm',
    abhaVerifyBtn: '🔍 Verify ABDM Profile',
    abhaVerifying: '🔄 Fetching ABDM Profile...',
    abhaVerifiedTitle: '✅ Verified ABDM Health Record (Profile Linked)',
    phoneForOtpLabel: '10-Digit Mobile Number for Verification',
    sendOtpBtn: 'Send OTP',
    enterOtpLabel: 'Enter 6-Digit OTP (Demo Code: 123456)',
    verifyAndLoginPatient: '✅ Verify OTP & Enter Patient Dashboard',
    loginPatientDirect: '📱 Enter Patient Dashboard',
    doctorUsernameLabel: 'Doctor Username',
    doctorPasswordLabel: 'Password',
    doctorSubmitBtn: 'Login to Doctor Review Portal',
    adminUsernameLabel: 'Administrator Username',
    adminPasswordLabel: 'Administrator Password',
    adminSubmitBtn: 'Login to Administrative Dashboard',
    simulationNotice: '⚠️ Demo system. The full Aadhaar number and card photos are never sent or stored. Consented profile details are saved for registration.',
    verifyingText: 'Verifying...',
    loggingInText: 'Logging in...',
  },
  hi: {
    appTitle: 'आरोग्य दृष्टि • Aarogya-Drishti',
    appSubtitle: 'आईटीडीए पाडेरु एजेंसी • जनजातीय डिजिटल टेलीमेडिसिन एवं एआई स्क्रीनिंग पोर्टल',
    whoAreYou: 'आप कौन हैं? कृपया चुनें',
    whoAreYouSub: 'अपने समर्पित स्वास्थ्य पोर्टल तक पहुंचने के लिए अपनी भूमिका चुनें',
    patientRoleTitle: 'मैं एक मरीज / परिवार का सदस्य हूँ',
    patientRoleSub: 'आधार या आभा कार्ड से नि:शुल्क पंजीकरण, मौखिक एआई स्क्रीनिंग, डॉक्टर वीडियो परामर्श और डिजिटल नुस्खे।',
    doctorRoleTitle: 'मैं एक डॉक्टर / चिकित्सा अधिकारी हूँ',
    doctorRoleSub: 'पाडेरु और जनजातीय अस्पतालों के लिए क्लीनिकल समीक्षा, वीडियो परामर्श और डिजिटल पर्चा जारी करना।',
    adminSectionTitle: '🏛️ आईटीडीए जिला प्रशासनिक पोर्टल (District Admin Portal)',
    adminSectionSub: 'जिला नोडल अधिकारियों, सुपर प्रशासकों एवं निगरानी टीमों के लिए समर्पित लॉगिन।',
    adminPortalBtn: 'एडमिन लॉगिन खोलें (Admin Sign In)',
    backToRole: '← भूमिका चयन पर वापस जाएं',
    doctorLoginTitle: '👨‍⚕️ चिकित्सा अधिकारी लॉगिन (Doctor Portal)',
    adminLoginTitle: '🏛️ आईटीडीए सुपर एडमिन लॉगिन (Admin Portal)',
    patientTabs: {
      aadhaar: '🪪 आधार कार्ड पंजीकरण (OCR)',
      abha: '🆔 आभा संख्या पंजीकरण (ABDM)',
      otp: '📱 मोबाइल ओटीपी लॉगिन',
      qr: '📷 आरोग्य सेतु QR स्कैन',
    },
    qrSectionTitle: '📷 आरोग्य सेतु / आभा क्यूआर कोड स्कैन लॉगिन',
    qrSectionSub: 'आरोग्य सेतु या आभा ऐप से क्यूआर कोड स्कैन करें या क्लिनिक कियोस्क कोड को अपने मोबाइल से स्कैन करें।',
    kioskQrTitle: '🏥 क्लिनिक कियोस्क क्यूआर कोड (अपने मोबाइल से स्कैन करें)',
    kioskQrSub: 'अपने मोबाइल पर आरोग्य सेतु या आभा ऐप खोलें और इस कियोस्क कोड को स्कैन करें:',
    quickDemoQr: '⚡ नमूना आरोग्य सेतु क्यूआर कोड स्कैन करें (डेमो)',
    qrVerifiedTitle: '✅ आरोग्य सेतु प्रोफ़ाइल पहचानी गई',
    qrVerifiedSub: 'आरोग्य सेतु क्यूआर से मरीज का विवरण प्राप्त हुआ। डैशबोर्ड में प्रवेश के लिए 6 अंकों का कोड दर्ज करें।',
    aadhaarUploadTitle: 'आधार कार्ड की तस्वीरें अपलोड करें',
    aadhaarUploadSub: 'अपने आधार कार्ड के आगे और पीछे की फोटो लें। सिस्टम विवरण को स्वचालित रूप से पढ़ लेगा।',
    frontCardLabel: '1. आधार सामने का भाग (फोटो और नाम)',
    backCardLabel: '2. आधार पीछे का भाग (पता और लैंडमार्क)',
    choosePhoto: '📷 फोटो लें / अपलोड करें',
    retakePhoto: 'फिर से फोटो लें',
    photoUploaded: '✅ फोटो अपलोड हो गई',
    ocrAnalyzing: '🔍 एआई आधार विवरण को स्कैन कर रहा है...',
    extractedDetailsTitle: '📋 पहचाने गए मरीज के विवरण (Aadhaar OCR)',
    fullNameLabel: 'मरीज का पूरा नाम (Full Name)',
    genderAgeLabel: 'लिंग एवं आयु (Gender / Age)',
    genderLabel: 'लिंग',
    ageLabel: 'आयु',
    addressLabel: 'आदिवासी गांव एवं पता (Tribal Address)',
    villageLabel: 'गांव',
    mandalLabel: 'मंडल',
    pincodeLabel: 'पिनकोड',
    fromQr: 'QR से स्वतः भरा गया',
    fromOcr: 'OCR से स्वतः भरा गया',
    manualEntry: 'मैन्युअल रूप से भरें',
    contactPhoneLabel: 'संपर्क मोबाइल (वैकल्पिक)',
    confirmRegister: 'पुष्टि करें और पंजीकरण करें',
    invalidAadhaar: 'आधार नंबर अमान्य है। कार्ड से पढ़े गए नंबर की जाँच करें।',
    invalidPincode: 'पिनकोड 6 अंकों का होना चाहिए।',
    landmarkLabel: 'स्थानीय लैंडमार्क (Habitation Landmark)',
    maskedAadhaarLabel: 'मास्क किया गया आधार नंबर',
    aadhaarConsent: 'मैं इस डेमो में कार्ड का विवरण केवल इसी डिवाइस पर पढ़ने की सहमति देता/देती हूँ।',
    abhaSectionTitle: '🆔 आयुष्मान भारत स्वास्थ्य खाता (ABHA / ABDM)',
    abhaSectionSub: 'राष्ट्रीय स्वास्थ्य प्राधिकरण से जुड़ा अपना 14 अंकों का आभा नंबर या @abdm पता दर्ज करें।',
    abhaInputLabel: '14 अंकों का आभा नंबर या @abdm पता',
    abhaPlaceholder: 'उदा: 14-8492-3814-7731 या bonangi@abdm',
    abhaVerifyBtn: '🔍 आभा प्रोफाइल सत्यापित करें (Verify ABDM)',
    abhaVerifying: '🔄 ABDM सर्वर से डेटा प्राप्त किया जा रहा है...',
    abhaVerifiedTitle: '✅ सत्यापित ABDM स्वास्थ्य रिकॉर्ड (Profile Linked)',
    phoneForOtpLabel: 'सत्यापन के लिए 10 अंकों का मोबाइल नंबर',
    sendOtpBtn: 'ओटीपी भेजें',
    enterOtpLabel: '6 अंकों का ओटीपी दर्ज करें (डेमो कोड: 123456)',
    verifyAndLoginPatient: '✅ ओटीपी सत्यापित करें और मरीज डैशबोर्ड खोलें',
    loginPatientDirect: '📱 मरीज डैशबोर्ड में प्रवेश करें',
    doctorUsernameLabel: 'डॉक्टर यूजरनेम (Username)',
    doctorPasswordLabel: 'पासवर्ड (Password)',
    doctorSubmitBtn: 'डॉक्टर पोर्टल में लॉगिन करें',
    adminUsernameLabel: 'एडमिन यूजरनेम (Admin Username)',
    adminPasswordLabel: 'पासवर्ड (Password)',
    adminSubmitBtn: 'एडमिन डैशबोर्ड में लॉगिन करें',
    simulationNotice: '⚠️ डेमो सिस्टम। पूरा आधार नंबर और कार्ड की तस्वीरें कभी भेजी या सहेजी नहीं जातीं। सहमति से दिए गए प्रोफ़ाइल विवरण पंजीकरण के लिए सहेजे जाते हैं।',
    verifyingText: 'सत्यापित किया जा रहा है...',
    loggingInText: 'लॉगिन हो रहा है...',
  },
};

export const Login: React.FC<LoginProps> = ({
  currentLang = 'te',
  requireServerAuth = false,
  onSelectLang,
  onLoginSuccess,
}) => {
  const [activeLang, setActiveLang] = useState<LanguageCode>(currentLang);

  // Sync active language if parent changes it
  React.useEffect(() => {
    if (currentLang && currentLang !== activeLang) {
      setActiveLang(currentLang);
    }
  }, [currentLang]);

  const handleLangChange = (l: LanguageCode) => {
    setActiveLang(l);
    if (onSelectLang) onSelectLang(l);
    try {
      localStorage.setItem('aarogya_language', l);
    } catch {}
  };

  const t = (T as Record<string, typeof T.te>)[activeLang] || T.te;
  const liveAuthUnavailable = () => activeLang === 'te'
    ? 'నిజమైన వీడియో కాల్‌లకు సర్వర్ ధృవీకరించిన లాగిన్ అవసరం. సర్వర్ లాగిన్ అందుబాటులో లేదు.'
    : activeLang === 'hi'
    ? 'लाइव वीडियो कॉल के लिए सर्वर-सत्यापित साइन-इन आवश्यक है। सर्वर लॉगिन उपलब्ध नहीं है।'
    : 'Live video calls require a server-verified sign-in. Server login is unavailable.';
  const fieldSourceText = (field: keyof ExtractedIdentityFields) => {
    const source = aadhaarFieldSources?.[field];
    return source === 'QR' ? t.fromQr : source === 'OCR' ? t.fromOcr : t.manualEntry;
  };
  const fieldNeedsReview = (field: keyof ExtractedIdentityFields, value: string | number | undefined) =>
    !value || aadhaarFieldSources?.[field] === 'OCR';
  const markAadhaarFieldManual = (field: keyof ExtractedIdentityFields) => {
    setAadhaarFieldSources((current) => ({ ...current, [field]: 'MANUAL' }));
  };

  // Portal Role: null = Role Selection Screen, 'PATIENT' = Patient Flow, 'DOCTOR' = Doctor Flow, 'ADMIN' = Admin Flow
  const [portalRole, setPortalRole] = useState<'PATIENT' | 'DOCTOR' | 'ADMIN' | null>(null);

  // Patient Sub-Mode: 'AADHAAR_REGISTER' | 'ABHA_REGISTER' | 'MOBILE_OTP'
  const [patientMode, setPatientMode] = useState<'AADHAAR_REGISTER' | 'ABHA_REGISTER' | 'MOBILE_OTP'>('AADHAAR_REGISTER');

  // Doctor Credentials
  const [doctorUsername, setDoctorUsername] = useState<string>('doctor.paderu');
  const [doctorPassword, setDoctorPassword] = useState<string>('Doctor@2026');

  // Admin Credentials
  const [adminUsername, setAdminUsername] = useState<string>('admin');
  const [adminPassword, setAdminPassword] = useState<string>('Admin@2026');

  // Common UI State
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Aadhaar Registration & OCR States
  const [aadhaarFrontUploaded, setAadhaarFrontUploaded] = useState<boolean>(false);
  const [aadhaarBackUploaded, setAadhaarBackUploaded] = useState<boolean>(false);
  const [frontImageDigest, setFrontImageDigest] = useState<string | null>(null);
  const [backImageDigest, setBackImageDigest] = useState<string | null>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState<boolean>(false);
  const [aadhaarConsent, setAadhaarConsent] = useState<boolean>(false);
  const [aadhaarFieldSources, setAadhaarFieldSources] = useState<ExtractedIdentityFields['fieldSources']>({});
  const [aadhaarNumber, setAadhaarNumber] = useState<string>('');
  const [aadhaarValid, setAadhaarValid] = useState<boolean | undefined>();
  const [aadhaarContactPhone, setAadhaarContactPhone] = useState<string>('');
  const [registeredPatientId, setRegisteredPatientId] = useState<string | null>(null);
  const [pendingPatientAuth, setPendingPatientAuth] = useState<{ user: AuthUser; tokens: AuthTokens } | null>(null);

  // Extracted Patient Info
  const [extractedName, setExtractedName] = useState<string>('');
  const [extractedGender, setExtractedGender] = useState<string>('');
  const [extractedAge, setExtractedAge] = useState<number | undefined>();
  const [extractedYearOfBirth, setExtractedYearOfBirth] = useState<number | undefined>();
  const [extractedAddress, setExtractedAddress] = useState<string>('');
  const [, setExtractedLandmark] = useState<string>('');
  const [extractedVillage, setExtractedVillage] = useState<string>('');
  const [extractedMandal, setExtractedMandal] = useState<string>('');
  const [extractedPincode, setExtractedPincode] = useState<string>('');
  const [maskedAadhaar, setMaskedAadhaar] = useState<string>('');

  // ABHA States
  const [abhaInput, setAbhaInput] = useState<string>('14-8492-3814-7731');
  const [abhaVerified, setAbhaVerified] = useState<boolean>(false);
  const [isVerifyingAbha, setIsVerifyingAbha] = useState<boolean>(false);
  const [verifiedAbhaNumber, setVerifiedAbhaNumber] = useState<string>('14-8492-3814-7731');

  // Mobile OTP States
  const [patientPhone, setPatientPhone] = useState<string>('9876543210');
  const [patientOtp, setPatientOtp] = useState<string>('');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCooldown, setOtpCooldown] = useState<number>(0);
  const [patientOtpPurpose, setPatientOtpPurpose] = useState<'REGISTER' | 'LOGIN'>('REGISTER');

  // Cooldown countdown timer
  React.useEffect(() => {
    if (otpCooldown > 0) {
      const timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCooldown]);

  const handleAadhaarImageUpload = async (file: File, side: 'front' | 'back') => {
    setIsProcessingOcr(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const reader = new FileReader();
    try {
      const image = await new Promise<string>((resolve, reject) => {
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Image could not be read.'));
        reader.onerror = () => reject(new Error('Image could not be read.'));
        reader.readAsDataURL(file);
      });
      const digestBytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const digest = Array.from(new Uint8Array(digestBytes)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if ((side === 'front' && digest === backImageDigest) || (side === 'back' && digest === frontImageDigest)) {
        throw new Error('The same photo cannot be used for both sides. Select a separate front and back photo.');
      }

      const fields = await extractIdentityFromImages([image], 'aadhaar');
      if (fields.qualityError) throw new Error(fields.qualityError);
      const usefulFields = fields.fullName || fields.maskedIdentity || fields.gender || fields.address || fields.village || fields.mandal || fields.pincode;
      if (!usefulFields) throw new Error('Aadhaar QR and text could not be read. Retake the photo with the full card in frame.');

      if (side === 'front') {
        setFrontImageDigest(digest);
        setAadhaarFrontUploaded(true);
      } else {
        setBackImageDigest(digest);
        setAadhaarBackUploaded(true);
      }
      const canApply = (field: keyof ExtractedIdentityFields) => {
        const existingSource = aadhaarFieldSources?.[field];
        const incomingSource = fields.fieldSources?.[field];
        return !(existingSource === 'QR' && incomingSource !== 'QR')
          && !(existingSource === 'MANUAL' && incomingSource === 'OCR');
      };
      if (fields.fullName && canApply('fullName')) setExtractedName(fields.fullName);
      if (fields.gender && canApply('gender')) setExtractedGender(fields.genderDisplay || fields.gender);
      if (fields.ageEstimated !== undefined && canApply('ageEstimated')) setExtractedAge(fields.ageEstimated);
      if (fields.yearOfBirth !== undefined && canApply('yearOfBirth')) setExtractedYearOfBirth(fields.yearOfBirth);
      if (fields.address && canApply('address')) setExtractedAddress(fields.address);
      if (fields.village && canApply('village')) setExtractedVillage(fields.village);
      if (fields.mandal && canApply('mandal')) setExtractedMandal(fields.mandal);
      if (fields.pincode && canApply('pincode')) setExtractedPincode(fields.pincode);
      if (fields.habitation && canApply('habitation')) setExtractedLandmark(fields.habitation);
      if (fields.aadhaarNumber) setAadhaarNumber(fields.aadhaarNumber);
      if (fields.aadhaarValid !== undefined) setAadhaarValid(fields.aadhaarValid);
      if (fields.maskedIdentity) setMaskedAadhaar(fields.maskedIdentity);
      setAadhaarFieldSources((current) => ({ ...(current || {}), ...Object.fromEntries(Object.entries(fields.fieldSources || {}).filter(([key, source]) => current?.[key as keyof ExtractedIdentityFields] !== 'MANUAL' || source !== 'OCR')) }));
      setSuccessMsg('Scan complete. Photos and Aadhaar number remain on this device.');
    } catch (error) {
      if (side === 'front') setAadhaarFrontUploaded(false);
      else setAadhaarBackUploaded(false);
      setErrorMsg(error instanceof Error ? error.message : 'Aadhaar details could not be read. Please retake the photo.');
    } finally {
      reader.onload = null;
      reader.onerror = null;
      setIsProcessingOcr(false);
    }
  };

  const handleAadhaarFrontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAadhaarImageUpload(file, 'front');
    e.target.value = '';
  };

  const handleAadhaarBackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAadhaarImageUpload(file, 'back');
    e.target.value = '';
  };

  const completePatientLogin = (user: AuthUser, tokens: AuthTokens) => {
    localStorage.setItem('aarogya_token', tokens.accessToken);
    localStorage.setItem('aarogya_tokens', JSON.stringify(tokens));
    localStorage.setItem('aarogya_user', JSON.stringify(user));
    localStorage.setItem('aarogya_patient_name', user.fullName);
    if (aadhaarContactPhone) localStorage.setItem('aarogya_patient_phone', aadhaarContactPhone);
    if (extractedAddress) localStorage.setItem('aarogya_patient_address', extractedAddress);
    if (onLoginSuccess) onLoginSuccess(user, tokens);
    else window.location.hash = '#/patient';
  };

  const handleAadhaarRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    const digits = aadhaarNumber.replace(/\D/g, '');
    if (!aadhaarConsent) {
      setErrorMsg(
        activeLang === 'te'
          ? 'దయచేసి రోగి సమ్మతిని ధృవీకరించండి'
          : activeLang === 'hi'
          ? 'कृपया सहमति की पुष्टि करें'
          : 'Please accept the consent checkbox to register'
      );
      return;
    }
    if (digits.length > 0 && !isValidAadhaarNumber(digits)) {
      setAadhaarValid(false);
      setErrorMsg(t.invalidAadhaar);
      return;
    }
    if (!extractedName.trim() || !extractedGender.trim() || !extractedAge || !extractedVillage.trim() || !extractedMandal.trim()) {
      setErrorMsg(
        activeLang === 'te'
          ? 'పేరు, లింగం, వయస్సు, గ్రామం మరియు మండలం వివరాలు అవసరం. దయచేసి వివరాలను నమోదు చేయండి.'
          : activeLang === 'hi'
          ? 'नाम, लिंग, आयु, गांव और मंडल अनिवार्य हैं। कृपया विवरण भरें।'
          : 'Name, gender, age, village, and mandal are required. Please fill in the details.'
      );
      return;
    }
    const contactPhone = aadhaarContactPhone.replace(/\D/g, '');
    if (contactPhone && !/^\d{10}$/.test(contactPhone)) {
      setErrorMsg('Contact mobile must contain 10 digits.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch('/api/v1/auth/register-aadhaar-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: aadhaarConsent,
          name: extractedName.trim(),
          yearOfBirth: extractedYearOfBirth || new Date().getFullYear() - extractedAge,
          gender: extractedGender.toLowerCase(),
          address: extractedAddress.trim(),
          village: extractedVillage.trim(),
          mandal: extractedMandal.trim(),
          pincode: /^[1-9]\d{5}$/.test(extractedPincode) ? extractedPincode : undefined,
          mobile: contactPhone || undefined,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !payload?.data) {
        setErrorMsg(payload?.error?.message || payload?.message || 'Registration failed. Please review the details and try again.');
        return;
      }
      const user = payload.data.user as AuthUser;
      const tokens: AuthTokens = {
        accessToken: payload.data.accessToken,
        refreshToken: payload.data.refreshToken,
        deviceSessionId: payload.data.deviceSessionId || '',
      };
      setRegisteredPatientId(payload.data.patientId);
      setPendingPatientAuth({ user, tokens });
      setSuccessMsg(
        activeLang === 'te'
          ? 'నమోదు పూర్తయింది! రోగి డ్యాష్‌బోర్డ్‌లోకి తీసుకెళ్తున్నాము...'
          : activeLang === 'hi'
          ? 'पंजीकरण सफल! मरीज डैशबोर्ड खुल रहा है...'
          : 'Registration successful! Opening patient portal...'
      );
      if (contactPhone) setPatientPhone(contactPhone);
      setAadhaarNumber('');
      setTimeout(() => {
        completePatientLogin(user, tokens);
      }, 350);
    } catch {
      setErrorMsg('Registration is unavailable. Check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle ABHA Verification
  const handleVerifyAbha = () => {
    if (!abhaInput || abhaInput.trim().length < 6) {
      setErrorMsg(
        activeLang === 'te'
          ? 'దయచేసి సరైన 14 అంకెల ABHA నంబరు నమోదు చేయండి.'
          : activeLang === 'hi'
          ? 'कृपया वैध 14 अंकों का आभा नंबर दर्ज करें।'
          : 'Please enter a valid 14-digit ABHA number or @abdm address.'
      );
      return;
    }

    setIsVerifyingAbha(true);
    setErrorMsg(null);

    setTimeout(() => {
      setIsVerifyingAbha(false);
      setAbhaVerified(true);
      setVerifiedAbhaNumber(abhaInput.trim());
      setExtractedName('బోనంగి బలరాజు (Bonangi Balaraju)');
      setExtractedAge(42);
      setExtractedGender('పురుషుడు (Male)');
      setExtractedAddress('వనకచింత గ్రామం, డుంబ్రిగుడ మండలం, అల్లూరి సీతారామరాజు జిల్లా');
      setSuccessMsg(
        activeLang === 'te'
          ? 'ABDM సర్వర్ నుండి రోగి ABHA ప్రొఫైల్ విజయవంతంగా అనుసంధానించబడింది!'
          : activeLang === 'hi'
          ? 'ABDM सर्वर से मरीज की आभा प्रोफाइल सफलतापूर्वक लिंक हो गई!'
          : 'ABDM Health Profile successfully verified and linked!'
      );
    }, 800);
  };

  // Direct Patient Sign In (OTP-Free)
  const handleDirectPatientLogin = async () => {
    const ph = (patientPhone || '9876543210').trim();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: ph,
          otp: '123456',
          purpose: 'LOGIN',
          deviceName: 'Patient PWA',
        }),
      });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.success && payload?.data) {
        completePatientLogin(payload.data.user, {
          accessToken: payload.data.accessToken,
          refreshToken: payload.data.refreshToken,
          deviceSessionId: payload.data.deviceSessionId || '',
        });
        return;
      }

      const suffix = ph.slice(-4) || '2026';
      const patientUser: AuthUser = {
        userId: `usr_patient_${suffix}`,
        username: `patient_${ph}`,
        role: 'patient',
        fullName: extractedName || 'Vantala Balaram (Citizen Patient)',
        phone: ph,
        hospitalId: 'hosp_paderu_dh',
        patientId: `PAT-PAD-${suffix}`,
        capabilities: ['auth:me', 'screening:read_own', 'patient:read_own', 'hospital:read', 'appointment:create', 'appointment:read'],
      };
      const patientTokens: AuthTokens = {
        accessToken: `demo_patient_token_${Date.now()}`,
        refreshToken: `demo_patient_refresh_${Date.now()}`,
        deviceSessionId: `dev_${Date.now()}`,
      };
      completePatientLogin(patientUser, patientTokens);
    } catch {
      setErrorMsg('Sign-in failed. Please check network connection.');
    } finally {
      setLoading(false);
    }
  };

  // Send Patient OTP
  const handleSendPatientOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientPhone || patientPhone.trim().length < 10) {
      setErrorMsg(
        activeLang === 'te'
          ? 'దయచేసి సరైన 10 అంకెల మొబైల్ నంబరును నమోదు చేయండి'
          : activeLang === 'hi'
          ? 'कृपया वैध 10 अंकों का मोबाइल नंबर दर्ज करें'
          : 'Please enter a valid 10-digit mobile number'
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const purpose = patientMode === 'MOBILE_OTP' ? 'LOGIN' : 'REGISTER';
    setPatientOtpPurpose(purpose);

    try {
      const res = await fetch('/api/v1/auth/patient/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: patientPhone.trim(), purpose }),
      });

      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.success) {
        setOtpSent(true);
        setOtpCooldown(60);
        setPatientOtp('123456');
        setSuccessMsg(payload.message || 'OTP Sent: 123456');
      } else if (requireServerAuth) {
        setOtpSent(false);
        setErrorMsg(liveAuthUnavailable());
      } else {
        setOtpSent(true);
        setOtpCooldown(60);
        setPatientOtp('123456');
        setSuccessMsg(
          activeLang === 'te'
            ? 'డెమో మోడ్: మీ మొబైల్ ఓటీపీ కోడ్: 123456'
            : activeLang === 'hi'
            ? 'डेमो मोड: मोबाइल ओटीपी कोड: 123456'
            : 'Demo OTP Ready: 123456'
        );
      }
    } catch {
      if (requireServerAuth) {
        setErrorMsg(liveAuthUnavailable());
        return;
      }
      setOtpSent(true);
      setOtpCooldown(60);
      setPatientOtp('123456');
      setSuccessMsg(
        activeLang === 'te'
          ? 'డెమో మోడ్: మీ మొబైల్ ఓటీపీ కోడ్: 123456'
          : activeLang === 'hi'
          ? 'डेमो मोड: मोबाइल ओटीपी कोड: 123456'
          : 'Demo OTP Ready: 123456'
      );
    } finally {
      setLoading(false);
    }
  };

  // Verify Patient OTP & Complete Registration / Login
  const handleVerifyPatientOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientOtp || patientOtp.trim().length !== 6) {
      setErrorMsg(
        activeLang === 'te'
          ? 'దయచేసి 6 అంకెల ఓటీపీని నమోదు చేయండి'
          : activeLang === 'hi'
          ? 'कृपया 6 अंकों का ओटीपी दर्ज करें'
          : 'Please enter the 6-digit OTP code'
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/auth/patient/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: patientPhone.trim(),
          otp: patientOtp.trim(),
          purpose: patientOtpPurpose,
          deviceName: 'Patient PWA (Mobile)',
        }),
      });

      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.success && payload.data) {
        const user: AuthUser = {
          ...payload.data.user,
          abhaNumber: abhaVerified ? verifiedAbhaNumber : '14-8492-3814-7731',
        };
        const tokens: AuthTokens = {
          accessToken: payload.data.accessToken,
          refreshToken: payload.data.refreshToken,
          deviceSessionId: payload.data.deviceSessionId || '',
        };

        localStorage.setItem('aarogya_token', tokens.accessToken);
        localStorage.setItem('aarogya_tokens', JSON.stringify(tokens));
        localStorage.setItem('aarogya_user', JSON.stringify(user));
        localStorage.setItem('aarogya_patient_name', extractedName);
        localStorage.setItem('aarogya_patient_phone', patientPhone.trim());
        localStorage.setItem('aarogya_patient_address', extractedAddress);
        localStorage.setItem('aarogya_patient_abha', user.abhaNumber || '14-8492-3814-7731');

        if (onLoginSuccess) {
          onLoginSuccess(user, tokens);
        } else {
          window.location.hash = '#/patient';
        }
        return;
      }

      if (requireServerAuth) {
        setErrorMsg(payload?.error?.message || liveAuthUnavailable());
        return;
      }

      setErrorMsg('Server authentication is unavailable. Demo auto-login is disabled. Please try again when the server is reachable.');
      return;
    } catch {
      setErrorMsg(
        activeLang === 'te'
          ? 'లాగిన్ విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.'
          : activeLang === 'hi'
          ? 'लॉगिन विफल रहा। कृपया पुन: प्रयास करें।'
          : 'Login failed. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Doctor Login
  const handleDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: doctorUsername, password: doctorPassword }),
      });

      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.success && payload.data) {
        const user: AuthUser = payload.data.user;
        const tokens: AuthTokens = {
          accessToken: payload.data.accessToken,
          refreshToken: payload.data.refreshToken,
          deviceSessionId: payload.data.deviceSessionId || '',
        };

        localStorage.setItem('aarogya_token', tokens.accessToken);
        localStorage.setItem('aarogya_tokens', JSON.stringify(tokens));
        localStorage.setItem('aarogya_user', JSON.stringify(user));

        if (onLoginSuccess) {
          onLoginSuccess(user, tokens);
        } else {
          window.location.hash = '#/doctor';
        }
        return;
      }

      if (requireServerAuth) {
        setErrorMsg(liveAuthUnavailable());
        return;
      }

      setErrorMsg('Server authentication is unavailable. Demo auto-login is disabled. Please try again when the server is reachable.');
      return;
    } catch {
      setErrorMsg(
        activeLang === 'te'
          ? 'వైద్యుల లాగిన్ విఫలమైంది. దయచేసి వివరాలు సరిచూసుకోండి.'
          : activeLang === 'hi'
          ? 'डॉक्टर लॉगिन विफल रहा। कृपया क्रेडेंशियल जांचें।'
          : 'Doctor login failed. Please verify credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Admin Login
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });

      const payload = await res.json().catch(() => null);

      if (res.ok && payload?.success && payload.data) {
        const user: AuthUser = payload.data.user;
        const tokens: AuthTokens = {
          accessToken: payload.data.accessToken,
          refreshToken: payload.data.refreshToken,
          deviceSessionId: payload.data.deviceSessionId || '',
        };

        localStorage.setItem('aarogya_token', tokens.accessToken);
        localStorage.setItem('aarogya_tokens', JSON.stringify(tokens));
        localStorage.setItem('aarogya_user', JSON.stringify(user));

        if (onLoginSuccess) {
          onLoginSuccess(user, tokens);
        } else {
          window.location.hash = '#/admin';
        }
        return;
      }

      setErrorMsg('Server authentication is unavailable. Demo auto-login is disabled. Please try again when the server is reachable.');
      return;
    } catch {
      setErrorMsg(
        activeLang === 'te'
          ? 'అడ్మిన్ లాగిన్ విఫలమైంది.'
          : activeLang === 'hi'
          ? 'प्रशासक लॉगिन विफल रहा।'
          : 'Administrator login failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-page-root"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        backgroundColor: 'var(--bg)',
      }}
    >
      <div
        className="login-card"
        style={{
          width: '100%',
          maxWidth: '580px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '32px 28px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.12), 0 0 20px rgba(2, 132, 199, 0.08)',
          color: 'var(--text-primary)',
          position: 'relative',
        }}
      >
        {/* Top Controls: Language Switcher + Theme Toggle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Language Selector Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleLangChange('te')}
              style={{
                background: activeLang === 'te' ? 'var(--accent)' : 'var(--surface-2)',
                color: activeLang === 'te' ? 'var(--accent-text)' : 'var(--text-secondary)',
                border: `1px solid ${activeLang === 'te' ? 'var(--accent)' : 'var(--border)'}`,
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              తెలుగు
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('en')}
              style={{
                background: activeLang === 'en' ? 'var(--accent)' : 'var(--surface-2)',
                color: activeLang === 'en' ? 'var(--accent-text)' : 'var(--text-secondary)',
                border: `1px solid ${activeLang === 'en' ? 'var(--accent)' : 'var(--border)'}`,
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => handleLangChange('hi')}
              style={{
                background: activeLang === 'hi' ? 'var(--accent)' : 'var(--surface-2)',
                color: activeLang === 'hi' ? 'var(--accent-text)' : 'var(--text-secondary)',
                border: `1px solid ${activeLang === 'hi' ? 'var(--accent)' : 'var(--border)'}`,
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              हिन्दी
            </button>
          </div>

          {/* Theme Toggle (Light / Dark Mode) */}
          <div>
            <ThemeToggle currentLang={activeLang} compact />
          </div>
        </div>

        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>🌿</div>
          <h2
            style={{
              margin: '0 0 6px 0',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {t.appTitle}
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {t.appSubtitle}
          </p>
        </div>

        {/* Global Error & Success Banners */}
        {errorMsg && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-text)',
              color: 'var(--danger-text)',
              fontSize: '0.82rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'var(--success-bg)',
              border: '1px solid var(--success-text)',
              color: 'var(--success-text)',
              fontSize: '0.82rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* =========================================================================
            VIEW 1: PRIMARY PORTAL ROLE SELECTION: "Are you a Patient or Doctor?"
            + Cleanly separated Administrative Portal Access below
           ========================================================================= */}
        {portalRole === null && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {t.whoAreYou}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {t.whoAreYouSub}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Option 1: Patient / Beneficiary */}
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/patient/login';
                }}
                style={{
                  background: 'var(--surface-2)',
                  border: '2px solid var(--btn-primary-bg)',
                  borderRadius: '16px',
                  padding: '20px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'var(--success-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    flexShrink: 0,
                  }}
                >
                  🧑‍🌾
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.08rem', fontWeight: 800, color: 'var(--btn-primary-bg)' }}>
                    {t.patientRoleTitle}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
                    {t.patientRoleSub}
                  </p>
                </div>
              </button>

              {/* Option 2: Doctor / Medical Officer */}
              <button
                type="button"
                onClick={() => {
                  setPortalRole('DOCTOR');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'var(--surface-2)',
                  border: '2px solid var(--accent)',
                  borderRadius: '16px',
                  padding: '20px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: 'var(--info-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    flexShrink: 0,
                  }}
                >
                  👨‍⚕️
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.08rem', fontWeight: 800, color: 'var(--accent)' }}>
                    {t.doctorRoleTitle}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.35' }}>
                    {t.doctorRoleSub}
                  </p>
                </div>
              </button>
            </div>

            {/* Cleanly Separated ITDA Admin Access Portal */}
            <div
              style={{
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: '1px dashed var(--border)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                {t.adminSectionTitle}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                {t.adminSectionSub}
              </div>
              <button
                type="button"
                onClick={() => {
                  setPortalRole('ADMIN');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'var(--surface-2)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)',
                  borderRadius: '10px',
                  padding: '8px 18px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                🏛️ {t.adminPortalBtn}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 2: DOCTOR LOGIN PORTAL
           ========================================================================= */}
        {portalRole === 'DOCTOR' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setPortalRole(null);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {t.backToRole}
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700 }}>
                {t.doctorLoginTitle}
              </span>
            </div>

            <form onSubmit={handleDoctorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  {t.doctorUsernameLabel}
                </label>
                <input
                  type="text"
                  value={doctorUsername}
                  onChange={(e) => setDoctorUsername(e.target.value)}
                  placeholder="doctor_paderu"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  {t.doctorPasswordLabel}
                </label>
                <input
                  type="password"
                  value={doctorPassword}
                  onChange={(e) => setDoctorPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  color: 'var(--accent-text)',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '6px',
                }}
              >
                {loading ? t.loggingInText : t.doctorSubmitBtn}
              </button>

              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                  textAlign: 'center',
                }}
              >
                💡 Demo Clinician: <code>doctor_paderu</code> / <code>PaderuCare@2026</code>
              </div>
            </form>
          </div>
        )}

        {/* =========================================================================
            VIEW 3: SEPARATED ADMIN LOGIN PORTAL
           ========================================================================= */}
        {portalRole === 'ADMIN' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setPortalRole(null);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {t.backToRole}
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--warning-text)', fontWeight: 700 }}>
                {t.adminLoginTitle}
              </span>
            </div>

            <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  {t.adminUsernameLabel}
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  {t.adminPasswordLabel}
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.92rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-text)',
                  borderRadius: '12px',
                  padding: '14px',
                  color: 'var(--warning-text)',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: '6px',
                }}
              >
                {loading ? t.loggingInText : t.adminSubmitBtn}
              </button>

              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                  marginTop: '8px',
                  textAlign: 'center',
                }}
              >
                🔒 ITDA Super Admin Credentials: <code>admin</code> / <code>Admin@2026</code>
              </div>
            </form>
          </div>
        )}

        {/* =========================================================================
            VIEW 4: PATIENT PORTAL
            Sub-modes:
              1. AADHAAR_REGISTER (Front & Back OCR)
              2. ABHA_REGISTER (14-Digit ABHA / ABDM Profile Linking)
              3. MOBILE_OTP (Direct OTP Login)
           ========================================================================= */}
        {portalRole === 'PATIENT' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <button
                type="button"
                onClick={() => {
                  setPortalRole(null);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {t.backToRole}
              </button>

              <span style={{ fontSize: '0.76rem', color: 'var(--btn-primary-bg)', fontWeight: 700 }}>
                🧑‍🌾 {t.patientRoleTitle}
              </span>
            </div>

            {/* Sub-Mode Tabs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '6px',
                background: 'var(--surface-2)',
                padding: '4px',
                borderRadius: '12px',
                marginBottom: '18px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setPatientMode('AADHAAR_REGISTER');
                  setErrorMsg(null);
                  setExtractedName('');
                  setExtractedGender('');
                  setExtractedAge(undefined);
                  setExtractedYearOfBirth(undefined);
                  setExtractedAddress('');
                  setExtractedLandmark('');
                  setExtractedVillage('');
                  setExtractedMandal('');
                  setExtractedPincode('');
                  setMaskedAadhaar('');
                  setAadhaarNumber('');
                  setAadhaarValid(undefined);
                  setAadhaarFieldSources({});
                  setAadhaarFrontUploaded(false);
                  setAadhaarBackUploaded(false);
                  setFrontImageDigest(null);
                  setBackImageDigest(null);
                  setRegisteredPatientId(null);
                }}
                style={{
                  background: patientMode === 'AADHAAR_REGISTER' ? 'var(--btn-primary-bg)' : 'transparent',
                  color: patientMode === 'AADHAAR_REGISTER' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {t.patientTabs.aadhaar}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPatientMode('ABHA_REGISTER');
                  setErrorMsg(null);
                  setAadhaarNumber('');
                  setAadhaarValid(undefined);
                }}
                style={{
                  background: patientMode === 'ABHA_REGISTER' ? 'var(--btn-primary-bg)' : 'transparent',
                  color: patientMode === 'ABHA_REGISTER' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {t.patientTabs.abha}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPatientMode('MOBILE_OTP');
                  setErrorMsg(null);
                  setAadhaarNumber('');
                  setAadhaarValid(undefined);
                }}
                style={{
                  background: patientMode === 'MOBILE_OTP' ? 'var(--btn-primary-bg)' : 'transparent',
                  color: patientMode === 'MOBILE_OTP' ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {t.patientTabs.otp}
              </button>
            </div>

            {/* -------------------- SUB-MODE 1: AADHAAR CARD OCR -------------------- */}
            {patientMode === 'AADHAAR_REGISTER' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {t.aadhaarUploadTitle}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {t.aadhaarUploadSub}
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={aadhaarConsent} onChange={(event) => { setAadhaarConsent(event.target.checked); if (!event.target.checked) { setAadhaarNumber(''); setAadhaarValid(undefined); } }} />
                  <span>{t.aadhaarConsent}</span>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {/* Front Upload */}
                  <div
                    style={{
                      border: '1.5px dashed var(--border)',
                      borderRadius: '12px',
                      padding: '12px',
                      textAlign: 'center',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {t.frontCardLabel}
                    </div>
                    {aadhaarFrontUploaded ? (
                      <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 700 }}>
                        {t.photoUploaded}
                      </div>
                    ) : (
                      <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                        🪪
                      </div>
                    )}
                    <label
                      style={{
                        display: 'inline-block',
                        background: 'var(--accent)',
                        color: 'var(--accent-text)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {aadhaarFrontUploaded ? t.retakePhoto : t.choosePhoto}
                      <input type="file" accept="image/*" disabled={!aadhaarConsent || isProcessingOcr} onChange={handleAadhaarFrontUpload} style={{ display: 'none' }} />
                    </label>
                  </div>

                  {/* Back Upload */}
                  <div
                    style={{
                      border: '1.5px dashed var(--border)',
                      borderRadius: '12px',
                      padding: '12px',
                      textAlign: 'center',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {t.backCardLabel}
                    </div>
                    {aadhaarBackUploaded ? (
                      <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--success-text)', fontWeight: 700 }}>
                        {t.photoUploaded}
                      </div>
                    ) : (
                      <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                        📍
                      </div>
                    )}
                    <label
                      style={{
                        display: 'inline-block',
                        background: 'var(--accent)',
                        color: 'var(--accent-text)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {aadhaarBackUploaded ? t.retakePhoto : t.choosePhoto}
                      <input type="file" accept="image/*" disabled={!aadhaarConsent || isProcessingOcr} onChange={handleAadhaarBackUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>

                <div style={{ textAlign: 'center', margin: '4px 0' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAadhaarConsent(true);
                      setAadhaarFrontUploaded(true);
                      setAadhaarBackUploaded(true);
                      if (!extractedGender) setExtractedGender('పురుషుడు (Male)');
                      if (!extractedAge) setExtractedAge(35);
                      if (!extractedVillage) setExtractedVillage('పాడేరు (Paderu)');
                      if (!extractedMandal) setExtractedMandal('పాడేరు (Paderu)');
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px dashed var(--btn-primary-bg)',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      color: 'var(--btn-primary-bg)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ {activeLang === 'te' ? 'ఆధార్ లేకుండా మాన్యువల్‌గా నమోదు చేయండి (Skip Aadhaar)' : activeLang === 'hi' ? 'आधार के बिना मैन्युअल विवरण भरें (Skip Aadhaar)' : 'Skip Aadhaar & Enter Details Manually'}
                  </button>
                </div>

                {isProcessingOcr && (
                  <div style={{ textAlign: 'center', padding: '8px', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 700 }}>
                    {t.ocrAnalyzing}
                  </div>
                )}

                {/* Extracted Details Card */}
                {(aadhaarFrontUploaded || aadhaarBackUploaded) && (
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '14px',
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{t.extractedDetailsTitle}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.fullNameLabel} <small>{fieldSourceText('fullName')}</small></div>
                        <input
                          type="text"
                          value={extractedName}
                          onChange={(e) => { setExtractedName(e.target.value); markAadhaarFieldManual('fullName'); }}
                          aria-invalid={fieldNeedsReview('fullName', extractedName)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            background: 'var(--surface)',
                            border: `1px solid ${fieldNeedsReview('fullName', extractedName) ? 'var(--warning-text)' : 'var(--border)'}`,
                            boxShadow: fieldNeedsReview('fullName', extractedName) ? 'inset 0 0 0 1px var(--warning-bg)' : undefined,
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.genderLabel} <small>{fieldSourceText('gender')}</small></div>
                        <input
                          type="text"
                          value={extractedGender}
                          onChange={(e) => { setExtractedGender(e.target.value); markAadhaarFieldManual('gender'); }}
                          aria-invalid={fieldNeedsReview('gender', extractedGender)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '6px',
                            background: 'var(--surface)',
                            border: `1px solid ${fieldNeedsReview('gender', extractedGender) ? 'var(--warning-text)' : 'var(--border)'}`,
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t.ageLabel} <small>{fieldSourceText('ageEstimated')}</small></div>
                        <input
                          type="number"
                          min="0"
                          max="120"
                          value={extractedAge ?? ''}
                          onChange={(e) => { setExtractedAge(e.target.value ? Number(e.target.value) : undefined); markAadhaarFieldManual('ageEstimated'); }}
                          aria-invalid={fieldNeedsReview('ageEstimated', extractedAge)}
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--surface)', border: `1px solid ${fieldNeedsReview('ageEstimated', extractedAge) ? 'var(--warning-text)' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                      {([
                        { key: 'village', label: t.villageLabel, value: extractedVillage, update: setExtractedVillage },
                        { key: 'mandal', label: t.mandalLabel, value: extractedMandal, update: setExtractedMandal },
                      ] as const).map(({ key, label, value, update }) => (
                        <div key={key}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label} <small>{fieldSourceText(key)}</small></div>
                          <input
                            type="text"
                            value={value}
                            onChange={(event) => { update(event.target.value); markAadhaarFieldManual(key); }}
                            aria-invalid={fieldNeedsReview(key, value)}
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--surface)', border: `1px solid ${fieldNeedsReview(key, value) ? 'var(--warning-text)' : 'var(--border)'}`, color: 'var(--text-primary)', fontSize: '0.82rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      🔒 {t.maskedAadhaarLabel}: <small>{fieldSourceText('maskedIdentity')}</small> <code>{maskedAadhaar || 'XXXX-XXXX-____'}</code>
                      {aadhaarValid === false && <span style={{ color: 'var(--danger-text)', marginLeft: '8px' }}>{t.invalidAadhaar}</span>}
                    </div>
                  </div>
                )}

                {(aadhaarFrontUploaded || aadhaarBackUploaded) && !registeredPatientId && (
                  <form onSubmit={handleAadhaarRegistration} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {t.contactPhoneLabel}
                      <input type="tel" inputMode="numeric" maxLength={10} value={aadhaarContactPhone} onChange={(event) => setAadhaarContactPhone(event.target.value.replace(/\D/g, ''))} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '5px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }} />
                    </label>
                    <button type="submit" disabled={loading || isProcessingOcr || !aadhaarConsent || !aadhaarFrontUploaded || !aadhaarBackUploaded} style={{ background: 'var(--btn-primary-bg)', border: 'none', borderRadius: '10px', padding: '13px', color: 'var(--btn-primary-text)', fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>
                      {loading ? t.loggingInText : t.confirmRegister}
                    </button>
                  </form>
                )}

                {registeredPatientId && pendingPatientAuth && (
                  <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-text)', borderRadius: '10px', padding: '14px', display: 'grid', gap: '10px' }}>
                    <strong style={{ color: 'var(--success-text)' }}>Patient ID: <code>{registeredPatientId}</code></strong>
                    <button type="button" onClick={() => completePatientLogin(pendingPatientAuth.user, pendingPatientAuth.tokens)} style={{ background: 'var(--btn-primary-bg)', border: 'none', borderRadius: '8px', padding: '11px', color: 'var(--btn-primary-text)', fontWeight: 700, cursor: 'pointer' }}>Continue to patient portal</button>
                  </div>
                )}


              </div>
            )}

            {/* -------------------- SUB-MODE 2: ABHA NUMBER REGISTRATION (NEW FEATURE) -------------------- */}
            {patientMode === 'ABHA_REGISTER' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {t.abhaSectionTitle}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {t.abhaSectionSub}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                    {t.abhaInputLabel}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={abhaInput}
                      onChange={(e) => setAbhaInput(e.target.value)}
                      placeholder={t.abhaPlaceholder}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyAbha}
                      disabled={isVerifyingAbha}
                      style={{
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0 16px',
                        color: 'var(--accent-text)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: isVerifyingAbha ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isVerifyingAbha ? t.abhaVerifying : t.abhaVerifyBtn}
                    </button>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleDirectPatientLogin()}
                      disabled={loading}
                      style={{
                        width: '100%',
                        background: 'var(--btn-primary-bg)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        color: 'var(--btn-primary-text)',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      🚀 {activeLang === 'te' ? 'నేరుగా లాగిన్ అవ్వండి (ఓటీపీ అవసరం లేదు)' : activeLang === 'hi' ? 'सीधे लॉगिन करें (बिना ओटीपी)' : 'Direct Patient Sign In (No OTP Required)'}
                    </button>
                  </div>
                </div>

                {abhaVerified && (
                  <div
                    style={{
                      background: 'var(--surface-2)',
                      border: '1.5px solid var(--success-text)',
                      borderRadius: '14px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--success-text)' }}>
                        {t.abhaVerifiedTitle}
                      </span>
                      <span style={{ fontSize: '0.68rem', background: 'var(--success-bg)', color: 'var(--success-text)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                        ABDM: LINKED
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                      <div style={{ fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>ABHA ID: </span>
                        <code style={{ fontWeight: 800, color: 'var(--accent)' }}>{verifiedAbhaNumber}</code>
                      </div>
                      <div style={{ fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Beneficiary: </span>
                        <strong style={{ color: 'var(--text-primary)' }}>{extractedName}</strong>
                      </div>
                      <div style={{ fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Demographics: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>42 Yrs • Male (పురుషుడు)</span>
                      </div>
                      <div style={{ fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Catchment: </span>
                        <span style={{ color: 'var(--text-secondary)' }}>Vanakachinta, Dumbriguda</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile OTP Flow for ABHA Linkage */}
                <form onSubmit={handleSendPatientOtp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {t.phoneForOtpLabel}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                      }}
                    />
                    <button
                      type="submit"
                      disabled={loading || otpCooldown > 0}
                      style={{
                        background: otpCooldown > 0 ? 'var(--border)' : 'var(--accent)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0 16px',
                        color: otpCooldown > 0 ? 'var(--text-muted)' : 'var(--accent-text)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: otpCooldown > 0 ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {otpCooldown > 0 ? `${otpCooldown}s` : t.sendOtpBtn}
                    </button>
                  </div>
                </form>

                {otpSent && (
                  <form onSubmit={handleVerifyPatientOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                        {t.enterOtpLabel}
                      </label>
                      <input
                        type="text"
                        value={patientOtp}
                        onChange={(e) => setPatientOtp(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'var(--surface-2)',
                          border: '2px solid var(--btn-primary-bg)',
                          color: 'var(--text-primary)',
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          letterSpacing: '0.3em',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        background: 'var(--btn-primary-bg)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px',
                        color: 'var(--btn-primary-text)',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? t.verifyingText : t.verifyAndLoginPatient}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* -------------------- SUB-MODE 3: DIRECT MOBILE OTP LOGIN -------------------- */}
            {patientMode === 'MOBILE_OTP' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                    {t.phoneForOtpLabel}
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '10px',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        fontWeight: 700,
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSendPatientOtp}
                      disabled={loading || otpCooldown > 0}
                      style={{
                        background: otpCooldown > 0 ? 'var(--border)' : 'var(--accent)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0 16px',
                        color: otpCooldown > 0 ? 'var(--text-muted)' : 'var(--accent-text)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: otpCooldown > 0 ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {otpCooldown > 0 ? `${otpCooldown}s` : t.sendOtpBtn}
                    </button>
                  </div>
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleDirectPatientLogin()}
                      disabled={loading}
                      style={{
                        width: '100%',
                        background: 'var(--btn-primary-bg)',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        color: 'var(--btn-primary-text)',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      🚀 {activeLang === 'te' ? 'నేరుగా లాగిన్ అవ్వండి (ఓటీపీ అవసరం లేదు)' : activeLang === 'hi' ? 'सीधे लॉगिन करें (बिना ओटीपी)' : 'Direct Patient Sign In (No OTP Required)'}
                    </button>
                  </div>
                </div>

                {otpSent && (
                  <form onSubmit={handleVerifyPatientOtp} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                        {t.enterOtpLabel}
                      </label>
                      <input
                        type="text"
                        value={patientOtp}
                        onChange={(e) => setPatientOtp(e.target.value)}
                        placeholder="123456"
                        maxLength={6}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '10px',
                          background: 'var(--surface-2)',
                          border: '2px solid var(--btn-primary-bg)',
                          color: 'var(--text-primary)',
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          letterSpacing: '0.3em',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        background: 'var(--btn-primary-bg)',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '14px',
                        color: 'var(--btn-primary-text)',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? t.verifyingText : t.loginPatientDirect}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bottom Simulation Demarcation Banner */}
        <div
          style={{
            marginTop: '24px',
            padding: '10px',
            borderRadius: '10px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            textAlign: 'center',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
          }}
        >
          {t.simulationNotice}
        </div>
      </div>
    </div>
  );
};

export default Login;
