import React, { useRef, useEffect } from 'react';
import { RobotCharacter, RobotState } from './RobotCharacter';
import { LanguageSelector } from './LanguageSelector';
import { AssistantMessages, ChatMessage } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import { LanguageCode } from '../../i18n';
import { LanguageMode } from './useLanguage';
import { SUPPORTED_LANGUAGES } from './languageConfig';
import { FemaleVoiceInfo } from './assistantVoice';

interface AssistantChatPanelProps {
  messages: ChatMessage[];
  robotState: RobotState;
  currentLang: LanguageCode;
  langMode: LanguageMode;
  onSelectLang: (lang: any) => void;
  onToggleLangMode?: () => void;
  onSetAutoMode?: () => void;
  onSendMessage: (text: string, imageBase64?: string) => void;
  onToggleVoice: () => void;
  isListening: boolean;
  isThinking: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  isVoiceSupported: boolean;
  interimTranscript?: string;
  isSpeaking?: boolean;
  isSpeakingPaused?: boolean;
  speakingLanguage?: LanguageCode;
  onPauseVoice?: () => void;
  onResumeVoice?: () => void;
  onStopVoice?: () => void;
  onReplayVoice?: () => void;
  onToggleSpeakMessage?: (msg: ChatMessage) => void;
  speakingMessageId?: string | null;
  voiceErrorMessage?: string | null;
  onDismissVoiceError?: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onClearHistory: () => void;
  onNavigateTab?: (tabId: string) => void;
  quickSuggestions?: string[];
  activeTab?: string;
  // Female Voice-First Conversation Controls
  isVoiceConversationActive?: boolean;
  onStartVoiceConversation?: () => void;
  onEndVoiceConversation?: () => void;
  onInterruptVoice?: () => void;
  femaleVoiceInfo?: FemaleVoiceInfo | null;
  showTextView?: boolean;
  onToggleShowTextView?: () => void;
  isContinuousConversation?: boolean;
  onToggleContinuousConversation?: () => void;
  statusText?: string;
  isPatient?: boolean;
}

