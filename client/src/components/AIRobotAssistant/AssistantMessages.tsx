import React from 'react';
import { RobotCharacter } from './RobotCharacter';
import { LanguageCode } from '../../i18n';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  speechText?: string;
  timestamp: string;
  language?: LanguageCode;
  navigateTo?: string | null;
  suggestedActions?: string[];
  imageUrl?: string;
  doctorRecommendation?: {
    specialty: string;
    facility: string;
    urgency: string;
    timelineDays: number;
    consultationReason: string;
  };
  photoAnalysis?: any;
}

interface AssistantMessagesProps {
  messages: ChatMessage[];
  onNavigateTab?: (tabId: string) => void;
  onSelectAction?: (actionText: string) => void;
  onToggleSpeakMessage?: (msg: ChatMessage) => void;
  speakingMessageId?: string | null;
  isSpeakingPaused?: boolean;
  isThinking?: boolean;
}

export const AssistantMessages: React.FC<AssistantMessagesProps> = ({
  messages,
  onNavigateTab,
  onSelectAction,
  onToggleSpeakMessage,
  speakingMessageId,
  isSpeakingPaused,
  isThinking,
}) => {
  const formatMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, index) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      return (
        <React.Fragment key={index}>
          {renderedLine}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div className="assistant-messages-container">
      {messages.map((msg) => {
        const isUser = msg.sender === 'user';
        const isSpeakingThis = !isUser && speakingMessageId === msg.id;

        return (
          <div
            key={msg.id}
            className={`assistant-chat-bubble-row ${isUser ? 'row-user' : 'row-assistant'}`}
          >
            {!isUser && (
              <div className="mini-robot-avatar-badge">
                <RobotCharacter
                  state={isSpeakingThis ? (isSpeakingPaused ? 'idle' : 'speaking') : 'idle'}
                  size={28}
                />
              </div>
            )}

            <div
              className={`chat-message-bubble ${isUser ? 'bubble-user' : 'bubble-assistant'} ${
                isSpeakingThis ? 'bubble-active-speaking' : ''
              }`}
            >
              {/* Attached Oral Photo Thumbnail */}
              {msg.imageUrl && (
                <div style={{ marginBottom: '8px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(52, 211, 153, 0.4)', maxWidth: '240px' }}>
                  <img src={msg.imageUrl} alt="Attached oral lesion" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '4px 8px', background: 'rgba(6, 78, 59, 0.7)', fontSize: '0.72rem', color: '#a7f3d0' }}>
                    📸 Attached Oral Cavity Photo
                  </div>
                </div>
              )}

              <div className="message-text-body">{formatMarkdown(msg.text)}</div>

              {/* Dedicated Doctor to Consult & Lesion Referral Card */}
              {!isUser && msg.doctorRecommendation && (
                <div
                  className="assistant-doctor-referral-card"
                  style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    background:
                      msg.doctorRecommendation.urgency === 'urgent'
                        ? 'rgba(239, 68, 68, 0.16)'
                        : 'rgba(6, 78, 59, 0.45)',
                    border: `1.5px solid ${
                      msg.doctorRecommendation.urgency === 'urgent' ? '#ef4444' : '#10b981'
                    }`,
                    borderRadius: '12px',
                    color: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#6ee7b7' }}>👨‍⚕️ Specialist to Consult</strong>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: msg.doctorRecommendation.urgency === 'urgent' ? '#ef4444' : '#059669',
                        color: '#ffffff',
                      }}
                    >
                      {msg.doctorRecommendation.urgency || 'Priority'}
                    </span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                    {msg.doctorRecommendation.specialty}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '6px' }}>
                    🏥 <strong>Referral Centre:</strong> {msg.doctorRecommendation.facility}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '4px' }}>
                    ⏱️ <strong>Recommended Window:</strong> Within {msg.doctorRecommendation.timelineDays || 14} days
                  </div>
                  {msg.doctorRecommendation.consultationReason && (
                    <div style={{ fontSize: '0.76rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '6px' }}>
                      Clinical Focus: {msg.doctorRecommendation.consultationReason}
                    </div>
                  )}
                </div>
              )}

              {/* One-Click Direct Application Navigation Link */}
              {!isUser && msg.navigateTo && onNavigateTab && (
                <div className="message-action-navigate">
                  <button
                    type="button"
                    className="btn-chat-navigate"
                    onClick={() => onNavigateTab(msg.navigateTo!)}
                  >
                    <span>👉 Open {msg.navigateTo.toUpperCase()} Module</span>
                  </button>
                </div>
              )}

              {/* Contextual Action / Suggested Follow-up Chips */}
              {!isUser && msg.suggestedActions && msg.suggestedActions.length > 0 && onSelectAction && (
                <div className="message-action-chips">
                  {msg.suggestedActions.map((action, aIdx) => (
                    <button
                      key={aIdx}
                      type="button"
                      className="chat-action-chip"
                      onClick={() => onSelectAction(action)}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              )}

              {/* Message Bottom Row: Audio Playback Toggle & Timestamp */}
              <div className="message-meta-footer">
                {!isUser && onToggleSpeakMessage && (
                  <button
                    type="button"
                    className={`btn-message-audio ${isSpeakingThis ? 'speaking-active' : ''}`}
                    onClick={() => onToggleSpeakMessage(msg)}
                    title={
                      isSpeakingThis
                        ? isSpeakingPaused
                          ? 'Resume voice reading'
                          : 'Stop voice reading'
                        : 'Listen to voice response aloud'
                    }
                    aria-label={isSpeakingThis ? 'Stop voice reading' : 'Listen aloud'}
                  >
                    {isSpeakingThis ? (
                      isSpeakingPaused ? (
                        <>
                          <span className="audio-icon">▶️</span>
                          <span className="audio-txt">Resume</span>
                        </>
                      ) : (
                        <>
                          <span className="soundwave-mini">
                            <span className="bar bar-1"></span>
                            <span className="bar bar-2"></span>
                            <span className="bar bar-3"></span>
                          </span>
                          <span className="audio-txt">Stop</span>
                        </>
                      )
                    ) : (
                      <>
                        <span className="audio-icon">🔊</span>
                        <span className="audio-txt">Listen</span>
                      </>
                    )}
                  </button>
                )}

                <span className="message-timestamp">{msg.timestamp}</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Thinking Indicator */}
      {isThinking && (
        <div className="assistant-chat-bubble-row row-assistant row-thinking">
          <div className="mini-robot-avatar-badge">
            <RobotCharacter state="thinking" size={28} />
          </div>
          <div className="chat-message-bubble bubble-assistant bubble-thinking">
            <div className="thinking-dots">
              <span className="dot dot-1"></span>
              <span className="dot dot-2"></span>
              <span className="dot dot-3"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
