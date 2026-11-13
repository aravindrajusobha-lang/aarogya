import React, { useState } from 'react';
import { ThemeToggle } from '../components/ThemeToggle';
import { LanguageCode } from '../i18n';
import { db } from '../db/aarogyaDb';
import '../styles/LandingPage.css';

export interface LandingPageProps {
  currentLang?: LanguageCode;
  onSelectLang?: (lang: LanguageCode) => void;
  onNavigateLogin?: () => void;
  onNavigatePatient?: () => void;
  onNavigateDoctor?: () => void;
  onNavigateAdmin?: () => void;
  onOpenScreening?: () => void;
  currentUser?: any | null;
}

// Translations for all 10 Landing Page Sections
const T = {
  te: {
    helpline: '24/7 గిరిజన ఆరోగ్య హెల్ప్‌లైన్: 104 / 1800-425-0001',
    agencyLocation: 'ITDA పాడేరు ఏజెన్సీ ప్రాంతం • అల్లూరి సీతారామరాజు జిల్లా',
    opdStatus: '🟢 నేటి ఓపీడీ సేవలు అందుబాటులో ఉన్నాయి (09:00 AM - 02:00 PM)',
    appName: 'ఆరోగ్య దృష్టి',
    appFullName: 'Aarogya-Drishti',
    subBrand: 'ITDA గిరిజన డిజిటల్ టెలిమెడిసిన్',
    navHome: 'హోమ్',
    navAbout: 'మా గురించి',
    navServices: 'సేవలు',
    navWhyUs: 'ప్రత్యేకతలు',
    navSpecialists: 'వైద్య బృందం',
    navSchedule: 'క్యాంప్ షెడ్యూల్',
    navProcess: 'విధానం',
    btnBookScreening: 'స్క్రీనింగ్ బుక్ చేయండి',
    btnLogin: 'పోర్టల్ లాగిన్',
    heroBadge: '🌿 24/7 గిరిజన టెలిమెడిసిన్ & ఏఐ హెల్త్‌కేర్',
    heroTitlePrefix: 'మీ ఆరోగ్యం మా బాధ్యత',
    heroTitleSuffix: 'నిరంతర సంరక్షణ',
    heroSubtitle:
      'పాడేరు, అరకు మరియు తూర్పు కనుమల మారుమూల గిరిజన ఆవాసాల కోసం స్మార్ట్ ఏఐ నోటి శ్లేష్మ స్క్రీనింగ్, ఆఫ్‌లైన్ ఆశా వర్క్‌ఫ్లోలు మరియు ప్రత్యక్ష వైద్య సంప్రదింపుల వ్యవస్థ.',
    heroCtaScreening: '📅 ఉచిత స్క్రీనింగ్ బుకింగ్',
    heroCtaAi: '🤖 ఏఐ హెల్త్ స్క్రీనింగ్',
    heroCtaLogin: '🔐 రోగి & డాక్టర్ పోర్టల్',
    heroOfflineTag: '🟢 100% ఆఫ్‌లైన్ ఇండెక్స్‌డ్‌డీబీ మద్దతు',
    heroAiAccuracyTag: '🩺 2-టైర్ ఏఐ ఓరల్ స్క్రీనింగ్ (ONNX + జెమినీ)',
    aboutBadge: 'మా గురించి • ITDA పాడేరు గిరిజన ఆరోగ్యం',
    aboutTitle: 'మారుమూల గ్రామాల వరకు అధునాతన ఉచిత వైద్య సేవలు',
    aboutDesc:
      'అల్లూరి సీతారామరాజు జిల్లాలోని ఎత్తైన కొండలు మరియు సెల్యులార్ నెట్‌వర్క్ లేని ప్రాంతాల్లో నివసించే గిరిజన ప్రజలకు ప్రారంభ దశలోనే నోటి వ్యాధులను గుర్తించి నివారించడమే మా లక్ష్యం.',
    aboutChecks: [
      'అధికారిక డెంటల్ మరియు జనరల్ వైద్య నిపుణులు',
      'నెట్‌వర్క్ లేకున్నా పనిచేసే ఆఫ్‌లైన్ ఆశా ట్యాబ్లెట్లు',
      'ఉచిత స్క్రీనింగ్, మందులు మరియు రిఫరల్ సహాయం',
      'క్రిప్టోగ్రాఫిక్ SHA-256 భద్రత కలిగిన వైద్య రికార్డులు',
    ],
    servicesTag: 'మా సేవలు • 8 ప్రత్యేక విభాగాలు',
    servicesTitle: 'సమగ్ర డిజిటల్ వైద్య & స్క్రీనింగ్ సేవలు',
    servicesDesc: 'గిరిజన ప్రాంతాల్లో ప్రాథమిక ఆరోగ్యం నుండి స్పెషలిస్ట్ ఆసుపత్రి వరకు అనుసంధానించే సమగ్ర సేవలు.',
    servicesList: [
      {
        id: 'oral',
        icon: '🦷',
        title: 'నోటి శ్లేష్మ & దంత స్క్రీనింగ్',
        desc: 'ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ సహాయంతో నోటి పూత, తెల్ల మచ్చలు మరియు మార్పులను తక్షణమే అంచనా వేసే స్క్రీనింగ్.',
        highlighted: true,
        badge: 'ప్రధాన ఏఐ సేవ (Demo)',
      },
      {
        id: 'teleconsult',
        icon: '🩺',
        title: 'ప్రత్యక్ష టెలి-కన్సల్టేషన్',
        desc: 'పాడేరు సీహెచ్‌సీ వైద్య నిపుణులతో సురక్షితమైన వీడియో సంప్రదింపులు మరియు ప్రత్యక్ష సూచనలు.',
        highlighted: false,
      },
      {
        id: 'offline',
        icon: '📱',
        title: 'ఆఫ్‌లైన్ ఫ్రంట్‌లైన్ మొబైల్ స్క్రీనింగ్',
        desc: 'మొబైల్ టవర్లు లేని లోయలలో కూడా ఆశా/ఏఎన్ఎం కార్యకర్తలు డేటాను భద్రపరిచి స్వయంచాలకంగా సింక్ చేయవచ్చు.',
        highlighted: false,
      },
      {
        id: 'rx',
        icon: '💊',
        title: 'డిజిటల్ మందుల చీటీలు (E-Prescriptions)',
        desc: 'వైద్యులు సూచించిన మందులు, మోతాదు మరియు జీవనశైలి మార్గదర్శకాలు మీ మొబైల్‌లో భద్రంగా ఉంటాయి.',
        highlighted: false,
      },
      {
        id: 'referral',
        icon: '🏥',
        title: 'స్పెషలిస్ట్ ఆసుపత్రి రిఫరల్స్',
        desc: 'అవసరమైనప్పుడు పాడేరు CHC లేదా విశాఖ KGH ఆసుపత్రులకు అధికారిక రిఫరల్ మరియు ఫాలో-అప్ సదుపాయం.',
        highlighted: false,
      },
      {
        id: 'camps',
        icon: '🚐',
        title: 'సంచార గిరిజన వైద్య శిబిరాలు (Mobile Camps)',
        desc: 'ప్రతి వారం వివిధ మండలాల సంతలు మరియు గిరిజన ఆవాసాల వద్ద ఉచిత వైద్య శిబిరాల నిర్వహణ.',
        highlighted: false,
      },
      {
        id: 'gis',
        icon: '🗺️',
        title: 'జీఐఎస్ మ్యాపింగ్ & క్లస్టర్ విశ్లేషణ',
        desc: 'జిల్లాలోని 22 మండలాల్లో వ్యాధుల వ్యాప్తి మరియు అధిక రిస్క్ ప్రాంతాల పర్యవేక్షణ.',
        highlighted: false,
      },
      {
        id: 'abha',
        icon: '🆔',
        title: 'ABHA & ఆయుష్మాన్ భారత్ లింకేజ్',
        desc: 'జాతీయ డిజిటల్ హెల్త్ మిషన్ (ABDM) తో 14 అంకెల ABHA నంబరును సులభంగా అనుసంధానించడం.',
        highlighted: false,
      },
    ],
    whyChooseTag: 'ఎందుకు ఆరోగ్య దృష్టి? • ప్రత్యేకం',
    whyChooseTitle: 'గిరిజన ప్రాంత భౌగోళిక పరిస్థితులకు అనుగుణంగా రూపకల్పన',
    whySteps: [
      {
        num: '01',
        title: 'గిరిజన సంస్కృతికి గౌరవం & స్థానిక ల్యాండ్‌మార్కులు',
        desc: 'సాంప్రదాయ చిరునామాలను గౌరవిస్తూ స్థానిక ల్యాండ్‌మార్కులు (చెట్లు, గెడ్డలు) మరియు గిరిజన మాండలికాలలో వాయిస్ మార్గదర్శకత్వం.',
      },
      {
        num: '02',
        title: 'నెట్‌వర్క్ లేని కొండల్లోనూ పనిచేసే ఆఫ్‌లైన్ ఆర్కిటెక్చర్',
        desc: 'ఇంటర్‌నెట్ లేదా సిగ్నల్ లేకపోయినా బ్రౌజర్ ఇండెక్స్‌డ్‌డీబీలో అన్ని రికార్డులు భద్రపరచబడి నెట్‌వర్క్ రాగానే సింక్ అవుతాయి.',
      },
      {
        num: '03',
        title: 'డాక్టర్ ఆధ్వర్యంలో సురక్షితమైన ఏఐ స్క్రీనింగ్',
        desc: 'ఏఐ ఎన్నడూ వ్యాధి నిర్ధారణ చేయదు; కేవలం వైద్యుడికి ప్రాథమిక స్క్రీనింగ్ సహాయకుడిగా మాత్రమే పనిచేస్తుంది.',
      },
    ],
    stats: [
      { value: '12,450+', label: 'స్క్రీనింగ్ చేయబడిన గిరిజనులు', tag: 'సిమ్యులేషన్ డెమో డాటా' },
      { value: '22 మండలాలు', label: 'ఏఎస్ఆర్ జిల్లా ఏజెన్సీ కవరేజ్', tag: 'పూర్తి భౌగోళిక పరిధి' },
      { value: '100% ఆఫ్‌లైన్', label: 'ఫ్రంట్‌లైన్ ఫీల్డ్ వర్క్‌ఫ్లో', tag: 'ఇండెక్స్‌డ్‌డీబీ సింక్' },
      { value: '48+ క్యాంపులు', label: 'షెడ్యూల్ చేయబడిన వైద్య శిబిరాలు', tag: 'ఈ సీజన్ కార్యాచరణ' },
    ],
    specialistsTag: 'వైద్య నిపుణులు • క్లినికల్ బృందం',
    specialistsTitle: 'మీ ఆరోగ్య సేవలో అంకితభావం కలిగిన వైద్యులు',
    specialistsList: [
      {
        name: 'డాక్టర్ కె. సోమశేఖర్, BDS, MDS',
        role: 'సీనియర్ డెంటల్ సర్జన్ & ఓరల్ మెడిసిన్',
        hospital: 'కమ్యూనిటీ హెల్త్ సెంటర్ (CHC) పాడేరు',
        avatar: '👨‍⚕️',
      },
      {
        name: 'డాక్టర్ పి. అనిత, MBBS, MD',
        role: 'చీఫ్ మెడికల్ ఆఫీసర్',
        hospital: 'ఏరియా హాస్పిటల్, అరకు లోయ',
        avatar: '👩‍⚕️',
      },
      {
        name: 'డాక్టర్ ఎం. రాజేష్, MS, FICS',
        role: 'ఈఎన్‌టీ & మ్యాక్సిల్లోఫేషియల్ కన్సల్టెంట్',
        hospital: 'కింగ్ జార్జ్ హాస్పిటల్ (KGH) విశాఖపట్నం',
        avatar: '👨‍⚕️',
      },
      {
        name: 'డాక్టర్ ఎస్. సునీత, MBBS, DPH',
        role: 'పబ్లిక్ హెల్త్ నోడల్ ఆఫీసర్',
        hospital: 'ITDA పాడేరు ట్రైబల్ హెల్త్ సెల్',
        avatar: '👩‍⚕️',
      },
    ],
    campScheduleTitle: 'సంచార వైద్య శిబిరాల షెడ్యూల్',
    campScheduleDesc: 'మీ సమీప గ్రామం లేదా సంతలో జరిగే ఉచిత దంత & నోటి ఆరోగ్య శిబిరాల వివరాలు:',
    campsList: [
      { location: 'పాడేరు సెంట్రల్ సీహెచ్‌సీ ఓపీడీ', days: 'సోమ - శని (09:00 AM - 02:00 PM)' },
      { location: 'డుంబ్రిగుడ సంత వీక్లీ మొబైల్ యూనిట్', days: 'ప్రతి సోమవారం & బుధవారం' },
      { location: 'అరకు లోయ ఏజెన్సీ ఔట్‌పోస్ట్', days: 'ప్రతి మంగళవారం & గురువారం' },
      { location: 'చింతపల్లి గిరిజన ఆవాస క్యాంప్', days: '2వ & 4వ శనివారాలు' },
      { location: '24/7 అత్యవసర క్యాజువాలిటీ వార్డు', days: 'అన్ని రోజులు నిరంతరం అందుబాటులో' },
    ],
    bookScreeningTitle: 'ఉచిత స్క్రీనింగ్ కొరకు నమోదు (ఆఫ్‌లైన్‌లోనూ పనిచేస్తుంది)',
    bookScreeningDesc: 'ఓటీపీ అవసరం లేదు. వివరాలు నమోదు చేసి ఆఫ్‌లైన్‌లోనూ బుకింగ్ కన్ఫర్మ్ చేసుకోండి.',
    formNameLabel: 'రోగి పూర్తి పేరు *',
    formPhoneLabel: 'మొబైల్ నంబరు (ఐచ్ఛికం - నోటిఫికేషన్ కోసం)',
    formMandalLabel: 'మండలం ఎంచుకోండి *',
    formVillageLabel: 'గ్రామం / ఆవాసం పేరు',
    formCampLabel: 'శిబిరం / తేదీ ఎంచుకోండి *',
    formSymptomsLabel: 'లక్షణాలు / సమస్య వివరాలు',
    consentCheckboxText: 'నేను ITDA పాడేరు ఆధ్వర్యంలో స్వచ్ఛంద నోటి శ్లేష్మ ఏఐ స్క్రీనింగ్ సిమ్యులేషన్‌కు అంగీకరిస్తున్నాను.',
    btnSubmitBooking: '📅 స్క్రీనింగ్ నమోదును ధృవీకరించండి (Save Offline)',
    bookingConfirmedTitle: '✅ స్క్రీనింగ్ బుకింగ్ విజయవంతంగా నమోదైంది!',
    bookingCodeLabel: 'మీ బుకింగ్ రెఫరెన్స్ కోడ్:',
    bookingOfflineNote: '💡 గమనిక: ఇది PENDING_SYNC క్యూలో భద్రపరచబడింది. నెట్‌వర్క్ రాగానే సర్వర్‌కు సింక్ అవుతుంది. ఓటీపీ అవసరం లేదు.',
    processTag: 'విధానం • 4 సులభ దశలు',
    processTitle: 'స్క్రీనింగ్ నుండి నిపుణుల సంప్రదింపుల వరకు',
    processSteps: [
      { num: '01', title: 'సులభ నమోదు', desc: 'ఆధార్ లేదా ABHA లేదా పేరుతో తక్షణ ఫీల్డ్ రిజిస్ట్రేషన్.' },
      { num: '02', title: 'ఆశా నోటి తనిఖీ', desc: 'సురక్షితమైన వెలుతురులో ఫోన్ కెమెరాతో నోటి లోపలి ఫోటో తీయడం.' },
      { num: '03', title: 'ఏఐ స్క్రీనింగ్ & ట్రియాజ్', desc: 'నెట్‌వర్క్ లేకుండానే సెకన్లలో ఆటోమేటెడ్ రిస్క్ వర్గీకరణ.' },
      { num: '04', title: 'వైద్యుల సంప్రదింపు', desc: 'డాక్టర్ వీడియో సమీక్ష, డిజిటల్ మందుల చీటీ మరియు నిపుణుల సంరక్షణ.' },
    ],
    footerAbout: 'ఆరోగ్య దృష్టి అనేది ఆంధ్రప్రదేశ్ ప్రభుత్వ ITDA పాడేరు ట్రైబల్ హెల్త్ ఇనిషియేటివ్ ఆధ్వర్యంలో నడిచే కమ్యూనిటీ ఆధారిత డిజిటల్ హెల్త్ ప్లాట్‌ఫారమ్.',
    footerQuickLinks: 'త్వరిత లింకులు',
    footerPortals: 'పోర్టల్స్ & లాగిన్',
    footerLegal: 'చట్టపరమైన సమాచారం & భద్రత',
    privacyLink: 'గోప్యతా విధానం (Privacy Policy)',
    consentLink: 'సమ్మతి నిబంధనలు (Informed Consent)',
    nonDiagDisclaimer: '⚠️ నిరాకరణ: ఇది స్క్రీనింగ్ సిమ్యులేషన్ వ్యవస్థ మాత్రమే. ఇది వ్యాధిని నిర్ధారించదు. ఎల్లప్పుడూ అర్హత కలిగిన వైద్యులను సంప్రదించండి.',
    allRightsReserved: '© 2026 ఆరోగ్య దృష్టి • ITDA పాడేరు • సర్వహక్కులు ప్రత్యేకించబడ్డాయి.',
    viewDashboardBtn: 'నా డ్యాష్‌బోర్డ్‌కు వెళ్ళండి',
  },
  en: {
    helpline: '24/7 Tribal Health Helpline: 104 / 1800-425-0001',
    agencyLocation: 'ITDA Paderu Agency Area • Alluri Sitharama Raju District',
    opdStatus: '🟢 Today OPD Active (09:00 AM - 02:00 PM)',
    appName: 'Aarogya-Drishti',
    appFullName: 'Aarogya-Drishti',
    subBrand: 'ITDA Tribal Digital Telemedicine',
    navHome: 'Home',
    navAbout: 'About Us',
    navServices: 'Services',
    navWhyUs: 'Why Us',
    navSpecialists: 'Specialists',
    navSchedule: 'Camp Schedule',
    navProcess: 'Process',
    btnBookScreening: 'Book a Screening',
    btnLogin: 'Portal Login',
    heroBadge: '🌿 24/7 Tribal Telemedicine & Smart Healthcare',
    heroTitlePrefix: 'Caring for Health',
    heroTitleSuffix: 'Caring for You',
    heroSubtitle:
      'Community-based AI oral mucosal screening, offline-first ASHA workflows, and direct telemedicine consultations engineered for remote habitations across the Eastern Ghats.',
    heroCtaScreening: '📅 Book Free Screening',
    heroCtaAi: '🤖 AI Oral Screening',
    heroCtaLogin: '🔐 Patient & Doctor Portal',
    heroOfflineTag: '🟢 100% Offline IndexedDB Capable',
    heroAiAccuracyTag: '🩺 2-Tier AI Oral Screening (ONNX + Gemini)',
    aboutBadge: 'ABOUT US • ITDA PADERU TRIBAL HEALTH',
    aboutTitle: 'Affordable & Dignified Healthcare Solutions for Every Habitation',
    aboutDesc:
      'Engineered specifically for remote mountain terrain with low cellular connectivity in Alluri Sitharama Raju District. Enabling frontline health workers to detect oral mucosal alterations early.',
    aboutChecks: [
      'Verified Clinical Officers & Dental Surgeons',
      'Fully Offline ASHA & ANM Tablet Workflows',
      'Zero-Cost Screenings, Medicines & Consultations',
      'Cryptographic SHA-256 Medical Records',
    ],
    servicesTag: 'OUR SERVICES • 8 CORE SPECIALITIES',
    servicesTitle: 'Comprehensive Digital Health & Screening Specialities',
    servicesDesc: 'Bridging remote tribal habitations with primary and specialist healthcare infrastructure.',
    servicesList: [
      {
        id: 'oral',
        icon: '🦷',
        title: 'Oral Cavity & Mucosal Screening',
        desc: 'AI-assisted rapid screening to assess oral mucosa, ulcers, and white/red patches with clinical triage.',
        highlighted: true,
        badge: 'Featured AI Service (Demo)',
      },
      {
        id: 'teleconsult',
        icon: '🩺',
        title: 'Tele-Consultation & Doctor Review',
        desc: 'Direct encrypted video consultations connecting frontline patients with Dental Surgeons at CHC Paderu.',
        highlighted: false,
      },
      {
        id: 'offline',
        icon: '📱',
        title: 'Offline Frontline Screening (ASHA)',
        desc: 'Works in zero-connectivity dead-zones. Health workers record screenings in IndexedDB and sync automatically.',
        highlighted: false,
      },
      {
        id: 'rx',
        icon: '💊',
        title: 'Digital E-Prescriptions & Care Nav',
        desc: 'Official doctor-signed prescriptions with dosage schedules and local dietary recommendations.',
        highlighted: false,
      },
      {
        id: 'referral',
        icon: '🏥',
        title: 'Specialist Hospital Referrals',
        desc: 'Structured referrals to Area Hospital Araku Valley and King George Hospital (KGH) Visakhapatnam.',
        highlighted: false,
      },
      {
        id: 'camps',
        icon: '🚐',
        title: 'Mobile Tribal Medical Camps',
        desc: 'Scheduled weekly outreach camps at tribal shandies (weekly markets) and remote panchayats.',
        highlighted: false,
      },
      {
        id: 'gis',
        icon: '🗺️',
        title: 'GIS Telemetry & Disease Mapping',
        desc: 'District-wide spatial analytics mapping oral alterations and screening coverage across 22 mandals.',
        highlighted: false,
      },
      {
        id: 'abha',
        icon: '🆔',
        title: 'ABHA & National ABDM Linking',
        desc: 'Seamless integration with Ayushman Bharat Digital Mission (ABDM) and 14-digit ABHA accounts.',
        highlighted: false,
      },
    ],
    whyChooseTag: 'WHY CHOOSE US • PLATFORM ADVANTAGES',
    whyChooseTitle: 'Engineered Specifically for Remote Mountain Topography',
    whySteps: [
      {
        num: '01',
        title: 'Compassionate & Tribal-Centric Care',
        desc: 'Preserving verbatim address landmarks, local tribal dialects, and respectful frontline health accompaniment.',
      },
      {
        num: '02',
        title: 'Resilient Offline-First Architecture',
        desc: 'Zero-data loss in disconnected terrain. Every mutation is cryptographically queued in browser IndexedDB.',
      },
      {
        num: '03',
        title: 'Clinician-in-the-Loop AI Safety',
        desc: 'Strict non-diagnostic triage. Automated scores never replace or overwrite human clinician assessments.',
      },
    ],
    stats: [
      { value: '12,450+', label: 'Tribals Screened', tag: 'Simulation Demo Data' },
      { value: '22 Mandals', label: 'ASR Agency Coverage', tag: 'Full District Scope' },
      { value: '100% Offline', label: 'Frontline Field Resilient', tag: 'IndexedDB PENDING_SYNC' },
      { value: '48+ Camps', label: 'Scheduled Medical Camps', tag: 'Current Season' },
    ],
    specialistsTag: 'EXPERT CLINICIANS • MEDICAL TEAM',
    specialistsTitle: 'Meet Our Dedicated Healthcare Officers',
    specialistsList: [
      {
        name: 'Dr. K. Somasekhar, BDS, MDS',
        role: 'Senior Dental Surgeon & Oral Medicine',
        hospital: 'Community Health Centre (CHC) Paderu',
        avatar: '👨‍⚕️',
      },
      {
        name: 'Dr. P. Anitha, MBBS, MD',
        role: 'Chief Medical Officer',
        hospital: 'Area Hospital, Araku Valley',
        avatar: '👩‍⚕️',
      },
      {
        name: 'Dr. M. Rajesh, MS, FICS',
        role: 'ENT & Maxillofacial Consultant',
        hospital: 'King George Hospital (KGH) Visakhapatnam',
        avatar: '👨‍⚕️',
      },
      {
        name: 'Dr. S. Sunitha, MBBS, DPH',
        role: 'Public Health Nodal Officer',
        hospital: 'ITDA Paderu Tribal Health Cell',
        avatar: '👩‍⚕️',
      },
    ],
    campScheduleTitle: 'Medical Camp Schedule & Working Hours',
    campScheduleDesc: 'Free dental & oral screening camp locations across Alluri Sitharama Raju District:',
    campsList: [
      { location: 'Paderu Central CHC OPD', days: 'Mon - Sat (09:00 AM - 02:00 PM)' },
      { location: 'Dumbriguda Shandy Mobile Unit', days: 'Every Monday & Wednesday' },
      { location: 'Araku Valley Agency Outpost', days: 'Every Tuesday & Thursday' },
      { location: 'Chintapalli Remote Tribal Camp', days: '2nd & 4th Saturday' },
      { location: '24/7 Emergency Casualty Desk', days: 'Open 24 Hours Daily' },
    ],
    bookScreeningTitle: 'Book a Free Screening (Works Completely Offline)',
    bookScreeningDesc: 'No mandatory OTP required. Fill your details and get immediate offline confirmation.',
    formNameLabel: 'Full Patient Name *',
    formPhoneLabel: 'Mobile Number (Optional - for SMS notification)',
    formMandalLabel: 'Select Mandal *',
    formVillageLabel: 'Village / Habitation Name',
    formCampLabel: 'Select Preferred Camp & Date *',
    formSymptomsLabel: 'Symptoms or Reason for Visit',
    consentCheckboxText: 'I consent to voluntary oral mucosal screening simulation under ITDA Paderu Tribal Health Initiative.',
    btnSubmitBooking: '📅 Confirm Screening Booking (Save Offline)',
    bookingConfirmedTitle: '✅ Screening Booking Successfully Confirmed!',
    bookingCodeLabel: 'Your Booking Reference ID:',
    bookingOfflineNote: '💡 Queued in PENDING_SYNC. Will automatically sync to ITDA Health Cloud when network reconnects. No OTP required.',
    processTag: 'WORK PROCESS • 4 SIMPLE STEPS',
    processTitle: 'From Frontline Screening to Specialist Care',
    processSteps: [
      { num: '01', title: 'Patient Registration', desc: 'Instant registration using Aadhaar, ABHA ID or simple name.' },
      { num: '02', title: 'Frontline Check-Up', desc: 'ASHA captures oral photo under safe focal illumination.' },
      { num: '03', title: 'AI Screening & Triage', desc: 'On-device neural network generates rapid risk triage recommendation.' },
      { num: '04', title: 'Ongoing Care & Consult', desc: 'Doctor teleconsultation, digital Rx and specialist navigation.' },
    ],
    footerAbout: 'Aarogya-Drishti is a community-based oral screening and digital healthcare navigation platform for ITDA Paderu Tribal Health Initiative.',
    footerQuickLinks: 'Quick Navigation',
    footerPortals: 'Portals & Access',
    footerLegal: 'Legal & Clinical Governance',
    privacyLink: 'Privacy Policy',
    consentLink: 'Informed Consent Framework',
    nonDiagDisclaimer: '⚠️ Disclaimer: This is a screening simulation system only. It does not provide definitive medical diagnoses. Always consult qualified doctors.',
    allRightsReserved: '© 2026 Aarogya-Drishti • ITDA Paderu Tribal Health Initiative. All rights reserved.',
    viewDashboardBtn: 'Return to Dashboard',
  },
  hi: {
    helpline: '24/7 जनजातीय स्वास्थ्य हेल्पलाइन: 104 / 1800-425-0001',
    agencyLocation: 'आईटीडीए पाडेरु एजेंसी क्षेत्र • अल्लूरी सीताराम राजू जिला',
    opdStatus: '🟢 आज की ओपीडी सेवा सक्रिय (09:00 AM - 02:00 PM)',
    appName: 'आरोग्य दृष्टि',
    appFullName: 'Aarogya-Drishti',
    subBrand: 'आईटीडीए जनजातीय डिजिटल टेलीमेडिसिन',
    navHome: 'होम',
    navAbout: 'हमारे बारे में',
    navServices: 'सेवाएं',
    navWhyUs: 'विशेषताएं',
    navSpecialists: 'चिकित्सक दल',
    navSchedule: 'शिविर समय-सारणी',
    navProcess: 'प्रक्रिया',
    btnBookScreening: 'स्क्रीनिंग बुक करें',
    btnLogin: 'पोर्टल लॉगिन',
    heroBadge: '🌿 24/7 जनजातीय टेलीमेडिसिन एवं एआई स्वास्थ्य सेवा',
    heroTitlePrefix: 'स्वास्थ्य की देखभाल',
    heroTitleSuffix: 'आपके जीवन का सरोकार',
    heroSubtitle:
      'पूर्वी घाट की दूरदराज बस्तियों के लिए स्मार्ट एआई मौखिक स्क्रीनिंग, ऑफलाइन आशा वर्कफ़्लो और प्रत्यक्ष डॉक्टर टेलीमेडिसिन प्रणाली।',
    heroCtaScreening: '📅 नि:शुल्क स्क्रीनिंग बुक करें',
    heroCtaAi: '🤖 एआई हेल्थ स्क्रीनिंग',
    heroCtaLogin: '🔐 रोगी एवं डॉक्टर पोर्टल',
    heroOfflineTag: '🟢 100% ऑफलाइन इंडेक्स्ड-डीबी समर्थित',
    heroAiAccuracyTag: '🩺 2-टियर एआई ओरल स्क्रीनिंग (ONNX + जेमिनी)',
    aboutBadge: 'हमारे बारे में • आईटीडीए पाडेरु',
    aboutTitle: 'हर आदिवासी बस्ती तक सुलभ और गुणवत्तापूर्ण स्वास्थ्य सेवाएं',
    aboutDesc:
      'अल्लूरी सीताराम राजू जिले के नेटवर्क-विहीन क्षेत्रों में रहने वाले आदिवासी समुदायों के लिए प्रारंभिक चरण में ही मौखिक रोगों की पहचान सुनिश्चित करना।',
    aboutChecks: [
      'प्रमाणित दंत चिकित्सक एवं मेडिकल अधिकारी',
      'बिना इंटरनेट कार्य करने वाले आशा टैबलेट्स',
      'नि:शुल्क स्क्रीनिंग, दवाएं एवं रेफरल सुविधा',
      'क्रिप्टोग्राफिक SHA-256 सुरक्षित मेडिकल रिकॉर्ड्स',
    ],
    servicesTag: 'हमारी सेवाएं • 8 प्रमुख विभाग',
    servicesTitle: 'व्यापक डिजिटल स्वास्थ्य एवं स्क्रीनिंग सेवाएं',
    servicesDesc: 'जनजातीय क्षेत्रों में प्राथमिक स्वास्थ्य से लेकर विशेषज्ञ अस्पतालों तक निर्बाध संपर्क।',
    servicesList: [
      {
        id: 'oral',
        icon: '🦷',
        title: 'मौखिक म्यूकोसा एवं दंत स्क्रीनिंग',
        desc: 'आर्टिफिशियल इंटेलिजेंस की सहायता से मौखिक छालों और परिवर्तनों की त्वरित स्क्रीनिंग।',
        highlighted: true,
        badge: 'प्रमुख एआई सेवा (Demo)',
      },
      {
        id: 'teleconsult',
        icon: '🩺',
        title: 'लाइव टेली-परामर्श (Video Call)',
        desc: 'पाडेरु सीएचसी के अनुभवी डॉक्टरों के साथ सुरक्षित वीडियो कॉल और परामर्श।',
        highlighted: false,
      },
      {
        id: 'offline',
        icon: '📱',
        title: 'ऑफलाइन फ्रंटलाइन मोबाइल स्क्रीनिंग',
        desc: 'बिना मोबाइल सिग्नल के भी डेटा सुरक्षित रहता है और नेटवर्क मिलने पर स्वतः सिंक होता है।',
        highlighted: false,
      },
      {
        id: 'rx',
        icon: '💊',
        title: 'डिजिटल पर्चा (E-Prescriptions)',
        desc: 'डॉक्टर द्वारा प्रमाणित डिजिटल नुस्खा, खुराक और जीवनशैली दिशानिर्देश।',
        highlighted: false,
      },
      {
        id: 'referral',
        icon: '🏥',
        title: 'विशेषज्ञ अस्पताल रेफरल',
        desc: 'आवश्यकता पड़ने पर पाडेरु सीएचसी या केजीएच विशाखापट्टनम के लिए आधिकारिक रेफरल।',
        highlighted: false,
      },
      {
        id: 'camps',
        icon: '🚐',
        title: 'मोबाइल जनजातीय स्वास्थ्य शिविर',
        desc: 'साप्ताहिक हाट-बाजारों और दूरदराज बस्तियों में नियमित नि:शुल्क स्वास्थ्य शिविर।',
        highlighted: false,
      },
      {
        id: 'gis',
        icon: '🗺️',
        title: 'जीआईएस मैपिंग एवं निगरानी',
        desc: 'जिले के 22 मंडलों में मौखिक स्वास्थ्य समस्याओं और स्क्रीनिंग कवरेज का डिजिटल नक्शा।',
        highlighted: false,
      },
      {
        id: 'abha',
        icon: '🆔',
        title: 'आभा (ABHA) खाता लिंकेज',
        desc: 'राष्ट्रीय डिजिटल स्वास्थ्य मिशन के तहत 14 अंकों के आभा नंबर का आसान जुड़ाव।',
        highlighted: false,
      },
    ],
    whyChooseTag: 'विशेषताएं • आरोग्य दृष्टि क्यों?',
    whyChooseTitle: 'पहाड़ी और जनजातीय भौगोलिक परिस्थितियों के अनुरूप निर्मित',
    whySteps: [
      {
        num: '01',
        title: 'जनजातीय संस्कृति का सम्मान एवं स्थानीय लैंडमार्क',
        desc: 'पारंपरिक पतों का सम्मान और स्थानीय आदिवासी बोलियों में आवाज द्वारा मार्गदर्शन।',
      },
      {
        num: '02',
        title: 'ऑफलाइन-फर्स्ट मजबूत तकनीकी ढांचा',
        desc: 'पहाड़ों में नेटवर्क न होने पर भी सभी रिकॉर्ड्स इंडेक्स्ड-डीबी में सुरक्षित रहते हैं।',
      },
      {
        num: '03',
        title: 'मानवीय निगरानी में सुरक्षित एआई तकनीक',
        desc: 'एआई कभी भी रोग का अंतिम निदान नहीं करता; यह केवल डॉक्टर का प्राथमिक सहायक है।',
      },
    ],
    stats: [
      { value: '12,450+', label: 'स्क्रीनिंग किए गए व्यक्ति', tag: 'सिमुलेशन डेमो डेटा' },
      { value: '22 मंडल', label: 'एएसआर जिला एजेंसी कवरेज', tag: 'संपूर्ण भौगोलिक दायरा' },
      { value: '100% ऑफलाइन', label: 'फ्रंटलाइन फील्ड क्षमता', tag: 'इंडेक्स्ड-डीबी सिंक' },
      { value: '48+ शिविर', label: 'निर्धारित स्वास्थ्य शिविर', tag: 'वर्तमान मौसम' },
    ],
    specialistsTag: 'विशेषज्ञ दल • चिकित्सा अधिकारी',
    specialistsTitle: 'आपके स्वास्थ्य के लिए समर्पित चिकित्सक',
    specialistsList: [
      {
        name: 'डॉ. के. सोमशेखर, BDS, MDS',
        role: 'वरिष्ठ दंत शल्य चिकित्सक',
        hospital: 'सामुदायिक स्वास्थ्य केंद्र (CHC) पाडेरु',
        avatar: '👨‍⚕️',
      },
      {
        name: 'डॉ. पी. अनिता, MBBS, MD',
        role: 'मुख्य चिकित्सा अधिकारी',
        hospital: 'क्षेत्रीय अस्पताल, अराकू घाटी',
        avatar: '👩‍⚕️',
      },
      {
        name: 'डॉ. एम. राजेश, MS, FICS',
        role: 'ईएनटी एवं मैक्सिलोफेशियल विशेषज्ञ',
        hospital: 'किंग जॉर्ज अस्पताल (KGH) विशाखापट्टनम',
        avatar: '👨‍⚕️',
      },
      {
        name: 'डॉ. एस. सुनीता, MBBS, DPH',
        role: 'जन स्वास्थ्य नोडल अधिकारी',
        hospital: 'आईटीडीए पाडेरु स्वास्थ्य शाखा',
        avatar: '👩‍⚕️',
      },
    ],
    campScheduleTitle: 'स्वास्थ्य शिविर समय-सारणी एवं ओपीडी समय',
    campScheduleDesc: 'अल्लूरी सीताराम राजू जिले में नि:शुल्क शिविरों की जानकारी:',
    campsList: [
      { location: 'पाडेरु सेंट्रल सीएचसी ओपीडी', days: 'सोम - शनि (09:00 AM - 02:00 PM)' },
      { location: 'डुंब्रिगुडा हाट मोबाइल यूनिट', days: 'प्रत्येक सोमवार एवं बुधवार' },
      { location: 'अराकू घाटी एजेंसी आउटपोस्ट', days: 'प्रत्येक मंगलवार एवं गुरुवार' },
      { location: 'चिंतापल्ली जनजातीय शिविर', days: 'द्वितीय एवं चतुर्थ शनिवार' },
      { location: '24/7 आपातकालीन वार्ड', days: 'सदैव उपलब्ध (24 घंटे)' },
    ],
    bookScreeningTitle: 'नि:शुल्क स्क्रीनिंग बुक करें (ऑफलाइन भी उपलब्ध)',
    bookScreeningDesc: 'ओटीपी की आवश्यकता नहीं है। विवरण भरें और तुरंत ऑफलाइन पुष्टि प्राप्त करें।',
    formNameLabel: 'मरीज का पूरा नाम *',
    formPhoneLabel: 'मोबाइल नंबर (वैकल्पिक - एसएमएस हेतु)',
    formMandalLabel: 'मंडल चुनें *',
    formVillageLabel: 'गांव / बस्ती का नाम',
    formCampLabel: 'शिविर एवं तिथि चुनें *',
    formSymptomsLabel: 'लक्षण या जांच का कारण',
    consentCheckboxText: 'मैं आईटीडीए पाडेरु के तहत स्वैच्छिक मौखिक एआई स्क्रीनिंग सिमुलेशन के लिए सहमति देता/देती हूँ।',
    btnSubmitBooking: '📅 स्क्रीनिंग बुकिंग की पुष्टि करें (Save Offline)',
    bookingConfirmedTitle: '✅ स्क्रीनिंग बुकिंग सफलतापूर्वक दर्ज हो गई!',
    bookingCodeLabel: 'आपका संदर्भ कोड:',
    bookingOfflineNote: '💡 PENDING_SYNC में सुरक्षित। नेटवर्क मिलने पर क्लाउड पर स्वतः सिंक हो जाएगा। ओटीपी की आवश्यकता नहीं है।',
    processTag: 'प्रक्रिया • 4 सरल चरण',
    processTitle: 'स्क्रीनिंग से लेकर विशेषज्ञ परामर्श तक',
    processSteps: [
      { num: '01', title: 'सरल पंजीकरण', desc: 'आधार, आभा या नाम से तुरंत पंजीकरण।' },
      { num: '02', title: 'मौखिक जांच', desc: 'आशा कार्यकर्ता द्वारा सुरक्षित रोशनी में फोटो खींचना।' },
      { num: '03', title: 'एआई स्क्रीनिंग', desc: 'बिना इंटरनेट कुछ ही सेकंड में प्राथमिक जोखिम विश्लेषण।' },
      { num: '04', title: 'परामर्श एवं देखभाल', desc: 'डॉक्टर वीडियो समीक्षा, डिजिटल पर्चा और विशेषज्ञ रेफरल।' },
    ],
    footerAbout: 'आरोग्य दृष्टि आईटीडीए पाडेरु के तहत संचालित एक समुदाय-आधारित डिजिटल स्वास्थ्य मंच है।',
    footerQuickLinks: 'त्वरित लिंक',
    footerPortals: 'पोर्टल्स एवं लॉगिन',
    footerLegal: 'कानूनी एवं क्लिनिकल नियम',
    privacyLink: 'गोपनीयता नीति (Privacy Policy)',
    consentLink: 'सहमति फ्रेमवर्क (Informed Consent)',
    nonDiagDisclaimer: '⚠️ अस्वीकरण: यह केवल स्क्रीनिंग सिमुलेशन प्रणाली है। यह कोई अंतिम चिकित्सा निदान नहीं है। सदैव प्रमाणित डॉक्टरों से परामर्श लें।',
    allRightsReserved: '© 2026 आरोग्य दृष्टि • आईटीडीए पाडेरु। सर्वाधिकार सुरक्षित।',
    viewDashboardBtn: 'डैशबोर्ड पर वापस जाएं',
  },
};

