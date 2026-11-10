import React, { useState, useEffect, useRef } from 'react';

interface AssistantInputProps {
  onSendMessage: (text: string, imageBase64?: string) => void;
  onToggleVoice: () => void;
  onStopSpeaking?: () => void;
  isListening: boolean;
  isThinking: boolean;
  isSpeaking?: boolean;
  isVoiceSupported: boolean;
  statusText?: string;
  interimTranscript?: string;
  placeholder?: string;
  quickSuggestions?: string[];
  onSelectSuggestion?: (text: string) => void;
  errorMessage?: string | null;
  onDismissError?: () => void;
  activeLang?: string;
}

export const AssistantInput: React.FC<AssistantInputProps> = ({
  onSendMessage,
  onToggleVoice,
  onStopSpeaking,
  isListening,
  isThinking,
  isSpeaking = false,
  isVoiceSupported,
  statusText,
  interimTranscript = '',
  placeholder = 'Type your question, attach photo, or tap mic...',
  quickSuggestions = [],
  onSelectSuggestion,
  errorMessage,
  onDismissError,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize interim speech transcript into the input preview
  useEffect(() => {
    if (isListening && interimTranscript) {
      setInputText(interimTranscript);
    }
  }, [isListening, interimTranscript]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setSelectedImage(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((inputText.trim() || selectedImage) && !isThinking) {
      const messageText = inputText.trim() || (selectedImage ? 'Please analyze this oral mucosal photo and tell me which doctor to consult.' : '');
      onSendMessage(messageText, selectedImage || undefined);
      setInputText('');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="assistant-input-container">
      {/* 1. ARIA Live Status Banner */}
      <div
        className="assistant-aria-status-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {statusText && (
          <div className="status-live-pill">
            <span
              className={`status-pulse-dot ${
                isListening
                  ? 'dot-listening'
                  : isThinking
                  ? 'dot-thinking'
                  : isSpeaking
                  ? 'dot-speaking'
                  : 'dot-idle'
              }`}
            />
            <span className="status-live-text">{statusText}</span>
          </div>
        )}
      </div>

      {/* 2. Error Message Banner with Actionable Advice */}
      {errorMessage && (
        <div className="assistant-error-alert-banner" role="alert">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{errorMessage}</span>
          {onDismissError && (
            <button
              type="button"
              className="error-dismiss-btn"
              onClick={onDismissError}
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 3. Active Speech Recognition Banner (Interim Transcript) */}
      {isListening && (
        <div className="voice-listening-live-bar animate-fade-in">
          <div className="listening-pulse-ring">
            <span className="listening-dot"></span>
          </div>
          <div className="listening-content-column">
            <span className="listening-status-label">🎙️ Live Recognition</span>
            <span className="listening-preview-transcript">
              {interimTranscript ? `"${interimTranscript}"` : 'Listening... Speak in Telugu, Hindi, or English.'}
            </span>
          </div>
          <button
            type="button"
            className="btn-cancel-voice-listen min-touch-target"
            onClick={onToggleVoice}
            title="Stop listening"
            aria-label="Stop listening"
          >
            ⏹ Done
          </button>
        </div>
      )}

      {/* 4. Active Speaking Stop / Barge-in Bar */}
      {isSpeaking && onStopSpeaking && (
        <div className="voice-speaking-live-bar animate-fade-in">
          <div className="speaking-sound-waves">
            <span className="wave-bar bar-1"></span>
            <span className="wave-bar bar-2"></span>
            <span className="wave-bar bar-3"></span>
          </div>
          <span className="speaking-label-txt">Dr. Drishti is speaking...</span>
          <button
            type="button"
            className="btn-stop-speaking min-touch-target"
            onClick={onStopSpeaking}
            title="Stop speaking"
            aria-label="Stop speaking"
          >
            ⏹ Stop
          </button>
        </div>
      )}

      {/* 5. Quick Contextual Suggestions */}
      {quickSuggestions.length > 0 && !isListening && !isSpeaking && (
        <div className="quick-suggestions-row">
          {quickSuggestions.map((sugg, idx) => (
            <button
              key={idx}
              type="button"
              className="suggestion-chip-btn"
              onClick={() => onSelectSuggestion?.(sugg)}
              disabled={isThinking}
            >
              {sugg}
            </button>
          ))}
        </div>
      )}

      {/* Selected Photo Thumbnail Preview Pill */}
      {selectedImage && (
        <div
          className="assistant-photo-preview-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 12px',
            background: 'rgba(6, 78, 59, 0.55)',
            borderRadius: '10px',
            border: '1.5px solid #10b981',
            margin: '0 8px 8px 8px',
          }}
        >
          <img
            src={selectedImage}
            alt="Oral cavity preview"
            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #34d399' }}
          />
          <div style={{ flex: 1, fontSize: '0.8rem', color: '#a7f3d0', lineHeight: 1.25 }}>
            <strong style={{ color: '#ffffff' }}>Oral Lesion Photo Attached</strong>
            <span style={{ display: 'block', fontSize: '0.72rem', color: '#6ee7b7' }}>
              Gemini Vision will screen lesion & recommend specialist doctor
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedImage(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              cursor: 'pointer',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
            }}
            title="Remove photo"
            aria-label="Remove photo"
          >
            ✕
          </button>
        </div>
      )}

      {/* 6. Text Input Field & Microphone / Photo Action Form */}
      <form onSubmit={handleSubmit} className="assistant-input-form">
        {/* Hidden File Input for Oral Photo */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoSelect}
          style={{ display: 'none' }}
          aria-label="Upload oral photo"
        />

        {/* Camera / Photo Attachment Button */}
        <button
          type="button"
          className="btn-input-photo min-touch-target"
          onClick={() => fileInputRef.current?.click()}
          disabled={isThinking}
          title="Attach oral photo for Gemini AI screening"
          aria-label="Attach oral photo"
          style={{
            background: selectedImage ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
            border: selectedImage ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '10px',
            color: selectedImage ? '#34d399' : '#cbd5e1',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
          }}
        >
          📷
        </button>

        <input
          type="text"
          className="assistant-text-field"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? interimTranscript || 'Listening to your speech...'
              : selectedImage
              ? 'Add a note or tap send to analyze oral photo...'
              : placeholder
          }
          disabled={isThinking}
          aria-label="Assistant question input"
        />

        {/* Microphone STT Button (Min 44px touch target) */}
        {isVoiceSupported && (
          <button
            type="button"
            className={`btn-input-mic min-touch-target ${
              isListening ? 'listening-active' : ''
            } ${isSpeaking ? 'speaking-interrupt' : ''}`}
            onClick={onToggleVoice}
            disabled={isThinking}
            title={
              isSpeaking
                ? 'Interrupt and speak now (Barge-in)'
                : isListening
                ? 'Stop listening'
                : 'Speak in Telugu, Hindi, or English'
            }
            aria-label={
              isSpeaking
                ? 'Interrupt and speak'
                : isListening
                ? 'Stop listening'
                : 'Microphone voice input'
            }
          >
            {isListening ? (
              <span className="mic-pulse-wave">🎙️</span>
            ) : isSpeaking ? (
              <span className="mic-barge-in-icon">⚡</span>
            ) : (
              <span>🎤</span>
            )}
          </button>
        )}

        {/* Send Button (Min 44px touch target) */}
        <button
          type="submit"
          className="btn-input-send min-touch-target"
          disabled={(!inputText.trim() && !selectedImage) || isThinking}
          title="Send message"
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
};
