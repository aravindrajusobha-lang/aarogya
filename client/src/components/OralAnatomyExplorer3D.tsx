import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LanguageCode } from '../i18n';
import '../styles/oral3DAnimation.css';

export interface OralAnatomicalPart {
  id: string;
  nameEn: string;
  nameTe: string;
  nameHi: string;
  subtitleEn: string;
  subtitleTe: string;
  subtitleHi: string;
  position3D: [number, number, number];
  cameraTarget: [number, number, number];
  cameraDistance: number;
  labelAnchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right';
  descriptionEn: string;
  descriptionTe: string;
  descriptionHi: string;
  screeningRelevanceEn: string;
  screeningRelevanceTe: string;
  screeningRelevanceHi: string;
  selfCareTipsEn: string[];
  selfCareTipsTe: string[];
  selfCareTipsHi: string[];
}

export const ORAL_ANATOMICAL_PARTS: OralAnatomicalPart[] = [
  {
    id: 'teeth',
    nameEn: 'Teeth (Upper & Lower)',
    nameTe: 'దంతాలు (పై మరియు కింది దంతాలు)',
    nameHi: 'दांत (ऊपरी और निचले दांत)',
    subtitleEn: 'Maxillary & Mandibular Dental Arches',
    subtitleTe: 'మాక్సిల్లరీ మరియు మాండిబ్యులర్ దంత వంపులు',
    subtitleHi: 'मैक्सिलरी और मैंडिबुलर डेंटल आर्च',
    position3D: [0, 0.95, 0.65],
    cameraTarget: [0, 0.2, 0],
    cameraDistance: 6.2,
    labelAnchor: 'top-left',
    descriptionEn: '32 permanent teeth arranged in maxillary (upper) and mandibular (lower) arches. Composed of enamel, dentin, cementum, and vascular pulp chamber. Functions in mastication, speech articulation, and facial structural support.',
    descriptionTe: 'నోటిలో 32 శాశ్వత దంతాలు ఉంటాయి. పై దవడ మరియు కింది దవడలలో ఇవి దృఢంగా అమర్చబడి ఉంటాయి. ఎనామెల్, డెంటిన్ మరియు పల్ప్ గదిని కలిగి ఉండి, ఆహారాన్ని నమలడానికి మరియు మాట్లాడటానికి ఉపయోగపడతాయి.',
    descriptionHi: 'मुख में 32 स्थायी दांत होते हैं जो ऊपरी और निचले जबड़े में स्थित होते हैं। यह भोजन चबाने और स्पष्ट बोलने में आवश्यक हैं।',
    screeningRelevanceEn: 'Clinical examination monitors for early dental caries, enamel erosion, sharp cusps causing chronic frictional trauma, supragingival calculus, and periapical pathology.',
    screeningRelevanceTe: 'దంతాల క్షయం, ఎనామెల్ అరిగిపోవడం, చిగుళ్ల వద్ద పాచి చేరడం మరియు నాలుకకు గాయం చేసే పదునైన దంతాల అంచులను పరీక్షించడం జరుగుతుంది.',
    screeningRelevanceHi: 'दांतों की सड़न, इनेमेल का क्षरण, मसूड़ों की सूजन और चोट पहुंचाने वाले नुकीले दांतों की जांच की जाती है।',
    selfCareTipsEn: [
      'Brush twice daily for two minutes using fluoridated toothpaste',
      'Clean interdental spaces daily with dental floss or interdental brushes',
      'Avoid high-sugar snacks and acidic carbonated beverages',
      'Visit a dentist every 6 months for professional scaling and checkup',
    ],
    selfCareTipsTe: [
      'ఫ్లోరైడ్ టూత్‌పేస్ట్‌తో రోజుకు రెండుసార్లు కనీసం రెండు నిమిషాలు బ్రష్ చేయండి',
      'దంతాల మధ్య భాగాలను డెంటల్ ఫ్లాస్‌తో సున్నితంగా శుభ్రం చేయండి',
      'చక్కెర అధికంగా ఉండే ఆహారాలు మరియు శీతల పానీయాలను తగ్గించండి',
      'ప్రతి 6 నెలలకు ఒకసారి దంతవైద్యుడిని సంప్రదించి క్లీనింగ్ చేయించుకోండి',
    ],
    selfCareTipsHi: [
      'फ्लोराइड टूथपेस्ट से दिन में दो बार ब्रश करें',
      'दांतों के बीच की जगह को फ्लॉस से साफ करें',
      'मीठे और अम्लीय खाद्य पदार्थों से बचें',
      'हर 6 महीने में दंत चिकित्सक से जांच कराएं',
    ],
  },
  {
    id: 'gingiva',
    nameEn: 'Gums (Gingiva)',
    nameTe: 'చిగుళ్ళు (జింజివా)',
    nameHi: 'मसूड़े (जिंजिवा)',
    subtitleEn: 'Masticatory Oral Mucosa & Periodontium',
    subtitleTe: 'దంతాలను రక్షించే సున్నితమైన చిగురు కణజాలం',
    subtitleHi: 'दांतों को सहारा देने वाले गुलाबी ऊतक',
    position3D: [-1.45, 0.45, 0.45],
    cameraTarget: [-0.6, 0.1, 0.2],
    cameraDistance: 5.6,
    labelAnchor: 'left',
    descriptionEn: 'Specialized keratinized masticatory mucosa covering the alveolar process of the jaws and encircling the cervical collars of teeth. Healthy gingiva is firm, resilient, and pale coral-pink with characteristic surface stippling.',
    descriptionTe: 'దంతాల మూలాలను కప్పి ఉంచే సున్నితమైన గులాబీ రంగు రక్తనాళాల కణజాలం. ఆరోగ్యకరమైన చిగుళ్ళు దృఢంగా ఉండి, బ్రష్ చేసినప్పుడు రక్తం కారకుండా ఉంటాయి.',
    descriptionHi: 'दांतों की जड़ों को ढकने वाले मजबूत गुलाबी ऊतक। स्वस्थ मसूड़ों से ब्रश करते समय खून नहीं आता।',
    screeningRelevanceEn: 'Evaluated for Gingivitis (erythema, edema, bleeding on probing), Periodontitis (pocket formation, gingival recession), drug-induced gingival enlargement, and persistent ulcerations.',
    screeningRelevanceTe: 'చిగుళ్ళ వాపు, రక్తస్రావం, చిగుళ్ళు వెనక్కి తగ్గడం మరియు చిగుళ్ళపై దీర్ఘకాలిక పుండ్లు ఉన్నాయా అని పరిశీలిస్తారు.',
    screeningRelevanceHi: 'मसूड़ों में सूजन, खून आना और लंबे समय से ठीक न होने वाले छालों की जांच की जाती है।',
    selfCareTipsEn: [
      'Gently massage gums with soft bristles at a 45-degree angle to the gumline',
      'Rinse with warm saline solution if mild inflammation occurs',
      'Avoid hard brushing which causes permanent gingival recession',
      'Maintain adequate Vitamin C intake for mucosal vascular integrity',
    ],
    selfCareTipsTe: [
      'చిగుళ్ళ అంచు వద్ద 45 డిగ్రీల కోణంలో సున్నితంగా మసాజ్ చేస్తూ బ్రష్ చేయండి',
      'చిగుళ్ళలో వాపు ఉంటే గోరువెచ్చని ఉప్పునీటితో పుక్కిలించండి',
      'చిగుళ్ళు దెబ్బతినకుండా గట్టిగా రుద్దడం మానుకోండి',
      'చిగుళ్ళ ఆరోగ్యానికి విటమిన్-సి పుష్కలంగా ఉండే ఆహారం తీసుకోండి',
    ],
    selfCareTipsHi: [
      'मसूड़ों की रेखा पर 45 डिग्री के कोण पर हल्के से ब्रश करें',
      'हल्की सूजन होने पर गुनगुने नमक के पानी से कुल्ला करें',
      'कठोर ब्रिसल वाले ब्रश का उपयोग न करें',
    ],
  },
  {
    id: 'hard_palate',
    nameEn: 'Hard Palate',
    nameTe: 'గట్టి అంగిలి (హార్డ్ పాలేట్)',
    nameHi: 'कठोर तालु (हार्ड पैलेट)',
    subtitleEn: 'Anterior Vault of Oral Cavity Roof',
    subtitleTe: 'నోటి పైకప్పు ముందు భాగం',
    subtitleHi: 'मुंह की ऊपरी छत का अगला भाग',
    position3D: [0.75, 1.35, -0.65],
    cameraTarget: [0, 0.7, -0.6],
    cameraDistance: 5.4,
    labelAnchor: 'top-right',
    descriptionEn: 'Rigid bony shelf formed by the palatine processes of maxillae and horizontal plates of palatine bones. Covered by keratinized mucosa exhibiting transverse palatine rugae that assist in tactile food manipulation against the tongue.',
    descriptionTe: 'నోటి పైకప్పు ముందు భాగం ఎముకతో కూడి దృఢంగా ఉంటుంది. దీనిపై ఉండే చారలు (రుగే) ఆహారాన్ని నమలడంలో మరియు నాలుకపై నియంత్రించడంలో సహాయపడతాయి.',
    descriptionHi: 'मुंह की ऊपरी सख्त छत जो भोजन को चबाने और निगलने में सहायता करती है।',
    screeningRelevanceEn: 'High-risk examination site for reverse smoking keratosis (stomatitis nicotina with punctate red duct openings), denture stomatitis, torus palatinus, and deep mucosal ulcerations.',
    screeningRelevanceTe: 'చుట్టలు లేదా పొగాకు తాగే వారిలో వచ్చే తెల్లటి పొరలు, ఎర్రటి మచ్చలు మరియు నికోటిన్ స్టోమటైటిస్ లక్షణాలను ఇక్కడ గుర్తిస్తారు.',
    screeningRelevanceHi: 'तंबाकू और बीड़ी के सेवन से होने वाले सफेद और लाल धब्बों की जांच की जाती है।',
    selfCareTipsEn: [
      'Completely avoid reverse chutta/bidi smoking which directly burns the palate',
      'Clean dentures thoroughly every night to prevent fungal denture stomatitis',
      'Avoid consuming scalding hot beverages that burn the delicate mucosal rugae',
    ],
    selfCareTipsTe: [
      'కాల్చే చుట్టలను నోటిలో ఉంచుకుని పొగ తాగే అలవాటును తక్షణమే మానేయండి',
      'కృత్రిమ పళ్ళ సెట్ (డెంచర్) ఉన్నవారు రాత్రిపూట శుభ్రంగా కడిగి భద్రపరచండి',
      'నాలుక మరియు అంగిలిని కాల్చేసే అతి వేడి పదార్థాలు తినవద్దు',
    ],
    selfCareTipsHi: [
      'धूम्रपान और तंबाकू के सेवन से पूरी तरह बचें',
      'बहुत गर्म चाय या भोजन से तालु को जलने से बचाएं',
    ],
  },
  {
    id: 'tongue',
    nameEn: 'Tongue (Lingua)',
    nameTe: 'నాలుక',
    nameHi: 'जीभ (रसना)',
    subtitleEn: 'Muscular Hydrostat & Lingual Papillae',
    subtitleTe: 'రుచి మరియు మాటలకు తోడ్పడే ప్రధాన కండర అవయవం',
    subtitleHi: 'स्वाद और वाणी का मुख्य संवेदी अंग',
    position3D: [0, -0.35, 0.15],
    cameraTarget: [0, -0.2, 0.1],
    cameraDistance: 5.2,
    labelAnchor: 'bottom-right',
    descriptionEn: 'Highly mobile muscular organ anchored to the hyoid bone and mandible. Dorsal body covered by specialized filiform, fungiform, and circumvallate papillae housing gustatory taste receptors. Crucial for bolus formation, swallowing, and speech.',
    descriptionTe: 'నోటి అడుగుభాగంలో ఉండే శక్తివంతమైన కండర అవయవం. దీని ఉపరితలంపై ఉండే పాపిల్లే రుచిని గ్రహిస్తాయి. ఆహారాన్ని మింగడానికి మరియు స్పష్టంగా మాట్లాడటానికి ఇది ఎంతో ముఖ్యం.',
    descriptionHi: 'मुंह के तल पर स्थित मांसपेशीय अंग जो स्वाद, भोजन चबाने और बोलने में प्रमुख भूमिका निभाता है।',
    screeningRelevanceEn: 'Lateral borders and ventral surface of the tongue account for over 50% of oral squamous cell carcinomas. Screen for leukoplakia, erythroplakia, indurated borders, and persistent ulcers exceeding 14 days.',
    screeningRelevanceTe: 'నాలుక పక్క అంచులు మరియు కింది భాగం నోటి క్యాన్సర్ లేదా ప్రీ-క్యాన్సర్ మచ్చలకు అత్యంత ప్రమాదకర ప్రాంతం. 2 వారాలకు మించి మానని పుండ్లు ఉంటే వెంటనే డాక్టర్‌ను సంప్రదించాలి.',
    screeningRelevanceHi: 'जीभ के किनारे और निचला हिस्सा मुंह के कैंसर की दृष्टि से अत्यधिक संवेदनशील होते हैं। दो सप्ताह से अधिक पुराने छालों की तुरंत जांच कराएं।',
    selfCareTipsEn: [
      'Gently clean the tongue dorsal surface daily using a smooth plastic scraper',
      'Inspect the lateral borders of the tongue in a mirror during monthly self-exams',
      'Immediately report any white patch, red patch, or painless ulcer persisting > 2 weeks',
      'Stay well hydrated to maintain salivary flow and protect lingual papillae',
    ],
    selfCareTipsTe: [
      'నాలుకను ప్రతిరోజూ సున్నితమైన టంగ్ క్లీనర్‌తో శుభ్రం చేసుకోండి',
      'అద్దంలో నాలుక పక్క అంచులను నెలకు ఒకసారి స్వయంగా పరిశీలించుకోండి',
      'రెండు వారాల కంటే ఎక్కువ కాలం ఉండే తెల్లటి లేదా ఎర్రటి మచ్చలను నిర్లక్ష్యం చేయవద్దు',
      'లాలాజల ప్రసరణ సరిగ్గా ఉండేందుకు తగినంత మంచి నీరు త్రాగండి',
    ],
    selfCareTipsHi: [
      'जीभ को प्रतिदिन जीभी से हल्के से साफ करें',
      'आईने में जीभ के दोनों किनारों की नियमित जांच करें',
      'लगातार रहने वाले छालों को नजरअंदाज न करें',
    ],
  },
  {
    id: 'buccal_mucosa',
    nameEn: 'Inner Cheek (Buccal Mucosa)',
    nameTe: 'బుగ్గ లోపలి భాగం (బుక్కల్ మ్యూకోసా)',
    nameHi: 'आंतरिक गाल (बक्कल म्यूकोसा)',
    subtitleEn: 'Lateral Lining Mucosa & Stensen Duct Orifice',
    subtitleTe: 'నోటి లోపలి పక్క గోడల సున్నితమైన పొర',
    subtitleHi: 'गाल के अंदर की सुरक्षात्मक परत',
    position3D: [-2.15, 0.0, -0.35],
    cameraTarget: [-1.2, 0.0, -0.3],
    cameraDistance: 5.6,
    labelAnchor: 'bottom-left',
    descriptionEn: 'Non-keratinized, highly vascular stratified squamous lining mucosa extending from the lip commissures to the retromolar area. Accommodates the parotid Stensen duct papilla opposite the upper second molars.',
    descriptionTe: 'బుగ్గల లోపలి భాగంలో ఉండే మృదువైన రక్తనాళాల పొర. లాలాజల గ్రంధుల రంధ్రాలు ఇక్కడే ఉంటాయి. గుట్కా లేదా ఖైనీ నమిలే అలవాటు వల్ల ఈ పొర ఎక్కువగా దెబ్బతింటుంది.',
    descriptionHi: 'गाल के अंदर की मुलायम परत जहां लार ग्रंथियों का मुहाना होता है। तंबाकू से यह सबसे ज्यादा प्रभावित होती है।',
    screeningRelevanceEn: 'Prime anatomical site for betel quid / gutka induced Oral Submucous Fibrosis (OSMF: mucosal blanching, dense vertical fibrous bands, restricted mouth opening < 35mm), Leukoplakia, and Lichen Planus.',
    screeningRelevanceTe: 'గుట్కా, ఖైనీ, తమలపాకుల వల్ల వచ్చే ఓరల్ సబ్‌మ్యూకస్ ఫైబ్రోసిస్ (నోరు తెరుచుకోకపోవడం), తెల్లటి మచ్చలు మరియు లైకెన్ ప్లానస్ వంటి మార్పులను ఇక్కడ గుర్తిస్తారు.',
    screeningRelevanceHi: 'गुटखा और खैनी के कारण मुंह का कम खुलना (OSMF) और सफेद पट्टियों की पहचान इसी क्षेत्र में होती है।',
    selfCareTipsEn: [
      'Strictly avoid chewing betel quid, tobacco, gutka, and khaini',
      'Perform regular mouth-opening self-checks (normal is minimum 3 finger-breadths)',
      'Perform daily gentle jaw stretching exercises if early tightness is noticed',
      'Rinse with warm water after eating to remove food particles from the vestibule',
    ],
    selfCareTipsTe: [
      'గుట్కా, ఖైనీ, నమిలే పొగాకు మరియు తమలపాకులను పూర్తిగా త్యజించండి',
      'మీ నోరు కనీసం మూడు వేళ్లు పట్టేంతగా తెరుచుకుంటుందో లేదో తరచుగా పరీక్షించుకోండి',
      'నోరు బిగుసుకుపోతున్నట్లు అనిపిస్తే దంతవైద్యుడిని వెంటనే సంప్రదించండి',
      'భోజనం తర్వాత నోటిని గోరువెచ్చని నీటితో శుభ్రంగా పుక్కిలించండి',
    ],
    selfCareTipsHi: [
      'गुटखा, पान मसाला और तंबाकू का सेवन पूरी तरह बंद करें',
      'नियमित रूप से जांचें कि मुंह में तीन अंगुलियां आसानी से जा रही हैं या नहीं',
    ],
  },
  {
    id: 'soft_palate',
    nameEn: 'Soft Palate',
    nameTe: 'మృదువైన అంగిలి (సాఫ్ట్ పాలేట్)',
    nameHi: 'कोमल तालु (सॉफ्ट पैलेट)',
    subtitleEn: 'Posterior Fibromuscular Pharyngeal Seal',
    subtitleTe: 'నోటి పైకప్పు వెనుక భాగం',
    subtitleHi: 'तालु का पिछला लचीला भाग',
    position3D: [0.0, 0.85, -1.85],
    cameraTarget: [0, 0.4, -1.8],
    cameraDistance: 5.8,
    labelAnchor: 'top-right',
    descriptionEn: 'Mobile muscular curtain suspended from the posterior margin of the hard palate. Composed of tensor veli palatini, levator veli palatini, and palatoglossus muscles. Elevates during deglutition to close the nasopharynx.',
    descriptionTe: 'గట్టి అంగిలి వెనుక ఉండే మృదువైన కండరాల పొర. ఆహారం మరియు నీరు మింగేటప్పుడు శ్వాసనాళంలోకి వెళ్లకుండా ఇది ముక్కు వెనుక ద్వారాన్ని మూసివేస్తుంది.',
    descriptionHi: 'कठोर तालु के पीछे स्थित मांसपेशीय पर्दा जो निगलते समय भोजन को नाक में जाने से रोकता है।',
    screeningRelevanceEn: 'Inspected for mucosal erythema, petechial hemorrhages, asymmetric palatal elevation (indicating cranial nerve IX/X pathology), and occult premalignant lesions.',
    screeningRelevanceTe: 'గొంతు వాపు, ఎర్రటి మచ్చలు, మింగడంలో ఇబ్బంది మరియు నరాల బలహీనత వల్ల అంగిలి కదలికలలో వచ్చే మార్పులను ఇక్కడ గమనిస్తారు.',
    screeningRelevanceHi: 'निगलने में कठिनाई, लाल धब्बे और तालु के पक्षाघात के लक्षणों की जांच की जाती है।',
    selfCareTipsEn: [
      'Maintain generous hydration to lubricate soft palatal and pharyngeal tissues',
      'Avoid screaming or excessive throat clearing which strains palatal muscles',
      'Seek clinical evaluation for snoring accompanied by witnessed breathing pauses (sleep apnea)',
    ],
    selfCareTipsTe: [
      'గొంతు పొడిబారకుండా రోజంతా తగినంత నీరు తాగుతూ ఉండండి',
      'గొంతును గట్టిగా సవరించడం లేదా కేకలు వేయడం ద్వారా గొంతుపై ఒత్తిడి తీసుకురావద్దు',
      'తీవ్రమైన గురక లేదా మింగడంలో అసౌకర్యం ఉంటే ఈఎన్‌టీ వైద్యుడిని సంప్రదించండి',
    ],
    selfCareTipsHi: [
      'गले को नम रखने के लिए पर्याप्त पानी पिएं',
      'लगातार खराश या निगलने में दर्द होने पर डॉक्टर से मिलें',
    ],
  },
  {
    id: 'uvula',
    nameEn: 'Uvula',
    nameTe: 'కొండనాలుక (యువులా)',
    nameHi: 'कौवा / यूवुला',
    subtitleEn: 'Midline Palatine Projection & Secretory Shield',
    subtitleTe: 'గొంతు వెనుక భాగంలో వేలాడే సున్నితమైన కండరం',
    subtitleHi: 'गले के पीछे लटकती छोटी संरचना',
    position3D: [0.0, 0.35, -2.15],
    cameraTarget: [0, 0.25, -2.0],
    cameraDistance: 5.6,
    labelAnchor: 'top-left',
    descriptionEn: 'Conical projection hanging from the free inferior border of the soft palate in the midline. Contains musculus uvulae and dense serous glands that produce thin lubricating saliva to protect the pharynx during rapid speech.',
    descriptionTe: 'మృదువైన అంగిలి మధ్యలో క్రిందికి వేలాడే చిన్న కండర భాగం. మాట్లాడేటప్పుడు మరియు మింగేటప్పుడు గొంతును తేమగా ఉంచే లాలాజలాన్ని విడుదల చేస్తుంది.',
    descriptionHi: 'कोमल तालु के बीच से लटकती हुई छोटी संरचना जो बोलने और निगलने में सहायता करती है।',
    screeningRelevanceEn: 'Checked for acute allergic uvular edema (Quincke disease), infectious uvulitis, papillomatous warts, and deviation toward the unaffected side in glossopharyngeal nerve palsy.',
    screeningRelevanceTe: 'కొండనాలుక వాపు, ఎలర్జీ వల్ల వచ్చే వాపులు మరియు ఇన్ఫెక్షన్లను గుర్తించడానికి ఇది సహాయపడుతుంది.',
    screeningRelevanceHi: 'एलर्जी या संक्रमण के कारण कौवे में होने वाली सूजन और दर्द की जांच की जाती है।',
    selfCareTipsEn: [
      'Gargle with warm salt water for mild uvular irritation or morning dry throat',
      'Avoid sleeping directly in front of dry air blasts from fans or unhumidified air conditioners',
      'Do not attempt home remedies like pressing or cutting the uvula with unsterilized tools',
    ],
    selfCareTipsTe: [
      'గొంతులో గరగర లేదా నొప్పి ఉంటే గోరువెచ్చని ఉప్పునీటితో పుక్కిలించండి',
      'గ్రామాలలో కొండనాలుక తెగిందని మూఢనమ్మకాలతో పసరు మందులు వేయించుకోవద్దు',
      'వాపు ఎక్కువగా ఉంటే వెంటనే సమీప ప్రభుత్వ పీహెచ్‌సీ లేదా సీహెచ్‌సీకి వెళ్లండి',
    ],
    selfCareTipsHi: [
      'हल्की जलन होने पर नमक के गुनगुने पानी से गरारे करें',
      'किसी भी घरेलू नुस्खे से कौवे को दबाने या छेड़ने का प्रयास न करें',
    ],
  },
  {
    id: 'tonsils',
    nameEn: 'Tonsils (Palatine Tonsils)',
    nameTe: 'టాన్సిల్స్ (పాలటైన్ టాన్సిల్స్)',
    nameHi: 'टॉन्सिल्स (गलतुंडिका)',
    subtitleEn: 'Bilateral Lymphoid Barrier of Fauces',
    subtitleTe: 'నోటి రోగనిరోధక రక్షక కణజాలం',
    subtitleHi: 'रोग प्रतिरोधक क्षमता की ग्रंथियां',
    position3D: [1.35, 0.15, -1.95],
    cameraTarget: [0.8, 0.1, -1.8],
    cameraDistance: 5.8,
    labelAnchor: 'right',
    descriptionEn: 'Ovoid immunocompetent lymphoid tissue masses situated in tonsillar niches flanked by the palatoglossal and palatopharyngeal arches. Functions as the primary immunological sentinel against inhaled and ingested microbes.',
    descriptionTe: 'గొంతుకు ఇరువైపులా ఉండే రోగనిరోధక లింఫోయిడ్ గ్రంధులు. శ్వాస మరియు ఆహారం ద్వారా లోపలికి ప్రవేశించే బ్యాక్టీరియా మరియు వైరస్‌లను ఎదుర్కొని శరీరాన్ని కాపాడతాయి.',
    descriptionHi: 'गले के दोनों किनारों पर स्थित लिम्फ नोड्स जो शरीर में प्रवेश करने वाले कीटाणुओं को रोकते हैं।',
    screeningRelevanceEn: 'Monitored for acute/chronic Tonsillitis, tonsillar hypertrophy causing pediatric airway obstruction, tonsilloliths, unilateral asymmetric enlargement, and deep crypt ulcerations.',
    screeningRelevanceTe: 'టాన్సిల్స్ వాపు, చీము గడ్డలు, ఒకవైపు మాత్రమే టాన్సిల్ అసాధారణంగా పెద్దది కావడం మరియు తీవ్రమైన గొంతు నొప్పిని గుర్తిస్తారు.',
    screeningRelevanceHi: 'टॉन्सिल में सूजन, मवाद, एक तरफा असामान्य वृद्धि और गंभीर दर्द की जांच की जाती है।',
    selfCareTipsEn: [
      'Gargle with warm saline solution (1/2 tsp salt in warm water) twice daily during throat soreness',
      'Avoid sharing drinking cups or utensils during active streptococcal pharyngitis',
      'Consult a physician promptly if unilateral tonsillar swelling makes swallowing saliva difficult',
    ],
    selfCareTipsTe: [
      'గొంతు నొప్పి ఉన్నప్పుడు రోజుకు రెండుసార్లు గోరువెచ్చని ఉప్పునీటితో పుక్కిలించండి',
      'ఇతరులు ఉపయోగించిన గ్లాసులు మరియు పాత్రలను శుభ్రం చేయకుండా వాడవద్దు',
      'లాలాజలం మింగడం కూడా కష్టంగా ఉంటే ఆలస్యం చేయకుండా వైద్యాధికారిని సంప్రదించండి',
    ],
    selfCareTipsHi: [
      'गले में दर्द होने पर दिन में दो बार गुनगुने नमक पानी से गरारे करें',
      'निगलने में अत्यधिक परेशानी होने पर तुरंत डॉक्टर को दिखाएं',
    ],
  },
  {
    id: 'lower_teeth',
    nameEn: 'Lower Teeth (Mandibular Arch)',
    nameTe: 'కింది దంతాలు (మాండిబ్యులర్ ఆర్చ్)',
    nameHi: 'निचले दांत (मैंडिबुलर आर्च)',
    subtitleEn: 'Mandibular Dentition & Sublingual Floor',
    subtitleTe: 'కింది దవడ దంతాలు మరియు నాలుక కింది ప్రదేశం',
    subtitleHi: 'निचले जबड़े के मजबूत दांत',
    position3D: [0.0, -1.05, 0.55],
    cameraTarget: [0, -0.6, 0.4],
    cameraDistance: 5.8,
    labelAnchor: 'bottom-left',
    descriptionEn: 'The 16 mandibular teeth rooted in the alveolar process of the mandible. Subjected to intense occlusal forces and high salivary mineral deposition from the adjacent sublingual and submandibular duct orifices.',
    descriptionTe: 'కింది దవడ ఎముకలో స్థిరపడిన 16 దంతాలు. నాలుక కింది లాలాజల గ్రంధుల నుండి ఖనిజాలు చేరడం వల్ల వీటి లోపలి భాగంలో పాచి త్వరగా గట్టిపడుతుంది.',
    descriptionHi: 'निचले जबड़े के 16 दांत जिन पर लार के कारण मैल और टारटार जल्दी जम जाता है।',
    screeningRelevanceEn: 'Monitored for heavy lingual calculus calculus deposits, periodontitis-induced lower incisor mobility, root exposure, and floor of mouth mucosal lesions.',
    screeningRelevanceTe: 'కింది దంతాల లోపలి వైపు గట్టిపడిన పాచి, చిగురు వ్యాధి వల్ల దంతాలు కదలడం మరియు నాలుక కింది భాగంలో వచ్చే తెల్లటి మచ్చలను గమనిస్తారు.',
    screeningRelevanceHi: 'दांतों के पीछे जमी पपड़ी, मसूड़ों की कमजोरी और ढीले दांतों की जांच की जाती है।',
    selfCareTipsEn: [
      'Hold brush vertically to clean behind the lower front teeth where calculus builds fastest',
      'Never use pins, safety needles, or matchsticks to scrape between teeth',
      'Get professional dental scaling once a year to prevent bone loss around lower teeth',
    ],
    selfCareTipsTe: [
      'కింది ముందు పళ్ళ వెనుక భాగాన్ని బ్రష్ నిలువుగా పట్టుకుని శుభ్రం చేయండి',
      'పళ్ళ సందుల్లో పిన్నులు, సేఫ్టీ పిన్నులు లేదా అగ్గిపుల్లలు పెట్టి గెలకవద్దు',
      'దంతాల పట్టు తప్పకుండా ఉండేందుకు సంవత్సరానికి ఒకసారి క్లీనింగ్ చేయించుకోండి',
    ],
    selfCareTipsHi: [
      'निचले आगे के दांतों के पीछे ब्रश को सीधा रखकर साफ करें',
      'दांतों के बीच पिन या तीली का प्रयोग कभी न करें',
    ],
  },
];

