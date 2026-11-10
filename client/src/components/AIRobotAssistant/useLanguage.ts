import { useState, useEffect, useCallback } from 'react';
import { LanguageCode } from '../../i18n';
import { detectLanguageFromText } from './languageDetector';

const STORAGE_LANG_KEY = 'aarogya_ai_robot_lang';
const STORAGE_MODE_KEY = 'aarogya_ai_robot_mode';

export type LanguageMode = 'auto' | 'manual';

export function useLanguage(initialLang: LanguageCode = 'en') {
  const [currentLang, setCurrentLang] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved && ['en', 'te', 'hi', 'ta', 'kn', 'ml'].includes(saved)) {
      return saved as LanguageCode;
    }
    return initialLang;
  });

  const [mode, setMode] = useState<LanguageMode>(() => {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    return saved === 'manual' ? 'manual' : 'auto';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_LANG_KEY, currentLang);
  }, [currentLang]);

  useEffect(() => {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  }, [mode]);

  const selectLanguage = useCallback((lang: LanguageCode, manual = true) => {
    setCurrentLang(lang);
    if (manual) {
      setMode('manual');
    }
  }, []);

  const handleInputTextDetection = useCallback(
    (text: string) => {
      if (mode === 'auto') {
        const detected = detectLanguageFromText(text);
        if (detected !== currentLang) {
          setCurrentLang(detected);
        }
        return detected;
      }
      return currentLang;
    },
    [mode, currentLang]
  );

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'auto' ? 'manual' : 'auto'));
  }, []);

  return {
    currentLang,
    mode,
    selectLanguage,
    setMode,
    toggleMode,
    handleInputTextDetection,
  };
}

