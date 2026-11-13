import React, { useEffect, useRef } from 'react';
import { RobotCharacter, RobotState } from './RobotCharacter';
import { LanguageSelector } from './LanguageSelector';
import { AssistantMessages, ChatMessage } from './AssistantMessages';
import { AssistantInput } from './AssistantInput';
import { LanguageCode } from '../../i18n';
import { LanguageMode } from './useLanguage';

interface Props {
  [key: string]: any;
  messages: ChatMessage[]; robotState: RobotState; currentLang: LanguageCode; langMode: LanguageMode;
  onSelectLang: (lang: any) => void; onSetAutoMode?: () => void;
  onSendMessage: (text: string, imageBase64?: string) => void; onToggleVoice: () => void;
  isListening: boolean; isThinking: boolean; isMuted: boolean; onToggleMute: () => void;
  isVoiceSupported: boolean; interimTranscript?: string; isSpeaking?: boolean;
  speakingLanguage?: LanguageCode; onStopVoice?: () => void; onToggleSpeakMessage?: (msg: ChatMessage) => void;
  speakingMessageId?: string | null; voiceErrorMessage?: string | null; onDismissVoiceError?: () => void;
  onClose: () => void; onNavigateTab?: (tabId: string) => void; isPatient?: boolean;
  statusText?: string; isSpeakingPaused?: boolean;
}

export const AssistantChatPanel: React.FC<Props> = ({ messages, robotState, currentLang, langMode, onSelectLang, onSetAutoMode, onSendMessage, onToggleVoice, isListening, isThinking, isMuted, onToggleMute, isVoiceSupported, interimTranscript = '', isSpeaking = false, onStopVoice, onToggleSpeakMessage, speakingMessageId, voiceErrorMessage, onDismissVoiceError, onClose, onNavigateTab, isPatient = false, statusText, isSpeakingPaused }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isThinking]);
  return <div className="assistant-chat-panel assistant-simple-panel" role="dialog" aria-label="Dr. Drishti assistant">
    <header className="panel-header-bar assistant-simple-header">
      <div className="header-robot-brand"><RobotCharacter state={robotState} size={34}/><div className="assistant-brand-title"><span>{isPatient ? 'Dr. Drishti Health Guide' : 'Dr. Drishti AI'}</span></div></div>
      <div className="assistant-simple-actions">
        <button type="button" className="btn-header-tool" onClick={onToggleMute} aria-label={isMuted ? 'Turn sound on' : 'Turn sound off'} title={isMuted ? 'Sound off' : 'Sound on'}>{isMuted ? '🔇' : '🔊'}</button>
        <button type="button" className="btn-header-tool btn-header-close" onClick={onClose} aria-label="Close assistant">×</button>
      </div>
    </header>
    <LanguageSelector currentLang={currentLang} mode={langMode} onSelectLang={onSelectLang} onSetAutoMode={onSetAutoMode || (() => {})}/>
    {(isListening || isSpeaking || isThinking) && <div className="assistant-simple-status" role="status">{statusText || (isListening ? `Listening in ${currentLang.toUpperCase()}…` : isThinking ? 'Thinking…' : 'Speaking…')} {isListening && interimTranscript ? ` “${interimTranscript}”` : ''}</div>}
    {voiceErrorMessage && <div className="assistant-error-alert-banner" role="alert">{voiceErrorMessage}<button onClick={onDismissVoiceError}>×</button></div>}
    <div className="assistant-simple-messages" ref={scrollRef}>
      <AssistantMessages messages={messages} onNavigateTab={onNavigateTab} onSelectAction={onSendMessage} onToggleSpeakMessage={onToggleSpeakMessage} speakingMessageId={speakingMessageId} isSpeakingPaused={isSpeakingPaused} isThinking={isThinking}/>
      {isThinking && <div className="assistant-simple-thinking">Thinking…</div>}
    </div>
    <AssistantInput onSendMessage={onSendMessage} onToggleVoice={onToggleVoice} onStopSpeaking={onStopVoice} isListening={isListening} isThinking={isThinking} isSpeaking={isSpeaking} isVoiceSupported={isVoiceSupported} interimTranscript={interimTranscript} placeholder="Type a message or use the microphone…" quickSuggestions={[]} errorMessage={null}/>
  </div>;
};
