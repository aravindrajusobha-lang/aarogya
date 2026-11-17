import { LanguageCode } from '../../i18n';

const ROMANIZED_TELUGU =
  /\b(ela|cheyali|cheyyali|cheyandi|unnaru|emiti|pundu|pundlu|noppi|naku|cheppandi|bagunnara|enti|ledu|undi|ayindi|kavali|ekada|ekkada|chupinchali|dantla|dantlo|kotha|noti|raktham|manchidi|pedda|chinna|evaru|evarini)\b/gi;
const ROMANIZED_HINDI =
  /\b(kaise|karna|karein|kare|karo|kripya|kya|mujhe|chala|chhale|dard|hai|bataiye|theek|nahi|hoga|daant|dant|khoon|mariz|aspatal|kahan|dikhao|dikhaen|pariwar)\b/gi;
const ROMANIZED_TAMIL =
  /\b(vanakkam|eppadi|irukkinga|enakku|ungalukku|sollunga|solunga|vaayil|maruththuvar|maruthuvam|aamaam|illai|pannunga)\b/gi;
const ROMANIZED_KANNADA =
  /\b(namaskara|hege|nimge|nanna|beku|yenu|yake|elli|heliri|maadi|rogiyu|baayalli|novu)\b/gi;
const ROMANIZED_MALAYALAM =
  /\b(sukhamano|engane|ningalkku|enikku|venam|evide|parayamo|vaayil|vedana|rogam|aashupathri)\b/gi;
const ENGLISH_MARKERS =
  /\b(i|you|your|the|is|are|my|how|what|when|where|please|can|could|should|have|has|with|for|and|to|help|patient|mouth|oral|health|screening|register|record|visit|consult|answer|use|show)\b/gi;

const SCRIPT_RANGES: Array<{ lang: LanguageCode; start: number; end: number }> = [
  { lang: 'te', start: 0x0c00, end: 0x0c7f },
  { lang: 'hi', start: 0x0900, end: 0x097f },
  { lang: 'ta', start: 0x0b80, end: 0x0bff },
  { lang: 'kn', start: 0x0c80, end: 0x0cff },
  { lang: 'ml', start: 0x0d00, end: 0x0d7f },
];

const countMatches = (text: string, pattern: RegExp): number =>
  [...text.matchAll(pattern)].length;

/**
 * Detects native script first, then common Telugu/Hindi transliteration.
 * Ambiguous Latin text keeps the active language unless it has clear English markers.
 */
export function detectLanguageFromText(text: string, fallbackLanguage: LanguageCode = 'en'): LanguageCode {
  const normalized = text.trim();
  if (!normalized) return fallbackLanguage;

  const scriptCounts = new Map<LanguageCode, number>();
  let latinCount = 0;
  for (const character of normalized) {
    if (!/\p{L}/u.test(character)) continue;
    if (/\p{Script=Latin}/u.test(character)) {
      latinCount++;
      continue;
    }
    const code = character.codePointAt(0)!;
    const range = SCRIPT_RANGES.find(({ start, end }) => code >= start && code <= end);
    if (range) {
      scriptCounts.set(range.lang, (scriptCounts.get(range.lang) || 0) + 1);
    }
  }

  const rankedScripts = [...scriptCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topScriptCount = rankedScripts[0]?.[1] || 0;
  const secondScriptCount = rankedScripts[1]?.[1] || 0;
  const hasClearScript = topScriptCount > secondScriptCount &&
    (latinCount === 0 || topScriptCount >= latinCount * 0.25);
  if (rankedScripts.length > 0 && hasClearScript) {
    return rankedScripts[0][0];
  }

  const lower = normalized.toLowerCase();
  const romanizedScores: Array<{ lang: LanguageCode; count: number }> = [
    { lang: 'te', count: countMatches(lower, ROMANIZED_TELUGU) },
    { lang: 'hi', count: countMatches(lower, ROMANIZED_HINDI) },
    { lang: 'ta', count: countMatches(lower, ROMANIZED_TAMIL) },
    { lang: 'kn', count: countMatches(lower, ROMANIZED_KANNADA) },
    { lang: 'ml', count: countMatches(lower, ROMANIZED_MALAYALAM) },
  ];
  romanizedScores.sort((a, b) => b.count - a.count);
  const minimumMarkers = romanizedScores[0].lang === 'te' || romanizedScores[0].lang === 'hi' ? 1 : 2;
  if (
    romanizedScores[0].count >= minimumMarkers &&
    romanizedScores[0].count > romanizedScores[1].count
  ) {
    return romanizedScores[0].lang;
  }
  if (countMatches(lower, ENGLISH_MARKERS) > 0) return 'en';

  return fallbackLanguage;
}

