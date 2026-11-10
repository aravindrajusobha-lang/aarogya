import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LanguageCode } from '../i18n';
import { Oral3DHealthcareAnimation } from './Oral3DHealthcareAnimation';

export interface HealthcareScene {
  id: string;
  title: string;
  titleTe: string;
  titleHi: string;
  subtitle: string;
  subtitleTe: string;
  subtitleHi: string;
  accentColor: string;
  badge: string;
  ctaText: string;
  ctaTextTe: string;
  ctaTextHi: string;
  targetTab: string;
  imageSrc?: string;
}

export const FUTURISTIC_ORAL_SHORTS: HealthcareScene[] = [
  {
    id: 'dental-implant',
    title: '3D Bio-Integrated Dental Implant Restoration',
    titleTe: '3D బయో-ఇంటిగ్రేటెడ్ దంత ఇంప్లాంట్ & క్రౌన్ అమరిక',
    titleHi: '3D बायो-इंटीग्रेटेड दंत इम्प्लांट व क्राउन प्रत्यारोपण',
    subtitle: 'Precision mandibular bone osteotomy with titanium fixture insertion, internal hex abutment, and porcelain ceramic crown restoration.',
    subtitleTe: 'దవడ ఎముకలో గ్రేడ్-4 టైటానియం స్క్రూ స్థిరీకరణ, అబట్‌మెంట్ అనుసంధానం మరియు సహజ పింగాణీ దంత కిరీటం అమరిక.',
    subtitleHi: 'जबड़े की हड्डी में टाइटेनियम स्क्रू, अबटमेंट और पोर्सिलेन क्राउन की संपूर्ण 3D प्रत्यारोपण प्रक्रिया।',
    accentColor: '#10b981',
    badge: '🦷 3D IMPLANT RESTORATION',
    ctaText: 'Launch Full 3D Anatomy Model',
    ctaTextTe: '3D పూర్తి మోడల్ చూడండి',
    ctaTextHi: '3D संपूर्ण मॉडल देखें',
    targetTab: 'dashboard',
  },
  {
    id: 'oral-screening',
    title: 'AI Biophotonic Mucosa Scanner',
    titleTe: 'AI బయోఫోటోనిక్ ఓరల్ స్కానర్',
    titleHi: 'एआई बायोफोटोनिक मुख श्लेष्मा स्कैनर',
    subtitle: 'Real-time multi-spectral laser triage scanning oral mucosa for early tissue variations across tribal settlements.',
    subtitleTe: 'రియల్-టైమ్ మల్టీ-స్పెక్ట్రల్ లేజర్ ద్వారా నోటి శ్లేష్మ పొరల ముందస్తు కణజాల సమగ్రత పరిశీలన.',
    subtitleHi: 'दूरदराज के क्षेत्रों में मुख श्लेष्मा की प्रारंभिक जांच हेतु रियल-टाइम मल्टी-स्पेक्ट्रल लेजर स्कैनिंग।',
    accentColor: '#06d6a0',
    badge: '🤖 AI SCANNER 4K',
    ctaText: 'Launch AI Screening Scan',
    ctaTextTe: 'AI స్క్రీనింగ్ ప్రారంభించండి',
    ctaTextHi: 'एआई स्क्रीनिंग शुरू करें',
    targetTab: 'screening',
  },
  {
    id: 'nanobubble-hygiene',
    title: 'Ultrasonic Nanobubble Hygiene Shield',
    titleTe: 'స్మార్ట్ నానోబబుల్ రక్షణ కవచం',
    titleHi: 'अल्ट्रासोनिक नैनोबबल स्वच्छता शील्ड',
    subtitle: 'High-speed acoustic micro-cavitation dissolves biofilm, locking an ionic protective shield onto dental enamel.',
    subtitleTe: 'అల్ట్రాసోనిక్ సూక్ష్మ తరంగాలు ఫలకాన్ని తొలగించి, దంతాలపై అయానిక్ రక్షణ పొరను ఏర్పరుస్తాయి.',
    subtitleHi: 'हाई-स्पीड अल्ट्रासोनिक माइक्रोकैविटेशन प्लाक हटाकर इनेमल पर आयनिक सुरक्षा शील्ड तैयार करती है।',
    accentColor: '#38bdf8',
    badge: '🛡️ NANO-SHIELD 42kHz',
    ctaText: 'Explore Preventive Hygiene',
    ctaTextTe: 'నివారణ సంరక్షణ విధానం',
    ctaTextHi: 'निवारक स्वच्छता अन्वेषण करें',
    targetTab: 'screening',
  },
  {
    id: 'lesion-exam',
    title: 'Early Sore Triage HUD & Red-Flag Guard',
    titleTe: 'ముందస్తు పుండ్ల ట్రయాజ్ HUD & భద్రతా రక్షణ',
    titleHi: 'प्रारंभिक छाला ट्रियाज HUD व सतर्कता गाइड',
    subtitle: 'Polarized macro-sensor tracks lesion healing duration. Non-healing sores lasting > 2 weeks auto-route to Medical Officer.',
    subtitleTe: 'నోటి పుండ్ల కాలవ్యవధిని పరిశీలిస్తుంది. 2 వారాల కంటే ఎక్కువ కాలం మానని పుండ్లను వెంటనే డాక్టర్‌కు పంపుతుంది.',
    subtitleHi: 'मुख छालों की अवधि की निगरानी। 2 सप्ताह से अधिक न भरने वाले छालों को तुरंत चिकित्सा अधिकारी को रेफर करता है।',
    accentColor: '#f59e0b',
    badge: '⚡ EARLY TRIAGE HUD',
    ctaText: 'Review Screening Queue',
    ctaTextTe: 'స్క్రీనింగ్ జాబితా పరిశీలన',
    ctaTextHi: 'स्क्रीनिंग कतार देखें',
    targetTab: 'screening',
  },
  {
    id: 'oncology-care',
    title: 'Satellite Tele-Consultation Telemetry',
    titleTe: 'శాటిలైట్ టెలి-కన్సల్టేషన్ టెలిమెట్రీ',
    titleHi: 'सैटेलाइट टेली-परामर्श टेलीमेट्री',
    subtitle: 'Encrypted orbital uplink connects remote ASHA frontline workers directly with hospital dental specialists.',
    subtitleTe: 'ఎన్‌క్రిప్టెడ్ శాటిలైట్ లింక్ ద్వారా మారుమూల ఆశా కార్యకర్తలు జిల్లా దంత నిపుణులతో నేరుగా చర్చిస్తారు.',
    subtitleHi: 'सुरक्षित सैटेलाइट लिंक द्वारा दूरस्थ आशा कार्यकर्ता सीधे जिला अस्पताल के दंत विशेषज्ञों से जुड़ते हैं।',
    accentColor: '#818cf8',
    badge: '🛰️ SATELLITE TELE-LINK',
    ctaText: 'Connect Tele-Specialist',
    ctaTextTe: 'టెలి-స్పెషలిస్ట్‌ను సంప్రదించండి',
    ctaTextHi: 'टेली-विशेषज्ञ से जुड़ें',
    targetTab: 'teleconsultation',
  },
  {
    id: 'patient-recovery',
    title: 'Epithelial Wellness & Habit Freedom',
    titleTe: 'కణ పునరుద్ధరణ & వ్యసన విముక్తి కవచం',
    titleHi: 'उपकला ऊतक पुनर्जनन व व्यसन मुक्ति',
    subtitle: 'Cellular tissue revitalization tracker guides 30-day habit cessation for healthy, resilient mucosal recovery.',
    subtitleTe: '30 రోజుల వ్యసన విముక్తి ద్వారా నోటి కణజాలం వేగంగా పునరుజ్జీవనం పొంది ఆరోగ్యంగా మారుతుంది.',
    subtitleHi: '30-दिवसीय व्यसन मुक्ति ट्रैकर स्वस्थ और मजबूत श्लेष्मा पुनर्जनन को गति प्रदान करता है।',
    accentColor: '#ec4899',
    badge: '🌿 WELLNESS RECOVERY',
    ctaText: 'View Patient Registry',
    ctaTextTe: 'రోగుల రికార్డులు చూడండి',
    ctaTextHi: 'मरीज रजिस्ट्री देखें',
    targetTab: 'patients',
  },
];

