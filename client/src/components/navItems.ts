export interface NavItem {
  id: string;
  label: string;
  labelTe?: string;
  labelHi?: string;
  labelTa?: string;
  labelKn?: string;
  labelMl?: string;
  category: 'overview' | 'clinical' | 'field' | 'governance' | 'account';
  icon: string;
  badge?: string;
  badgeType?: 'real' | 'mock' | 'live';
}

export const NAV_ITEMS: NavItem[] = [
  // Overview
  { id: 'dashboard', label: 'Operations Dashboard', labelTe: 'కమాండ్ డాష్‌బోర్డ్', labelHi: 'ऑपरेशंस डैशबोर्ड', labelTa: 'கட்டளை டாஷ்போர்டு', labelKn: 'ಕಾರ್ಯಾಚರಣೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', labelMl: 'ഓപ്പറേഷൻസ് ഡാഷ്‌ബോർഡ്', category: 'overview', icon: '🌿' },
  { id: 'asr-map', label: 'ASR District Map', labelTe: 'ASR జిల్లా మ్యాప్', labelHi: 'ASR जिला मानचित्र', labelTa: 'ASR மாவட்ட வரைபடம்', labelKn: 'ASR ಜಿಲ್ಲಾ ನಕ್ಷೆ', labelMl: 'ASR ജില്ലാ ഭൂപടം', category: 'overview', icon: '🗺️', badge: '22 Mandals', badgeType: 'live' },

  // Clinical & Care
  { id: 'screening', label: 'Clinical Screening', labelTe: 'క్లినికల్ స్క్రీనింగ్', labelHi: 'नैदानिक स्क्रीनिंग', labelTa: 'மருத்துவப் பரிசோதனை', labelKn: 'ಕ್ಲಿನಿಕಲ್ ತಪಾಸಣೆ', labelMl: 'ക്ലിനിക്കൽ സ്ക്രീനിംഗ്', category: 'clinical', icon: '🩺', badge: 'MO Queue' },
  { id: 'ai-screening', label: 'AI Oral Screening Engine', labelTe: 'AI నోటి స్క్రీనింగ్ ఇంజిన్', labelHi: 'एआई ओरल स्क्रीनिंग इंजन', labelTa: 'AI வாய் பரிசோதனை', labelKn: 'AI ಮೌಖಿಕ ತಪಾಸಣೆ', labelMl: 'AI വായ പരിശോധന', category: 'clinical', icon: '🔬', badge: 'Multi-Disease', badgeType: 'live' },
  { id: 'teleconsultation', label: 'Teleconsultation', labelTe: 'టెలిమెడిసిన్', labelHi: 'टेलीकंसल्टेशन', labelTa: 'தொலைமருத்துவம்', labelKn: 'ಟೆಲಿಮೆಡಿಸಿನ್', labelMl: 'ടെലിമെഡിസിൻ', category: 'clinical', icon: '📞' },
  { id: 'patients', label: 'Patients & Offline Sync', labelTe: 'రోగులు & ఆఫ్‌లైన్ సింక్', labelHi: 'मरीज एवं ऑफलाइन सिंक', labelTa: 'நோயாளிகள் & ஆஃப்லைன் ஒத்திசைவு', labelKn: 'ರೋಗಿಗಳು ಮತ್ತು ಆಫ್‌ಲೈನ್ ಸಿಂಕ್', labelMl: 'രോഗികളും ഓഫ്‌ലൈൻ സിങ്കും', category: 'clinical', icon: '👥' },
  { id: 'appointments', label: 'OPD Appointments', labelTe: 'ఓపీడీ అపాయింట్‌మెంట్లు', labelHi: 'ओपीडी अपॉइंटमेंट', labelTa: 'OPD முன்பதிவுகள்', labelKn: 'OPD ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು', labelMl: 'OPD അപ്പോയിന്റ്‌മെന്റുകൾ', category: 'clinical', icon: '📅' },
  { id: 'camps', label: 'Outreach Camps', labelTe: 'గ్రామీణ శిబిరాలు', labelHi: 'आउटरीच कैंप', labelTa: 'கள முகாம்கள்', labelKn: 'ಹೊರಸಂಪರ್ಕ ಶಿಬಿರಗಳು', labelMl: 'ക്യാമ്പുകൾ', category: 'clinical', icon: '🏕️' },

  // Tribal Field Operations
  { id: 'camp-planning', label: 'Medical Camp Planning', labelTe: 'మెడికల్ క్యాంప్ ప్లానింగ్', labelHi: 'मेडिकल कैंप योजना', labelTa: 'மருத்துவ முகாம் திட்டம்', labelKn: 'ಶಿಬಿರದ ಯೋಜನೆ', labelMl: 'ക്യാമ്പ് ആസൂത്രണം', category: 'field', icon: '🏕️', badge: 'AI Priority' },
  { id: 'assignments', label: 'Worker Jurisdiction', labelTe: 'ఆరోగ్య కార్యకర్తల విధులు', labelHi: 'कार्यकर्ता क्षेत्राधिकार', labelTa: 'பணியாளர் எல்லை', labelKn: 'ಕಾರ್ಯಕರ್ತರ ವ್ಯಾಪ್ತಿ', labelMl: 'പ്രവർത്തകരുടെ அதிகாரപരിധി', category: 'field', icon: '📍' },
  { id: 'village-groups', label: 'Village Groups', labelTe: 'గ్రామ సమూహాలు', labelHi: 'ग्राम समूह', labelTa: 'கிராமக் குழுக்கள்', labelKn: 'ಗ್ರಾಮ ಗುಂಪುಗಳು', labelMl: 'വില്ലേജ് ഗ്രൂപ്പുകൾ', category: 'field', icon: '🏘️' },
  { id: 'specialists', label: 'Specialist Directory', labelTe: 'నిపుణుల జాబితా', labelHi: 'विशेषज्ञ निर्देशिका', labelTa: 'நிபுணர் அடைவு', labelKn: 'ತಜ್ಞರ ಡೈರೆಕ್ಟರಿ', labelMl: 'സ്പെഷ്യലിസ്റ്റ് ഡയറക്ടറി', category: 'field', icon: '👨‍⚕️' },
  { id: 'hospitals', label: 'Hospitals & Network', labelTe: 'ఆసుపత్రుల నెట్‌వర్క్', labelHi: 'अस्पताल नेटवर्क', labelTa: 'மருத்துவமனைகள் நெட்வொர்க்', labelKn: 'ಆಸ್ಪತ್ರೆಗಳ ಜಾಲ', labelMl: 'ആശുപത്രികൾ ശൃംഖല', category: 'field', icon: '🏥' },

  // Governance & Security
  { id: 'location-admin', label: 'Location Management', labelTe: 'గ్రామాల నిర్వహణ', labelHi: 'स्थान प्रबंधन', labelTa: 'இருப்பிட மேலாண்மை', labelKn: 'ಸ್ಥಳ ನಿರ್ವಹಣೆ', labelMl: 'ലൊക്കേഷൻ മാനേജ്മെന്റ്', category: 'governance', icon: '🌐' },
  { id: 'invitations', label: 'Staff Onboarding', labelTe: 'సిబ్బంది ఆహ్వానాలు', labelHi: 'స్టాఫ్ ఆమంత్రణ', labelTa: 'பணியாளர் அழைப்புகள்', labelKn: 'ಸಿಬ್ಬಂದಿ ಆಹ್ವಾನಗಳು', labelMl: 'ജീവനക്കാരുടെ ക്ഷണം', category: 'governance', icon: '✉️' },
  { id: 'notifications', label: 'Notification Center', labelTe: 'నోటిఫికేషన్లు', labelHi: 'सूचना केंद्र', labelTa: 'அறிவிப்பு மையம்', labelKn: 'ಅಧಿಸೂಚನೆ ಕೇಂದ್ರ', labelMl: 'അറിയിപ്പ് കേന്ദ്രം', category: 'governance', icon: '🔔' },
  { id: 'recovery', label: 'Account Recovery', labelTe: 'ఖాతా పునరుద్ధరణ', labelHi: 'खाता पुनर्प्राप्ति', labelTa: 'கணக்கு மீட்பு', labelKn: 'ಖಾತೆ ಮರುಪಡೆಯುವಿಕೆ', labelMl: 'അക്കൗണ്ട് വീണ്ടെടുക്കൽ', category: 'governance', icon: '🛡️' },
  { id: 'consent', label: 'DPDP Patient Consent', labelTe: 'రోగి సమ్మతి పత్రం', labelHi: 'रोगी सहमति', labelTa: 'நோயாளி ஒப்புதல்', labelKn: 'ರೋಗಿಯ ಸಮ್ಮತಿ', labelMl: 'രോഗി സമ്മതം', category: 'governance', icon: '📋' },
  { id: 'matrix', label: 'Capability Matrix', labelTe: 'అనుమతుల మ్యాట్రిక్స్', labelHi: 'क्षमता मैट्रिक्स', labelTa: 'திறன் அணி', labelKn: 'ಸಾಮರ್ಥ್ಯ ಮ್ಯಾಟ್ರಿಕ್ಸ್', labelMl: 'ശേഷി മാട്രിക്സ്', category: 'governance', icon: '🔐' },
  { id: 'aadhaar', label: 'Aadhaar Mock Service', labelTe: 'ఆధార్ మాక్ సర్వీస్', labelHi: 'आधार मॉक सेवा', labelTa: 'ஆதார் மாதிரி சேவை', labelKn: 'ಆಧಾರ್ ಮಾಕ್ ಸೇವೆ', labelMl: 'ആധാർ മോക്ക് സേവനം', category: 'governance', icon: '🆔', badge: 'MOCK', badgeType: 'mock' },
  { id: 'diagnostics', label: 'System Diagnostics', labelTe: 'సిస్టమ్ విశ్లేషణ', labelHi: 'सिस्टम डायग्नोस्टिक्स', labelTa: 'கணினி கண்டறிதல்', labelKn: 'ವ್ಯವಸ್ಥೆಯ ರೋಗನಿರ್ಣಯ', labelMl: 'സിസ്റ്റം ഡയഗ്നോസ്റ്റിക്സ്', category: 'governance', icon: '⚙️' },

  // Account
  { id: 'auth', label: 'Auth, Devices & Profile', labelTe: 'ప్రొఫైల్ & సెట్టింగ్‌లు', labelHi: 'प्रोफाइल एवं सेटिंग्स', labelTa: 'சுயவிவரம் & அமைப்புகள்', labelKn: 'ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸೆಟ್ಟಿಂಗ್‌ಗಳು', labelMl: 'പ്രൊഫൈലും ക്രമീകരണങ്ങളും', category: 'account', icon: '👤' },

  // Citizen & Patient Dedicated Navigation
  { id: 'reports', label: 'Medical Reports', labelTe: 'వైద్య నివేదికలు', labelHi: 'मेडिकल रिपोर्ट', labelTa: 'மருத்துவ அறிக்கைகள்', labelKn: 'ವೈದ್ಯಕೀಯ ವರದಿಗಳು', labelMl: 'മെഡിക്കൽ റിപ്പോർട്ടുകൾ', category: 'clinical', icon: '📄' },
  { id: 'help', label: 'Help and Support', labelTe: 'సహాయం & మద్దతు', labelHi: 'सहायता एवं समर्थन', labelTa: 'உதவி & ஆதரவு', labelKn: 'ಸಹಾಯ ಮತ್ತು ಬೆಂಬಲ', labelMl: 'സഹായവും പിന്തുണയും', category: 'account', icon: '❓' },
];

