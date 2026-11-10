/**
 * MULTILINGUAL VOICE LANGUAGE DETECTION & CANDIDATE SEQUENCING ENGINE
 * 
 * Supports:
 * - Telugu (te-IN / 'te')
 * - Hindi (hi-IN / 'hi')
 * - English (en-IN / 'en')
 * - Auto Detect ('auto')
 * 
 * Rules:
 * 1. Default STT language: te-IN on first run.
 * 2. Script detection: Telugu (U+0C00–U+0C7F), Devanagari (U+0900–U+097F), Latin = English.
 * 3. Candidate cycling: If STT transcript is empty or script does not match recognition lang, retry once with candidate lang.
 * 4. Language stickiness: Keeps confirmed language until manual switch or 2 consecutive turns in another language.
 * 5. Manual lock: When manually selected, NEVER auto-switch.
 */

export type VoiceLangCode = 'te' | 'hi' | 'en';
export type VoiceBCP47 = 'te-IN' | 'hi-IN' | 'en-IN';
export type VoiceSelectionMode = 'auto' | 'manual';

export interface LanguageOption {
  code: VoiceLangCode;
  bcp47: VoiceBCP47;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_VOICE_LANGUAGES: Record<VoiceLangCode, LanguageOption> = {
  te: { code: 'te', bcp47: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు' },
  hi: { code: 'hi', bcp47: 'hi-IN', label: 'Hindi', nativeLabel: 'हिंदी' },
  en: { code: 'en', bcp47: 'en-IN', label: 'English', nativeLabel: 'English' },
};

export const DEFAULT_INITIAL_VOICE_LANG: VoiceLangCode = 'te';

/**
 * Detect script based on Unicode codepoints
 */
export function detectScriptFromText(text: string): VoiceLangCode | null {
  if (!text || !text.trim()) return null;

  let teCount = 0;
  let hiCount = 0;
  let latinCount = 0;

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
    // Latin: A-Z, a-z
    else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      latinCount++;
    }
  }

  // Priority to Indic scripts if present
  if (teCount > 0 && teCount >= hiCount) return 'te';
  if (hiCount > 0 && hiCount > teCount) return 'hi';
  if (latinCount > 0) {
    // Check for common Romanized Telugu or Hindi markers
    const lower = text.toLowerCase();
    const teluguSpecific = /\b(ela|cheyali|cheyyali|cheyandi|unnaru|emiti|pundu|pundlu|noppi|naku|cheppandi|bagunnara|enti|ledu|undi|ayindi|kavali|ekada|ekkada|chupinchali|dantla|dantlo|kotha|noti|raktham|manchidi|pedda|chinna|evaru|evarini)\b/i;
    const hindiSpecific = /\b(kaise|karna|karein|kare|karo|kripya|kya|mujhe|chala|chhale|dard|hai|bataiye|theek|nahi|hoga|daant|dant|khoon|mariz|aspatal|kahan|dikhao|dikhaen|pariwar)\b/i;
    if (hindiSpecific.test(lower) && !teluguSpecific.test(lower)) return 'hi';
    if (teluguSpecific.test(lower) && !hindiSpecific.test(lower)) return 'te';
    return 'en';
  }

  return null;
}

/**
 * Manages sticky language state and candidate cycling
 */
export class LanguageSessionManager {
  private mode: VoiceSelectionMode = 'auto';
  private currentLanguage: VoiceLangCode = DEFAULT_INITIAL_VOICE_LANG;
  private pendingDifferentLangCount = 0;
  private lastDetectedLang: VoiceLangCode | null = null;
  private candidateIndex = 0;

  private candidateSequence: VoiceLangCode[] = ['te', 'hi', 'en'];

  constructor(initialLang: VoiceLangCode = DEFAULT_INITIAL_VOICE_LANG, initialMode: VoiceSelectionMode = 'auto') {
    this.currentLanguage = initialLang;
    this.mode = initialMode;
  }

  public getMode(): VoiceSelectionMode {
    return this.mode;
  }

  public setMode(mode: VoiceSelectionMode): void {
    this.mode = mode;
  }

  public getCurrentLanguage(): VoiceLangCode {
    return this.currentLanguage;
  }

  public getCurrentBCP47(): VoiceBCP47 {
    return SUPPORTED_VOICE_LANGUAGES[this.currentLanguage]?.bcp47 || 'te-IN';
  }

  public setManualLanguage(lang: VoiceLangCode): void {
    this.currentLanguage = lang;
    this.mode = 'manual';
    this.pendingDifferentLangCount = 0;
  }

  public getNextCandidateLanguage(): VoiceLangCode {
    this.candidateIndex = (this.candidateIndex + 1) % this.candidateSequence.length;
    return this.candidateSequence[this.candidateIndex];
  }

  public resetCandidateSequence(): void {
    this.candidateIndex = this.candidateSequence.indexOf(this.currentLanguage);
    if (this.candidateIndex === -1) this.candidateIndex = 0;
  }

  /**
   * Process incoming transcript:
   * Returns the language that should be used for answering.
   */
  public processTranscript(transcript: string): VoiceLangCode {
    if (this.mode === 'manual') {
      // Manual selection strictly locked: never auto-switch
      return this.currentLanguage;
    }

    const detected = detectScriptFromText(transcript);
    if (!detected) {
      return this.currentLanguage;
    }

    if (detected === this.currentLanguage) {
      this.pendingDifferentLangCount = 0;
      return this.currentLanguage;
    }

    // Patient spoke a different language:
    // Requires 2 consecutive turns in the new language to switch sticky state
    if (this.lastDetectedLang === detected) {
      this.pendingDifferentLangCount++;
      if (this.pendingDifferentLangCount >= 2) {
        this.currentLanguage = detected;
        this.pendingDifferentLangCount = 0;
        this.resetCandidateSequence();
      }
    } else {
      this.lastDetectedLang = detected;
      this.pendingDifferentLangCount = 1;
    }

    // For the immediate turn, answer in the detected language of this utterance
    return detected;
  }
}
