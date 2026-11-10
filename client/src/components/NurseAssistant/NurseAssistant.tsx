import React, { useState, useEffect, useRef } from 'react';
import {
  AnimationState,
  NurseExpression,
  NurseGesture,
  NurseAiResponse,
  ChatMessage,
} from './types';
import { SemanticAnimationEngine } from './SemanticAnimationEngine';
import { NurseAvatar2D } from './NurseAvatar2D';
import { AssistantVoiceManager } from './AssistantVoice';
import { AssistantChat } from './AssistantChat';
import { OnboardingTour, TOUR_STEPS } from './OnboardingTour';
import { GuidedAuthModal } from './GuidedAuthModal';
import { LanguageCode } from '../../i18n';
import { AuthUser, AuthTokens } from '../AuthPanel';

export interface NurseAssistantProps {
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

const POS_STORAGE_KEY = 'aarogya_3d_nurse_pos';
const MIN_STORAGE_KEY = 'aarogya_3d_nurse_minimized';
const MUTED_STORAGE_KEY = 'aarogya_3d_nurse_muted';

export const NurseAssistant: React.FC<NurseAssistantProps> = ({
  currentLang,
  onSelectLang,
  onNavigateTab,
  isOpen,
  onClose,
  authToken,
  currentUser,
  onLoginSuccess,
  activeTab = 'dashboard',
}) => {
  // Animation state engine
  const [animEngine] = useState(() => new SemanticAnimationEngine());
  const [animationState, setAnimationState] = useState<AnimationState>('greeting');
  const [expression, setExpression] = useState<NurseExpression>('smiling');
  const [gesture, setGesture] = useState<NurseGesture>('wave');

  // Assistant status
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem(MUTED_STORAGE_KEY) === 'true';
  });
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    return localStorage.getItem(MIN_STORAGE_KEY) === 'true';
  });

  // Modals & Tour
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [tourStepIndex, setTourStepIndex] = useState<number>(0);

  // Chat message history
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'init-msg',
      sender: 'assistant',
      text:
        'Namaste! I am Drishti, your clinical guide for Aarogya-Drishti.\n\nI can guide you through oral mucosal screenings, demonstrate self-examination steps, explain triage metrics, or take you on an interactive platform tour. How can I support you today?',
      speechText:
        'Namaste! I am Drishti. How can I help you today?',
      lang: 'en',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      animation: 'greeting',
      expression: 'smiling',
      gesture: 'wave',
      suggestedActions: [
        'Take Platform Tour 🗺️',
        'How to Register / Login 🔐',
        'Oral Cancer Red Flags ⚠️',
        'How does Offline Sync work? 📶',
        'Show Screening Guidelines 📋',
      ],
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Voice Manager Ref
  const voiceManagerRef = useRef<AssistantVoiceManager | null>(null);

  // Floating window position
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(POS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          const maxX = Math.max(10, window.innerWidth - 680);
          const maxY = Math.max(45, window.innerHeight - 560);
          const clampedX = Math.max(10, Math.min(maxX, parsed.x));
          const clampedY = Math.max(45, Math.min(maxY, parsed.y));
          return { x: clampedX, y: clampedY };
        }
      }
    } catch {}
    const defaultX = window.innerWidth > 1100 ? Math.max(20, window.innerWidth - 690) : 20;
    return { x: defaultX, y: 80 };
  });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Sync engine animation state
  useEffect(() => {
    animEngine.setCallbacks({
      onStateChange: (state, expr, gest) => {
        setAnimationState(state);
        setExpression(expr);
        setGesture(gest);
      },
      onResetToIdle: () => {
        setAnimationState('idle');
        setExpression('calm');
        setGesture('open_hand');
      },
    });
    // Trigger initial warm greeting
    animEngine.triggerState('greeting', 'smiling', 'wave', 5000);
  }, [animEngine]);

  // Initialize Web Speech Manager
  useEffect(() => {
    voiceManagerRef.current = new AssistantVoiceManager({
      onStartListening: () => {
        setIsListening(true);
        setStatusMessage('Listening to your voice...');
        animEngine.triggerState('listening', 'attentive', 'open_hand');
      },
      onStopListening: () => {
        setIsListening(false);
        setStatusMessage('');
      },
      onSpeechResult: (transcript) => {
        setIsListening(false);
        setStatusMessage('');
        if (transcript.trim()) {
          handleSendMessage(transcript.trim());
        }
      },
      onSpeechError: (err) => {
        setIsListening(false);
        setStatusMessage(`Speech error: ${err}`);
      },
      onStartSpeaking: () => {
        setIsSpeaking(true);
      },
      onStopSpeaking: () => {
        setIsSpeaking(false);
      },
    });

    return () => {
      voiceManagerRef.current?.stopAll();
    };
  }, []);

  // Update voice manager language on prop change
  useEffect(() => {
    // Keep in sync
  }, [currentLang]);

  // Save minimized state
  const toggleMinimize = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsMinimized((prev) => {
      const next = !prev;
      localStorage.setItem(MIN_STORAGE_KEY, String(next));
      return next;
    });
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem(MUTED_STORAGE_KEY, String(next));
      if (next && voiceManagerRef.current) {
        voiceManagerRef.current.stopSpeaking();
      }
      return next;
    });
  };

  // Dragging logic for the floating assistant
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow drag on header handle
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };

    let latestPos = { x: position.x, y: position.y };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvt.clientX - dragStartRef.current.startX;
      const dy = moveEvt.clientY - dragStartRef.current.startY;
      const maxX = Math.max(10, window.innerWidth - (isMinimized ? 220 : 680));
      const maxY = Math.max(40, window.innerHeight - (isMinimized ? 80 : 560));
      const newX = Math.max(10, Math.min(maxX, dragStartRef.current.posX + dx));
      const newY = Math.max(40, Math.min(maxY, dragStartRef.current.posY + dy));
      latestPos = { x: newX, y: newY };
      setPosition(latestPos);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(latestPos));
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Toggle Voice Input (Mic)
  const handleToggleMic = () => {
    if (!voiceManagerRef.current) return;
    if (isListening) {
      voiceManagerRef.current.stopListening();
    } else {
      if (isSpeaking) {
        voiceManagerRef.current.stopSpeaking();
      }
      voiceManagerRef.current.startListening(currentLang);
    }
  };

  // Handle Stop Speaking
  const handleStopSpeaking = () => {
    voiceManagerRef.current?.stopSpeaking();
    setIsSpeaking(false);
    animEngine.resetToIdle();
  };

  // Core AI Assistant Query Dispatcher
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isThinking) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      lang: currentLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsThinking(true);
    setStatusMessage('Drishti is analyzing your query...');

    // Trigger thinking animation
    animEngine.triggerState('thinking', 'thoughtful', 'hand_to_chin');

    try {
      const response = await fetch('/api/v1/assistant/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          language: currentLang,
          context: {
            currentTab: activeTab,
            user: currentUser
              ? {
                  fullName: currentUser.fullName,
                  role: currentUser.role,
                  hospitalId: currentUser.hospitalId,
                }
              : null,
          },
        }),
      });

      const envelope = await response.json();

      if (!response.ok || !envelope.success) {
        throw new Error(envelope.error?.message || 'Assistant query failed');
      }

      const aiData: NurseAiResponse = envelope.data;

      // Update animation state based on semantic response
      animEngine.triggerState(
        aiData.animation || 'explaining',
        aiData.expression || 'friendly',
        aiData.gesture || 'open_hand',
        typeof aiData.duration === 'number' ? aiData.duration : undefined
      );

      // Check special client actions
      if (aiData.intent === 'guided_registration' || text.toLowerCase().includes('register') || text.toLowerCase().includes('sign up')) {
        setIsAuthModalOpen(true);
      } else if (aiData.intent === 'start_tour' || text.toLowerCase().includes('tour') || text.toLowerCase().includes('walkthrough')) {
        startTour();
      }

      // If response includes navigateTo and user requested navigation
      if (aiData.navigateTo) {
        // Auto-navigate if explicit or provide quick jump
        if (
          text.toLowerCase().includes('open') ||
          text.toLowerCase().includes('go to') ||
          text.toLowerCase().includes('show me') ||
          text.toLowerCase().includes('take me')
        ) {
          onNavigateTab(aiData.navigateTo);
        }
      }

      // Add assistant response to messages
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: aiData.answerText,
        speechText: aiData.speechText || aiData.answerText,
        lang: aiData.language || currentLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        animation: aiData.animation,
        expression: aiData.expression,
        gesture: aiData.gesture,
        topic: aiData.topic,
        highlight: aiData.highlight,
        navigateTo: aiData.navigateTo,
        suggestedActions: aiData.suggestedActions || [
          'Show High-Risk Screening 🔴',
          'Explain Invariant 1 (Non-Diagnosis) 🛡️',
          'How does Offline Queue work? 📶',
          'Outreach Camps in Paderu 🏕️',
        ],
      };

      setMessages((prev) => [...prev, botMsg]);

      // Speak aloud if not muted
      if (!isMuted && voiceManagerRef.current && (aiData.speechText || aiData.answerText)) {
        voiceManagerRef.current.speak(
          aiData.speechText || aiData.answerText,
          aiData.language || currentLang
        );
      }
    } catch (err: any) {
      animEngine.triggerState('error', 'concerned', 'gentle_warning');
      const errorMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'assistant',
        text:
          "I experienced a slight delay reaching the offline healthcare knowledge engine. Let me still assist you with oral self-examinations, camp schedules, or system navigation.",
        lang: currentLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        animation: 'error',
        expression: 'concerned',
        gesture: 'gentle_warning',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
      setStatusMessage('');
    }
  };

  // Start Onboarding Tour
  const startTour = () => {
    setIsTourActive(true);
    setTourStepIndex(0);
    const firstStep = TOUR_STEPS[0];
    onNavigateTab(firstStep.targetTab);
    animEngine.triggerState(firstStep.animation, firstStep.expression, firstStep.gesture);

    if (!isMuted && voiceManagerRef.current) {
      voiceManagerRef.current.speak(firstStep.description, currentLang);
    }
  };

  const handleNextTourStep = () => {
    if (tourStepIndex < TOUR_STEPS.length - 1) {
      const nextIndex = tourStepIndex + 1;
      setTourStepIndex(nextIndex);
      const step = TOUR_STEPS[nextIndex];
      onNavigateTab(step.targetTab);
      animEngine.triggerState(step.animation, step.expression, step.gesture);

      if (!isMuted && voiceManagerRef.current) {
        voiceManagerRef.current.speak(step.description, currentLang);
      }
    } else {
      handleCompleteTour();
    }
  };

  const handlePrevTourStep = () => {
    if (tourStepIndex > 0) {
      const prevIndex = tourStepIndex - 1;
      setTourStepIndex(prevIndex);
      const step = TOUR_STEPS[prevIndex];
      onNavigateTab(step.targetTab);
      animEngine.triggerState(step.animation, step.expression, step.gesture);

      if (!isMuted && voiceManagerRef.current) {
        voiceManagerRef.current.speak(step.description, currentLang);
      }
    }
  };

  const handleCompleteTour = () => {
    setIsTourActive(false);
    animEngine.triggerState('success', 'smiling', 'thumbs_up', 4000);
    const endMsg: ChatMessage = {
      id: `tour-end-${Date.now()}`,
      sender: 'assistant',
      text:
        'Great job completing the platform walkthrough! You are ready to record screenings, schedule outreach camps, and consult with medical officers across Alluri Sitharama Raju District.',
      speechText:
        'Tour complete! Feel free to ask me questions anytime or click on any section to begin.',
      lang: currentLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      animation: 'success',
      expression: 'smiling',
      gesture: 'thumbs_up',
    };
    setMessages((prev) => [...prev, endMsg]);
    if (!isMuted && voiceManagerRef.current) {
      voiceManagerRef.current.speak(endMsg.speechText!, currentLang);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Draggable 3D Nurse Assistant Panel */}
      <aside
        className={`nurse-3d-floating-container ${isMinimized ? 'is-minimized' : 'is-expanded'}`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
        aria-label="3D AI Nurse Assistant Drishti"
      >
        {/* Floating Top Header Handle */}
        <div className="nurse-3d-header" onMouseDown={handleMouseDown}>
          <div className="nurse-header-branding">
            <span className="nurse-status-indicator pulse-green" />
            <div className="nurse-title-box">
              <span className="nurse-name">Drishti AI • Nurse Assistant</span>
              <span className="nurse-badge">Virtual Health Navigator</span>
            </div>
          </div>

          <div className="nurse-header-actions">
            {/* Audio Mute/Unmute */}
            <button
              type="button"
              className={`nurse-tool-btn ${isMuted ? 'is-muted' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute voice reading' : 'Mute voice reading'}
              aria-label="Toggle speech voice"
            >
              {isMuted ? '🔇' : '🔊'}
            </button>

            {/* Quick Tour Trigger */}
            <button
              type="button"
              className="nurse-tool-btn"
              onClick={startTour}
              title="Start Guided Application Tour"
              aria-label="Guided Tour"
            >
              🗺️
            </button>

            {/* Registration/Auth Helper */}
            <button
              type="button"
              className="nurse-tool-btn"
              onClick={() => setIsAuthModalOpen(true)}
              title="Open Assisted Registration & Login"
              aria-label="Guided Registration"
            >
              🔐
            </button>

            {/* Minimize / Maximize */}
            <button
              type="button"
              className="nurse-tool-btn"
              onClick={toggleMinimize}
              title={isMinimized ? 'Expand full assistant' : 'Minimize to 3D avatar'}
              aria-label="Toggle minimize"
            >
              {isMinimized ? '🗖' : '🗕'}
            </button>

            {/* Close */}
            <button
              type="button"
              className="nurse-tool-btn close-btn"
              onClick={onClose}
              title="Close assistant"
              aria-label="Close assistant"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Minimized Quick Dock: Animated Nurse Avatar in compact sphere */}
        {isMinimized ? (
          <div className="nurse-minimized-dock" onClick={() => setIsMinimized(false)}>
            <div className="nurse-minimized-canvas-wrapper" style={{ overflow: 'hidden' }}>
              <NurseAvatar2D
                animationState={animationState}
                expression={expression}
                gesture={gesture}
                isSpeaking={isSpeaking}
                isListening={isListening}
                isThinking={isThinking}
                width={58}
                height={58}
              />
            </div>
            <div className="nurse-minimized-info">
              <div className="nurse-mini-title">Drishti AI</div>
              <div className="nurse-mini-sub">
                {isSpeaking ? 'Speaking...' : isThinking ? 'Thinking...' : isListening ? 'Listening...' : 'Click to expand'}
              </div>
            </div>
            <button
              type="button"
              className={`nurse-mini-mic-btn ${isListening ? 'is-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMic();
              }}
              title="Click to speak"
            >
              🎤
            </button>
          </div>
        ) : (
          /* Full Dual-Pane View: 2D Animated Nurse + Interactive Conversational Chat */
          <div className="nurse-3d-body-layout">
            {/* Left Pane: 2D Animated Avatar Viewport */}
            <div className="nurse-avatar-viewport">
              <div className="nurse-avatar-canvas-box" style={{ width: '100%', height: '270px' }}>
                <NurseAvatar2D
                  animationState={animationState}
                  expression={expression}
                  gesture={gesture}
                  isSpeaking={isSpeaking}
                  isListening={isListening}
                  isThinking={isThinking}
                  width="100%"
                  height="100%"
                />
              </div>

              {/* Character State Tag */}
              <div className="nurse-state-bar">
                <span className="nurse-active-state-tag">
                  {animationState.toUpperCase()} • {expression}
                </span>
                <span className="nurse-drag-hint">Interactive 2D Nurse Assistant</span>
              </div>

              {/* Quick Action Badges */}
              <div className="nurse-quick-guide-links">
                <button
                  type="button"
                  className="nurse-pill-link"
                  onClick={() => handleSendMessage('What are the warning signs of oral mucosal lesions?')}
                >
                  ⚠️ Warning Signs
                </button>
                <button
                  type="button"
                  className="nurse-pill-link"
                  onClick={() => handleSendMessage('How do I conduct a screening offline?')}
                >
                  📶 Offline Mode
                </button>
                <button
                  type="button"
                  className="nurse-pill-link"
                  onClick={() => handleSendMessage('Explain small count suppression Invariant 3')}
                >
                  🛡️ Patient Privacy
                </button>
              </div>
            </div>

            {/* Right Pane: Conversational Chat & Voice Controls */}
            <div className="nurse-chat-viewport">
              <AssistantChat
                messages={messages}
                inputText={inputText}
                setInputText={setInputText}
                onSendMessage={handleSendMessage}
                onSuggestedAction={(act) => handleSendMessage(act)}
                onNavigateTo={(tab) => onNavigateTab(tab)}
                isThinking={isThinking}
                isSpeaking={isSpeaking}
                isListening={isListening}
                onToggleMic={handleToggleMic}
                onStopSpeaking={handleStopSpeaking}
                currentLang={currentLang}
                onSelectLang={onSelectLang}
                statusMessage={statusMessage}
              />
            </div>
          </div>
        )}
      </aside>

      {/* Interactive Step-by-Step Guided Application Walkthrough Tour */}
      <OnboardingTour
        isActive={isTourActive}
        currentStepIndex={tourStepIndex}
        onNext={handleNextTourStep}
        onPrev={handlePrevTourStep}
        onComplete={handleCompleteTour}
        currentLang={currentLang}
      />

      {/* First-Time Guided Registration & Login Modal */}
      <GuidedAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          animEngine.resetToIdle();
        }}
        onLoginSuccess={(user, tokens) => {
          setIsAuthModalOpen(false);
          onLoginSuccess?.(user, tokens);
          animEngine.triggerState('success', 'smiling', 'thumbs_up', 4000);
          const welcomeMsg: ChatMessage = {
            id: `auth-success-${Date.now()}`,
            sender: 'assistant',
            text: `Welcome back, ${user.fullName}! You are signed in as [${user.role.toUpperCase()}]. All screening, referral, and camp management features are now unlocked.`,
            speechText: `Welcome back, ${user.fullName}! You are signed in as ${user.role}.`,
            lang: currentLang,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            animation: 'success',
            expression: 'smiling',
            gesture: 'thumbs_up',
          };
          setMessages((prev) => [...prev, welcomeMsg]);
          if (!isMuted && voiceManagerRef.current) {
            voiceManagerRef.current.speak(welcomeMsg.speechText!, currentLang);
          }
        }}
        onTriggerAnimation={(st, ex, gt) => animEngine.triggerState(st, ex, gt)}
      />
    </>
  );
};
