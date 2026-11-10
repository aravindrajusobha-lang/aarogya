import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LanguageCode } from '../i18n';
import { Oral3DHealthcareAnimation } from './Oral3DHealthcareAnimation';

interface OralProcedureVideoPlayerProps {
  onOpenScreeningQueue?: () => void;
  currentLang?: LanguageCode;
}

export interface CheckupStoryStep {
  id: string;
  stepNumber: string;
  title: Record<string, string>;
  timeRange: [number, number]; // [startSec, endSec]
  sceneLabel: Record<string, string>;
  dialogues: {
    speaker: 'lakshmi' | 'ravi' | 'app' | 'doctor';
    speakerName: Record<string, string>;
    role: Record<string, string>;
    avatar: string;
    text: Record<string, string>;
  }[];
  keyAction: Record<string, string>;
  calloutBadge: string;
}

const CHECKUP_STORY_STEPS: CheckupStoryStep[] = [
  {
    id: 'intro',
    stepNumber: 'Overview',
    title: {
      en: 'An Oral Checkup, Right in Your Village',
      te: 'మీ గ్రామంలోనే ప్రత్యక్ష నోటి ఆరోగ్య తనిఖీ',
      hi: 'आपके अपने गांव में त्वरित मुख जांच',
    },
    timeRange: [0, 8],
    sceneLabel: {
      en: 'Community Outreach • ITDA Paderu Agency',
      te: 'కమ్యూనిటీ ఔట్‌రీచ్ • ఐటీడీఏ పాడేరు ఏజెన్సీ',
      hi: 'सामुदायिक पहुंच • आईटीडीए पाडेरू एजेंसी',
    },
    dialogues: [],
    keyAction: {
      en: 'Frontline ASHA health workers bring early oral screening to remote tribal habitations.',
      te: 'ఆశా కార్యకర్తలు మారుమూల గిరిజన గ్రామాల్లోకి ముందస్తు నోటి స్క్రీనింగ్‌ను చేరవేస్తున్నారు.',
      hi: 'आशा कार्यकर्ता दूरदराज के आदिवासी गांवों में प्रारंभिक मुख स्क्रीनिंग पहुंचा रहे हैं।',
    },
    calloutBadge: 'Village Care',
  },
  {
    id: 'step-1',
    stepNumber: 'Step 1',
    title: {
      en: 'A Health Worker Meets the Patient at Home',
      te: 'ఆరోగ్య కార్యకర్త రోగి ఇంటికి వెళ్లి కలుస్తారు',
      hi: 'स्वास्थ्य कार्यकर्ता मरीज के घर जाकर मिलते हैं',
    },
    timeRange: [8, 25],
    sceneLabel: {
      en: 'Home Visit & Symptom Intake • Vankachinta Village',
      te: 'ఇంటి వద్ద తనిఖీ & లక్షణాల సేకరణ • వంకచింత గ్రామం',
      hi: 'गृह भेंट एवं लक्षण संकलन • वनकाचिंता गांव',
    },
    dialogues: [
      {
        speaker: 'lakshmi',
        speakerName: { en: 'Lakshmi', te: 'లక్ష్మి', hi: 'लक्ष्मी' },
        role: { en: 'ASHA Health Worker', te: 'ఆశా కార్యకర్త', hi: 'आशा कार्यकर्ता' },
        avatar: '👩‍⚕️',
        text: {
          en: 'Namaste Ravi! I am Lakshmi, your health worker. Let us do a quick mouth checkup.',
          te: 'నమస్తే రవి! నేను మీ ఆరోగ్య కార్యకర్త లక్ష్మిని. మీ నోటిని ఒకసారి త్వరితంగా తనిఖీ చేద్దాం.',
          hi: 'नमस्ते रवि! मैं आपकी स्वास्थ्य कार्यकर्ता लक्ष्मी हूँ। आइए मुंह की त्वरित जांच करें।',
        },
      },
      {
        speaker: 'ravi',
        speakerName: { en: 'Ravi', te: 'రవి', hi: 'रवि' },
        role: { en: 'Community Resident (Age 42)', te: 'గ్రామస్తుడు (వయస్సు 42)', hi: 'ग्रामीण नागरिक (आयु 42)' },
        avatar: '👤',
        text: {
          en: 'I chew tobacco and have a sore in my mouth. Is it serious?',
          te: 'నేను పొగాకు నములుతాను, నా నోటిలో పుండు ఉంది. ఇది తీవ్రమైనదా?',
          hi: 'मैं तंबाकू चबाता हूँ और मेरे मुंह में छाला है। क्या यह गंभीर है?',
        },
      },
    ],
    keyAction: {
      en: 'Frontline risk factor intake (tobacco/gutka consumption) and early mucosal visual inspection.',
      te: 'పొగాకు అలవాట్ల చరిత్ర సేకరణ మరియు ప్రాథమిక నోటి శ్లేష్మ తనిఖీ నిర్వహణ.',
      hi: 'तंबाकू/गुटखा सेवन इतिहास संकलन और प्रारंभिक मौखिक दृश्य निरीक्षण।',
    },
    calloutBadge: 'Home Visit',
  },
  {
    id: 'step-2',
    stepNumber: 'Step 2',
    title: {
      en: 'Scan the Mouth with the Phone Camera',
      te: 'ఫోన్ కెమెరాతో నోటిని స్కాన్ చేయడం',
      hi: 'फोन कैमरे से मुंह को स्कैन करना',
    },
    timeRange: [25, 45],
    sceneLabel: {
      en: 'Camera AI Screening • High-Resolution Mucosal Viewfinder',
      te: 'కెమెరా AI స్క్రీనింగ్ • హై-రెజల్యూషన్ శ్లేష్మ వ్యూఫైండర్',
      hi: 'कैमरा AI स्क्रीनिंग • उच्च-रिज़ॉल्यूशन म्यूकोसल व्यूफ़ाइंडर',
    },
    dialogues: [
      {
        speaker: 'lakshmi',
        speakerName: { en: 'Lakshmi', te: 'లక్ష్మి', hi: 'लक्ष्मी' },
        role: { en: 'ASHA Health Worker', te: 'ఆశా కార్యకర్త', hi: 'आशा कार्यकर्ता' },
        avatar: '👩‍⚕️',
        text: {
          en: 'Open wide, Ravi. I will scan with my phone.',
          te: 'నోరు పెద్దగా తెరవండి రవి. నేను నా ఫోన్‌తో స్కాన్ చేస్తాను.',
          hi: 'मुंह पूरा खोलें, रवि। मैं अपने फोन से स्कैन करूंगी।',
        },
      },
      {
        speaker: 'app',
        speakerName: { en: 'Aarogya App', te: 'ఆరోగ్య యాప్', hi: 'आरोग्य ऐप' },
        role: { en: 'DEMO AI Screening Support', te: 'డెమో AI స్క్రీనింగ్ సహాయం', hi: 'डेमो AI स्क्रीनिंग सपोर्ट' },
        avatar: '📱',
        text: {
          en: 'White patch found. See a doctor.',
          te: 'తెల్లటి మచ్చ గుర్తించబడింది. వైద్యుడిని సంప్రదించండి.',
          hi: 'सफेद पैच मिला। डॉक्टर को दिखाएं।',
        },
      },
    ],
    keyAction: {
      en: 'The app inspects mucosal texture and flags early warning signs for clinician evaluation.',
      te: 'యాప్ నోటి లోపలి పొరను పరిశీలించి ముందస్తు హెచ్చరిక గుర్తులను వైద్యుడికి అందిస్తుంది.',
      hi: 'ऐप मौखिक म्यूकोसा का निरीक्षण करता है और डॉक्टर के मूल्यांकन के लिए प्रारंभिक संकेत दिखाता है।',
    },
    calloutBadge: 'Oral AI Scan',
  },
  {
    id: 'step-3',
    stepNumber: 'Step 3',
    title: {
      en: 'The Report Reaches a Doctor Instantly',
      te: 'రిపోర్టు తక్షణమే వైద్యుడి వద్దకు చేరుతుంది',
      hi: 'रिपोर्ट तुरंत डॉक्टर तक पहुंचती है',
    },
    timeRange: [45, 60],
    sceneLabel: {
      en: 'Instant Offline Sync & Tele-Referral • Paderu CHC',
      te: 'తక్షణ ఆఫ్‌లైన్ సింక్ & టెలి-రెఫరల్ • పాడేరు సీహెచ్‌సీ',
      hi: 'त्वरित ऑफ़लाइन सिंक और टेली-रेफरल • पाडेरू सीएचसी',
    },
    dialogues: [
      {
        speaker: 'lakshmi',
        speakerName: { en: 'Lakshmi', te: 'లక్ష్మి', hi: 'लक्ष्मी' },
        role: { en: 'ASHA Health Worker', te: 'ఆశా కార్యకర్త', hi: 'आशा कार्यकर्ता' },
        avatar: '👩‍⚕️',
        text: {
          en: 'The app flagged it. I am sending your report to Dr. Priya now.',
          te: 'యాప్ దీనిని గుర్తించింది. నేను మీ నివేదికను డాక్టర్ ప్రియ గారికి పంపుతున్నాను.',
          hi: 'ऐप ने इसे चिन्हित किया। मैं आपकी रिपोर्ट अभी डॉ. प्रिया को भेज रही हूँ।',
        },
      },
      {
        speaker: 'doctor',
        speakerName: { en: 'Dr. Priya', te: 'డాక్టర్ ప్రియ', hi: 'डॉ. प्रिया' },
        role: { en: 'Medical Officer, Paderu CHC', te: 'వైద్యాధికారి, పాడేరు సీహెచ్‌సీ', hi: 'चिकित्सा अधिकारी, पाडेरू सीएचसी' },
        avatar: '🩺',
        text: {
          en: 'Report received. Please come to the clinic on Monday.',
          te: 'నివేదిక అందింది. దయచేసి సోమవారం క్లినిక్‌కి రండి.',
          hi: 'रिपोर्ट प्राप्त हुई। कृपया सोमवार को क्लिनिक आएं।',
        },
      },
    ],
    keyAction: {
      en: 'Encrypted patient report synched to hospital queue; fast-track clinic appointment booked.',
      te: 'ఎన్‌క్రిప్ట్ చేసిన రోగి నివేదిక ఆసుపత్రికి పంపబడింది; సోమవారం క్లినిక్ అపాయింట్‌మెంట్ ఖరారైంది.',
      hi: 'सुरक्षित मरीज रिपोर्ट अस्पताल कतार में सिंक हुई; सोमवार के लिए क्लिनिक परामर्श निर्धारित।',
    },
    calloutBadge: 'Instant Tele-Sync',
  },
  {
    id: 'step-4',
    stepNumber: 'Step 4',
    title: {
      en: 'Early Detection Means Simpler Treatment & Healthier Life',
      te: 'ముందస్తు గుర్తింపు అంటే సులభమైన చికిత్స మరియు ఆరోగ్యకరమైన జీవితం',
      hi: 'प्रारंभिक पहचान का मतलब सरल उपचार और स्वस्थ जीवन',
    },
    timeRange: [60, 75],
    sceneLabel: {
      en: 'Clinic Review & Care Navigation • Recovery & Wellness',
      te: 'క్లినిక్ సమీక్ష & సంరక్షణ మార్గదర్శకత్వం • కోలుకోవడం & ఆరోగ్యం',
      hi: 'क्लिनिक परामर्श और देखभाल मार्गदर्शन • रिकवरी और स्वास्थ्य',
    },
    dialogues: [
      {
        speaker: 'ravi',
        speakerName: { en: 'Ravi', te: 'రవి', hi: 'रवि' },
        role: { en: 'Recovered Patient', te: 'కోలుకున్న రోగి', hi: 'स्वस्थ मरीज' },
        avatar: '👤',
        text: {
          en: 'Found early, treated early. Thank you, Lakshmi!',
          te: 'ముందుగా గుర్తించారు, త్వరగా నయమైంది. ధన్యవాదాలు లక్ష్మి!',
          hi: 'समय रहते पहचान हुई, आसानी से इलाज हुआ। धन्यवाद लक्ष्मी!',
        },
      },
    ],
    keyAction: {
      en: 'Early oral screening prevents escalation and ensures prompt intervention for tribal families.',
      te: 'ముందస్తు నోటి స్క్రీనింగ్ సమస్యలు పెరగకుండా అరికట్టి గిరిజన కుటుంబాలకు సత్వర రక్షణ కల్పిస్తుంది.',
      hi: 'प्रारंभिक मुख स्क्रीनिंग जटिलताओं को रोकती है और जनजातीय परिवारों को त्वरित सुरक्षा देती है।',
    },
    calloutBadge: 'Healthy Life',
  },
];

