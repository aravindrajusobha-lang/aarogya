import React from 'react';

export type AssistantLanguage = 'te' | 'hi' | 'en';
export type SelectorMode = 'auto' | 'manual';

interface LanguageSelectorProps {
  currentLang: AssistantLanguage | string;
  mode: SelectorMode;
  onSelectLang: (lang: AssistantLanguage) => void;
  onSetAutoMode: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLang,
  mode,
  onSelectLang,
  onSetAutoMode,
}) => {
  const isAuto = mode === 'auto';

  return (
    <div
      className="robot-lang-selector-bar"
      role="radiogroup"
      aria-label="Assistant Language Selection"
    >
      {/* 1. Auto Detect Option */}
      <button
        type="button"
        role="radio"
        aria-checked={isAuto}
        className={`lang-segmented-btn ${isAuto ? 'active auto-active' : ''}`}
        onClick={onSetAutoMode}
        title="Auto Detect: Automatically recognizes spoken Telugu, Hindi, or English"
      >
        <span className="lang-icon">🌐</span>
        <span className="lang-txt">Auto Detect</span>
      </button>

      {/* 2. Telugu Option */}
      <button
        type="button"
        role="radio"
        aria-checked={!isAuto && currentLang === 'te'}
        className={`lang-segmented-btn ${!isAuto && currentLang === 'te' ? 'active' : ''}`}
        onClick={() => onSelectLang('te')}
        title="Telugu (తెలుగు) - te-IN"
      >
        <span className="lang-txt">తెలుగు</span>
      </button>

      {/* 3. Hindi Option */}
      <button
        type="button"
        role="radio"
        aria-checked={!isAuto && currentLang === 'hi'}
        className={`lang-segmented-btn ${!isAuto && currentLang === 'hi' ? 'active' : ''}`}
        onClick={() => onSelectLang('hi')}
        title="Hindi (हिंदी) - hi-IN"
      >
        <span className="lang-txt">हिंदी</span>
      </button>

      {/* 4. English Option */}
      <button
        type="button"
        role="radio"
        aria-checked={!isAuto && currentLang === 'en'}
        className={`lang-segmented-btn ${!isAuto && currentLang === 'en' ? 'active' : ''}`}
        onClick={() => onSelectLang('en')}
        title="English (India) - en-IN"
      >
        <span className="lang-txt">English</span>
      </button>
    </div>
  );
};
