import { LanguageCode } from '../../i18n';

/**
 * Unicode-based script detector for Indian languages and English.
 */
export function detectLanguageFromText(text: string): LanguageCode {
  if (!text || !text.trim()) return 'en';

  let teCount = 0;
  let hiCount = 0;
  let taCount = 0;
  let knCount = 0;
  let mlCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    // Telugu: 0x0C00 - 0x0C7F
    if (code >= 0x0c00 && code <= 0x0c7f) {
      teCount++;
    }
    // Devanagari (Hindi): 0x0900 - 0x097F
    else if (code >= 0x0900 && code <= 0x097f) {
      hiCount++;
    }
    // Tamil: 0x0B80 - 0x0BFF
    else if (code >= 0x0b80 && code <= 0x0bff) {
      taCount++;
    }
    // Kannada: 0x0C80 - 0x0CFF
    else if (code >= 0x0c80 && code <= 0x0cff) {
      knCount++;
    }
    // Malayalam: 0x0D00 - 0x0D7F
    else if (code >= 0x0d00 && code <= 0x0d7f) {
      mlCount++;
    }
  }

  const scores = [
    { lang: 'te' as LanguageCode, count: teCount },
    { lang: 'hi' as LanguageCode, count: hiCount },
    { lang: 'ta' as LanguageCode, count: taCount },
    { lang: 'kn' as LanguageCode, count: knCount },
    { lang: 'ml' as LanguageCode, count: mlCount },
  ];

  scores.sort((a, b) => b.count - a.count);

  if (scores[0].count > 0) {
    return scores[0].lang;
  }

  return 'en';
}