/**
 * The 11 Patient-Allowed Navigation Targets
 * (Strictly excludes administrative governance, jurisdiction, mock services, and system diagnostics)
 */
export const PATIENT_NAV_IDS = new Set<string>([
  'dashboard',     // 1. Patient Dashboard
  'screening',     // 2. My Medical Cases
  'specialists',   // 3. Specialist Directory
  'hospitals',     // 4. Hospitals and Network
  'notifications', // 5. My Notifications
  'consent',       // 6. Patient Consent
  'auth',          // 7. My Profile
  'appointments',  // 8. My Appointments
  'patients',      // 9. Medical Records
  'reports',       // 10. Medical Reports
  'help',          // 11. Help and Support
]);

/**
 * Patient-friendly localized labels for the 11 patient items
 */
export const PATIENT_ITEM_LABELS: Record<string, { label: string; labelTe: string; labelHi: string; icon: string }> = {
  dashboard: { label: 'Patient Dashboard', labelTe: 'పేషెంట్ డాష్‌బోర్డ్', labelHi: 'रोगी डैशबोर्ड', icon: '🏠' },
  screening: { label: 'My Medical Cases', labelTe: 'నా వైద్య కేసులు', labelHi: 'मेरे मेडिकल केस', icon: '🩺' },
  specialists: { label: 'Specialist Directory', labelTe: 'నిపుణుల జాబితా', labelHi: 'विशेषज्ञ निर्देशिका', icon: '👨‍⚕️' },
  hospitals: { label: 'Hospitals and Network', labelTe: 'ఆసుపత్రుల నెట్‌వర్క్', labelHi: 'अस्पताल नेटवर्क', icon: '🏥' },
  notifications: { label: 'My Notifications', labelTe: 'నా నోటిఫికేషన్లు', labelHi: 'मेरी सूचनाएं', icon: '🔔' },
  consent: { label: 'Patient Consent', labelTe: 'రోగి సమ్మతి పత్రం', labelHi: 'रोगी सहमति', icon: '📋' },
  auth: { label: 'My Profile', labelTe: 'నా ప్రొఫైల్', labelHi: 'मेरी प्रोफाइल', icon: '👤' },
  appointments: { label: 'My Appointments', labelTe: 'నా అపాయింట్‌మెంట్లు', labelHi: 'मेरे अपॉइंटमेंट', icon: '📅' },
  patients: { label: 'Medical Records', labelTe: 'వైద్య రికార్డులు', labelHi: 'मेडिकल रिकॉर्ड', icon: '📂' },
  reports: { label: 'Medical Reports', labelTe: 'వైద్య నివేదికలు', labelHi: 'मेडिकल रिपोर्ट', icon: '📄' },
  help: { label: 'Help and Support', labelTe: 'సహాయం & మద్దతు', labelHi: 'सहायता एवं समर्थन', icon: '❓' },
};
