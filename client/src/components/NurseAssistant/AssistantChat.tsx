import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './types';
import { LanguageCode } from '../../i18n';

interface AssistantChatProps {
  messages: ChatMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  onSendMessage: (text: string) => void;
  onSuggestedAction: (actionText: string) => void;
  onNavigateTo: (targetTab: string) => void;
  isThinking: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  currentLang: LanguageCode;
  onSelectLang: (lang: LanguageCode) => void;
  statusMessage?: string;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  messages,
  inputText,
  setInputText,
  onSendMessage,
  onSuggestedAction,
  onNavigateTo,
  isThinking,
  isSpeaking,
  isListening,
  onToggleMic,
  onStopSpeaking,
  currentLang,
  onSelectLang,
  statusMessage,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking, isSpeaking]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="assistant-chat-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '340px' }}>
      {/* Top Language & Audio Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'var(--paper-warm)',
          borderBottom: '1px solid var(--line)',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 600, color: 'var(--slate)' }}>Language:</span>
          <div className="segmented-toggle-mini" style={{ display: 'flex', gap: '2px', background: 'var(--white)', padding: '2px', borderRadius: '4px', border: '1px solid var(--line)' }}>
            <button
              type="button"
              className={currentLang === 'en' ? 'active' : ''}
              onClick={() => onSelectLang('en')}
              style={{
                background: currentLang === 'en' ? 'var(--coral)' : 'transparent',
                color: currentLang === 'en' ? '#fff' : 'var(--slate-soft)',
                border: 'none',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: currentLang === 'en' ? 700 : 400,
              }}
            >
              EN
            </button>
            <button
              type="button"
              className={currentLang === 'te' ? 'active' : ''}
              onClick={() => onSelectLang('te')}
              style={{
                background: currentLang === 'te' ? 'var(--coral)' : 'transparent',
                color: currentLang === 'te' ? '#fff' : 'var(--slate-soft)',
                border: 'none',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: currentLang === 'te' ? 700 : 400,
              }}
            >
              తెలుగు
            </button>
            <button
              type="button"
              className={currentLang === 'hi' ? 'active' : ''}
              onClick={() => onSelectLang('hi')}
              style={{
                background: currentLang === 'hi' ? 'var(--coral)' : 'transparent',
                color: currentLang === 'hi' ? '#fff' : 'var(--slate-soft)',
                border: 'none',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: currentLang === 'hi' ? 700 : 400,
              }}
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Audio Stop Button if nurse is speaking */}
        {isSpeaking && (
          <button
            type="button"
            onClick={onStopSpeaking}
            style={{
              background: 'var(--coral)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 600,
            }}
          >
            ⏹️ Stop Speaking
          </button>
        )}
      </div>

      {/* Audio Waveform Bar during Voice interaction */}
      {(isSpeaking || isListening) && (
        <div
          style={{
            background: isListening ? '#fef2f2' : '#f0fdf4',
            borderBottom: `1px solid ${isListening ? '#fca5a5' : '#bbf7d0'}`,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: isListening ? '#991b1b' : '#166534',
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {isListening ? '🎙️ Listening... (Speak now)' : '🔊 Drishti AI is speaking...'}
          </span>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            <span className="wave-bar" style={{ width: '3px', height: '10px', background: isListening ? '#ef4444' : '#10b981', borderRadius: '2px', animation: 'waveBar 0.6s infinite alternate' }} />
            <span className="wave-bar" style={{ width: '3px', height: '14px', background: isListening ? '#ef4444' : '#10b981', borderRadius: '2px', animation: 'waveBar 0.8s infinite alternate 0.1s' }} />
            <span className="wave-bar" style={{ width: '3px', height: '8px', background: isListening ? '#ef4444' : '#10b981', borderRadius: '2px', animation: 'waveBar 0.7s infinite alternate 0.2s' }} />
            <span className="wave-bar" style={{ width: '3px', height: '12px', background: isListening ? '#ef4444' : '#10b981', borderRadius: '2px', animation: 'waveBar 0.5s infinite alternate 0.3s' }} />
          </div>
        </div>
      )}

      {/* Messages Scroll View */}
      <div
        className="assistant-messages-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '380px',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                width: '100%',
              }}
            >
              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: isUser ? 'var(--coral)' : 'var(--white)',
                  color: isUser ? '#ffffff' : 'var(--slate)',
                  border: isUser ? 'none' : '1px solid var(--line)',
                  boxShadow: '0 2px 8px rgba(32, 41, 67, 0.05)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--coral)',
                    }}
                  >
                    <span>👩‍⚕️ Drishti AI</span>
                    {msg.animation && (
                      <span
                        style={{
                          background: 'var(--paper-warm)',
                          color: 'var(--slate-soft)',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          fontWeight: 500,
                        }}
                      >
                        [{msg.animation}]
                      </span>
                    )}
                  </div>
                )}
                {msg.text}

                {/* Direct Page Navigation CTA Pill */}
                {msg.navigateTo && (
                  <div style={{ marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => onNavigateTo(msg.navigateTo!)}
                      style={{
                        background: 'var(--slate)',
                        color: 'var(--paper)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 600,
                      }}
                    >
                      <span>🚀</span> Open {msg.navigateTo.toUpperCase()} Module
                    </button>
                  </div>
                )}

                <span
                  style={{
                    display: 'block',
                    fontSize: '0.65rem',
                    opacity: 0.7,
                    marginTop: '4px',
                    textAlign: isUser ? 'right' : 'left',
                  }}
                >
                  {msg.timestamp}
                </span>
              </div>

              {/* Suggested Action Chips below Nurse Responses */}
              {!isUser && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', maxWidth: '90%' }}>
                  {msg.suggestedActions.map((action, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSuggestedAction(action)}
                      style={{
                        background: 'var(--paper-warm)',
                        color: 'var(--slate)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        padding: '3px 10px',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.background = 'var(--coral)';
                        (e.target as HTMLElement).style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.background = 'var(--paper-warm)';
                        (e.target as HTMLElement).style.color = 'var(--slate)';
                      }}
                    >
                      💡 {action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isThinking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--paper-warm)', borderRadius: '12px', width: 'fit-content' }}>
            <span style={{ fontSize: '0.9rem' }}>🤔</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--slate-soft)', fontWeight: 600 }}>Drishti AI is thinking...</span>
            <div style={{ display: 'flex', gap: '3px' }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--coral)', animation: 'waveBar 0.6s infinite alternate' }} />
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--coral)', animation: 'waveBar 0.6s infinite alternate 0.2s' }} />
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--coral)', animation: 'waveBar 0.6s infinite alternate 0.4s' }} />
            </div>
          </div>
        )}

        {statusMessage && (
          <div
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              color: 'var(--coral)',
              fontStyle: 'italic',
              background: 'rgba(235, 94, 85, 0.08)',
              borderRadius: '6px',
              margin: '4px 0',
            }}
          >
            {statusMessage}
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input Bar with Mic & Send */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 12px',
          background: 'var(--paper-warm)',
          borderTop: '1px solid var(--line)',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={onToggleMic}
          className={`mic-btn ${isListening ? 'listening' : ''}`}
          style={{
            background: isListening ? '#ef4444' : 'var(--white)',
            color: isListening ? '#ffffff' : 'var(--slate)',
            border: `1px solid ${isListening ? '#dc2626' : 'var(--line)'}`,
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1rem',
            flexShrink: 0,
            transition: 'all 0.2s ease',
            boxShadow: isListening ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none',
          }}
          title={isListening ? 'Stop Listening' : 'Click to Speak (Voice Input)'}
        >
          {isListening ? '⏹️' : '🎙️'}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            currentLang === 'te'
              ? 'నోటి ఆరోగ్యం, క్యాంపులు లేదా గ్రామాల గురించి అడగండి...'
              : currentLang === 'hi'
              ? 'मुंह के स्वास्थ्य, कैंप या गांवों के बारे में पूछें...'
              : 'Ask about oral health, camps, or tribal mandals...'
          }
          style={{
            flex: 1,
            background: 'var(--white)',
            border: '1px solid var(--line)',
            borderRadius: '20px',
            padding: '8px 14px',
            fontSize: '0.86rem',
            color: 'var(--slate)',
            outline: 'none',
          }}
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isThinking}
          style={{
            background: inputText.trim() && !isThinking ? 'var(--coral)' : '#e2e8f0',
            color: inputText.trim() && !isThinking ? '#ffffff' : '#94a3b8',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: inputText.trim() && !isThinking ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};