interface CinematicHealthcareBackdropProps {
  onSelectScene?: (scene: HealthcareScene) => void;
  showShowcase?: boolean;
  currentLang?: LanguageCode;
}

export const CinematicHealthcareBackdrop: React.FC<CinematicHealthcareBackdropProps> = ({
  onSelectScene,
  showShowcase = true,
  currentLang = 'en',
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'3d-exploded' | 'carousel-shorts'>('3d-exploded');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(currentLang);
  const [progress, setProgress] = useState<number>(0); // 0 to 100 for current short
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  // Web Audio Synth for futuristic sci-fi sound effects
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sync prop language
  useEffect(() => {
    setSelectedLang(currentLang);
  }, [currentLang]);

  const activeScene = useMemo(() => FUTURISTIC_ORAL_SHORTS[activeIndex], [activeIndex]);
  const SHORT_DURATION_MS = 14000; // 14 seconds per short

  // Play subtle high-tech sound effect when switching or scanning
  const playFuturisticTone = useCallback(
    (type: 'switch' | 'scan' | 'laser') => {
      if (isMuted) return;
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'switch') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
        } else if (type === 'laser') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.linearRampToValueAtTime(560, now + 0.25);
          gain.gain.setValueAtTime(0.03, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
        }
      } catch {
        // Audio synthesis fallback
      }
    },
    [isMuted]
  );

  // Progressive story timeline
  useEffect(() => {
    if (isPaused) return;

    const intervalStepMs = 100;
    const increment = (intervalStepMs / SHORT_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + increment >= 100) {
          setActiveIndex((current) => (current + 1) % FUTURISTIC_ORAL_SHORTS.length);
          playFuturisticTone('switch');
          return 0;
        }
        return prev + increment;
      });
    }, intervalStepMs);

    return () => clearInterval(timer);
  }, [isPaused, playFuturisticTone]);

  const handleNext = () => {
    setProgress(0);
    setActiveIndex((prev) => (prev + 1) % FUTURISTIC_ORAL_SHORTS.length);
    playFuturisticTone('switch');
  };

  const handlePrev = () => {
    setProgress(0);
    setActiveIndex((prev) => (prev - 1 + FUTURISTIC_ORAL_SHORTS.length) % FUTURISTIC_ORAL_SHORTS.length);
    playFuturisticTone('switch');
  };

  const handleSelectShort = (index: number) => {
    setProgress(0);
    setActiveIndex(index);
    playFuturisticTone('switch');
  };

  const toggleSound = () => {
    if (isMuted) {
      setIsMuted(false);
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
        }
      } catch {
        // Ignore
      }
    } else {
      setIsMuted(true);
    }
  };

  // Card mouse movement for interactive laser tracking
  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setMousePos({ x, y });
  };

  const getLocalizedTitle = (scene: HealthcareScene) => {
    if (selectedLang === 'te') return scene.titleTe || scene.title;
    if (selectedLang === 'hi') return scene.titleHi || scene.title;
    return scene.title;
  };

  const getLocalizedSubtitle = (scene: HealthcareScene) => {
    if (selectedLang === 'te') return scene.subtitleTe || scene.subtitle;
    if (selectedLang === 'hi') return scene.subtitleHi || scene.subtitle;
    return scene.subtitle;
  };

  const getLocalizedCta = (scene: HealthcareScene) => {
    if (selectedLang === 'te') return scene.ctaTextTe || scene.ctaText;
    if (selectedLang === 'hi') return scene.ctaTextHi || scene.ctaText;
    return scene.ctaText;
  };

  return (
    <div className="cinematic-backdrop-root futuristic-shorts-root">
      {/* 1. Deep Atmospheric Background & Iridescent Aurora Waves */}
      <div className="cinematic-ambient-void" aria-hidden="true">
        <div
          className="cinematic-dynamic-glow"
          style={{
            background: `radial-gradient(circle at 60% 30%, ${activeScene.accentColor}33 0%, transparent 70%)`,
          }}
        />
        <div className="cinematic-aurora-ribbon ribbon-1" />
        <div className="cinematic-aurora-ribbon ribbon-2" />
        <div className="cinematic-aurora-ribbon ribbon-3" />
        <div className="cinematic-vignette-overlay" />
        <div className="cinematic-mesh-grid" />
      </div>

      {showShowcase && (
        <div
          className="cinematic-showcase-container"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* TOP STORY BAR: Segmented progress bars (Stories / Shorts format) */}
          <div className="shorts-timeline-segmented-bar" role="progressbar" aria-label="Shorts Story Progress">
            {FUTURISTIC_ORAL_SHORTS.map((scene, idx) => {
              let fillPercent = 0;
              if (idx < activeIndex) fillPercent = 100;
              else if (idx === activeIndex) fillPercent = progress;

              return (
                <div
                  key={`segment-${scene.id}`}
                  className={`story-segment-track ${idx === activeIndex ? 'active' : ''}`}
                  onClick={() => handleSelectShort(idx)}
                  title={getLocalizedTitle(scene)}
                >
                  <div
                    className="story-segment-fill"
                    style={{
                      width: `${fillPercent}%`,
                      backgroundColor: scene.accentColor,
                      boxShadow: idx === activeIndex ? `0 0 10px ${scene.accentColor}` : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* TOP CONTROL BAR: Status HUD, Language Switcher, Sound & Controls */}
          <div className="cinematic-showcase-header shorts-header-bar">
            <div className="shorts-header-left">
              <span className="live-rec-dot" />
              {/* Mode Switcher Pill */}
              <div className="shorts-lang-toggle-group" style={{ marginRight: '6px' }}>
                <button
                  type="button"
                  className={`shorts-lang-btn ${viewMode === '3d-exploded' ? 'active' : ''}`}
                  onClick={() => setViewMode('3d-exploded')}
                  title="3D Exploded Technical Anatomy (Anime.js v4)"
                >
                  🧬 3D EXPLODED MODEL
                </button>
                <button
                  type="button"
                  className={`shorts-lang-btn ${viewMode === 'carousel-shorts' ? 'active' : ''}`}
                  onClick={() => setViewMode('carousel-shorts')}
                  title="Cinematic Oral Care Shorts"
                >
                  🎬 ORAL CARE SHORTS
                </button>
              </div>
              <span className="shorts-scene-pill" style={{ borderColor: `${activeScene.accentColor}66`, color: activeScene.accentColor }}>
                {viewMode === '3d-exploded' ? 'ANIME.JS V4 • 3D HUD' : activeScene.badge}
              </span>
            </div>

            <div className="cinematic-playback-controls">
              {/* Language Switcher */}
              <div className="shorts-lang-toggle-group">
                <button
                  type="button"
                  className={`shorts-lang-btn ${selectedLang === 'en' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('en')}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={`shorts-lang-btn ${selectedLang === 'te' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('te')}
                >
                  తెలుగు
                </button>
                <button
                  type="button"
                  className={`shorts-lang-btn ${selectedLang === 'hi' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('hi')}
                >
                  हिंदी
                </button>
              </div>

              {/* Sound Synth Toggle */}
              <button
                type="button"
                className={`cinematic-ctrl-btn sound-btn ${!isMuted ? 'active-sound' : ''}`}
                onClick={toggleSound}
                title={isMuted ? 'Unmute Futuristic Audio Synth' : 'Mute Audio Synth'}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>

              {/* Prev / Play / Next */}
              <button
                type="button"
                className="cinematic-ctrl-btn"
                onClick={handlePrev}
                title="Previous Short"
                aria-label="Previous short"
              >
                ◀
              </button>
              <button
                type="button"
                className="cinematic-ctrl-btn play-pause-btn"
                onClick={() => setIsPaused(!isPaused)}
                title={isPaused ? 'Resume Short' : 'Pause Short'}
                aria-label={isPaused ? 'Resume short' : 'Pause short'}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
              <button
                type="button"
                className="cinematic-ctrl-btn"
                onClick={handleNext}
                title="Next Short"
                aria-label="Next short"
              >
                ▶
              </button>
            </div>
          </div>

          {viewMode === '3d-exploded' ? (
            <div style={{ marginTop: '12px' }}>
              <Oral3DHealthcareAnimation
                currentLang={selectedLang}
                initialTheme="cyber"
                onLayerSelect={(_layerId) => {
                  if (onSelectScene) onSelectScene(activeScene);
                }}
              />
            </div>
          ) : (
            <>
              {/* 3D PERSPECTIVE FLOATING CAROUSEL DECK */}
              <div className="cinematic-3d-deck">
                {/* Left Deck Arrow */}
                <button
                  type="button"
                  className="cinematic-side-nav-btn nav-btn-left"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrev();
                  }}
                  title="Previous Short"
                  aria-label="Previous short"
                >
                  ‹
                </button>

                {FUTURISTIC_ORAL_SHORTS.map((scene, index) => {
                  const diff = (index - activeIndex + FUTURISTIC_ORAL_SHORTS.length) % FUTURISTIC_ORAL_SHORTS.length;
                  let positionClass = 'scene-hidden';

                  if (diff === 0) {
                    positionClass = 'scene-active';
                  } else if (diff === 1 || diff === -4) {
                    positionClass = 'scene-next';
                  } else if (diff === FUTURISTIC_ORAL_SHORTS.length - 1 || diff === -1) {
                    positionClass = 'scene-prev';
                  }

                  const isActive = diff === 0;

                  return (
                    <div
                      key={scene.id}
                      className={`cinematic-card ${positionClass} futuristic-short-card`}
                      onClick={() => {
                        if (isActive) {
                          if (onSelectScene) onSelectScene(scene);
                        } else {
                          handleSelectShort(index);
                        }
                      }}
                      onMouseMove={isActive ? handleCardMouseMove : undefined}
                      style={{
                        borderColor: isActive ? `${scene.accentColor}88` : 'rgba(255, 255, 255, 0.12)',
                        boxShadow: isActive ? `0 25px 60px -10px rgba(0,0,0,0.85), 0 0 35px ${scene.accentColor}33` : undefined,
                      }}
                    >
                      <div className="cinematic-card-image-wrap animated-short-stage">
                        {/* DYNAMIC ANIMATED SHORT STAGES */}
                        {scene.id === 'dental-implant' && (
                          <ShortDentalImplantPlacement
                            isActive={isActive}
                            accentColor={scene.accentColor}
                            onSwitchTo3D={() => setViewMode('3d-exploded')}
                          />
                        )}

                        {scene.id === 'oral-screening' && (
                          <ShortAiScanner mouseX={mousePos.x} mouseY={mousePos.y} isActive={isActive} accentColor={scene.accentColor} />
                        )}

                        {scene.id === 'nanobubble-hygiene' && (
                          <ShortNanobubble isActive={isActive} accentColor={scene.accentColor} />
                        )}

                        {scene.id === 'lesion-exam' && (
                          <ShortEarlyTriage mouseX={mousePos.x} mouseY={mousePos.y} isActive={isActive} accentColor={scene.accentColor} />
                        )}

                        {scene.id === 'oncology-care' && (
                          <ShortSatelliteTelehealth isActive={isActive} accentColor={scene.accentColor} />
                        )}

                        {scene.id === 'patient-recovery' && (
                          <ShortWellnessRecovery isActive={isActive} accentColor={scene.accentColor} />
                        )}

                        {/* HUD OVERLAY HEADER (Top inside active short) */}
                        <div className="short-inner-hud-header">
                          <div className="short-hud-badge-wrap">
                            <span className="short-step-num">0{index + 1} / 0{FUTURISTIC_ORAL_SHORTS.length}</span>
                            <h3 className="short-hud-title">{getLocalizedTitle(scene)}</h3>
                          </div>
                          <div className="short-hud-telemetry-tag">
                            <span className="hud-blip-dot" style={{ backgroundColor: scene.accentColor }} />
                            <span>ASR-60FPS // LIVE TELEMETRY</span>
                          </div>
                        </div>

                        {/* SUBTITLE & ACTION CTA (Bottom inside active short) */}
                        <div className="short-inner-hud-footer">
                          <div className="short-subtitle-bubble">
                            <span className="subtitle-icon">💬</span>
                            <p className="subtitle-text">{getLocalizedSubtitle(scene)}</p>
                          </div>

                          <div className="short-cta-action-row">
                            <button
                              type="button"
                              className="short-cta-btn"
                              style={{
                                background: `linear-gradient(135deg, ${scene.accentColor} 0%, #064e3b 100%)`,
                                boxShadow: `0 4px 18px ${scene.accentColor}55`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (scene.id === 'dental-implant') {
                                  setViewMode('3d-exploded');
                                } else if (onSelectScene) {
                                  onSelectScene(scene);
                                }
                              }}
                            >
                              <span>{getLocalizedCta(scene)}</span>
                              <span className="btn-arrow-icon">→</span>
                            </button>
                          </div>
                        </div>

                        {/* Glare & Vignette */}
                        <div className="cinematic-card-glare" />
                        <div className="cinematic-card-shadow-rim" />
                      </div>
                    </div>
                  );
                })}

                {/* Right Deck Arrow */}
                <button
                  type="button"
                  className="cinematic-side-nav-btn nav-btn-right"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  title="Next Short"
                  aria-label="Next short"
                >
                  ›
                </button>
              </div>

              {/* SCENE PROGRESS DOTS & SHORT TITLES */}
              <div className="cinematic-dots-row shorts-dots-pills">
                {FUTURISTIC_ORAL_SHORTS.map((scene, index) => (
                  <button
                    key={`dot-${scene.id}`}
                    type="button"
                    className={`cinematic-dot short-pill-dot ${index === activeIndex ? 'active' : ''}`}
                    onClick={() => handleSelectShort(index)}
                    style={{
                      backgroundColor: index === activeIndex ? scene.accentColor : 'rgba(255, 255, 255, 0.22)',
                      boxShadow: index === activeIndex ? `0 0 14px ${scene.accentColor}` : 'none',
                    }}
                    title={getLocalizedTitle(scene)}
                    aria-label={`Short ${index + 1}: ${scene.title}`}
                  >
                    {index === activeIndex && (
                      <span className="dot-title-preview">{getLocalizedTitle(scene).split(' ')[0]}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   ANIMATED SHORT 1: AI BIOPHOTONIC MUCOSA SCANNER (Holographic Laser Sweep)
   ========================================================================== */
const ShortAiScanner: React.FC<{ mouseX: number; mouseY: number; isActive: boolean; accentColor: string }> = ({
  mouseX,
  mouseY,
  isActive,
  accentColor,
}) => {
  return (
    <div className={`short-stage-viewport stage-scanner ${isActive ? 'anim-active' : ''}`}>
      <svg viewBox="0 0 800 480" className="futuristic-svg-stage" fill="none">
        <defs>
          <linearGradient id="laserGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0" />
            <stop offset="50%" stopColor={accentColor} stopOpacity="0.85" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>

          <radialGradient id="laserSpot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.9" />
            <stop offset="60%" stopColor={accentColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </radialGradient>

          <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Cyber Grid Matrix */}
        <g opacity="0.18">
          <line x1="100" y1="60" x2="700" y2="60" stroke="#38bdf8" strokeDasharray="4 6" />
          <line x1="100" y1="140" x2="700" y2="140" stroke="#38bdf8" strokeDasharray="4 6" />
          <line x1="100" y1="220" x2="700" y2="220" stroke="#38bdf8" strokeDasharray="4 6" />
          <line x1="100" y1="300" x2="700" y2="300" stroke="#38bdf8" strokeDasharray="4 6" />
          <line x1="100" y1="380" x2="700" y2="380" stroke="#38bdf8" strokeDasharray="4 6" />
          <line x1="200" y1="40" x2="200" y2="420" stroke="#38bdf8" strokeDasharray="4 6" />
          <line x1="400" y1="40" x2="400" y2="420" stroke="#38bdf8" strokeDasharray="4 6" />
          <line x1="600" y1="40" x2="600" y2="420" stroke="#38bdf8" strokeDasharray="4 6" />
        </g>

        {/* 2. Holographic Oral Cavity Contour */}
        <g transform="translate(400, 230)">
          {/* Outer Dental Arch Wireframe */}
          <path
            d="M -180 80 C -190 -80, -90 -160, 0 -160 C 90 -160, 190 -80, 180 80 C 170 120, 110 140, 0 140 C -110 140, -170 120, -180 80 Z"
            stroke="rgba(56, 189, 248, 0.35)"
            strokeWidth="2"
            fill="rgba(6, 78, 59, 0.15)"
          />

          {/* Tongue Dorsum Contour */}
          <path
            d="M -90 40 C -90 -30, -50 -80, 0 -80 C 50 -80, 90 -30, 90 40 C 80 80, 50 100, 0 100 C -50 100, -80 80, -90 40 Z"
            stroke={accentColor}
            strokeWidth="1.8"
            fill="rgba(6, 214, 160, 0.12)"
            strokeDasharray="6 4"
            className="anim-pulse-wire"
          />

          {/* Holographic Teeth Array Nodes */}
          {[-140, -110, -80, -50, -20, 20, 50, 80, 110, 140].map((tx, idx) => {
            const ty = -140 + Math.abs(tx) * 0.45;
            return (
              <g key={`tooth-${idx}`} transform={`translate(${tx}, ${ty})`}>
                <rect x="-8" y="-6" width="16" height="12" rx="3" stroke="rgba(255, 255, 255, 0.45)" strokeWidth="1.2" fill="rgba(255, 255, 255, 0.15)" />
                <circle cx="0" cy="0" r="1.5" fill="#38bdf8" />
              </g>
            );
          })}
        </g>

        {/* 3. Sweeping Laser Beam (Moves up and down with CSS animation) */}
        <g className="laser-sweep-group" filter="url(#laserGlow)">
          <line x1="80" y1="0" x2="720" y2="0" stroke={accentColor} strokeWidth="3" opacity="0.9" />
          <rect x="80" y="-12" width="640" height="24" fill="url(#laserGrad)" opacity="0.75" />
        </g>

        {/* 4. Mouse-tracking Biophotonic Focus Ring */}
        <g transform={`translate(${8 * mouseX}, ${4.8 * mouseY})`} className="mouse-focus-reticle">
          <circle cx="0" cy="0" r="32" stroke={accentColor} strokeWidth="1.5" strokeDasharray="8 6" className="anim-rotate-ring" />
          <circle cx="0" cy="0" r="8" fill="url(#laserSpot)" />
          <line x1="-42" y1="0" x2="-14" y2="0" stroke={accentColor} strokeWidth="1.5" />
          <line x1="14" y1="0" x2="42" y2="0" stroke={accentColor} strokeWidth="1.5" />
          <line x1="0" y1="-42" x2="0" y2="-14" stroke={accentColor} strokeWidth="1.5" />
          <line x1="0" y1="14" x2="0" y2="42" stroke={accentColor} strokeWidth="1.5" />
          <text x="18" y="-18" fill={accentColor} fontSize="11" fontFamily="monospace" fontWeight="bold">
            SCAN // 99.4%
          </text>
        </g>

        {/* 5. AI Bounding Triage Boxes */}
        <g transform="translate(240, 160)" className="triage-box box-1">
          <rect x="0" y="0" width="105" height="42" rx="4" stroke={accentColor} strokeWidth="1.4" fill="rgba(6, 78, 59, 0.35)" />
          <text x="8" y="16" fill="#34d399" fontSize="10" fontFamily="monospace" fontWeight="700">R-BUCCAL: OPTIMAL</text>
          <text x="8" y="32" fill="#cbd5e1" fontSize="9" fontFamily="monospace">MICRO-REFLECT: 98%</text>
        </g>

        <g transform="translate(480, 260)" className="triage-box box-2">
          <rect x="0" y="0" width="115" height="42" rx="4" stroke="#38bdf8" strokeWidth="1.4" fill="rgba(15, 23, 42, 0.55)" />
          <text x="8" y="16" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="700">L-TONGUE: HEALTHY</text>
          <text x="8" y="32" fill="#cbd5e1" fontSize="9" fontFamily="monospace">VASCULARITY: CLEAR</text>
        </g>

        {/* 6. Live Telemetry Waveform Bar at Bottom */}
        <path
          d="M 120 410 Q 180 390, 240 410 T 360 410 T 480 395 T 600 410 T 680 405"
          stroke={accentColor}
          strokeWidth="2"
          fill="none"
          opacity="0.8"
          className="anim-wave-flow"
        />
      </svg>
    </div>
  );
};

/* ==========================================================================
   ANIMATED SHORT 2: ULTRASONIC NANOBUBBLE HYGIENE SHIELD
   ========================================================================== */
const ShortNanobubble: React.FC<{ isActive: boolean; accentColor: string }> = ({ isActive, accentColor }) => {
  return (
    <div className={`short-stage-viewport stage-nanobubble ${isActive ? 'anim-active' : ''}`}>
      <svg viewBox="0 0 800 480" className="futuristic-svg-stage" fill="none">
        <defs>
          <radialGradient id="bubbleGlow" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#38bdf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
          </radialGradient>
        </defs>

        {/* 1. Concentric Ultrasonic Shockwaves */}
        <g transform="translate(400, 220)">
          <circle cx="0" cy="0" r="70" stroke={accentColor} strokeWidth="1.5" opacity="0.7" className="anim-sonic-wave wave-1" />
          <circle cx="0" cy="0" r="130" stroke={accentColor} strokeWidth="1.2" opacity="0.5" className="anim-sonic-wave wave-2" />
          <circle cx="0" cy="0" r="190" stroke={accentColor} strokeWidth="1" opacity="0.3" className="anim-sonic-wave wave-3" />
        </g>

        {/* 2. Pearlescent Teeth Dental Arc */}
        <g transform="translate(400, 220)">
          <path
            d="M -160 50 C -170 -60, -80 -120, 0 -120 C 80 -120, 170 -60, 160 50"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="38"
            strokeLinecap="round"
            fill="none"
          />

          {/* Individual Pearlescent Teeth Nodes */}
          {[-120, -80, -40, 0, 40, 80, 120].map((tx, idx) => {
            const ty = -110 + Math.abs(tx) * 0.4;
            return (
              <g key={`enamel-${idx}`} transform={`translate(${tx}, ${ty})`}>
                <rect x="-14" y="-18" width="28" height="36" rx="8" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" />
                <path d="M -8 -10 L 8 -10" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="1.5" />
                <circle cx="-5" cy="-8" r="2" fill="#ffffff" />
              </g>
            );
          })}

          {/* Hexagonal Fluoride Nano-Shield Grid Overlay */}
          <g className="anim-shield-pulse" opacity="0.85">
            <polygon points="0,-160 30,-140 30,-110 0,-90 -30,-110 -30,-140" stroke={accentColor} strokeWidth="1.5" fill="rgba(56, 189, 248, 0.12)" />
            <polygon points="60,-130 90,-110 90,-80 60,-60 30,-80 30,-110" stroke={accentColor} strokeWidth="1.5" fill="rgba(56, 189, 248, 0.12)" />
            <polygon points="-60,-130 -30,-110 -30,-80 -60,-60 -90,-80 -90,-110" stroke={accentColor} strokeWidth="1.5" fill="rgba(56, 189, 248, 0.12)" />
          </g>
        </g>

        {/* 3. Floating Micro-Cavitation Nanobubbles (16 dynamic bubbles) */}
        {[
          { cx: 280, cy: 170, r: 18, delay: '0s' },
          { cx: 330, cy: 130, r: 12, delay: '0.4s' },
          { cx: 480, cy: 140, r: 16, delay: '0.8s' },
          { cx: 520, cy: 190, r: 14, delay: '0.2s' },
          { cx: 370, cy: 260, r: 22, delay: '0.6s' },
          { cx: 430, cy: 250, r: 19, delay: '1s' },
          { cx: 230, cy: 220, r: 11, delay: '1.2s' },
          { cx: 570, cy: 220, r: 13, delay: '0.5s' },
        ].map((b, i) => (
          <circle
            key={`nb-${i}`}
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fill="url(#bubbleGlow)"
            stroke="#ffffff"
            strokeWidth="0.8"
            className="anim-bubble-float"
            style={{ animationDelay: b.delay }}
          />
        ))}

        {/* 4. Telemetry Dial: Quadrant Timer HUD */}
        <g transform="translate(640, 160)">
          <circle cx="0" cy="0" r="42" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="4" />
          <circle cx="0" cy="0" r="42" stroke="#38bdf8" strokeWidth="4" strokeDasharray="260" strokeDashoffset="65" className="anim-quad-timer" />
          <text x="0" y="-4" fill="#ffffff" fontSize="13" fontWeight="bold" textAnchor="middle">02:00</text>
          <text x="0" y="14" fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="monospace">SONIC 42kHz</text>
        </g>
      </svg>
    </div>
  );
};

/* ==========================================================================
   ANIMATED SHORT 3: EARLY SORE TRIAGE HUD & RED-FLAG GUARD
   ========================================================================== */
const ShortEarlyTriage: React.FC<{ mouseX: number; mouseY: number; isActive: boolean; accentColor: string }> = ({
  mouseX,
  mouseY,
  isActive,
  accentColor,
}) => {
  return (
    <div className={`short-stage-viewport stage-triage ${isActive ? 'anim-active' : ''}`}>
      <svg viewBox="0 0 800 480" className="futuristic-svg-stage" fill="none">
        <defs>
          <radialGradient id="aphtousSpot" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fca5a5" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#f87171" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Polarized Macro Viewfinder Reticle */}
        <g stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5">
          {/* Frame Corners */}
          <path d="M 120 120 L 120 80 L 160 80" />
          <path d="M 680 120 L 680 80 L 640 80" />
          <path d="M 120 340 L 120 380 L 160 380" />
          <path d="M 680 340 L 680 380 L 640 380" />
        </g>

        {/* 2. Micro-Polarized Mucosal Surface Simulation */}
        <g transform="translate(400, 230)">
          {/* Pink Mucosal Base Tissue */}
          <ellipse cx="0" cy="0" rx="240" ry="130" fill="rgba(244, 63, 94, 0.08)" stroke="rgba(244, 63, 94, 0.2)" strokeWidth="1.5" />

          {/* Micro-Vascular Capillary Strands */}
          <path d="M -180 -20 Q -100 -50, -40 -10 T 60 -40 T 160 -10" stroke="rgba(239, 68, 68, 0.35)" strokeWidth="1.2" fill="none" />
          <path d="M -160 30 Q -80 60, 20 20 T 140 40" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="1" fill="none" />

          {/* Simulated Observation Lesion / Aphtous Sore Spot */}
          <g transform={`translate(${mouseX * 1.5 - 75}, ${mouseY * 0.8 - 40})`} className="lesion-tracker-node">
            <circle cx="0" cy="0" r="34" fill="url(#aphtousSpot)" />
            <circle cx="0" cy="0" r="18" fill="rgba(255, 255, 255, 0.25)" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 3" />
            <circle cx="0" cy="0" r="4" fill="#ffffff" />

            {/* Tracking Calipers */}
            <line x1="-32" y1="-32" x2="-22" y2="-32" stroke={accentColor} strokeWidth="1.5" />
            <line x1="-32" y1="-32" x2="-32" y2="-22" stroke={accentColor} strokeWidth="1.5" />
            <line x1="32" y1="32" x2="22" y2="32" stroke={accentColor} strokeWidth="1.5" />
            <line x1="32" y1="32" x2="32" y2="22" stroke={accentColor} strokeWidth="1.5" />

            {/* Real-time Triage Tag */}
            <g transform="translate(44, -20)">
              <rect x="0" y="0" width="138" height="48" rx="6" fill="rgba(15, 23, 42, 0.88)" stroke={accentColor} strokeWidth="1.4" />
              <text x="8" y="16" fill={accentColor} fontSize="10" fontFamily="monospace" fontWeight="bold">APHTOUS OBSERVATION</text>
              <text x="8" y="30" fill="#38bdf8" fontSize="9" fontFamily="monospace">DAY: 4 (&lt; 14 DAYS)</text>
              <text x="8" y="42" fill="#94a3b8" fontSize="8" fontFamily="monospace">STATUS: BENIGN TRIAGE</text>
            </g>
          </g>
        </g>

        {/* 3. Clinical 14-Day Timeline Meter HUD */}
        <g transform="translate(160, 390)">
          <rect x="0" y="0" width="480" height="24" rx="12" fill="rgba(15, 23, 42, 0.7)" stroke="rgba(255, 255, 255, 0.15)" />
          {/* Green zone (0-7 days) */}
          <rect x="2" y="2" width="160" height="20" rx="10" fill="rgba(16, 185, 129, 0.4)" />
          {/* Amber zone (7-14 days) */}
          <rect x="162" y="2" width="158" height="20" fill="rgba(245, 158, 11, 0.4)" />
          {/* Red Flag zone (>14 days) */}
          <rect x="320" y="2" width="158" height="20" rx="10" fill="rgba(239, 68, 68, 0.4)" />

          <text x="80" y="16" fill="#6ee7b7" fontSize="9" textAnchor="middle" fontWeight="bold">0-7D: OBSERVATION</text>
          <text x="240" y="16" fill="#fde68a" fontSize="9" textAnchor="middle" fontWeight="bold">7-14D: RE-EVALUATE</text>
          <text x="400" y="16" fill="#fca5a5" fontSize="9" textAnchor="middle" fontWeight="bold">&gt;14D: MO TELE-ROUTE ⚠️</text>
        </g>
      </svg>
    </div>
  );
};

/* ==========================================================================
   ANIMATED SHORT 4: SATELLITE TELE-CONSULTATION TELEMETRY
   ========================================================================== */
const ShortSatelliteTelehealth: React.FC<{ isActive: boolean; accentColor: string }> = ({ isActive, accentColor }) => {
  return (
    <div className={`short-stage-viewport stage-satellite ${isActive ? 'anim-active' : ''}`}>
      <svg viewBox="0 0 800 480" className="futuristic-svg-stage" fill="none">
        {/* 1. Cyber Contour Mountain Valleys (ASR District) */}
        <g stroke="rgba(129, 140, 248, 0.25)" strokeWidth="1.4">
          <path d="M 80 380 Q 200 280, 320 340 T 560 300 T 720 370" fill="none" />
          <path d="M 60 410 Q 180 320, 340 370 T 580 330 T 740 400" fill="none" />
          <path d="M 40 440 Q 220 350, 380 400 T 620 360 T 760 430" fill="none" />
        </g>

        {/* 2. Orbital Satellite Node (Top-Center) */}
        <g transform="translate(400, 100)" className="satellite-orbital-node">
          {/* Solar Panels */}
          <rect x="-60" y="-10" width="36" height="20" rx="2" fill="#38bdf8" stroke="#818cf8" strokeWidth="1.5" />
          <rect x="24" y="-10" width="36" height="20" rx="2" fill="#38bdf8" stroke="#818cf8" strokeWidth="1.5" />
          {/* Main Chassis */}
          <rect x="-18" y="-14" width="36" height="28" rx="4" fill="#0f172a" stroke="#818cf8" strokeWidth="2" />
          <circle cx="0" cy="0" r="6" fill={accentColor} />

          {/* Sweeping Uplink Pulse Beams */}
          <line x1="-12" y1="14" x2="-180" y2="240" stroke={accentColor} strokeWidth="1.8" strokeDasharray="6 4" className="anim-uplink-left" />
          <line x1="12" y1="14" x2="180" y2="240" stroke={accentColor} strokeWidth="1.8" strokeDasharray="6 4" className="anim-uplink-right" />
        </g>

        {/* 3. Frontline ASHA Hamlet Node (Left - Dumbriguda) */}
        <g transform="translate(220, 340)">
          <circle cx="0" cy="0" r="38" fill="rgba(15, 23, 42, 0.85)" stroke="#38bdf8" strokeWidth="2" />
          <text x="0" y="-8" fontSize="22" textAnchor="middle">👩‍⚕️</text>
          <text x="0" y="16" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">ASHA WORKER</text>
          <text x="0" y="27" fill="#94a3b8" fontSize="8" textAnchor="middle">DUMBRIGUDA</text>
        </g>

        {/* 4. Specialist District Hospital Node (Right - Paderu CHC) */}
        <g transform="translate(580, 340)">
          <circle cx="0" cy="0" r="38" fill="rgba(15, 23, 42, 0.85)" stroke="#818cf8" strokeWidth="2" />
          <text x="0" y="-8" fontSize="22" textAnchor="middle">👨‍⚕️</text>
          <text x="0" y="16" fill="#818cf8" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">MO DENTIST</text>
          <text x="0" y="27" fill="#94a3b8" fontSize="8" textAnchor="middle">PADERU CHC</text>
        </g>

        {/* 5. Live Audio Spectrum Equalizer (Center) */}
        <g transform="translate(400, 320)" className="tele-audio-spectrum">
          {[-45, -30, -15, 0, 15, 30, 45].map((bx, i) => (
            <rect
              key={`bar-${i}`}
              x={bx - 4}
              y={-18 - (i % 3) * 8}
              width="8"
              height={36 + (i % 3) * 16}
              rx="4"
              fill={accentColor}
              className="anim-spectrum-bar"
              style={{ animationDelay: `${i * 0.12}s` }}
            />
          ))}
          <text x="0" y="32" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
            OPUS 48kHz // SHA-256 VERIFIED
          </text>
        </g>
      </svg>
    </div>
  );
};

/* ==========================================================================
   ANIMATED SHORT 5: EPITHELIAL WELLNESS & HABIT FREEDOM
   ========================================================================== */
const ShortWellnessRecovery: React.FC<{ isActive: boolean; accentColor: string }> = ({ isActive, accentColor }) => {
  return (
    <div className={`short-stage-viewport stage-wellness ${isActive ? 'anim-active' : ''}`}>
      <svg viewBox="0 0 800 480" className="futuristic-svg-stage" fill="none">
        <defs>
          <radialGradient id="cellGlow" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#f472b6" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#ec4899" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#831843" stopOpacity="0.1" />
          </radialGradient>
        </defs>

        {/* 1. Vital Regeneration Orbs Matrix (Cellular Mitosis) */}
        <g transform="translate(400, 210)">
          {/* Main Regenerating Core */}
          <circle cx="0" cy="0" r="75" fill="rgba(236, 72, 153, 0.15)" stroke={accentColor} strokeWidth="2" strokeDasharray="6 4" className="anim-rotate-ring" />
          <circle cx="0" cy="0" r="48" fill="url(#cellGlow)" />
          <text x="0" y="6" fill="#ffffff" fontSize="26" textAnchor="middle">🌿</text>

          {/* Orbiting Regenerated Epithelial Cells */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const cx = Math.cos(rad) * 115;
            const cy = Math.sin(rad) * 115;
            return (
              <g key={`cell-${i}`} transform={`translate(${cx}, ${cy})`} className="anim-cell-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
                <circle cx="0" cy="0" r="16" fill="rgba(236, 72, 153, 0.6)" stroke="#fbcfe8" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="6" fill="#ffffff" />
              </g>
            );
          })}
        </g>

        {/* 2. Habit Cessation Milestone HUD (Left) */}
        <g transform="translate(180, 160)">
          <rect x="0" y="0" width="130" height="54" rx="8" fill="rgba(15, 23, 42, 0.85)" stroke="#10b981" strokeWidth="1.5" />
          <text x="12" y="18" fill="#34d399" fontSize="10" fontWeight="bold" fontFamily="monospace">HABIT FREE: 30D</text>
          <text x="12" y="34" fill="#ffffff" fontSize="12" fontWeight="700">TOBACCO-FREE</text>
          <text x="12" y="46" fill="#94a3b8" fontSize="8" fontFamily="monospace">MUCOSAL RENEWAL</text>
        </g>

        {/* 3. Vital Biometrics Gauge (Right) */}
        <g transform="translate(620, 210)">
          <circle cx="0" cy="0" r="42" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="4" />
          <circle cx="0" cy="0" r="42" stroke={accentColor} strokeWidth="4" strokeDasharray="260" strokeDashoffset="40" />
          <text x="0" y="-2" fill="#ffffff" fontSize="14" fontWeight="bold" textAnchor="middle">98%</text>
          <text x="0" y="14" fill={accentColor} fontSize="8" textAnchor="middle" fontFamily="monospace">RECOVERY</text>
        </g>

        {/* 4. Bottom Wellness Banner */}
        <g transform="translate(240, 385)">
          <rect x="0" y="0" width="320" height="30" rx="15" fill="rgba(6, 78, 59, 0.45)" stroke="rgba(52, 211, 153, 0.4)" />
          <text x="160" y="19" fill="#a7f3d0" fontSize="11" fontWeight="600" textAnchor="middle">
            ✨ Complete Epithelial Health Restored
          </text>
        </g>
      </svg>
    </div>
  );
};

/* ==========================================================================
   ANIMATED SHORT 0: 3D DENTAL IMPLANT & CROWN RESTORATION (Image 2 Match)
   ========================================================================== */
interface ShortDentalImplantPlacementProps {
  isActive: boolean;
  accentColor: string;
  onSwitchTo3D?: () => void;
}

const ShortDentalImplantPlacement: React.FC<ShortDentalImplantPlacementProps> = ({
  isActive,
  accentColor,
  onSwitchTo3D,
}) => {
  return (
    <div className={`short-stage-viewport stage-implant ${isActive ? 'anim-active' : ''}`}>
      <svg viewBox="0 0 800 480" className="futuristic-svg-stage" fill="none">
        <defs>
          {/* Metallic Gradients for Grade-4 Titanium Screw */}
          <linearGradient id="titaniumScrewGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="25%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#cbd5e1" />
            <stop offset="75%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Abutment Metallic Gradient */}
          <linearGradient id="abutmentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="35%" stopColor="#e2e8f0" />
            <stop offset="60%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Natural Ceramic Porcelain Crown Gradient */}
          <linearGradient id="crownGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#f8fafc" />
            <stop offset="85%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          {/* Natural Pink Gingival Gum Gradient */}
          <linearGradient id="gumTissueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="45%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>

          {/* Alveolar Bone Cross-Section Cutaway Gradient */}
          <linearGradient id="boneCutawayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="30%" stopColor="#fef3c7" />
            <stop offset="70%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Docking Spark Radial Glow */}
          <radialGradient id="dockGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. Alveolar Bone Cross-Section Window (Trabecular Architecture) */}
        <g id="bone-cutaway-group">
          {/* Bone socket window path */}
          <path
            d="M 120 440 L 120 310 C 220 310, 290 305, 345 305 C 352 320, 360 415, 400 422 C 440 415, 448 320, 455 305 C 510 305, 580 310, 680 310 L 680 440 Z"
            fill="url(#boneCutawayGrad)"
            stroke="#f59e0b"
            strokeWidth="1.5"
            className="bone-trabecular-glow"
          />

          {/* Trabecular Bone Micro-Porous Texture Pattern */}
          <g opacity="0.35" stroke="#92400e" strokeWidth="1">
            {[-80, -40, 0, 40, 80].map((dx, i) => (
              <path
                key={`trab-${i}`}
                d={`M ${400 + dx} 330 Q ${410 + dx} 360, ${395 + dx} 390 T ${405 + dx} 420`}
                fill="none"
              />
            ))}
          </g>

          {/* Osteotomy Socket Channel Outline */}
          <path
            d="M 370 305 C 370 340, 375 390, 400 412 C 425 390, 430 340, 430 305 Z"
            fill="rgba(15, 23, 42, 0.45)"
            stroke="rgba(245, 158, 11, 0.6)"
            strokeWidth="1.2"
            strokeDasharray="4 2"
          />
        </g>

        {/* 2. Concentric Osseointegration Radiating Waves */}
        <g id="osseo-waves-group">
          <circle cx="400" cy="355" r="45" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6 4" className="anim-osseo-ring-1" />
          <circle cx="400" cy="355" r="70" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="8 6" className="anim-osseo-ring-2" />
          <circle cx="400" cy="355" r="95" fill="none" stroke="#6ee7b7" strokeWidth="1" strokeDasharray="10 8" className="anim-osseo-ring-3" />
        </g>

        {/* 3. Titanium Fixture (Threaded Screw Implant) */}
        <g id="titanium-implant-screw">
          {/* Main Tapered Screw Body */}
          <path
            d="M 376 305 L 378 320 L 379 340 L 382 365 L 386 390 L 392 405 C 396 412, 404 412, 408 405 L 414 390 L 418 365 L 421 340 L 422 320 L 424 305 Z"
            fill="url(#titaniumScrewGrad)"
            stroke="#475569"
            strokeWidth="1.5"
          />

          {/* Precision Micro-Threads (Helical ridges down the body) */}
          {[315, 327, 339, 351, 363, 375, 387, 399].map((ty, idx) => {
            const widthOffset = (ty - 305) * 0.28;
            const x1 = 376 + widthOffset;
            const x2 = 424 - widthOffset;
            return (
              <g key={`thread-${idx}`}>
                {/* Thread highlight crest */}
                <line x1={x1} y1={ty} x2={x2} y2={ty + 4} stroke="#f1f5f9" strokeWidth="2" strokeLinecap="round" />
                {/* Thread shadow groove */}
                <line x1={x1 + 1} y1={ty + 2} x2={x2 - 1} y2={ty + 6} stroke="#1e293b" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
              </g>
            );
          })}

          {/* Implant Collar & Internal Hex Platform at top */}
          <rect x="374" y="298" width="52" height="7" rx="2" fill="#94a3b8" stroke="#334155" strokeWidth="1.2" />
          <line x1="388" y1="301" x2="412" y2="301" stroke="#f8fafc" strokeWidth="1.5" />
        </g>

        {/* 4. Natural Mandibular Gingiva (Pink Gum Ridge with Extraction Crest) */}
        <g id="mandibular-gums">
          <path
            d="M 70 305 C 160 305, 230 295, 315 295 C 335 295, 348 308, 366 308 L 434 308 C 452 308, 465 295, 485 295 C 570 295, 640 305, 730 305 L 730 450 L 70 450 Z"
            fill="url(#gumTissueGrad)"
            stroke="#e11d48"
            strokeWidth="2"
          />
          {/* Subtle mucosal luster / highlights on gum margins */}
          <path
            d="M 120 304 C 200 302, 270 294, 320 294"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 480 294 C 530 294, 600 302, 680 304"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* 5. Flanking Natural Pearly Teeth (Anatomy from Image 2) */}
        <g id="flanking-teeth">
          {/* Left Molars (Adjacent to missing site) */}
          {/* Molar 1 (x: 270) */}
          <path
            d="M 230 295 C 230 230, 250 200, 275 200 C 300 200, 320 230, 320 295 Z"
            fill="url(#crownGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.8"
          />
          {/* Molar 1 Occlusal Anatomical Cusps & Fissures */}
          <path d="M 255 210 Q 275 218, 295 210" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
          <path d="M 275 205 L 275 225" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
          {/* Roots embedded into bone */}
          <path d="M 245 295 Q 248 350, 255 375" stroke="#fde68a" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
          <path d="M 305 295 Q 302 350, 295 375" stroke="#fde68a" strokeWidth="6" strokeLinecap="round" opacity="0.6" />

          {/* Molar 2 (x: 180) */}
          <path
            d="M 140 298 C 140 235, 160 205, 185 205 C 210 205, 230 235, 230 298 Z"
            fill="url(#crownGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.8"
          />
          <path d="M 165 215 Q 185 222, 205 215" stroke="#94a3b8" strokeWidth="1.2" fill="none" />

          {/* Right Premolars & Anterior Teeth (x: 480 to 650) */}
          {/* Premolar 1 (x: 485) */}
          <path
            d="M 480 295 C 480 235, 498 202, 520 202 C 542 202, 555 235, 555 295 Z"
            fill="url(#crownGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.8"
          />
          <path d="M 505 212 Q 520 218, 535 212" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
          <path d="M 518 295 Q 518 345, 516 365" stroke="#fde68a" strokeWidth="5" strokeLinecap="round" opacity="0.6" />

          {/* Premolar 2 (x: 555) */}
          <path
            d="M 555 298 C 555 240, 570 210, 590 210 C 610 210, 620 240, 620 298 Z"
            fill="url(#crownGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.8"
          />

          {/* Canine / Incisor (x: 620) */}
          <path
            d="M 620 302 C 620 245, 635 215, 650 215 C 665 215, 675 245, 675 302 Z"
            fill="url(#crownGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.8"
          />

          {/* Additional Anterior (x: 675) */}
          <path
            d="M 675 304 C 675 250, 688 220, 700 220 C 712 220, 720 250, 720 304 Z"
            fill="url(#crownGrad)"
            stroke="#cbd5e1"
            strokeWidth="1.8"
          />
        </g>

        {/* 6. Precision Internal Hex Abutment (Sitting on the screw platform) */}
        <g id="precision-abutment">
          {/* Conical connector post */}
          <path
            d="M 388 298 L 391 262 L 409 262 L 412 298 Z"
            fill="url(#abutmentGrad)"
            stroke="#334155"
            strokeWidth="1.5"
          />
          {/* Internal hex chamber connector pin */}
          <rect x="395" y="258" width="10" height="5" rx="1" fill="#f8fafc" stroke="#64748b" strokeWidth="1" />
          <line x1="394" y1="268" x2="406" y2="268" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" />
        </g>

        {/* 7. Alignment Laser Guide Beams (Descending Guide Lines from Image 2) */}
        <g id="alignment-guide-beams">
          {/* Left alignment line */}
          <line x1="388" y1="130" x2="388" y2="295" stroke="#38bdf8" strokeWidth="1.4" className="anim-guide-line" />
          {/* Center axis line */}
          <line x1="400" y1="110" x2="400" y2="415" stroke={accentColor} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
          {/* Right alignment line */}
          <line x1="412" y1="130" x2="412" y2="295" stroke="#38bdf8" strokeWidth="1.4" className="anim-guide-line" />
        </g>

        {/* 8. Porcelain Ceramic Crown (Animated Descending Assembly) */}
        <g id="animated-crown-assembly" className="anim-crown-assembly">
          {/* Natural Anatomical Molar Crown Restoration */}
          <path
            d="M 362 268 C 358 245, 360 215, 375 198 C 388 185, 412 185, 425 198 C 440 215, 442 245, 438 268 C 430 274, 415 272, 400 272 C 385 272, 370 274, 362 268 Z"
            fill="url(#crownGrad)"
            stroke="#94a3b8"
            strokeWidth="2"
            filter="drop-shadow(0 4px 10px rgba(0,0,0,0.35))"
          />
          {/* Crown Occlusal Masticatory Cusps & Grooves */}
          <path d="M 382 208 Q 400 216, 418 208" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
          <path d="M 400 200 L 400 220" stroke="#cbd5e1" strokeWidth="1.5" fill="none" />
          {/* Internal Abutment Hollow Chamber (Indicating mating fit) */}
          <path d="M 391 268 L 393 252 L 407 252 L 409 268" stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 2" fill="none" />

          {/* Enamel highlight reflection */}
          <ellipse cx="380" cy="225" rx="5" ry="14" fill="#ffffff" opacity="0.6" transform="rotate(-15 380 225)" />
        </g>

        {/* 9. Docking Spark Confirmation Flash */}
        <circle cx="400" cy="268" r="24" fill="url(#dockGlow)" className="anim-dock-spark" />

        {/* 10. Technical Telemetry Annotations (Image 2 Match Callouts) */}
        {/* Callout 1: Crown (Top-Right) */}
        <g transform="translate(470, 150)">
          <line x1="-30" y1="40" x2="0" y2="15" stroke="#38bdf8" strokeWidth="1.2" />
          <line x1="0" y1="15" x2="160" y2="15" stroke="#38bdf8" strokeWidth="1.2" />
          <rect x="0" y="-3" width="165" height="34" rx="6" fill="rgba(15, 23, 42, 0.88)" stroke="#38bdf8" strokeWidth="1" />
          <text x="10" y="12" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">1. PORCELAIN CROWN</text>
          <text x="10" y="24" fill="#cbd5e1" fontSize="8.5">Natural Shade A2 // 250N Load</text>
        </g>

        {/* Callout 2: Abutment (Right-Middle) */}
        <g transform="translate(470, 255)">
          <line x1="-55" y1="15" x2="0" y2="15" stroke="#94a3b8" strokeWidth="1.2" />
          <line x1="0" y1="15" x2="160" y2="15" stroke="#94a3b8" strokeWidth="1.2" />
          <rect x="0" y="-3" width="165" height="34" rx="6" fill="rgba(15, 23, 42, 0.88)" stroke="#94a3b8" strokeWidth="1" />
          <text x="10" y="12" fill="#e2e8f0" fontSize="10" fontWeight="bold" fontFamily="monospace">2. INTERNAL HEX ABUTMENT</text>
          <text x="10" y="24" fill="#cbd5e1" fontSize="8.5">Zero Micro-Gap Precision Lock</text>
        </g>

        {/* Callout 3: Titanium Screw Fixture (Left-Middle) */}
        <g transform="translate(140, 340)">
          <line x1="235" y1="15" x2="180" y2="15" stroke="#10b981" strokeWidth="1.2" />
          <line x1="180" y1="15" x2="0" y2="15" stroke="#10b981" strokeWidth="1.2" />
          <rect x="0" y="-3" width="180" height="34" rx="6" fill="rgba(15, 23, 42, 0.88)" stroke="#10b981" strokeWidth="1" />
          <text x="10" y="12" fill="#34d399" fontSize="10" fontWeight="bold" fontFamily="monospace">3. TITANIUM FIXTURE (SCREW)</text>
          <text x="10" y="24" fill="#cbd5e1" fontSize="8.5">Grade-4 // 35 N·cm Insertion</text>
        </g>

        {/* Callout 4: Jaw Bone (Bottom-Right) */}
        <g transform="translate(470, 395)">
          <line x1="-40" y1="15" x2="0" y2="15" stroke="#f59e0b" strokeWidth="1.2" />
          <line x1="0" y1="15" x2="160" y2="15" stroke="#f59e0b" strokeWidth="1.2" />
          <rect x="0" y="-3" width="165" height="34" rx="6" fill="rgba(15, 23, 42, 0.88)" stroke="#f59e0b" strokeWidth="1" />
          <text x="10" y="12" fill="#fbbf24" fontSize="10" fontWeight="bold" fontFamily="monospace">4. MANDIBULAR JAW BONE</text>
          <text x="10" y="24" fill="#cbd5e1" fontSize="8.5">Osseointegration: 99.4% Stability</text>
        </g>

        {/* 11. Center Switch to 3D Exploded Anatomy Pill */}
        {onSwitchTo3D && (
          <g transform="translate(290, 30)" style={{ cursor: 'pointer' }} onClick={onSwitchTo3D}>
            <rect x="0" y="0" width="220" height="34" rx="17" fill="rgba(6, 78, 59, 0.85)" stroke="#10b981" strokeWidth="1.6" filter="drop-shadow(0 4px 12px rgba(16, 185, 129, 0.4))" />
            <text x="110" y="21" fill="#a7f3d0" fontSize="11" fontWeight="700" textAnchor="middle">
              🧬 Switch to 3D Exploded Model →
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default CinematicHealthcareBackdrop;