export interface OralAnatomyExplorer3DProps {
  currentLang?: LanguageCode;
  initialSelectedPart?: string;
  onSelectPart?: (part: OralAnatomicalPart) => void;
  onNavigateScreening?: () => void;
  compact?: boolean;
}

export const OralAnatomyExplorer3D: React.FC<OralAnatomyExplorer3DProps> = ({
  currentLang = 'te',
  initialSelectedPart = 'teeth',
  onSelectPart,
  onNavigateScreening,
  compact = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const reqAnimIdRef = useRef<number | null>(null);
  const oralCavityGroupRef = useRef<THREE.Group | null>(null);
  const partsMeshMapRef = useRef<Map<string, THREE.Mesh[]>>(new Map());

  // Interactive States
  const [selectedPartId, setSelectedPartId] = useState<string>(initialSelectedPart);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(false);
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [projectedLabels, setProjectedLabels] = useState<
    Array<{
      part: OralAnatomicalPart;
      x: number;
      y: number;
      visible: boolean;
    }>
  >([]);

  const selectedPart =
    ORAL_ANATOMICAL_PARTS.find((p) => p.id === selectedPartId) || ORAL_ANATOMICAL_PARTS[0];

  // Multilingual text helpers
  const getPartName = useCallback(
    (part: OralAnatomicalPart) => {
      if (currentLang === 'te') return part.nameTe;
      if (currentLang === 'hi') return part.nameHi;
      return part.nameEn;
    },
    [currentLang]
  );

  const getPartSubtitle = useCallback(
    (part: OralAnatomicalPart) => {
      if (currentLang === 'te') return part.subtitleTe;
      if (currentLang === 'hi') return part.subtitleHi;
      return part.subtitleEn;
    },
    [currentLang]
  );

  const getPartDesc = useCallback(
    (part: OralAnatomicalPart) => {
      if (currentLang === 'te') return part.descriptionTe;
      if (currentLang === 'hi') return part.descriptionHi;
      return part.descriptionEn;
    },
    [currentLang]
  );

  const getPartScreening = useCallback(
    (part: OralAnatomicalPart) => {
      if (currentLang === 'te') return part.screeningRelevanceTe;
      if (currentLang === 'hi') return part.screeningRelevanceHi;
      return part.screeningRelevanceEn;
    },
    [currentLang]
  );

  const getPartTips = useCallback(
    (part: OralAnatomicalPart) => {
      if (currentLang === 'te') return part.selfCareTipsTe;
      if (currentLang === 'hi') return part.selfCareTipsHi;
      return part.selfCareTipsEn;
    },
    [currentLang]
  );

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 640;
    const height = mountRef.current.clientHeight || 480;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);
    scene.fog = new THREE.FogExp2(0x030712, 0.045);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 7.2);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.6;
    controls.minDistance = 3.2;
    controls.maxDistance = 12.0;
    controls.maxPolarAngle = Math.PI * 0.78;
    controls.minPolarAngle = Math.PI * 0.22;
    controls.target.set(0, 0.1, 0);
    controlsRef.current = controls;

    // 5. Futuristic Lighting (Cyan, Teal, Deep Navy, Accent Glow)
    const ambientLight = new THREE.AmbientLight(0x0e2238, 2.2);
    scene.add(ambientLight);

    const cyanKeyLight = new THREE.DirectionalLight(0x38bdf8, 3.2);
    cyanKeyLight.position.set(3, 4, 6);
    cyanKeyLight.castShadow = true;
    cyanKeyLight.shadow.mapSize.width = 1024;
    cyanKeyLight.shadow.mapSize.height = 1024;
    scene.add(cyanKeyLight);

    const tealRimLight = new THREE.DirectionalLight(0x14b8a6, 2.8);
    tealRimLight.position.set(-5, -2, -3);
    scene.add(tealRimLight);

    const internalCavityLight = new THREE.PointLight(0x06b6d4, 2.0, 6.0);
    internalCavityLight.position.set(0, 0.4, -1.8);
    scene.add(internalCavityLight);

    const softPinkFill = new THREE.PointLight(0xf43f5e, 1.2, 7.0);
    softPinkFill.position.set(0, -1.2, 2.5);
    scene.add(softPinkFill);

    // 6. Cybernetic Grid Rings in Background
    const gridGroup = new THREE.Group();
    for (let r = 2.4; r <= 5.8; r += 0.85) {
      const ringGeo = new THREE.RingGeometry(r - 0.015, r, 64);
      const ringMesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
        })
      );
      ringMesh.position.z = -3.2;
      gridGroup.add(ringMesh);
    }
    scene.add(gridGroup);

    // 7. BUILD REALISTIC 3D ORAL CAVITY MODEL
    const oralCavityGroup = new THREE.Group();
    oralCavityGroupRef.current = oralCavityGroup;
    const meshMap = new Map<string, THREE.Mesh[]>();
    partsMeshMapRef.current = meshMap;

    const registerMesh = (partId: string, mesh: THREE.Mesh) => {
      mesh.userData = { partId };
      if (!meshMap.has(partId)) meshMap.set(partId, []);
      meshMap.get(partId)!.push(mesh);
    };

    // --- PBR Materials ---
    const enamelMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.12,
      metalness: 0.04,
      clearcoat: 0.96,
      clearcoatRoughness: 0.08,
      reflectivity: 0.85,
    });

    const gumMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd9657b,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.82,
      clearcoatRoughness: 0.22,
    });

    const hardPalateMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xe07a8b,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.78,
      clearcoatRoughness: 0.28,
    });

    const softPalateMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc44e64,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.88,
      clearcoatRoughness: 0.24,
    });

    const uvulaMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xbe435a,
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.95,
      clearcoatRoughness: 0.18,
    });

    const tongueMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdb6275,
      roughness: 0.45,
      metalness: 0.01,
      clearcoat: 0.84,
      clearcoatRoughness: 0.26,
    });

    const tonsilMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xa83b4f,
      roughness: 0.52,
      metalness: 0.02,
      clearcoat: 0.75,
      clearcoatRoughness: 0.32,
    });

    const buccalMucosaMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc9586d,
      roughness: 0.40,
      metalness: 0.02,
      clearcoat: 0.88,
      clearcoatRoughness: 0.22,
      side: THREE.DoubleSide,
    });

    const lipsMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb94255,
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.15,
    });

    const pharynxBackdropMaterial = new THREE.MeshStandardMaterial({
      color: 0x180509,
      roughness: 0.85,
      metalness: 0.1,
    });

    // A. Outer Framing Lips & Oral Aperture
    const outerLipsCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.8, -0.1, 0.4),
      new THREE.Vector3(-1.8, 1.45, 0.65),
      new THREE.Vector3(0.0, 1.75, 0.75),
      new THREE.Vector3(1.8, 1.45, 0.65),
      new THREE.Vector3(2.8, -0.1, 0.4),
      new THREE.Vector3(1.9, -1.55, 0.6),
      new THREE.Vector3(0.0, -1.8, 0.7),
      new THREE.Vector3(-1.9, -1.55, 0.6),
    ], true);

    const outerLipsGeo = new THREE.TubeGeometry(outerLipsCurve, 64, 0.42, 16, true);
    const outerLipsMesh = new THREE.Mesh(outerLipsGeo, lipsMaterial);
    oralCavityGroup.add(outerLipsMesh);

    // B. Deep Pharynx Cavity Backing
    const pharynxGeo = new THREE.CylinderGeometry(1.6, 2.4, 3.2, 32, 1, true);
    const pharynxMesh = new THREE.Mesh(pharynxGeo, pharynxBackdropMaterial);
    pharynxMesh.rotation.x = Math.PI / 2;
    pharynxMesh.position.set(0, 0.1, -2.6);
    oralCavityGroup.add(pharynxMesh);

    // C. Upper Dental Arch & Maxillary Gingiva
    const upperArchGroup = new THREE.Group();
    const upperTeethCount = 14;
    for (let i = 0; i < upperTeethCount; i++) {
      const u = i / (upperTeethCount - 1);
      const angle = (u - 0.5) * Math.PI * 0.92;
      const rX = 1.95;
      const rZ = 1.45;
      const x = Math.sin(angle) * rX;
      const z = Math.cos(angle) * rZ * 0.92 - 0.65;
      const y = 1.15 + Math.cos(angle * 1.8) * 0.12;

      const isMolar = i < 3 || i > 10;
      const isCanine = i === 4 || i === 9;
      const toothScale = isMolar ? 0.38 : isCanine ? 0.34 : 0.32;
      const toothH = isMolar ? 0.62 : isCanine ? 0.75 : 0.68;

      const toothGeo = new THREE.CylinderGeometry(
        toothScale * 0.92,
        toothScale * (isMolar ? 1.05 : 0.75),
        toothH,
        14
      );
      const toothMesh = new THREE.Mesh(toothGeo, enamelMaterial);
      toothMesh.position.set(x, y, z);
      toothMesh.rotation.z = -x * 0.12;
      toothMesh.rotation.y = angle * 0.85;
      toothMesh.castShadow = true;
      upperArchGroup.add(toothMesh);
      registerMesh('teeth', toothMesh);
    }

    // Maxillary Scalloped Gum Arch
    const upperGumCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.1, 1.25, -1.2),
      new THREE.Vector3(-1.5, 1.45, -0.4),
      new THREE.Vector3(-0.8, 1.55, 0.3),
      new THREE.Vector3(0.0, 1.58, 0.6),
      new THREE.Vector3(0.8, 1.55, 0.3),
      new THREE.Vector3(1.5, 1.45, -0.4),
      new THREE.Vector3(2.1, 1.25, -1.2),
    ]);
    const upperGumGeo = new THREE.TubeGeometry(upperGumCurve, 32, 0.34, 12, false);
    const upperGumMesh = new THREE.Mesh(upperGumGeo, gumMaterial);
    upperArchGroup.add(upperGumMesh);
    registerMesh('gingiva', upperGumMesh);
    oralCavityGroup.add(upperArchGroup);

    // D. Lower Dental Arch & Mandibular Gingiva
    const lowerArchGroup = new THREE.Group();
    const lowerTeethCount = 14;
    for (let i = 0; i < lowerTeethCount; i++) {
      const u = i / (lowerTeethCount - 1);
      const angle = (u - 0.5) * Math.PI * 0.88;
      const rX = 1.85;
      const rZ = 1.40;
      const x = Math.sin(angle) * rX;
      const z = Math.cos(angle) * rZ * 0.92 - 0.55;
      const y = -0.95 - Math.cos(angle * 1.8) * 0.10;

      const isMolar = i < 3 || i > 10;
      const toothScale = isMolar ? 0.36 : 0.28;
      const toothH = isMolar ? 0.58 : 0.65;

      const toothGeo = new THREE.CylinderGeometry(
        toothScale * (isMolar ? 1.05 : 0.7),
        toothScale * 0.9,
        toothH,
        14
      );
      const toothMesh = new THREE.Mesh(toothGeo, enamelMaterial);
      toothMesh.position.set(x, y, z);
      toothMesh.rotation.z = x * 0.12;
      toothMesh.rotation.y = angle * 0.85;
      toothMesh.castShadow = true;
      lowerArchGroup.add(toothMesh);
      registerMesh('lower_teeth', toothMesh);
      registerMesh('teeth', toothMesh);
    }

    // Mandibular Scalloped Gum Arch
    const lowerGumCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.0, -1.15, -1.1),
      new THREE.Vector3(-1.4, -1.28, -0.35),
      new THREE.Vector3(-0.7, -1.35, 0.25),
      new THREE.Vector3(0.0, -1.38, 0.52),
      new THREE.Vector3(0.7, -1.35, 0.25),
      new THREE.Vector3(1.4, -1.28, -0.35),
      new THREE.Vector3(2.0, -1.15, -1.1),
    ]);
    const lowerGumGeo = new THREE.TubeGeometry(lowerGumCurve, 32, 0.32, 12, false);
    const lowerGumMesh = new THREE.Mesh(lowerGumGeo, gumMaterial);
    lowerArchGroup.add(lowerGumMesh);
    registerMesh('gingiva', lowerGumMesh);
    oralCavityGroup.add(lowerArchGroup);

    // E. Hard Palate with Transverse Rugae Ribs
    const hardPalateGeo = new THREE.CylinderGeometry(1.65, 1.85, 1.7, 32, 8, true, 0, Math.PI);
    const hardPalateMesh = new THREE.Mesh(hardPalateGeo, hardPalateMaterial);
    hardPalateMesh.rotation.x = Math.PI / 2;
    hardPalateMesh.rotation.z = Math.PI;
    hardPalateMesh.position.set(0, 1.25, -0.85);
    hardPalateMesh.scale.set(1.0, 0.65, 1.0);
    oralCavityGroup.add(hardPalateMesh);
    registerMesh('hard_palate', hardPalateMesh);

    // Anatomical Rugae Ribs
    for (let r = 0; r < 5; r++) {
      const rugaZ = -0.35 - r * 0.22;
      const rugaW = 1.3 - r * 0.12;
      const rugaCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-rugaW * 0.5, 1.45, rugaZ),
        new THREE.Vector3(0, 1.52, rugaZ + 0.05),
        new THREE.Vector3(rugaW * 0.5, 1.45, rugaZ),
      ]);
      const rugaGeo = new THREE.TubeGeometry(rugaCurve, 16, 0.045, 8, false);
      const rugaMesh = new THREE.Mesh(rugaGeo, hardPalateMaterial);
      oralCavityGroup.add(rugaMesh);
      registerMesh('hard_palate', rugaMesh);
    }

    // F. Soft Palate Descending Posteriorly
    const softPalateCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.4, 0.95, -1.6),
      new THREE.Vector3(-0.7, 0.98, -1.75),
      new THREE.Vector3(0.0, 0.85, -1.85),
      new THREE.Vector3(0.7, 0.98, -1.75),
      new THREE.Vector3(1.4, 0.95, -1.6),
    ]);
    const softPalateGeo = new THREE.TubeGeometry(softPalateCurve, 24, 0.28, 12, false);
    const softPalateMesh = new THREE.Mesh(softPalateGeo, softPalateMaterial);
    oralCavityGroup.add(softPalateMesh);
    registerMesh('soft_palate', softPalateMesh);

    // G. Central Hanging Uvula
    const uvulaGeo = new THREE.ConeGeometry(0.22, 0.75, 16);
    uvulaGeo.rotateX(Math.PI);
    const uvulaMesh = new THREE.Mesh(uvulaGeo, uvulaMaterial);
    uvulaMesh.position.set(0.0, 0.35, -2.15);
    oralCavityGroup.add(uvulaMesh);
    registerMesh('uvula', uvulaMesh);

    // H. Bilateral Palatine Tonsils in Tonsillar Pillars
    const leftTonsilGeo = new THREE.DodecahedronGeometry(0.42, 1);
    leftTonsilGeo.scale(0.85, 1.4, 0.85);
    const leftTonsil = new THREE.Mesh(leftTonsilGeo, tonsilMaterial);
    leftTonsil.position.set(-1.35, 0.15, -1.95);
    oralCavityGroup.add(leftTonsil);
    registerMesh('tonsils', leftTonsil);

    const rightTonsil = leftTonsil.clone();
    rightTonsil.position.set(1.35, 0.15, -1.95);
    oralCavityGroup.add(rightTonsil);
    registerMesh('tonsils', rightTonsil);

    // I. Anatomical Tongue with Dorsal Papillae & Median Sulcus
    const tongueGeo = new THREE.SphereGeometry(1.65, 32, 24);
    tongueGeo.scale(1.15, 0.48, 1.45);
    const tongueMesh = new THREE.Mesh(tongueGeo, tongueMaterial);
    tongueMesh.position.set(0.0, -0.42, 0.15);
    tongueMesh.rotation.x = -0.12;
    oralCavityGroup.add(tongueMesh);
    registerMesh('tongue', tongueMesh);

    // Dorsal Median Sulcus Ridge
    const sulcusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.22, 1.15),
      new THREE.Vector3(0, -0.16, 0.5),
      new THREE.Vector3(0, -0.24, -0.4),
      new THREE.Vector3(0, -0.32, -1.1),
    ]);
    const sulcusGeo = new THREE.TubeGeometry(sulcusCurve, 20, 0.04, 8, false);
    const sulcusMesh = new THREE.Mesh(sulcusGeo, tongueMaterial);
    oralCavityGroup.add(sulcusMesh);
    registerMesh('tongue', sulcusMesh);

    // J. Buccal Mucosa / Inner Cheeks (Left & Right Lateral Vestibule Walls)
    const leftCheekGeo = new THREE.CylinderGeometry(1.9, 1.8, 2.6, 24, 1, true, -Math.PI * 0.45, Math.PI * 0.42);
    const leftCheek = new THREE.Mesh(leftCheekGeo, buccalMucosaMaterial);
    leftCheek.position.set(-1.35, 0.05, -0.35);
    leftCheek.rotation.y = -Math.PI * 0.12;
    oralCavityGroup.add(leftCheek);
    registerMesh('buccal_mucosa', leftCheek);

    const rightCheekGeo = new THREE.CylinderGeometry(1.9, 1.8, 2.6, 24, 1, true, Math.PI * 0.03, Math.PI * 0.42);
    const rightCheek = new THREE.Mesh(rightCheekGeo, buccalMucosaMaterial);
    rightCheek.position.set(1.35, 0.05, -0.35);
    rightCheek.rotation.y = Math.PI * 0.12;
    oralCavityGroup.add(rightCheek);
    registerMesh('buccal_mucosa', rightCheek);

    scene.add(oralCavityGroup);

    // 8. Raycaster for Interactive Clicking on 3D Meshes
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleCanvasClick = (event: MouseEvent) => {
      if (!mountRef.current || !cameraRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, cameraRef.current);
      const intersects = raycaster.intersectObjects(oralCavityGroup.children, true);

      if (intersects.length > 0) {
        for (const hit of intersects) {
          const partId = hit.object.userData?.partId;
          if (partId) {
            handleSelectPart(partId);
            break;
          }
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('click', handleCanvasClick);

    // 9. Resize Observer
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const newW = mountRef.current.clientWidth;
      const newH = mountRef.current.clientHeight;
      cameraRef.current.aspect = newW / newH;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // 10. Animation Loop & Screen Projection for Interactive Callouts
    let frameCount = 0;
    const animateLoop = () => {
      reqAnimIdRef.current = requestAnimationFrame(animateLoop);
      controls.update();

      if (isAutoRotating && oralCavityGroupRef.current) {
        oralCavityGroupRef.current.rotation.y += 0.003;
      }

      renderer.render(scene, camera);

      // Project 3D Coordinates to 2D Screen Space every 2 frames for smooth UI callouts
      frameCount++;
      if (frameCount % 2 === 0 && cameraRef.current && mountRef.current) {
        const rect = mountRef.current.getBoundingClientRect();
        const updated = ORAL_ANATOMICAL_PARTS.map((part) => {
          const v = new THREE.Vector3(...part.position3D);
          v.project(cameraRef.current!);
          const isVisible = v.z < 1.0;
          const x = ((v.x + 1) * rect.width) / 2;
          const y = ((-v.y + 1) * rect.height) / 2;
          return {
            part,
            x: Math.round(x),
            y: Math.round(y),
            visible: isVisible && x > 20 && x < rect.width - 20 && y > 20 && y < rect.height - 20,
          };
        });
        setProjectedLabels(updated);
      }
    };

    animateLoop();

    return () => {
      if (reqAnimIdRef.current) cancelAnimationFrame(reqAnimIdRef.current);
      domEl.removeEventListener('click', handleCanvasClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [isAutoRotating]);

  // Handle Highlighting and Focusing an Anatomical Part
  const handleSelectPart = (partId: string) => {
    setSelectedPartId(partId);
    const targetPart = ORAL_ANATOMICAL_PARTS.find((p) => p.id === partId);
    if (!targetPart) return;

    if (onSelectPart) onSelectPart(targetPart);

    // Animate camera toward anatomical target smoothly
    if (cameraRef.current && controlsRef.current) {
      const [tx, ty, tz] = targetPart.cameraTarget;
      const dist = targetPart.cameraDistance;

      const startPos = cameraRef.current.position.clone();
      const endPos = new THREE.Vector3(tx, ty + 0.35, dist);
      const startTarget = controlsRef.current.target.clone();
      const endTarget = new THREE.Vector3(tx, ty, tz);

      let step = 0;
      const totalSteps = 24;
      const animateCam = () => {
        step++;
        const t = step / totalSteps;
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        cameraRef.current?.position.lerpVectors(startPos, endPos, ease);
        controlsRef.current?.target.lerpVectors(startTarget, endTarget, ease);

        if (step < totalSteps) {
          requestAnimationFrame(animateCam);
        }
      };
      animateCam();
    }

    // Highlight active meshes with cyan glow
    const meshMap = partsMeshMapRef.current;
    meshMap.forEach((meshes, id) => {
      const isCurrent = id === partId;
      meshes.forEach((m) => {
        if (m.material && 'emissive' in m.material) {
          const mat = m.material as THREE.MeshPhysicalMaterial;
          if (isCurrent) {
            mat.emissive = new THREE.Color(0x06b6d4);
            mat.emissiveIntensity = 0.45;
          } else {
            mat.emissive = new THREE.Color(0x000000);
            mat.emissiveIntensity = 0.0;
          }
        }
      });
    });
  };

  // Wireframe toggle effect
  useEffect(() => {
    const meshMap = partsMeshMapRef.current;
    meshMap.forEach((meshes) => {
      meshes.forEach((m) => {
        if (m.material && 'wireframe' in m.material) {
          (m.material as any).wireframe = wireframeMode;
        }
      });
    });
  }, [wireframeMode]);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0.2, 7.2);
      controlsRef.current.target.set(0, 0.1, 0);
      setIsAutoRotating(false);
    }
    handleSelectPart('teeth');
  };

  return (
    <div
      ref={containerRef}
      className={`oral-explorer-card ${isFullscreen ? 'fullscreen-mode' : ''} ${compact ? 'compact-mode' : ''}`}
      style={{
        background: 'radial-gradient(ellipse at 40% 30%, #081528 0%, #030712 100%)',
        border: '1px solid rgba(56, 189, 248, 0.28)',
        borderRadius: isFullscreen ? '0px' : '20px',
        boxShadow: '0 25px 65px -12px rgba(0, 0, 0, 0.85), 0 0 35px rgba(14, 165, 233, 0.14)',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: compact ? '420px' : '620px',
      }}
    >
      {/* 1. Header Bar: Title & Fullscreen Action (Matches Reference Image 2) */}
      <div
        className="oral-explorer-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 22px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
          background: 'rgba(3, 7, 18, 0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>🦷</span>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 800,
                letterSpacing: '0.03em',
                background: 'linear-gradient(90deg, #ffffff 0%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {currentLang === 'te'
                ? '🦷 3D నోటి శరీర నిర్మాణ & ఆరోగ్య అన్వేషణ'
                : currentLang === 'hi'
                ? '🦷 3D मुख शरीर रचना एवं स्वास्थ्य एक्सप्लोरर'
                : '3D Oral Anatomy & Health Explorer'}
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
              {currentLang === 'te'
                ? 'ఇంటరాక్టివ్ త్రీ-డైమెన్షనల్ క్లినికల్ మోడల్ • ITDA పాడేరు'
                : 'Interactive Medically Accurate 3D Model • ITDA Paderu'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(14, 165, 233, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              color: '#38bdf8',
              borderRadius: '9999px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <span>{isFullscreen ? '✕ Exit' : 'Interactive View ⛶'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Two-Column Stage: Left 3D Canvas, Right Oral Health Info Panel */}
      <div
        className="oral-explorer-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1.45fr) minmax(320px, 1fr)',
          flex: 1,
          position: 'relative',
          minHeight: '480px',
        }}
      >
        {/* LEFT COLUMN: 3D THREE.JS CANVAS & INTERACTIVE CALLOUTS */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            minHeight: '380px',
            overflow: 'hidden',
          }}
        >
          {/* Mount Element for WebGL Renderer */}
          <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

          {/* Left Floating Cyber Toolbar (Matches Image 2) */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 25,
            }}
          >
            <button
              type="button"
              title="Reset View / Auto-Rotate"
              onClick={() => setIsAutoRotating(!isAutoRotating)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: isAutoRotating ? '#0284c7' : 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                fontSize: '0.95rem',
              }}
            >
              🔄
            </button>
            <button
              type="button"
              title="Recenter Camera"
              onClick={handleResetCamera}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              🔍
            </button>
            <button
              type="button"
              title="Wireframe / X-Ray Toggle"
              onClick={() => setWireframeMode(!wireframeMode)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: wireframeMode ? '#10b981' : 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.95rem',
              }}
            >
              🧊
            </button>
          </div>

          {/* Interactive Screen-Projected Callout Badges with Glowing Cyan Lines (Matches Image 2) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            {projectedLabels.map(({ part, x, y, visible }) => {
              if (!visible) return null;
              const isSelected = part.id === selectedPartId;

              return (
                <div
                  key={part.id}
                  style={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSelectPart(part.id)}
                >
                  {/* Glowing Cyan Beacon Pin Dot */}
                  <div
                    style={{
                      width: isSelected ? '14px' : '10px',
                      height: isSelected ? '14px' : '10px',
                      borderRadius: '50%',
                      background: isSelected ? '#38bdf8' : '#0284c7',
                      boxShadow: isSelected
                        ? '0 0 16px #38bdf8, 0 0 24px #38bdf8'
                        : '0 0 8px rgba(56, 189, 248, 0.6)',
                      border: '2px solid #ffffff',
                      transition: 'all 0.2s',
                      margin: '0 auto',
                    }}
                  />

                  {/* Leader Label Pill */}
                  <div
                    style={{
                      marginTop: '4px',
                      background: isSelected
                        ? 'rgba(2, 132, 199, 0.92)'
                        : 'rgba(15, 23, 42, 0.82)',
                      border: isSelected
                        ? '1.5px solid #38bdf8'
                        : '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: isSelected ? '#ffffff' : '#e2e8f0',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(4px)',
                      transition: 'all 0.2s',
                    }}
                  >
                    {getPartName(part).split('(')[0].trim()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Hint Banner */}
          <div
            style={{
              position: 'absolute',
              bottom: '12px',
              left: '16px',
              right: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none',
              zIndex: 22,
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                color: '#64748b',
                background: 'rgba(3, 7, 18, 0.6)',
                padding: '3px 8px',
                borderRadius: '4px',
              }}
            >
              🖱️ {currentLang === 'te' ? 'తిప్పడానికి డ్రాగ్ చేయండి • జూమ్ కోసం స్క్రోల్ చేయండి' : 'Drag to rotate • Scroll to zoom'}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: ORAL HEALTH INFORMATION CARD (Matches Reference Image 2) */}
        <div
          className="oral-explorer-info-col"
          style={{
            background: 'rgba(8, 20, 36, 0.88)',
            borderLeft: '1px solid rgba(56, 189, 248, 0.2)',
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            maxHeight: isFullscreen ? 'calc(100vh - 70px)' : '620px',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Header with Green Shield Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
                fontSize: '1.1rem',
              }}
            >
              🛡️
            </div>
            <div>
              <h4
                style={{
                  margin: 0,
                  fontSize: '0.98rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '0.02em',
                }}
              >
                {currentLang === 'te'
                  ? 'నోటి ఆరోగ్య సమాచారం'
                  : currentLang === 'hi'
                  ? 'मौखिक स्वास्थ्य जानकारी'
                  : 'Oral Health Information'}
              </h4>
              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                {currentLang === 'te' ? 'క్లినికల్ అనాటమీ & స్క్రీనింగ్ గైడ్' : 'Clinical Anatomy & Screening Guide'}
              </span>
            </div>
          </div>

          {/* Key Parts Identified Section with Green Checkmarks (Matches Image 2) */}
          <div>
            <div
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#38bdf8',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {currentLang === 'te' ? 'గుర్తించబడిన ముఖ్య భాగాలు:' : 'Key Parts Identified'}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ORAL_ANATOMICAL_PARTS.map((p) => {
                const isSelected = p.id === selectedPartId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPart(p.id)}
                    style={{
                      background: isSelected ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.6)',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.2)',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#ffffff' : '#cbd5e1',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ color: '#10b981', fontSize: '0.8rem' }}>✓</span>
                    <span>{getPartName(p).split('(')[0].trim()}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Part Detail Card with 3D Hologram Badge (Matches Image 2) */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(3, 7, 18, 0.6) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h5
                  style={{
                    margin: 0,
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: '#38bdf8',
                  }}
                >
                  {getPartName(selectedPart)}
                </h5>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{getPartSubtitle(selectedPart)}</span>
              </div>

              {/* Holographic Radar Badge */}
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(3, 7, 18, 0.8) 100%)',
                  border: '1.5px solid #38bdf8',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                }}
              >
                🦷
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.76rem', color: '#cbd5e1', lineHeight: '1.45' }}>
              {getPartDesc(selectedPart)}
            </p>

            {/* Screening Relevance */}
            <div
              style={{
                background: 'rgba(2, 132, 199, 0.12)',
                borderLeft: '3px solid #0284c7',
                padding: '8px 10px',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <strong style={{ fontSize: '0.72rem', color: '#38bdf8', display: 'block', marginBottom: '2px' }}>
                🔍 {currentLang === 'te' ? 'స్క్రీనింగ్ పరీక్షలో ఏమి గమనిస్తారు:' : 'Clinical Screening Relevance:'}
              </strong>
              <span style={{ fontSize: '0.72rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                {getPartScreening(selectedPart)}
              </span>
            </div>
          </div>

          {/* Health Tips Checklist (Matches Image 2) */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.55)',
              borderRadius: '12px',
              padding: '12px 14px',
              border: '1px solid rgba(56, 189, 248, 0.12)',
            }}
          >
            <div
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                color: '#fbbf24',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {currentLang === 'te' ? 'ఆరోగ్య సూచనలు (Health Tips)' : 'Health Tips'}
            </div>

            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {getPartTips(selectedPart).slice(0, 3).map((tip, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '0.74rem',
                    color: '#e2e8f0',
                    lineHeight: '1.35',
                  }}
                >
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Primary Action Button: "Start Screening" (Matches Image 2) */}
          <button
            type="button"
            onClick={() => {
              if (onNavigateScreening) {
                onNavigateScreening();
              } else {
                window.location.hash = '#/screening';
              }
            }}
            style={{
              marginTop: 'auto',
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 18px',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s',
            }}
          >
            <span>⚡</span>
            <span>
              {currentLang === 'te'
                ? 'స్క్రీనింగ్ ప్రారంభించండి'
                : currentLang === 'hi'
                ? 'स्क्रीनिंग शुरू करें'
                : 'Start Screening'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OralAnatomyExplorer3D;