const TOTAL_DURATION_SEC = 75;

export const OralProcedureVideoPlayer: React.FC<OralProcedureVideoPlayerProps> = ({
  onOpenScreeningQueue,
  currentLang = 'en',
}) => {
  const [lang, setLang] = useState<LanguageCode>(currentLang);
  const [playbackMode, setPlaybackMode] = useState<'story' | 'video' | '3d-implant'>('story');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [activeStepId, setActiveStepId] = useState<string>('intro');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [voiceSpeechEnabled, setVoiceSpeechEnabled] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync external language prop
  useEffect(() => {
    if (currentLang) {
      setLang(currentLang);
    }
  }, [currentLang]);

  // Determine current active step based on currentTime
  const currentStep = CHECKUP_STORY_STEPS.find(
    (step) => currentTime >= step.timeRange[0] && currentTime < step.timeRange[1]
  ) || CHECKUP_STORY_STEPS[CHECKUP_STORY_STEPS.length - 1];

  useEffect(() => {
    if (currentStep.id !== activeStepId) {
      setActiveStepId(currentStep.id);
    }
  }, [currentStep, activeStepId]);

  // Optional Voice Narration using SpeechSynthesis
  const speakDialogue = useCallback(
    (text: string, voiceLang: string) => {
      if (!voiceSpeechEnabled || isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        if (voiceLang === 'te') utterance.lang = 'te-IN';
        else if (voiceLang === 'hi') utterance.lang = 'hi-IN';
        else utterance.lang = 'en-IN';
        window.speechSynthesis.speak(utterance);
      } catch {
        // Fallback silently if audio engine is not available
      }
    },
    [voiceSpeechEnabled, isMuted]
  );

  // Trigger narration on step change
  useEffect(() => {
    if (isPlaying && voiceSpeechEnabled && !isMuted && currentStep.dialogues.length > 0) {
      const firstDialog = currentStep.dialogues[0];
      const textToSpeak = firstDialog.text[lang] || firstDialog.text.en;
      speakDialogue(textToSpeak, lang);
    }
  }, [activeStepId, isPlaying, voiceSpeechEnabled, isMuted, currentStep, lang, speakDialogue]);

  // Main playback timer loop
  useEffect(() => {
    if (playbackMode === 'story' && isPlaying) {
      timerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= TOTAL_DURATION_SEC) {
            return 0; // Loop demonstration
          }
          return Math.min(TOTAL_DURATION_SEC, prev + 1);
        });
      }, 1000 / playbackSpeed);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [playbackMode, isPlaying, playbackSpeed]);

  const formatSeconds = (sec: number): string => {
    if (isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTogglePlay = () => {
    if (playbackMode === 'video' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      if (next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (playbackMode === 'video' && videoRef.current) {
      const dur = videoRef.current.duration || TOTAL_DURATION_SEC;
      videoRef.current.currentTime = (val / TOTAL_DURATION_SEC) * dur;
    }
  };

  const handleSelectStep = (step: CheckupStoryStep) => {
    setCurrentTime(step.timeRange[0]);
    setActiveStepId(step.id);
    if (playbackMode === 'video' && videoRef.current) {
      const dur = videoRef.current.duration || TOTAL_DURATION_SEC;
      videoRef.current.currentTime = (step.timeRange[0] / TOTAL_DURATION_SEC) * dur;
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  const getLocalizedText = (textObj: Record<string, string>): string => {
    return textObj[lang] || textObj.en || '';
  };

  const progressPercent = (currentTime / TOTAL_DURATION_SEC) * 100;

  return (
    <div className="oral-procedure-showcase-panel" ref={containerRef}>
      {/* 1. Header Navigation Bar */}
      <div className="procedure-showcase-header">
        <div className="procedure-header-titles">
          <div className="procedure-header-badge-row">
            <span className="procedure-live-pulse-dot" />
            <span className="procedure-tag-label">Aarogya Drishti • Checkup Demo</span>
            <span className="procedure-simulation-chip">Simulation Mode</span>
          </div>
          <h3 className="procedure-showcase-title">
            {lang === 'te'
              ? 'గ్రామీణ నోటి ఆరోగ్య తనిఖీ ప్రత్యక్ష డెమో'
              : lang === 'hi'
              ? 'ग्रामीण मुख जांच लाइव डेमो'
              : 'Aarogya Drishti: Oral Checkup Demo'}
          </h3>
          <p className="procedure-showcase-subtitle">
            {lang === 'te'
              ? 'మీ గ్రామంలోనే ప్రత్యక్ష నోటి తనిఖీ, కెమెరా స్క్రీనింగ్ మరియు తక్షణ టెలి-సంప్రదింపుల మార్గదర్శకత్వం'
              : lang === 'hi'
              ? 'आपके गांव में मुख जांच, कैमरा स्क्रीनिंग और तुरंत डॉक्टर परामर्श प्रक्रिया'
              : 'An oral checkup right in your village: Home visit, phone camera AI scan, and instant doctor sync'}
          </p>
        </div>

        {/* Mode Switcher & Language Controls */}
        <div className="procedure-header-actions">
          <div className="procedure-mode-tabs" role="tablist">
            <button
              type="button"
              className={`procedure-mode-btn ${playbackMode === 'story' ? 'mode-active' : ''}`}
              onClick={() => setPlaybackMode('story')}
            >
              🎬 {lang === 'te' ? 'స్టోరీబోర్డ్ డెమో' : lang === 'hi' ? 'स्टोरीबोर्ड डेमो' : 'Checkup Story Demo'}
            </button>
            <button
              type="button"
              className={`procedure-mode-btn ${playbackMode === 'video' ? 'mode-active' : ''}`}
              onClick={() => setPlaybackMode('video')}
            >
              🎥 {lang === 'te' ? 'క్లినికల్ వీడియో' : lang === 'hi' ? 'क्लिनिकल वीडियो' : 'Clinical Operatory'}
            </button>
            <button
              type="button"
              className={`procedure-mode-btn ${playbackMode === '3d-implant' ? 'mode-active' : ''}`}
              onClick={() => setPlaybackMode('3d-implant')}
              title="Interactive 3D Dental Implant & Crown Placement Animation"
            >
              🦷 {lang === 'te' ? '3D దంత ఇంప్లాంట్' : lang === 'hi' ? '3D दंत इम्प्लांट' : '3D Dental Implant'}
            </button>
          </div>

          <div className="demo-lang-pills">
            <button
              type="button"
              className={`demo-lang-btn ${lang === 'en' ? 'lang-active' : ''}`}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`demo-lang-btn ${lang === 'te' ? 'lang-active' : ''}`}
              onClick={() => setLang('te')}
            >
              తెలుగు
            </button>
            <button
              type="button"
              className={`demo-lang-btn ${lang === 'hi' ? 'lang-active' : ''}`}
              onClick={() => setLang('hi')}
            >
              हिंदी
            </button>
          </div>
        </div>
      </div>

      {/* 2. Visual Cinema Stage Container */}
      <div className="procedure-video-screen-container checkup-story-stage">
        {playbackMode === '3d-implant' ? (
          /* Interactive 3D Dental Implant & Crown Placement Animation (Matches user reference diagram) */
          <div style={{ width: '100%', height: '100%', minHeight: '360px', position: 'relative' }}>
            <Oral3DHealthcareAnimation currentLang={lang} compact={true} />
          </div>
        ) : playbackMode === 'video' ? (
          /* Real Operatory Video Fallback View */
          <div className="operatory-video-box">
            <video
              ref={videoRef}
              src="/assets/videos/oral-procedure-demo.mp4"
              poster="/assets/healthcare/dental-examination.jpg"
              className="procedure-main-video"
              muted={isMuted}
              playsInline
              loop
              onTimeUpdate={() => {
                if (videoRef.current) {
                  const dur = videoRef.current.duration || TOTAL_DURATION_SEC;
                  setCurrentTime((videoRef.current.currentTime / dur) * TOTAL_DURATION_SEC);
                }
              }}
            />
          </div>
        ) : (
          /* Animated Storyboard Cinema Stage (Exact match to Aarogya Drishti_ Oral Checkup Demo.md) */
          <div className={`story-cinema-scene scene-${currentStep.id}`}>
            {/* Ambient Background & HUD Grid */}
            <div className="story-ambient-backdrop" />
            <div className="story-hud-grid-overlay" />

            {/* Stage Top Status Bar */}
            <div className="story-scene-status-bar">
              <div className="story-scene-pill">
                <span className="step-glow-dot" />
                <span className="step-num-txt">{currentStep.stepNumber}:</span>
                <span className="step-name-txt">{getLocalizedText(currentStep.title)}</span>
              </div>
              <div className="story-location-badge">
                📍 {getLocalizedText(currentStep.sceneLabel)}
              </div>
            </div>

            {/* SCENE 0: OVERVIEW & TITLE */}
            {currentStep.id === 'intro' && (
              <div className="story-scene-intro animate-fade-in">
                <div className="intro-emblem-wrap">
                  <div className="intro-emblem-ring" />
                  <span className="intro-leaf-icon">🌿</span>
                </div>
                <h2 className="intro-big-title">Aarogya Drishti</h2>
                <h4 className="intro-sub-banner">{getLocalizedText(currentStep.title)}</h4>
                <p className="intro-desc-lead">
                  {lang === 'te'
                    ? 'ఆరోగ్య కార్యకర్తలు మారుమూల గిరిజన గృహాల్లోనే స్మార్ట్‌ఫోన్ ద్వారా నోటి ప్రాథమిక తనిఖీని అందిస్తున్నారు.'
                    : lang === 'hi'
                    ? 'आशा स्वास्थ्य कार्यकर्ता दूरदराज के आदिवासी घरों में स्मार्टफोन द्वारा मुख स्क्रीनिंग पहुंचा रहे हैं।'
                    : 'Bringing non-invasive early oral mucosal screening to remote tribal habitations through ASHA health workers.'}
                </p>
                <div className="intro-tags-row">
                  <span className="intro-chip">🏡 {lang === 'te' ? 'ఇంటి వద్ద తనిఖీ' : lang === 'hi' ? 'घर पर जांच' : 'Home Visit'}</span>
                  <span className="intro-chip">📱 {lang === 'te' ? 'AI కెమెరా స్కాన్' : lang === 'hi' ? 'AI कैमरा स्कैन' : 'AI Camera Scan'}</span>
                  <span className="intro-chip">⚡ {lang === 'te' ? 'తక్షణ టెలి-రిపోర్ట్' : lang === 'hi' ? 'तुरंत डॉक्टर रिपोर्ट' : 'Instant Doctor Report'}</span>
                  <span className="intro-chip">💚 {lang === 'te' ? 'ఆరోగ్యకరమైన జీవితం' : lang === 'hi' ? 'स्वस्थ जीवन' : 'Healthy Recovery'}</span>
                </div>
              </div>
            )}

            {/* SCENE 1: HOME VISIT (Lakshmi meets Ravi) */}
            {currentStep.id === 'step-1' && (
              <div className="story-scene-home-visit animate-fade-in">
                <div className="story-split-actors">
                  {/* Lakshmi Character Card */}
                  <div className="actor-card actor-lakshmi">
                    <div className="actor-avatar-halo">
                      <span className="actor-emoji">👩‍⚕️</span>
                      <span className="actor-live-indicator" />
                    </div>
                    <div className="actor-meta">
                      <strong className="actor-name">{getLocalizedText(currentStep.dialogues[0].speakerName)}</strong>
                      <span className="actor-role-chip">{getLocalizedText(currentStep.dialogues[0].role)}</span>
                    </div>
                    <div className="actor-speech-bubble lakshmi-bubble">
                      <span className="speech-quote-icon">“</span>
                      <p>{getLocalizedText(currentStep.dialogues[0].text)}</p>
                    </div>
                  </div>

                  {/* Village Home Middle Icon */}
                  <div className="story-center-connector">
                    <div className="connector-circle">
                      <span>🏡</span>
                      <small>Home Visit</small>
                    </div>
                  </div>

                  {/* Ravi Character Card */}
                  <div className="actor-card actor-ravi">
                    <div className="actor-avatar-halo">
                      <span className="actor-emoji">👤</span>
                    </div>
                    <div className="actor-meta">
                      <strong className="actor-name">{getLocalizedText(currentStep.dialogues[1].speakerName)}</strong>
                      <span className="actor-role-chip">{getLocalizedText(currentStep.dialogues[1].role)}</span>
                    </div>
                    <div className="actor-speech-bubble ravi-bubble">
                      <span className="speech-quote-icon">“</span>
                      <p>{getLocalizedText(currentStep.dialogues[1].text)}</p>
                    </div>
                  </div>
                </div>

                <div className="story-scene-footer-action">
                  💡 <strong>{lang === 'te' ? 'లక్ష్యం:' : lang === 'hi' ? 'उद्देश्य:' : 'Clinical Action:'}</strong>{' '}
                  {getLocalizedText(currentStep.keyAction)}
                </div>
              </div>
            )}

            {/* SCENE 2: CAMERA AI SCAN (White patch found) */}
            {currentStep.id === 'step-2' && (
              <div className="story-scene-scan animate-fade-in">
                <div className="scan-layout-grid">
                  {/* Left: Lakshmi Instruction */}
                  <div className="scan-actor-box">
                    <div className="actor-card actor-lakshmi mini">
                      <div className="actor-avatar-halo">
                        <span className="actor-emoji">👩‍⚕️</span>
                      </div>
                      <div className="actor-meta">
                        <strong className="actor-name">{getLocalizedText(currentStep.dialogues[0].speakerName)}</strong>
                        <span className="actor-role-chip">{getLocalizedText(currentStep.dialogues[0].role)}</span>
                      </div>
                      <div className="actor-speech-bubble lakshmi-bubble">
                        <p>{getLocalizedText(currentStep.dialogues[0].text)}</p>
                      </div>
                    </div>

                    <div className="scan-instruction-card">
                      <h5>📱 {lang === 'te' ? 'మొబైల్ స్క్రీనింగ్ మార్గదర్శకం' : lang === 'hi' ? 'मोबाइल स्क्रीनिंग गाइड' : 'Mobile Intake Guidance'}</h5>
                      <ul>
                        <li>🔦 {lang === 'te' ? 'నోటి లోపల వెలుతురును కేంద్రీకరించండి' : lang === 'hi' ? 'मुंह के अंदर प्रकाश केंद्रित करें' : 'Adequate focal illumination'}</li>
                        <li>🔍 {lang === 'te' ? 'బుక్కల్ మ్యూకోసా & నాలుకను తనిఖీ చేయండి' : lang === 'hi' ? 'गाल की अंदरूनी परत और जीभ का निरीक्षण' : 'Bilateral buccal mucosa inspection'}</li>
                        <li>📸 {lang === 'te' ? 'స్పష్టమైన ఫోటోను సేవ్ చేయండి' : lang === 'hi' ? 'स्पष्ट फोटो कैप्चर करें' : 'Capture clear macro photograph'}</li>
                      </ul>
                    </div>
                  </div>

                  {/* Right: Smartphone Viewfinder with User's Dental Image & Laser Scan Overlay */}
                  <div className="phone-viewfinder-mockup">
                    <div className="phone-screen-top-bar">
                      <span className="phone-camera-dot" />
                      <span className="phone-hud-title">AAROGYA-DRISHTI AI CAMERA v2.4</span>
                      <span className="phone-battery">🔋 94%</span>
                    </div>

                    <div className="phone-camera-viewport">
                      {/* Clinical Dental Examination Image */}
                      <img
                        src="/assets/healthcare/dental-examination.jpg"
                        alt="Dental examination oral cavity scan"
                        className="phone-camera-feed-img"
                      />

                      {/* Animated Scanning Laser Beam */}
                      <div className="hud-laser-scan-line" />

                      {/* HUD Corner Reticles */}
                      <div className="hud-target-bracket top-left" />
                      <div className="hud-target-bracket top-right" />
                      <div className="hud-target-bracket bottom-left" />
                      <div className="hud-target-bracket bottom-right" />

                      {/* Lesion Detection Bounding Box */}
                      <div className="hud-detection-bounding-box">
                        <span className="detection-tag-pulse">AI DEMO FLAG</span>
                      </div>

                      {/* Live App Alert Dialogue Pill (Exact words: "White patch found. See a doctor.") */}
                      <div className="hud-app-alert-pill">
                        <span className="alert-bell-icon">⚠️</span>
                        <div className="alert-text-body">
                          <strong>{getLocalizedText(currentStep.dialogues[1].speakerName)}:</strong>
                          <span>{getLocalizedText(currentStep.dialogues[1].text)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="story-scene-footer-action">
                  💡 <strong>{lang === 'te' ? 'లక్ష్యం:' : lang === 'hi' ? 'उद्देश्य:' : 'Clinical Action:'}</strong>{' '}
                  {getLocalizedText(currentStep.keyAction)}
                </div>
              </div>
            )}

            {/* SCENE 3: DOCTOR TELE-REPORT SYNC */}
            {currentStep.id === 'step-3' && (
              <div className="story-scene-sync animate-fade-in">
                <div className="sync-layout-grid">
                  {/* ASHA Dispatcher Card */}
                  <div className="sync-node-card asha-node">
                    <div className="node-header">
                      <span className="node-icon">👩‍⚕️</span>
                      <div>
                        <strong>{getLocalizedText(currentStep.dialogues[0].speakerName)}</strong>
                        <small>{getLocalizedText(currentStep.dialogues[0].role)}</small>
                      </div>
                    </div>
                    <div className="actor-speech-bubble lakshmi-bubble">
                      <p>{getLocalizedText(currentStep.dialogues[0].text)}</p>
                    </div>
                    <div className="node-packet-badge">
                      🔒 SHA-256 Encrypted Sync Ledger
                    </div>
                  </div>

                  {/* Animated Sync Transmission Beam */}
                  <div className="sync-telecom-beam">
                    <div className="beam-pulse-line" />
                    <div className="beam-packet-orb">⚡</div>
                    <span className="beam-label">4G / Offline Queue Replay</span>
                  </div>

                  {/* Medical Officer Card */}
                  <div className="sync-node-card doctor-node">
                    <div className="node-header">
                      <span className="node-icon">🩺</span>
                      <div>
                        <strong>{getLocalizedText(currentStep.dialogues[1].speakerName)}</strong>
                        <small>{getLocalizedText(currentStep.dialogues[1].role)}</small>
                      </div>
                    </div>
                    <div className="actor-speech-bubble doctor-bubble">
                      <p>{getLocalizedText(currentStep.dialogues[1].text)}</p>
                    </div>
                    <div className="node-appointment-ticket">
                      📅 <strong>{lang === 'te' ? 'అపాయింట్‌మెంట్ బుక్ అయింది: సోమవారం' : lang === 'hi' ? 'परामर्श निश्चित: सोमवार' : 'Clinic Appointment: Monday 10:00 AM'}</strong>
                    </div>
                  </div>
                </div>

                <div className="story-scene-footer-action">
                  💡 <strong>{lang === 'te' ? 'లక్ష్యం:' : lang === 'hi' ? 'उद्देश्य:' : 'Clinical Action:'}</strong>{' '}
                  {getLocalizedText(currentStep.keyAction)}
                </div>
              </div>
            )}

            {/* SCENE 4: HEALTHY RECOVERY & VALUE */}
            {currentStep.id === 'step-4' && (
              <div className="story-scene-recovery animate-fade-in">
                <div className="recovery-hero-card">
                  <div className="recovery-icon-circle">💚</div>
                  <h3 className="recovery-headline">
                    {lang === 'te'
                      ? 'ముందస్తు గుర్తింపు అంటే సులభమైన చికిత్స మరియు ఆరోగ్యకరమైన జీవితం'
                      : lang === 'hi'
                      ? 'प्रारंभिक पहचान का मतलब सरल उपचार और स्वस्थ जीवन'
                      : 'Early Detection Means Simpler Treatment & a Healthier Life'}
                  </h3>

                  <div className="recovery-dialog-quote">
                    <span className="quote-avatar">👤</span>
                    <blockquote>
                      “{getLocalizedText(currentStep.dialogues[0].text)}”
                    </blockquote>
                    <span className="quote-author">— Ravi, Vankachinta Village</span>
                  </div>

                  <div className="recovery-outro-box">
                    <h4 className="outro-title">🌿 Aarogya Drishti</h4>
                    <p className="outro-lead">
                      {lang === 'te'
                        ? 'ప్రతి గ్రామానికి ముందస్తు నోటి స్క్రీనింగ్ — సురక్షితమైన రేపటి కోసం.'
                        : lang === 'hi'
                        ? 'हर गांव के लिए प्रारंभिक मुख स्क्रीनिंग — सुरक्षित और स्वस्थ भविष्य।'
                        : 'Early oral screening for every village — Protecting tribal communities across the Eastern Ghats.'}
                    </p>
                  </div>
                </div>

                <div className="story-scene-footer-action">
                  💡 <strong>{lang === 'te' ? 'లక్ష్యం:' : lang === 'hi' ? 'उद्देश्य:' : 'Clinical Action:'}</strong>{' '}
                  {getLocalizedText(currentStep.keyAction)}
                </div>
              </div>
            )}

            {/* Play / Pause Center Overlay Button (Visible on Hover/Pause) */}
            {!isPlaying && (
              <button
                type="button"
                className="procedure-play-center-btn"
                onClick={handleTogglePlay}
                aria-label="Play checkup demonstration"
              >
                <div className="play-triangle-icon" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Bottom HUD Scrubber & Playback Controls Bar */}
      <div className="procedure-hud-controls-bar">
        <div className="hud-primary-controls">
          <button
            type="button"
            className="hud-control-btn play-pause-btn"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>

          <button
            type="button"
            className="hud-control-btn mute-btn"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <button
            type="button"
            className={`hud-control-btn voice-tts-btn ${voiceSpeechEnabled && !isMuted ? 'btn-active' : ''}`}
            onClick={() => setVoiceSpeechEnabled((prev) => !prev)}
            title="Toggle Voice Narration"
          >
            🗣️ {voiceSpeechEnabled ? 'Voice ON' : 'Voice'}
          </button>

          <div className="hud-time-readout">
            <span className="time-cur">{formatSeconds(currentTime)}</span>
            <span className="time-sep">/</span>
            <span className="time-total">{formatSeconds(TOTAL_DURATION_SEC)}</span>
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="hud-scrubber-track-wrap">
          <input
            type="range"
            min={0}
            max={TOTAL_DURATION_SEC}
            value={currentTime}
            onChange={handleSeek}
            className="hud-timeline-slider"
          />
          <div className="hud-slider-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Secondary Utility Controls */}
        <div className="hud-secondary-controls">
          <button
            type="button"
            className="hud-speed-pill"
            onClick={() => setPlaybackSpeed((s) => (s === 1 ? 1.5 : s === 1.5 ? 2 : 1))}
            title="Playback Speed"
          >
            {playbackSpeed}x
          </button>

          <button
            type="button"
            className="hud-control-btn restart-btn"
            onClick={() => setCurrentTime(0)}
            title="Restart from beginning"
          >
            🔄
          </button>

          <button
            type="button"
            className="hud-control-btn fullscreen-btn"
            onClick={handleFullscreen}
            title="Fullscreen"
          >
            ⛶
          </button>
        </div>
      </div>

      {/* 4. Storyboard Chapter Step Navigation Cards (Exact WHO / Village Workflow) */}
      <div className="procedure-chapters-container">
        <div className="procedure-chapters-header">
          <span className="chapters-label">
            {lang === 'te'
              ? 'నోటి తనిఖీ దశల నావిగేషన్:'
              : lang === 'hi'
              ? 'मुख जांच चरण नेविगेशन:'
              : 'Oral Checkup Procedure Stages:'}
          </span>
          {onOpenScreeningQueue && (
            <button
              type="button"
              className="procedure-queue-link-btn"
              onClick={onOpenScreeningQueue}
            >
              🩺 {lang === 'te' ? 'స్క్రీనింగ్ ఫారమ్ తెరవండి' : lang === 'hi' ? 'स्क्रीनिंग फॉर्म खोलें' : 'Open Screening Queue'} →
            </button>
          )}
        </div>

        <div className="procedure-chapters-grid">
          {CHECKUP_STORY_STEPS.map((step) => {
            const isActive = activeStepId === step.id;
            return (
              <div
                key={step.id}
                className={`procedure-chapter-card ${isActive ? 'chapter-active' : ''}`}
                onClick={() => handleSelectStep(step)}
              >
                <div className="chapter-card-top">
                  <span className="chapter-step-badge">{step.stepNumber}</span>
                  <span className="chapter-time-pill">{step.calloutBadge}</span>
                </div>
                <h4 className="chapter-title">{getLocalizedText(step.title)}</h4>
                <p className="chapter-action-text">{getLocalizedText(step.keyAction)}</p>
                {isActive && <div className="chapter-active-glow-bar" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