export const LandingPage: React.FC<LandingPageProps> = ({
  currentLang = 'te',
  onSelectLang,
  onNavigateLogin,
  onNavigatePatient,
  onNavigateDoctor,
  onNavigateAdmin,
  onOpenScreening,
  currentUser,
}) => {
  const [activeLang, setActiveLang] = useState<LanguageCode>(currentLang);

  React.useEffect(() => {
    if (currentLang && currentLang !== activeLang) {
      setActiveLang(currentLang);
    }
  }, [currentLang]);

  const handleLangSelect = (l: LanguageCode) => {
    setActiveLang(l);
    if (onSelectLang) onSelectLang(l);
    try {
      localStorage.setItem('aarogya_language', l);
    } catch {}
  };

  const t = (T as Record<string, typeof T.te>)[activeLang] || T.te;

  // Booking Form State (Offline Capable, No Mandatory OTP, Consent Checkbox)
  const [patientName, setPatientName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [mandal, setMandal] = useState<string>('Paderu');
  const [village, setVillage] = useState<string>('');
  const [preferredCamp, setPreferredCamp] = useState<string>('Paderu Central CHC OPD - 12 Nov 2026');
  const [symptoms, setSymptoms] = useState<string>('');
  const [consentGiven, setConsentGiven] = useState<boolean>(true);
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBookScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGiven) {
      setErrorMsg(
        activeLang === 'te'
          ? 'దయచేసి స్వచ్ఛంద స్క్రీనింగ్ సమ్మతి బాక్స్‌ను టిక్ చేయండి.'
          : activeLang === 'hi'
          ? 'कृपया स्वैच्छिक स्क्रीनिंग सहमति चेकबॉक्स को चुनें।'
          : 'Please accept the informed consent checkbox to proceed.'
      );
      return;
    }
    if (!patientName.trim()) {
      setErrorMsg(
        activeLang === 'te'
          ? 'దయచేసి రోగి పూర్తి పేరు నమోదు చేయండి.'
          : activeLang === 'hi'
          ? 'कृपया मरीज का नाम दर्ज करें।'
          : 'Please enter patient full name.'
      );
      return;
    }

    setBookingLoading(true);
    setErrorMsg(null);

    const clientMutationId = `booking_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const bookingCode = `SCR-${mandal.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const bookingPayload = {
      bookingId: bookingCode,
      clientMutationId,
      patientName: patientName.trim(),
      phone: phone.trim() || 'NOT_PROVIDED',
      mandal,
      village: village.trim() || mandal,
      preferredCamp,
      symptoms: symptoms.trim() || 'Routine oral mucosal checkup',
      consentGiven: true,
      consentTimestamp: new Date().toISOString(),
      status: 'CONFIRMED',
      syncStatus: 'PENDING_SYNC',
      createdAt: Date.now(),
    };

    try {
      // 1. Enqueue in IndexedDB Sync Queue (Offline Resilient)
      await db.syncQueue.add({
        action: 'screening_booking',
        endpoint: '/api/v1/appointments',
        method: 'POST',
        payload: bookingPayload,
        retryCount: 0,
        createdAt: Date.now(),
      });

      // 2. Also try online sync if connected
      if (navigator.onLine) {
        try {
          await fetch('/api/v1/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingPayload),
          }).catch(() => null);
        } catch {}
      }

      setConfirmedBooking(bookingPayload);
      setBookingSuccess(true);
    } catch {
      // LocalStorage fallback for robustness
      try {
        const existing = JSON.parse(localStorage.getItem('pending_screening_bookings') || '[]');
        existing.push(bookingPayload);
        localStorage.setItem('pending_screening_bookings', JSON.stringify(existing));
        setConfirmedBooking(bookingPayload);
        setBookingSuccess(true);
      } catch {
        setErrorMsg('Could not record booking offline. Please retry.');
      }
    } finally {
      setBookingLoading(false);
    }
  };

  // In-Place Section View Switching (Zero Scroll Animation)
  const [activeSection, setActiveSection] = useState<'all' | 'about' | 'services' | 'why-us' | 'specialists' | 'booking' | 'process'>('all');

  const handleSectionSwitch = (section: 'all' | 'about' | 'services' | 'why-us' | 'specialists' | 'booking' | 'process') => {
    setActiveSection(section);
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const getSectionTitle = (sec: string) => {
    switch (sec) {
      case 'about': return t.navAbout;
      case 'services': return t.navServices;
      case 'why-us': return t.navWhyUs;
      case 'specialists': return t.navSpecialists;
      case 'booking': return t.navSchedule;
      case 'process': return t.navProcess;
      default: return t.navHome;
    }
  };

  const scrollToBooking = () => {
    handleSectionSwitch('booking');
  };

  return (
    <div className="landing-root">
      {/* -------------------- 1. TOP INFO BAR -------------------- */}
      <div className="landing-top-bar">
        <div className="landing-top-bar-left">
          <div className="landing-top-info-item">
            <span>📞</span>
            <span>{t.helpline}</span>
          </div>
          <div className="landing-top-info-item">
            <span>📍</span>
            <span>{t.agencyLocation}</span>
          </div>
          <div className="landing-top-info-item" style={{ color: 'var(--success-text)', fontWeight: 700 }}>
            {t.opdStatus}
          </div>
        </div>

        <div className="landing-top-bar-right">
          {/* Language Selector Pills */}
          <div className="lang-btn-group">
            <button
              type="button"
              className={`lang-btn ${activeLang === 'te' ? 'active' : ''}`}
              onClick={() => handleLangSelect('te')}
            >
              తెలుగు
            </button>
            <button
              type="button"
              className={`lang-btn ${activeLang === 'en' ? 'active' : ''}`}
              onClick={() => handleLangSelect('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-btn ${activeLang === 'hi' ? 'active' : ''}`}
              onClick={() => handleLangSelect('hi')}
            >
              हिन्दी
            </button>
          </div>

          {/* Theme Toggle (Light / Dark) */}
          <ThemeToggle currentLang={activeLang} compact />
        </div>
      </div>

      {/* -------------------- 2. NAVBAR -------------------- */}
      <header className="landing-navbar">
        <div
          className="landing-brand"
          style={{ cursor: 'pointer' }}
          onClick={() => handleSectionSwitch('all')}
        >
          <img className="landing-brand-logo" src="/brand/aarogya-mark.png" alt="Aarogya-Drishti logo" />
          <div className="landing-brand-text">
            <h1>{t.appName}</h1>
            <p>{t.subBrand}</p>
          </div>
        </div>

        <ul className="landing-nav-links">
          <li>
            <button
              type="button"
              className={`landing-nav-link-btn ${activeSection === 'all' ? 'active' : ''}`}
              onClick={() => handleSectionSwitch('all')}
            >
              {t.navHome}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`landing-nav-link-btn ${activeSection === 'about' ? 'active' : ''}`}
              onClick={() => handleSectionSwitch('about')}
            >
              {t.navAbout}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`landing-nav-link-btn ${activeSection === 'services' ? 'active' : ''}`}
              onClick={() => handleSectionSwitch('services')}
            >
              {t.navServices}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`landing-nav-link-btn ${activeSection === 'why-us' ? 'active' : ''}`}
              onClick={() => handleSectionSwitch('why-us')}
            >
              {t.navWhyUs}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`landing-nav-link-btn ${activeSection === 'specialists' ? 'active' : ''}`}
              onClick={() => handleSectionSwitch('specialists')}
            >
              {t.navSpecialists}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`landing-nav-link-btn ${activeSection === 'booking' ? 'active' : ''}`}
              onClick={() => handleSectionSwitch('booking')}
            >
              {t.navSchedule}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`landing-nav-link-btn ${activeSection === 'process' ? 'active' : ''}`}
              onClick={() => handleSectionSwitch('process')}
            >
              {t.navProcess}
            </button>
          </li>
        </ul>

        <div className="landing-nav-actions">
          {currentUser ? (
            <button
              type="button"
              className="btn-primary-action"
              onClick={() => {
                const role = (currentUser.role || '').toUpperCase();
                if (role.includes('ADMIN')) {
                  if (onNavigateAdmin) onNavigateAdmin();
                  else window.location.hash = '#/admin';
                } else if (role.includes('DOCTOR') || role.includes('MEDICAL')) {
                  if (onNavigateDoctor) onNavigateDoctor();
                  else window.location.hash = '#/doctor';
                } else {
                  if (onNavigatePatient) onNavigatePatient();
                  else window.location.hash = '#/patient';
                }
              }}
            >
              <span>👤</span>
              <span>{t.viewDashboardBtn}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-outline-action"
                onClick={() => {
                  if (onNavigateLogin) onNavigateLogin();
                  else window.location.hash = '#/login';
                }}
              >
                <span>🔐</span>
                <span>{t.btnLogin}</span>
              </button>
              <button
                type="button"
                className="btn-primary-action"
                onClick={scrollToBooking}
              >
                <span>📅</span>
                <span>{t.btnBookScreening}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* -------------------- 3. HERO SECTION (Mediax Reference Style) -------------------- */}
      <section className="landing-hero">
        <div className="hero-content-col">
          <div className="hero-pill-badge">
            {t.heroBadge}
          </div>

          <h2 className="hero-headline">
            {t.heroTitlePrefix}{' '}
            <span className="highlight-word">{t.heroTitleSuffix}</span>
          </h2>

          <p className="hero-subtext">
            {t.heroSubtitle}
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              className="btn-primary-action"
              onClick={scrollToBooking}
            >
              <span>📅</span>
              <span>{t.heroCtaScreening}</span>
            </button>

            <button
              type="button"
              className="btn-outline-action"
              onClick={() => {
                if (onOpenScreening) onOpenScreening();
                else window.location.hash = '#/patient';
              }}
            >
              <span>🤖</span>
              <span>{t.heroCtaAi}</span>
            </button>

            <button
              type="button"
              className="btn-outline-action"
              onClick={() => {
                if (onNavigateLogin) onNavigateLogin();
                else window.location.hash = '#/login';
              }}
            >
              <span>🔐</span>
              <span>{t.heroCtaLogin}</span>
            </button>
          </div>

          <div className="hero-trust-row">
            <div className="hero-trust-item">
              <span>{t.heroOfflineTag}</span>
            </div>
            <div className="hero-trust-item">
              <span>{t.heroAiAccuracyTag}</span>
            </div>
          </div>
        </div>

        {/* Hero Visual Graphic (Clean SVG & Geometric Accents, Zero Stock Photos) */}
        <div className="hero-visual-card">
          <div className="hero-visual-bg-pattern" />

          {/* Floating Badge Top Right */}
          <div className="hero-floating-badge badge-top-right">
            <span style={{ fontSize: '1.2rem' }}>🩺</span>
            <div>
              <div style={{ color: 'var(--success-text)', fontSize: '0.74rem' }}>FRONT-LINE TRIAGE</div>
              <div style={{ color: 'var(--text-primary)' }}>CHC Paderu Dental Outpost</div>
            </div>
          </div>

          {/* Central Clinical Medical Cross Vector Graphic */}
          <div style={{ width: '220px', height: '220px', position: 'relative', margin: '20px 0' }}>
            <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ filter: 'drop-shadow(0 12px 28px rgba(2, 132, 199, 0.2))' }}>
              <circle cx="100" cy="100" r="90" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2" />
              <circle cx="100" cy="100" r="75" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 4" />
              {/* Medical Cross */}
              <path
                d="M85 45 H115 V85 H155 V115 H115 V155 H85 V115 H45 V85 H85 Z"
                fill="var(--btn-primary-bg)"
              />
              <circle cx="100" cy="100" r="24" fill="#ffffff" />
              <path
                d="M93 100 L98 105 L108 94"
                fill="none"
                stroke="var(--btn-primary-bg)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Floating Badge Bottom Left */}
          <div className="hero-floating-badge badge-bottom-left">
            <span style={{ fontSize: '1.2rem' }}>📶</span>
            <div>
              <div style={{ color: 'var(--accent)', fontSize: '0.74rem' }}>OFFLINE SYNC STATUS</div>
              <div style={{ color: 'var(--text-primary)' }}>Pending Queue: 0 (Synced)</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              Aarogya-Drishti Dental Engine
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Non-Diagnostic AI Screening Simulation
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- IN-PLACE SECTION VIEW FILTER BAR -------------------- */}
      {activeSection !== 'all' && (
        <div className="section-active-filter-bar">
          <div className="section-filter-info">
            <span>👁️ {activeLang === 'te' ? 'ప్రస్తుత విభాగం' : activeLang === 'hi' ? 'वर्तमान अनुभाग' : 'Current Section'}:</span>
            <strong>{getSectionTitle(activeSection)}</strong>
          </div>
          <button
            type="button"
            className="btn-filter-reset"
            onClick={() => handleSectionSwitch('all')}
          >
            ✕ {activeLang === 'te' ? 'అన్ని విభాగాలు చూపించు' : activeLang === 'hi' ? 'सभी अनुभाग देखें' : 'Show All Sections'}
          </button>
        </div>
      )}

      {/* -------------------- DYNAMIC IN-PLACE SECTIONS SWITCHER -------------------- */}
      <div key={activeSection} className="section-switch-enter">
        {/* -------------------- 4. ABOUT SECTION -------------------- */}
        {(activeSection === 'all' || activeSection === 'about') && (
          <section id="about-section" className="landing-section soft-bg">
            <div className="landing-section-inner">
              <div className="about-grid">
                <div className="about-graphic-wrap">
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🏥</div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      ITDA Paderu Healthcare Hub
                    </h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                      Connecting 22 Mandals & 3,500+ Tribal Habitations
                    </p>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'var(--surface-2)',
                        padding: '8px 16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                      }}
                    >
                      <span>⭐⭐⭐⭐⭐</span>
                      <span style={{ color: 'var(--text-primary)' }}>4.9/5 Tribal Satisfaction</span>
                    </div>
                  </div>
                </div>

                <div className="about-content-wrap">
                  <span className="section-tag">{t.aboutBadge}</span>
                  <h3 className="section-title">{t.aboutTitle}</h3>
                  <p className="section-desc">{t.aboutDesc}</p>

                  <div className="about-check-list">
                    {t.aboutChecks.map((item, idx) => (
                      <div key={idx} className="about-check-item">
                        <div className="about-check-icon">✓</div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={scrollToBooking}
                  >
                    <span>📅</span>
                    <span>{t.btnBookScreening}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* -------------------- 5. SERVICES GRID (8 Cards - Mediax Reference) -------------------- */}
        {(activeSection === 'all' || activeSection === 'services') && (
          <section id="services-section" className="landing-section">
            <div className="section-header-center">
              <span className="section-tag">{t.servicesTag}</span>
              <h3 className="section-title">{t.servicesTitle}</h3>
              <p className="section-desc">{t.servicesDesc}</p>
            </div>

            <div className="services-grid-8">
              {t.servicesList.map((svc) => (
                <div
                  key={svc.id}
                  className={`service-card ${svc.highlighted ? 'highlighted' : ''}`}
                >
                  <div className="service-icon-wrap">{svc.icon}</div>
                  <h4 className="service-title">{svc.title}</h4>
                  <p className="service-desc">{svc.desc}</p>
                  <div>
                    <button
                      type="button"
                      className="service-action-link"
                      onClick={() => {
                        if (svc.id === 'oral' && onOpenScreening) {
                          onOpenScreening();
                        } else {
                          scrollToBooking();
                        }
                      }}
                    >
                      <span>{activeLang === 'te' ? 'వివరాలు చూడండి' : activeLang === 'hi' ? 'विवरण देखें' : 'Learn More'}</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* -------------------- 6. WHY CHOOSE US (3 Steps) -------------------- */}
        {(activeSection === 'all' || activeSection === 'why-us' || activeSection === 'about') && (
          <section id="why-choose-section" className="landing-section soft-bg">
            <div className="landing-section-inner">
              <div className="why-choose-grid">
                <div className="why-choose-content">
                  <span className="section-tag">{t.whyChooseTag}</span>
                  <h3 className="section-title">{t.whyChooseTitle}</h3>

                  <div className="why-steps-list">
                    {t.whySteps.map((step, idx) => (
                      <div key={idx} className="why-step-item">
                        <div className="step-num-badge">{step.num}</div>
                        <div className="why-step-content">
                          <h4>{step.title}</h4>
                          <p>{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Why Choose Us Illustration Card */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    borderRadius: '24px',
                    padding: '36px 28px',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.05)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '3.5rem', marginBottom: '14px' }}>⛰️</div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '1.3rem', color: 'var(--text-primary)' }}>
                    Eastern Ghats Offline Resilient
                  </h4>
                  <p style={{ margin: '0 0 24px 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Built strictly to respect the 7 Architectural Invariants: Small-count cell suppression ($&lt; 5$), Zero real PII, Cryptographic SHA-256 integrity, and Safe non-diagnostic triage.
                  </p>
                  <div
                    style={{
                      background: 'var(--success-bg)',
                      color: 'var(--success-text)',
                      border: '1px solid var(--success-text)',
                      padding: '10px 16px',
                      borderRadius: '12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <span>🛡️</span>
                    <span>Govt. of Andhra Pradesh Approved Protocol</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* -------------------- 7. STATISTICS RIBBON BAR -------------------- */}
        {(activeSection === 'all' || activeSection === 'services' || activeSection === 'why-us') && (
          <div className="stats-ribbon-bar">
            {t.stats.map((st, idx) => (
              <div key={idx} className="stats-ribbon-item">
                <div className="stats-num">{st.value}</div>
                <div className="stats-label">{st.label}</div>
                <span className="stats-demo-tag">{st.tag}</span>
              </div>
            ))}
          </div>
        )}

        {/* -------------------- 8. SPECIALIST NETWORK (4 Doctors) -------------------- */}
        {(activeSection === 'all' || activeSection === 'specialists') && (
          <section id="specialists-section" className="landing-section">
            <div className="section-header-center">
              <span className="section-tag">{t.specialistsTag}</span>
              <h3 className="section-title">{t.specialistsTitle}</h3>
            </div>

            <div className="specialists-grid-4">
              {t.specialistsList.map((doc, idx) => (
                <div key={idx} className="doctor-card">
                  <div className="doctor-photo-container">
                    <div className="doctor-avatar-circle">{doc.avatar}</div>
                  </div>
                  <div className="doctor-info-body">
                    <h4 className="doctor-name">{doc.name}</h4>
                    <div className="doctor-specialty">{doc.role}</div>
                    <div className="doctor-hospital">{doc.hospital}</div>
                    <button
                      type="button"
                      className="btn-outline-action"
                      style={{ width: '100%', fontSize: '0.82rem', padding: '8px 12px' }}
                      onClick={scrollToBooking}
                    >
                      <span>📹</span>
                      <span>{activeLang === 'te' ? 'సంప్రదించండి' : activeLang === 'hi' ? 'परामर्श लें' : 'Consult Doctor'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* -------------------- 9. MEDICAL CAMP SCHEDULE & BOOKING FORM -------------------- */}
        {(activeSection === 'all' || activeSection === 'booking') && (
          <section id="booking-section" className="landing-section soft-bg">
        <div className="landing-section-inner">
          <div className="camp-booking-grid">
            {/* Left: Camp Schedule & Working Hours */}
            <div className="camp-hours-card">
              <h3>{t.campScheduleTitle}</h3>
              <p>{t.campScheduleDesc}</p>

              <div className="camp-schedule-list">
                {t.campsList.map((camp, idx) => (
                  <div key={idx} className="camp-schedule-row">
                    <span className="camp-schedule-location">{camp.location}</span>
                    <span className="camp-schedule-time">{camp.days}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 'auto',
                  padding: '12px 14px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                }}
              >
                📍 <strong>ITDA Tribal Care Guarantee:</strong> Free transportation and tribal community escort provided by local ASHA workers for all referred cases.
              </div>
            </div>

            {/* Right: Book a Screening Form (Works Completely Offline) */}
            <div className="booking-form-card">
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                {t.bookScreeningTitle}
              </h3>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                {t.bookScreeningDesc}
              </p>

              {errorMsg && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    color: 'var(--danger-text)',
                    border: '1px solid var(--danger-text)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontSize: '0.82rem',
                    marginBottom: '16px',
                  }}
                >
                  ⚠️ {errorMsg}
                </div>
              )}

              {bookingSuccess && confirmedBooking ? (
                <div
                  style={{
                    background: 'var(--success-bg)',
                    color: 'var(--success-text)',
                    border: '1.5px solid var(--success-text)',
                    borderRadius: '16px',
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎉</div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', color: 'var(--success-text)' }}>
                    {t.bookingConfirmedTitle}
                  </h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: '0.86rem' }}>
                    {t.bookingCodeLabel} <strong style={{ fontSize: '1.1rem', letterSpacing: '1px' }}>{confirmedBooking.bookingId}</strong>
                  </p>
                  <div style={{ fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.4)', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px' }}>
                    📍 Patient: <strong>{confirmedBooking.patientName}</strong> • {confirmedBooking.mandal} • {confirmedBooking.preferredCamp}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--success-text)', fontStyle: 'italic', marginBottom: '16px' }}>
                    {t.bookingOfflineNote}
                  </div>
                  <button
                    type="button"
                    className="btn-primary-action"
                    onClick={() => {
                      setBookingSuccess(false);
                      setConfirmedBooking(null);
                      setPatientName('');
                      setPhone('');
                      setVillage('');
                    }}
                  >
                    <span>➕</span>
                    <span>Book Another Appointment</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBookScreening}>
                  <div className="form-group-grid">
                    <div className="form-control-wrap">
                      <label>{t.formNameLabel}</label>
                      <input
                        type="text"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Bonangi Balaraju"
                        required
                      />
                    </div>

                    <div className="form-control-wrap">
                      <label>{t.formPhoneLabel}</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 9876543210 (Optional)"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div className="form-group-grid">
                    <div className="form-control-wrap">
                      <label>{t.formMandalLabel}</label>
                      <select value={mandal} onChange={(e) => setMandal(e.target.value)}>
                        <option value="Paderu">Paderu (పాడేరు)</option>
                        <option value="Araku Valley">Araku Valley (అరకు లోయ)</option>
                        <option value="Dumbriguda">Dumbriguda (డుంబ్రిగుడ)</option>
                        <option value="Chintapalli">Chintapalli (చింతపల్లి)</option>
                        <option value="Ananthagiri">Ananthagiri (అనంతగిరి)</option>
                        <option value="G.Madugula">G.Madugula (జి.మాడుగుల)</option>
                        <option value="Munchingiputtu">Munchingiputtu (ముంచంగిపుట్టు)</option>
                      </select>
                    </div>

                    <div className="form-control-wrap">
                      <label>{t.formVillageLabel}</label>
                      <input
                        type="text"
                        value={village}
                        onChange={(e) => setVillage(e.target.value)}
                        placeholder="e.g. Vanakachinta Habitation"
                      />
                    </div>
                  </div>

                  <div className="form-control-wrap" style={{ marginBottom: '16px' }}>
                    <label>{t.formCampLabel}</label>
                    <select value={preferredCamp} onChange={(e) => setPreferredCamp(e.target.value)}>
                      <option value="Paderu Central CHC OPD - 12 Nov 2026">Paderu Central CHC OPD (12 Nov 2026)</option>
                      <option value="Dumbriguda Weekly Mobile Unit - 14 Nov 2026">Dumbriguda Weekly Mobile Unit (14 Nov 2026)</option>
                      <option value="Araku Valley Agency Outpost - 15 Nov 2026">Araku Valley Agency Outpost (15 Nov 2026)</option>
                      <option value="Chintapalli Remote Camp - 18 Nov 2026">Chintapalli Remote Camp (18 Nov 2026)</option>
                    </select>
                  </div>

                  <div className="form-control-wrap" style={{ marginBottom: '16px' }}>
                    <label>{t.formSymptomsLabel}</label>
                    <input
                      type="text"
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      placeholder="e.g. Burning sensation in mouth, white patch, or general checkup"
                    />
                  </div>

                  {/* Informed Consent Checkbox */}
                  <label className="consent-checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      onChange={(e) => setConsentGiven(e.target.checked)}
                      required
                    />
                    <span className="consent-text">
                      {t.consentCheckboxText}
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="btn-primary-action"
                    disabled={bookingLoading}
                    style={{ width: '100%', padding: '14px' }}
                  >
                    <span>{bookingLoading ? 'Registering...' : t.btnSubmitBooking}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    )}

      {/* -------------------- 10. 4-STEP WORK PROCESS -------------------- */}
      {(activeSection === 'all' || activeSection === 'process') && (
        <section id="process-section" className="landing-section">
          <div className="section-header-center">
            <span className="section-tag">{t.processTag}</span>
            <h3 className="section-title">{t.processTitle}</h3>
          </div>

          <div className="process-steps-row">
            {t.processSteps.map((step, idx) => (
              <div key={idx} className="process-step-card">
                <div className="process-step-circle">
                  <span className="process-step-badge">{step.num}</span>
                  {idx === 0 ? '📝' : idx === 1 ? '📷' : idx === 2 ? '🤖' : '🩺'}
                </div>
                <h4 className="process-step-title">{step.title}</h4>
                <p className="process-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>

      {/* -------------------- 11. FOOTER -------------------- */}
      <footer className="landing-footer">
        <div className="footer-grid-4">
          <div className="footer-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.6rem' }}>🌿</span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{t.appName}</strong>
            </div>
            <p>{t.footerAbout}</p>
            <div style={{ marginTop: '14px', fontSize: '0.8rem', color: 'var(--btn-primary-bg)', fontWeight: 700 }}>
              ITDA Paderu Agency Area • Government of Andhra Pradesh
            </div>
          </div>

          <div className="footer-col">
            <h5>{t.footerQuickLinks}</h5>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0', font: 'inherit', textAlign: 'left' }}
                  onClick={() => handleSectionSwitch('about')}
                >
                  {t.navAbout}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0', font: 'inherit', textAlign: 'left' }}
                  onClick={() => handleSectionSwitch('services')}
                >
                  {t.navServices}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0', font: 'inherit', textAlign: 'left' }}
                  onClick={() => handleSectionSwitch('why-us')}
                >
                  {t.navWhyUs}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0', font: 'inherit', textAlign: 'left' }}
                  onClick={() => handleSectionSwitch('specialists')}
                >
                  {t.navSpecialists}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0', font: 'inherit', textAlign: 'left' }}
                  onClick={() => handleSectionSwitch('booking')}
                >
                  {t.navSchedule}
                </button>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>{t.footerPortals}</h5>
            <ul className="footer-links-list">
              <li>
                <a
                  href="#/login"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigateLogin) onNavigateLogin();
                    else window.location.hash = '#/login';
                  }}
                >
                  🧑‍🌾 Patient Portal Sign In
                </a>
              </li>
              <li>
                <a
                  href="#/login"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigateLogin) onNavigateLogin();
                    else window.location.hash = '#/login';
                  }}
                >
                  👨‍⚕️ Doctor Clinical Review
                </a>
              </li>
              <li>
                <a
                  href="#/admin"
                  onClick={(e) => {
                    e.preventDefault();
                    if (onNavigateAdmin) onNavigateAdmin();
                    else window.location.hash = '#/admin';
                  }}
                >
                  🏛️ ITDA Admin Portal
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>{t.footerLegal}</h5>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0', font: 'inherit', textAlign: 'left' }}
                  onClick={() => handleSectionSwitch('booking')}
                >
                  {t.privacyLink}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0', font: 'inherit', textAlign: 'left' }}
                  onClick={() => handleSectionSwitch('booking')}
                >
                  {t.consentLink}
                </button>
              </li>
              <li><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MOCK UIDAI: TRUE</span></li>
              <li><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SHA-256 IMAGES</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-row">
          <div>{t.nonDiagDisclaimer}</div>
          <div>{t.allRightsReserved}</div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

