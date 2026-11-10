import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RobotCharacter, RobotState } from './RobotCharacter';
import { AssistantChatPanel } from './AssistantChatPanel';
import { ChatMessage } from './AssistantMessages';
import { useLanguage } from './useLanguage';
import { askAssistant } from './assistantService';
import { AssistantVoiceEngine, FemaleVoiceInfo } from './assistantVoice';
import { SUPPORTED_LANGUAGES } from './languageConfig';
import { LanguageCode } from '../../i18n';
import { AuthUser, AuthTokens } from '../AuthPanel';
import {
  RED_FLAG_SYMPTOM_RULES,
  VOICE_STATUS_TEXT,
  VoiceLanguageCode,
} from './safetyMessages';
import './assistant.css';

export interface AIRobotAssistantProps {
  currentLang: LanguageCode;
  onSelectLang: (lang: LanguageCode) => void;
  onNavigateTab: (tabId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  authToken?: string;
  currentUser?: AuthUser | null;
  onLoginSuccess?: (user: AuthUser, tokens: AuthTokens) => void;
  activeTab?: string;
}

const STORAGE_MIN_KEY = 'aarogya_ai_robot_minimized';
const STORAGE_MUTE_KEY = 'aarogya_ai_robot_muted';
const STORAGE_CONTINUOUS_KEY = 'aarogya_ai_robot_continuous';

export const AIRobotAssistant: React.FC<AIRobotAssistantProps> = ({
  currentLang: appLang,
  onSelectLang: setAppLang,
  onNavigateTab,
  isOpen,
  onClose,
  authToken,
  currentUser,
  activeTab = 'dashboard',
}) => {
  const isPatient = currentUser?.role?.toLowerCase() === 'patient';
  // Language & Auto-detection Hook
  const {
    currentLang,
    mode: langMode,
    selectLanguage,
    setMode: setLangMode,
    handleInputTextDetection,
  } = useLanguage(appLang);

  // Synchronize with parent app language when manually switched
  useEffect(() => {
    if (appLang !== currentLang) {
      selectLanguage(appLang, false);
    }
  }, [appLang, currentLang, selectLanguage]);

  // Voice Engine Ref
  const voiceEngineRef = useRef<AssistantVoiceEngine | null>(null);

  // UI States
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_MIN_KEY) === 'true';
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_MUTE_KEY) === 'true';
  });
  const [isContinuousConversation, setIsContinuousConversation] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_CONTINUOUS_KEY);
    return saved !== null ? saved === 'true' : true; // Default ON
  });

  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSpeakingPaused, setIsSpeakingPaused] = useState<boolean>(false);
  const [speakingLanguage, setSpeakingLanguage] = useState<LanguageCode>(currentLang);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [voiceErrorMessage, setVoiceErrorMessage] = useState<string | null>(null);
  const hasAutoSpokenRef = useRef<boolean>(false);

  // Continuous Female Voice-First Conversation States
  const [isVoiceConversationActive, setIsVoiceConversationActive] = useState<boolean>(false);
  const [showTextView, setShowTextView] = useState<boolean>(false);
  const [femaleVoiceInfo, setFemaleVoiceInfo] = useState<FemaleVoiceInfo | null>(null);

  // Initialize Welcome Message in the active language
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: SUPPORTED_LANGUAGES[currentLang]?.sampleGreeting || SUPPORTED_LANGUAGES.en.sampleGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: currentLang,
      suggestedActions: SUPPORTED_LANGUAGES[currentLang]?.suggestedQuestions || SUPPORTED_LANGUAGES.en.suggestedQuestions,
    },
  ]);

  // Update welcome message if language changed and only welcome message exists
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome-msg') {
        return [
          {
            id: 'welcome-msg',
            sender: 'assistant',
            text: SUPPORTED_LANGUAGES[currentLang]?.sampleGreeting || SUPPORTED_LANGUAGES.en.sampleGreeting,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            language: currentLang,
            suggestedActions: SUPPORTED_LANGUAGES[currentLang]?.suggestedQuestions || SUPPORTED_LANGUAGES.en.suggestedQuestions,
          },
        ];
      }
      return prev;
    });
  }, [currentLang]);

  /**
   * Red-Flag Clinical Escalation Check
   * Inspects user query for ulcers > 2 weeks, white/red patches, lumps, bleeding, dysphagia, emergency symptoms
   */
  const checkClinicalRedFlags = useCallback(
    (queryText: string, lang: LanguageCode) => {
      const lower = queryText.toLowerCase();
      const voiceLang: VoiceLanguageCode = lang === 'te' ? 'te' : lang === 'hi' ? 'hi' : 'en';

      for (const rule of RED_FLAG_SYMPTOM_RULES) {
        const keywords = [
          ...(rule.keywords.en || []),
          ...(rule.keywords[voiceLang] || []),
        ];
        for (const kw of keywords) {
          if (lower.includes(kw.toLowerCase())) {
            return {
              triggered: true,
              urgency: rule.urgency,
              spokenText: rule.spokenAdvice[voiceLang] || rule.spokenAdvice.en,
              writtenText: rule.writtenAdvice[voiceLang] || rule.writtenAdvice.en,
            };
          }
        }
      }
      return { triggered: false };
    },
    []
  );

  // Handle User Message Submission
  const handleUserQuery = useCallback(
    async (text: string, imageBase64?: string) => {
      if ((!text.trim() && !imageBase64) || isThinking) return;

      // 1. Language detection if in auto mode
      const activeQueryLang = handleInputTextDetection(text);

      // Stop any speech currently playing
      voiceEngineRef.current?.stopSpeaking();

      // 2. Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: text.trim() || 'Attached oral photo for screening',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: activeQueryLang,
        imageUrl: imageBase64,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);
      setRobotState('thinking');
      setInterimTranscript('');

      // 3. Clinical Red-Flag Check (only when no photo attached, as photo goes directly to visual inspection)
      if (!imageBase64) {
        const redFlag = checkClinicalRedFlags(text, activeQueryLang);
        if (redFlag.triggered && redFlag.writtenText && redFlag.spokenText) {
          const asstMsgId = `asst-redflag-${Date.now()}`;
          const assistantMsg: ChatMessage = {
            id: asstMsgId,
            sender: 'assistant',
            text: redFlag.writtenText,
            speechText: redFlag.spokenText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            language: activeQueryLang,
            navigateTo: 'hospitals',
            suggestedActions: ['Find Nearest PHC', 'Schedule Clinic Visit', 'Read Oral Guidelines'],
          };

          setMessages((prev) => [...prev, assistantMsg]);
          setIsThinking(false);

          if (!isMuted) {
            setSpeakingMessageId(asstMsgId);
            setSpeakingLanguage(activeQueryLang);
            voiceEngineRef.current?.speakFemale(redFlag.spokenText, activeQueryLang);
          } else {
            setRobotState('error');
            setTimeout(() => setRobotState('idle'), 2500);
          }
          return;
        }
      }

      // 4. Query Assistant Backend with conversation history and optional photo
      try {
        const historyPayload = messages.slice(-6).map((m) => ({
          sender: m.sender,
          text: m.text,
          language: m.language,
        }));

        const answer = await askAssistant({
          query: text,
          language: activeQueryLang,
          activeTab,
          authToken,
          conversationHistory: historyPayload,
          image: imageBase64,
        });

        const asstMsgId = `asst-${Date.now()}`;
        const assistantMsg: ChatMessage = {
          id: asstMsgId,
          sender: 'assistant',
          text: answer.answerText,
          speechText: answer.speechText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: activeQueryLang,
          navigateTo: answer.navigateTo,
          suggestedActions: answer.suggestedActions,
          doctorRecommendation: answer.doctorRecommendation,
          photoAnalysis: answer.photoAnalysis,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsThinking(false);

        // Auto-navigate to target screen if requested (e.g. patients, screening, specialists)
        if (answer.navigateTo) {
          onNavigateTab(answer.navigateTo);
        }

        // Vocalize response aloud in natural female voice
        if (!isMuted && answer.speechText) {
          setSpeakingMessageId(asstMsgId);
          setSpeakingLanguage(activeQueryLang);
          voiceEngineRef.current?.speakFemale(answer.speechText, activeQueryLang);
        } else {
          setRobotState('success');
          setTimeout(() => setRobotState('idle'), 2000);
        }
      } catch {
        setIsThinking(false);
        setRobotState('error');
        setTimeout(() => setRobotState('idle'), 2500);
      }
    },
    [isThinking, handleInputTextDetection, checkClinicalRedFlags, messages, activeTab, authToken, isMuted, onNavigateTab]
  );

  // Setup Voice Engine
  useEffect(() => {
    const voiceEngine = new AssistantVoiceEngine({
      onStartListening: () => {
        setIsListening(true);
        setRobotState('listening');
        setInterimTranscript('');
        setVoiceErrorMessage(null);
      },
      onStopListening: () => {
        setIsListening(false);
        setRobotState((prev) => (prev === 'listening' ? 'idle' : prev));
      },
      onTranscript: (transcript, isFinal) => {
        setInterimTranscript(transcript);
        if (isFinal && transcript.trim()) {
          setInterimTranscript('');
          handleUserQuery(transcript.trim());
        }
      },
      onStartSpeaking: (_text, lang, voiceInfo) => {
        setIsSpeaking(true);
        setIsSpeakingPaused(false);
        setSpeakingLanguage(lang);
        setFemaleVoiceInfo(voiceInfo);
        setRobotState('speaking');
      },
      onPauseSpeaking: () => {
        setIsSpeakingPaused(true);
        setRobotState('idle');
      },
      onResumeSpeaking: () => {
        setIsSpeakingPaused(false);
        setRobotState('speaking');
      },
      onStopSpeaking: () => {
        setIsSpeaking(false);
        setIsSpeakingPaused(false);
        setSpeakingMessageId(null);
        setRobotState('idle');
      },
      onContinuousCycleReady: () => {
        setRobotState('listening');
        setIsListening(true);
        setInterimTranscript('');
      },
      onError: (errMsg) => {
        setIsListening(false);
        setRobotState('error');
        setVoiceErrorMessage(errMsg);
        setTimeout(() => {
          setRobotState((prev) => (prev === 'error' ? 'idle' : prev));
        }, 4000);
      },
      onVoicesLoaded: () => {
        if (voiceEngineRef.current) {
          setFemaleVoiceInfo(voiceEngineRef.current.resolveFemaleVoice(currentLang));
        }
      },
    });

    voiceEngine.setMuted(isMuted);
    voiceEngine.enableContinuousConversation(isContinuousConversation);
    voiceEngineRef.current = voiceEngine;
    setFemaleVoiceInfo(voiceEngine.resolveFemaleVoice(currentLang));

    return () => {
      voiceEngine.stopSpeaking();
      voiceEngine.stopListening();
    };
  }, [isMuted, isContinuousConversation, handleUserQuery, currentLang]);

  // Synchronize female voice profile when language changes
  useEffect(() => {
    if (voiceEngineRef.current) {
      setFemaleVoiceInfo(voiceEngineRef.current.resolveFemaleVoice(currentLang));
    }
  }, [currentLang]);

  // Handle Mute Toggle
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_MUTE_KEY, String(next));
      voiceEngineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  // Voice Playback Controls
  const handlePauseVoice = useCallback(() => {
    voiceEngineRef.current?.pauseSpeaking();
  }, []);

  const handleResumeVoice = useCallback(() => {
    voiceEngineRef.current?.resumeSpeaking();
  }, []);

  const handleStopVoice = useCallback(() => {
    voiceEngineRef.current?.stopSpeaking();
  }, []);

  const handleReplayVoice = useCallback(() => {
    voiceEngineRef.current?.replay();
  }, []);

  // Toggle vocalization for individual message
  const handleToggleSpeakMessage = useCallback(
    (msg: ChatMessage) => {
      if (speakingMessageId === msg.id && isSpeaking) {
        if (isSpeakingPaused) {
          voiceEngineRef.current?.resumeSpeaking();
        } else {
          voiceEngineRef.current?.stopSpeaking();
        }
      } else {
        const textToSpeak = msg.speechText || msg.text;
        const msgLang = msg.language || currentLang;
        setSpeakingMessageId(msg.id);
        setSpeakingLanguage(msgLang);
        voiceEngineRef.current?.speakFemale(textToSpeak, msgLang);
      }
    },
    [speakingMessageId, isSpeaking, isSpeakingPaused, currentLang]
  );

  // Handle Speech STT Toggle (Microphone click in text view) with Barge-in
  const handleToggleVoice = useCallback(() => {
    // 1. Barge-in: If speaking, stop immediately and listen
    if (isSpeaking) {
      voiceEngineRef.current?.interrupt();
      return;
    }

    if (isListening) {
      voiceEngineRef.current?.stopListening();
      if (interimTranscript.trim()) {
        handleUserQuery(interimTranscript.trim());
        setInterimTranscript('');
      }
    } else {
      // 2. Start speech recognition directly in user's selected language
      voiceEngineRef.current?.startListening(currentLang);
    }
  }, [isSpeaking, isListening, currentLang, interimTranscript, handleUserQuery]);

  // Continuous Female Voice-First Conversation Controls
  const handleStartVoiceConversation = useCallback(() => {
    setIsVoiceConversationActive(true);
    setIsMinimized(false);
    localStorage.setItem(STORAGE_MIN_KEY, 'false');
    voiceEngineRef.current?.enableContinuousConversation(true);
    voiceEngineRef.current?.startListening(currentLang);
  }, [currentLang]);

  // Automatically speak welcome guidance (Steps 1, 2, 3) in the active language
  const autoSpeakWelcomeGuidance = useCallback(() => {
    if (hasAutoSpokenRef.current || isMuted) return;
    const welcomeSpeech =
      SUPPORTED_LANGUAGES[currentLang]?.spokenWelcome ||
      SUPPORTED_LANGUAGES.en.spokenWelcome;
    if (!welcomeSpeech || !voiceEngineRef.current) return;

    hasAutoSpokenRef.current = true;
    setSpeakingMessageId('welcome-msg');
    setSpeakingLanguage(currentLang);
    voiceEngineRef.current.speakFemale(welcomeSpeech, currentLang);
  }, [currentLang, isMuted]);

  // Trigger auto-speech when application loads / assistant is open
  useEffect(() => {
    if (isOpen && !isMinimized && !hasAutoSpokenRef.current && !isMuted) {
      // Primary attempt: Speak shortly after mount once voices are initialized
      const timer = setTimeout(() => {
        autoSpeakWelcomeGuidance();
      }, 700);

      // Autoplay fallback: If browser restricts audio before user gesture,
      // trigger auto-speech on the user's first tap/click/touch anywhere on screen
      const handleFirstInteraction = () => {
        if (!hasAutoSpokenRef.current && !isMuted) {
          autoSpeakWelcomeGuidance();
        }
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('pointerdown', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
      };

      window.addEventListener('click', handleFirstInteraction, { once: true });
      window.addEventListener('pointerdown', handleFirstInteraction, { once: true });
      window.addEventListener('touchstart', handleFirstInteraction, { once: true });
      window.addEventListener('keydown', handleFirstInteraction, { once: true });

      return () => {
        clearTimeout(timer);
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('pointerdown', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
      };
    }
  }, [isOpen, isMinimized, isMuted, autoSpeakWelcomeGuidance]);

  const handleEndVoiceConversation = useCallback(() => {
    setIsVoiceConversationActive(false);
    voiceEngineRef.current?.endConversation();
    setRobotState('idle');
  }, []);

  const handleInterruptVoice = useCallback(() => {
    voiceEngineRef.current?.interrupt();
  }, []);

  const handleToggleContinuousConversation = useCallback(() => {
    setIsContinuousConversation((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_CONTINUOUS_KEY, String(next));
      voiceEngineRef.current?.enableContinuousConversation(next);
      return next;
    });
  }, []);

  // Handle Minimize
  const handleMinimize = useCallback(() => {
    setIsMinimized((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_MIN_KEY, String(next));
      return next;
    });
  }, []);

  // Handle Dock Click (floating robot in bottom-right)
  const handleDockClick = useCallback(() => {
    if (isOpen && !isMinimized) {
      setIsMinimized(true);
      localStorage.setItem(STORAGE_MIN_KEY, 'true');
    } else {
      setIsMinimized(false);
      localStorage.setItem(STORAGE_MIN_KEY, 'false');
      if (!isOpen) {
        onClose();
      }
    }
  }, [isOpen, isMinimized, onClose]);

  // Handle Close Button Click (✕ in panel header)
  const handlePanelClose = useCallback(() => {
    setIsMinimized(false);
    localStorage.setItem(STORAGE_MIN_KEY, 'false');
    if (isVoiceConversationActive) {
      voiceEngineRef.current?.endConversation();
      setIsVoiceConversationActive(false);
    }
    onClose();
  }, [onClose, isVoiceConversationActive]);

  // Clear Chat History & Restart
  const handleClearHistory = useCallback(() => {
    setMessages([
      {
        id: 'welcome-msg',
        sender: 'assistant',
        text: SUPPORTED_LANGUAGES[currentLang]?.sampleGreeting || SUPPORTED_LANGUAGES.en.sampleGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: currentLang,
        suggestedActions: SUPPORTED_LANGUAGES[currentLang]?.suggestedQuestions || SUPPORTED_LANGUAGES.en.suggestedQuestions,
      },
    ]);
    voiceEngineRef.current?.stopSpeaking();
    setSpeakingMessageId(null);
    setRobotState('idle');
  }, [currentLang]);

  // Handle Language Selection from Assistant (Auto, te, hi, en)
  const handleLanguageChange = useCallback(
    (lang: LanguageCode) => {
      selectLanguage(lang, true);
      setAppLang(lang);
    },
    [selectLanguage, setAppLang]
  );

  const handleSetAutoMode = useCallback(() => {
    setLangMode('auto');
  }, [setLangMode]);

  // Determine current robot animation state
  const effectiveRobotState: RobotState = isThinking
    ? 'thinking'
    : isListening
    ? 'listening'
    : isSpeaking && !isSpeakingPaused
    ? 'speaking'
    : robotState !== 'idle'
    ? robotState
    : isHovered
    ? 'hover'
    : 'idle';

  const isVoiceSupported = voiceEngineRef.current?.isSpeechRecognitionSupported() ?? true;

  // Localized status text
  const voiceLangKey: VoiceLanguageCode = currentLang === 'te' ? 'te' : currentLang === 'hi' ? 'hi' : 'en';
  const statusDict = VOICE_STATUS_TEXT[voiceLangKey] || VOICE_STATUS_TEXT.en;
  const currentStatusText = isListening
    ? statusDict.listening
    : isThinking
    ? statusDict.processing
    : isSpeaking
    ? statusDict.speaking
    : statusDict.idle;

  return (
    <div className="ai-robot-floating-container" aria-live="polite">
      {/* Expandable Chat Panel */}
      {isOpen && !isMinimized && (
        <AssistantChatPanel
          messages={messages}
          robotState={effectiveRobotState}
          currentLang={currentLang}
          langMode={langMode}
          onSelectLang={handleLanguageChange}
          onSetAutoMode={handleSetAutoMode}
          onSendMessage={handleUserQuery}
          onToggleVoice={handleToggleVoice}
          isListening={isListening}
          isThinking={isThinking}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          isVoiceSupported={isVoiceSupported}
          interimTranscript={interimTranscript}
          isSpeaking={isSpeaking}
          isSpeakingPaused={isSpeakingPaused}
          speakingLanguage={speakingLanguage}
          onPauseVoice={handlePauseVoice}
          onResumeVoice={handleResumeVoice}
          onStopVoice={handleStopVoice}
          onReplayVoice={handleReplayVoice}
          onToggleSpeakMessage={handleToggleSpeakMessage}
          speakingMessageId={speakingMessageId}
          voiceErrorMessage={voiceErrorMessage}
          onDismissVoiceError={() => setVoiceErrorMessage(null)}
          onMinimize={handleMinimize}
          onClose={handlePanelClose}
          onClearHistory={handleClearHistory}
          onNavigateTab={onNavigateTab}
          isPatient={isPatient}
          quickSuggestions={
            isPatient
              ? currentLang === 'te'
                ? [
                    'నా అపాయింట్‌మెంట్ వివరాలు ఏమిటి?',
                    'రోజువారీ నోటి శుభ్రత ఎలా పాటించాలి?',
                    'దగ్గర్లోని CHC ఆసుపత్రి ఎక్కడ ఉంది?',
                    'నా నోటి స్క్రీనింగ్ రిపోర్ట్ అర్థం ఏమిటి?',
                  ]
                : currentLang === 'hi'
                ? [
                    'मेरी अगली अपॉइंटमेंट कब है?',
                    'दांत और मसूड़ों की सफाई के आसान नियम',
                    'नजदीकी सामुदायिक स्वास्थ्य केंद्र कहां है?',
                    'मेरी ओरल रिपोर्ट का क्या मतलब है?',
                  ]
                : [
                    'When is my next dental appointment?',
                    'Daily oral hygiene and brushing tips',
                    'Where is the nearest CHC hospital?',
                    'Explain my oral screening report',
                  ]
              : SUPPORTED_LANGUAGES[currentLang]?.suggestedQuestions ||
                SUPPORTED_LANGUAGES.en.suggestedQuestions
          }
          activeTab={activeTab}
          isVoiceConversationActive={isVoiceConversationActive}
          onStartVoiceConversation={handleStartVoiceConversation}
          onEndVoiceConversation={handleEndVoiceConversation}
          onInterruptVoice={handleInterruptVoice}
          femaleVoiceInfo={femaleVoiceInfo}
          showTextView={showTextView}
          onToggleShowTextView={() => setShowTextView((prev) => !prev)}
          isContinuousConversation={isContinuousConversation}
          onToggleContinuousConversation={handleToggleContinuousConversation}
          statusText={currentStatusText}
        />
      )}

      {/* Floating Trigger Dock (Bottom-Right Mascot) */}
      <div
        className={`robot-trigger-dock ${isVoiceConversationActive ? 'voice-convo-live' : ''}`}
        onClick={handleDockClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="button"
        tabIndex={0}
        aria-label="Toggle Dr. Drishti Female AI Guide"
        title="Dr. Drishti AI Guide"
      >
        <RobotCharacter
          state={effectiveRobotState}
          size={64}
          showTooltip={!isOpen || isMinimized}
          tooltipText={isVoiceConversationActive ? 'Dr. Drishti Voice Active 🎙️' : 'Chat with Dr. Drishti AI 🤖'}
        />

        <div className="robot-badge-status">
          <span className="status-dot"></span>
          <span>{langMode === 'auto' ? 'AUTO' : currentLang.toUpperCase()}</span>
          {isVoiceConversationActive && <span className="badge-live-mic">🎙️ LIVE</span>}
          {isSpeaking && !isSpeakingPaused && <span>🔊</span>}
        </div>
      </div>
    </div>
  );
};

export default AIRobotAssistant;
