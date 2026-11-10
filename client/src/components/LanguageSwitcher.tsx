import React from 'react';
import { LanguageCode } from '../i18n';

interface LanguageSwitcherProps {
  currentLang: LanguageCode;
  onSelect: (lang: LanguageCode) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ currentLang, onSelect }) => {
  return (
    <div className="lang-selector" aria-label="Language Selector">
      <button
        type="button"
        className={`lang-btn ${currentLang === 'en' ? 'active' : ''}`}
        onClick={() => onSelect('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={`lang-btn ${currentLang === 'te' ? 'active' : ''}`}
        onClick={() => onSelect('te')}
      >
        తెలుగు
      </button>
      <button
        type="button"
        className={`lang-btn ${currentLang === 'hi' ? 'active' : ''}`}
        onClick={() => onSelect('hi')}
      >
        हिन्दी
      </button>
      <button
        type="button"
        className={`lang-btn ${currentLang === 'ta' ? 'active' : ''}`}
        onClick={() => onSelect('ta')}
      >
        தமிழ்
      </button>
      <button
        type="button"
        className={`lang-btn ${currentLang === 'kn' ? 'active' : ''}`}
        onClick={() => onSelect('kn')}
      >
        ಕನ್ನಡ
      </button>
      <button
        type="button"
        className={`lang-btn ${currentLang === 'ml' ? 'active' : ''}`}
        onClick={() => onSelect('ml')}
      >
        മലയാളം
      </button>
    </div>
  );
};