export const AssistantChatPanel: React.FC<AssistantChatPanelProps> = ({
  messages,
  robotState,
  currentLang,
  langMode,
  onSelectLang,
  onSetAutoMode,
  onSendMessage,
  onToggleVoice,
  isListening,
  isThinking,
  isMuted,
  onToggleMute,
  isVoiceSupported,
  interimTranscript = '',
  isSpeaking = false,
  isSpeakingPaused = false,
  speakingLanguage,
  onPauseVoice,
  onResumeVoice,
  onStopVoice,
  onReplayVoice,
  onToggleSpeakMessage,
  speakingMessageId,
  voiceErrorMessage,
  onDismissVoiceError,
  onMinimize,
  onClose,
  onClearHistory,
  onNavigateTab,
  quickSuggestions = [],
  activeTab = 'dashboard',
  isVoiceConversationActive = false,
  onStartVoiceConversation,
  onEndVoiceConversation,
  onInterruptVoice,
  femaleVoiceInfo,
  showTextView = false,
  onToggleShowTextView,
  isContinuousConversation = true,
  onToggleContinuousConversation,
  statusText,
  isPatient = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drawerScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message in text view
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    if (drawerScrollRef.current) {
      drawerScrollRef.current.scrollTop = drawerScrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, showTextView]);

  const activeSpeechLang = speakingLanguage || currentLang;
  const langConfig = SUPPORTED_LANGUAGES[activeSpeechLang] || SUPPORTED_LANGUAGES.en;

  const handleSetAuto = () => {
    if (onSetAutoMode) {
      onSetAutoMode();
    }
  };

  return (
    <div
      className={`assistant-chat-panel ${isVoiceConversationActive ? 'mode-voice-first' : 'mode-hybrid'}`}
      role="dialog"
      aria-label="Aarogya-Drishti Multilingual Conversational AI Assistant"
    >
      {/* -------------------- 1. PANEL HEADER -------------------- */}
      <div className="panel-header-bar">
        <div className="header-robot-brand">
          <RobotCharacter state={robotState} size={36} />
          <div className="header-title-column">
            <div className="assistant-brand-title">
              <span>{isPatient ? 'Dr. Drishti Health Guide' : 'Dr. Drishti AI'}</span>
              <span className="ai-model-badge">
                {isPatient ? 'CITIZEN ASSIST' : isVoiceConversationActive ? 'VOICE LIVE' : 'MULTILINGUAL'}
              </span>
            </div>
            <div className="assistant-status-indicator">
              <span className={`status-dot-pulse ${isVoiceConversationActive ? 'voice-live' : ''}`}></span>
              <span className="status-label-text">
                {statusText ||
                  (isListening
                    ? 'Listening…'
                    : isSpeaking
                    ? 'Speaking…'
                    : isThinking
                    ? 'Processing…'
                    : isPatient
                    ? 'Voice & Oral Care Assistant'
                    : `Online • Tab: ${activeTab}`)}
              </span>
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="header-action-controls">
          {/* Continuous Conversation Toggle Button */}
          {onToggleContinuousConversation && (
            <button
              type="button"
              className={`btn-header-tool min-touch-target ${isContinuousConversation ? 'active' : ''}`}
              onClick={onToggleContinuousConversation}
              title={isContinuousConversation ? 'Continuous Voice: ON' : 'Continuous Voice: OFF'}
              aria-label="Toggle continuous voice conversation"
            >
              {isContinuousConversation ? '🔄' : '⏸️'}
            </button>
          )}

          {/* Audio Speaker Mute Toggle */}
          <button
            type="button"
            className={`btn-header-tool min-touch-target ${isMuted ? 'muted' : ''}`}
            onClick={onToggleMute}
            title={isMuted ? 'Unmute voice' : 'Mute voice'}
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          {/* Toggle Text View in Voice Mode */}
          {isVoiceConversationActive && onToggleShowTextView && (
            <button
              type="button"
              className={`btn-header-tool min-touch-target ${showTextView ? 'active' : ''}`}
              onClick={onToggleShowTextView}
              title={showTextView ? 'Hide text view' : 'Show text chat'}
              aria-label={showTextView ? 'Hide text view' : 'Show text view'}
            >
              {showTextView ? '🎙️' : '💬'}
            </button>
          )}

          {/* Clear History & Restart */}
          <button
            type="button"
            className="btn-header-tool min-touch-target"
            onClick={onClearHistory}
            title="Restart conversation"
            aria-label="Restart conversation"
          >
            🧹
          </button>

          {/* Minimize Button */}
          <button
            type="button"
            className="btn-header-tool min-touch-target"
            onClick={onMinimize}
            title="Minimize"
            aria-label="Minimize"
          >
            ━
          </button>

          {/* Close Button */}
          <button
            type="button"
            className="btn-header-tool btn-header-close min-touch-target"
            onClick={onClose}
            title="Close Assistant"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* -------------------- 2. VOICE-FIRST CONVERSATIONAL VIEW -------------------- */}
      {isVoiceConversationActive ? (
        <div className={`voice-first-conversation-view is-${robotState}`}>
          {/* Top Voice Status Bar */}
          <div className="voice-header-meta-bar">
            <div className="voice-meta-badge">
              <span className="voice-live-dot"></span>
              <span className="voice-live-text">
                {isContinuousConversation ? 'Continuous Voice Active' : 'Single Turn Mode'}
              </span>
            </div>

            <button
              type="button"
              className="btn-voice-end-quick min-touch-target"
              onClick={onEndVoiceConversation}
              title="End Voice Conversation"
              aria-label="End voice conversation"
            >
              🛑 End
            </button>
          </div>

          {/* Female Voice Profile Badge */}
          <div className="female-voice-identity-badge">
            <span className="female-icon">👩‍⚕️</span>
            <span className="voice-role-title">Dr. Drishti • Female AI Assistant</span>
            {femaleVoiceInfo && femaleVoiceInfo.canSpeak && (
              <span className="voice-subname">
                ({femaleVoiceInfo.name})
              </span>
            )}
          </div>

          {/* Voice Limitation Notice if device lacks native voice */}
          {femaleVoiceInfo && !femaleVoiceInfo.canSpeak && (
            <div className="voice-limitation-pill" role="alert">
              <span className="info-icon">ℹ️</span>
              <span className="info-text">
                {femaleVoiceInfo.limitationNotice || 'Voice is not available for this language on this device. Displaying text.'}
              </span>
            </div>
          )}

          {/* Center Robot Avatar Stage */}
          <div
            className={`voice-avatar-stage ${isSpeaking ? 'clickable-interrupt' : ''}`}
            onClick={isSpeaking ? onInterruptVoice : undefined}
            title={isSpeaking ? 'Tap to interrupt and speak (Barge-in)' : undefined}
          >
            <div className={`avatar-wave-ring ring-1 ${robotState}`}></div>
            <div className={`avatar-wave-ring ring-2 ${robotState}`}></div>
            <div className={`avatar-wave-ring ring-3 ${robotState}`}></div>

            <RobotCharacter state={robotState} size={110} />

            {/* Speaking Equalizer Wave Bars */}
            {isSpeaking && (
              <div className="speaking-audio-equalizer-stage">
                <span className="eq-bar bar-1"></span>
                <span className="eq-bar bar-2"></span>
                <span className="eq-bar bar-3"></span>
                <span className="eq-bar bar-4"></span>
                <span className="eq-bar bar-5"></span>
              </div>
            )}
          </div>

          {/* Real-time State & Live Caption Card */}
          <div className="voice-live-caption-card">
            <div className="voice-state-indicator-row">
              <span className={`state-badge state-${robotState}`}>
                {statusText || (robotState === 'listening' ? '🎙️ Listening…' : robotState === 'speaking' ? '🔊 Speaking…' : '🤖 Ready')}
              </span>
            </div>

            <div className="voice-transcript-content" aria-live="polite">
              {robotState === 'listening' ? (
                interimTranscript ? (
                  <p className="transcript-live-text">"{interimTranscript}"</p>
                ) : (
                  <p className="transcript-placeholder">
                    Speak your symptoms in {langConfig.nativeName} ({langConfig.name})...
                  </p>
                )
              ) : robotState === 'thinking' ? (
                <div className="thinking-orbital-row">
                  <span className="orbit-dot"></span>
                  <span>Formulating healthcare guidance...</span>
                </div>
              ) : robotState === 'speaking' ? (
                <p className="speaking-caption-text">
                  "{messages[messages.length - 1]?.speechText || messages[messages.length - 1]?.text}"
                </p>
              ) : (
                <p className="transcript-placeholder">
                  Tap microphone or speak naturally to continue.
                </p>
              )}
            </div>
          </div>

          {/* Interactive Action Control Strip */}
          <div className="voice-main-action-dock">
            {isSpeaking && onInterruptVoice && (
              <button
                type="button"
                className="btn-voice-action btn-interrupt min-touch-target"
                onClick={onInterruptVoice}
                title="Interrupt assistant and speak now (Barge-in)"
              >
                ⚡ Speak Now (Barge-in)
              </button>
            )}

            {isSpeaking && onStopVoice && (
              <button
                type="button"
                className="btn-voice-action btn-stop-speaking-pill min-touch-target"
                onClick={onStopVoice}
                title="Stop speaking"
              >
                ⏹ Stop Speaking
              </button>
            )}

            {isListening && (
              <button
                type="button"
                className="btn-voice-action btn-done-listening min-touch-target"
                onClick={onToggleVoice}
                title="Finish speaking and submit query"
              >
                ⏹ Done Speaking
              </button>
            )}

            {onEndVoiceConversation && (
              <button
                type="button"
                className="btn-voice-action btn-end-conversation min-touch-target"
                onClick={onEndVoiceConversation}
                title="Stop voice conversation"
              >
                🛑 End Voice
              </button>
            )}

            {onToggleShowTextView && (
              <button
                type="button"
                className="btn-voice-action btn-toggle-drawer min-touch-target"
                onClick={onToggleShowTextView}
                title={showTextView ? 'Hide text view' : 'Show full text history'}
              >
                {showTextView ? '🎙️ Voice Only' : '💬 Show Text'}
              </button>
            )}
          </div>

          {/* Multilingual Selector Bar */}
          <LanguageSelector
            currentLang={currentLang}
            mode={langMode}
            onSelectLang={onSelectLang}
            onSetAutoMode={handleSetAuto}
          />

          {/* Optional Slide-Up Text Drawer */}
          {showTextView && (
            <div className="voice-drawer-messages-area" ref={drawerScrollRef}>
              <div className="drawer-header-row">
                <span className="drawer-title">Written Conversation Log</span>
                <button
                  type="button"
                  className="btn-close-drawer min-touch-target"
                  onClick={onToggleShowTextView}
                >
                  ✕ Close
                </button>
              </div>
              <AssistantMessages
                messages={messages}
                onNavigateTab={onNavigateTab}
                onSelectAction={onSendMessage}
                onToggleSpeakMessage={onToggleSpeakMessage}
                speakingMessageId={speakingMessageId}
                isSpeakingPaused={isSpeakingPaused}
                isThinking={isThinking}
              />
            </div>
          )}
        </div>
      ) : (
        /* -------------------- 3. HYBRID / TEXT & VOICE VIEW -------------------- */
        <>
          {/* Start Voice Conversation Banner Button */}
          {isVoiceSupported && onStartVoiceConversation && (
            <div className="start-voice-mode-banner">
              <button
                type="button"
                className="btn-start-voice-convo min-touch-target"
                onClick={onStartVoiceConversation}
              >
                <span className="btn-icon">🎙️</span>
                <span className="btn-text">
                  <strong>Start Voice Conversation</strong>
                  <small>Continuous back-and-forth conversation with Dr. Drishti</small>
                </span>
                <span className="btn-arrow">➔</span>
              </button>
            </div>
          )}

          {/* Multilingual Selector Bar */}
          <LanguageSelector
            currentLang={currentLang}
            mode={langMode}
            onSelectLang={onSelectLang}
            onSetAutoMode={handleSetAuto}
          />

          {/* Active Voice Playback Audio Strip */}
          {isSpeaking && (
            <div className="voice-playback-control-strip">
              <div className="playback-info-column">
                <div className="soundwave-animated">
                  <span className={`bar b1 ${isSpeakingPaused ? 'paused' : ''}`}></span>
                  <span className={`bar b2 ${isSpeakingPaused ? 'paused' : ''}`}></span>
                  <span className={`bar b3 ${isSpeakingPaused ? 'paused' : ''}`}></span>
                  <span className={`bar b4 ${isSpeakingPaused ? 'paused' : ''}`}></span>
                  <span className={`bar b5 ${isSpeakingPaused ? 'paused' : ''}`}></span>
                </div>
                <span className="playback-label">
                  {isSpeakingPaused
                    ? `Paused (${langConfig.nativeName})`
                    : `Speaking in ${langConfig.nativeName} (${langConfig.name})`}
                </span>
              </div>

              <div className="playback-actions-row">
                {isSpeakingPaused ? (
                  <button
                    type="button"
                    className="btn-audio-ctrl btn-resume min-touch-target"
                    onClick={onResumeVoice}
                    title="Resume voice playback"
                  >
                    ▶️
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-audio-ctrl btn-pause min-touch-target"
                    onClick={onPauseVoice}
                    title="Pause voice playback"
                  >
                    ⏸️
                  </button>
                )}

                <button
                  type="button"
                  className="btn-audio-ctrl btn-stop min-touch-target"
                  onClick={onStopVoice}
                  title="Stop voice playback"
                >
                  ⏹️
                </button>

                {onReplayVoice && (
                  <button
                    type="button"
                    className="btn-audio-ctrl btn-replay min-touch-target"
                    onClick={onReplayVoice}
                    title="Replay voice response"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Voice Error / Notice Toast */}
          {voiceErrorMessage && (
            <div className="voice-error-toast" role="alert">
              <span className="toast-icon">⚠️</span>
              <span className="toast-text">{voiceErrorMessage}</span>
              {onDismissVoiceError && (
                <button
                  type="button"
                  className="toast-close min-touch-target"
                  onClick={onDismissVoiceError}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Scrollable Message History Body */}
          <div className="panel-messages-scroll-area" ref={scrollRef}>
            <AssistantMessages
              messages={messages}
              onNavigateTab={onNavigateTab}
              onSelectAction={onSendMessage}
              onToggleSpeakMessage={onToggleSpeakMessage}
              speakingMessageId={speakingMessageId}
              isSpeakingPaused={isSpeakingPaused}
              isThinking={isThinking}
            />
          </div>

          {/* Input Area */}
          <AssistantInput
            onSendMessage={onSendMessage}
            onToggleVoice={onToggleVoice}
            onStopSpeaking={onStopVoice}
            isListening={isListening}
            isThinking={isThinking}
            isSpeaking={isSpeaking}
            isVoiceSupported={isVoiceSupported}
            statusText={statusText}
            interimTranscript={interimTranscript}
            quickSuggestions={quickSuggestions}
            onSelectSuggestion={onSendMessage}
            errorMessage={voiceErrorMessage}
            onDismissError={onDismissVoiceError}
            activeLang={currentLang}
          />
        </>
      )}
    </div>
  );
};
