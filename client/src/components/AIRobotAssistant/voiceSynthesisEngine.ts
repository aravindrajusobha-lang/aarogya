/**
 * MULTILINGUAL FEMALE VOICE SYNTHESIS ENGINE
 * 
 * Rules:
 * 1. Female voice priority per language:
 *    (1) Female voice matching lang exactly (te-IN / hi-IN / en-IN)
 *    (2) Any voice matching lang
 *    (3) Fallback notice: NEVER read Telugu or Hindi with an English voice!
 * 2. Rate ~0.9, pitch ~1.05.
 * 3. Split long text into sentence chunks to prevent Chrome utterance cutoff.
 * 4. Watchdog timer to prevent Chrome speech stall.
 * 5. Instant cancel on barge-in / unmount.
 */

import { VoiceLangCode } from './languageDetectionEngine';

// Female voice name hints
const FEMALE_VOICE_HINTS: Record<VoiceLangCode, string[]> = {
  te: ['shruti', 'swathi', 'vani', 'chitra', 'telugu female', 'google తెలుగు', 'te-in'],
  hi: ['kalpana', 'swara', 'ananya', 'geeta', 'sunita', 'hindi female', 'google हिन्दी', 'hi-in'],
  en: ['heera', 'neerja', 'priya', 'jenny', 'zira', 'sonia', 'hazel', 'samantha', 'karen', 'en-in'],
};

// Explicit male keywords to avoid
const MALE_VOICE_REGEX = /\b(male|david|mark|george|ravi|mohan|madhav|prabhat|guy|steven|james)\b/i;

export interface VoiceResolutionResult {
  voice: SpeechSynthesisVoice | null;
  voiceName: string;
  isFemale: boolean;
  canSpeak: boolean;
  reason?: string;
}

export class MultilingualVoiceSynthesizer {
  private voices: SpeechSynthesisVoice[] = [];
  private isSpeaking = false;
  private currentUtteranceChunks: SpeechSynthesisUtterance[] = [];
  private currentChunkIndex = 0;
  private resumeWatchdog: any = null;
  private onFinishedCallback: (() => void) | null = null;
  private onErrorCallback: ((err: string) => void) | null = null;

  constructor() {
    this.initVoices();
  }

  public initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const update = () => {
      this.voices = window.speechSynthesis.getVoices() || [];
    };

    update();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = update;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices() || [];
    }
    return this.voices;
  }

  /**
   * Resolve best female voice for target language
   * Enforces: NEVER read Telugu or Hindi with an English voice!
   */
  public resolveVoice(lang: VoiceLangCode): VoiceResolutionResult {
    const all = this.getAvailableVoices();
    const targetBcp47 = lang === 'te' ? 'te-in' : lang === 'hi' ? 'hi-in' : 'en-in';
    const hints = FEMALE_VOICE_HINTS[lang] || [];

    // Filter voices that match the language (exact or prefix match e.g. "te" or "te-IN")
    const matchingVoices = all.filter((v) => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      return vLang === targetBcp47 || vLang.startsWith(`${lang}-`) || vLang === lang;
    });

    if (matchingVoices.length === 0) {
      // If language is Telugu or Hindi, NEVER fall back to English voice!
      if (lang === 'te' || lang === 'hi') {
        return {
          voice: null,
          voiceName: 'None',
          isFemale: false,
          canSpeak: false,
          reason: `No native ${lang === 'te' ? 'Telugu' : 'Hindi'} voice is installed on this device.`,
        };
      }
      // For English, check if any English voice exists
      const enVoice = all.find((v) => v.lang.toLowerCase().startsWith('en'));
      return {
        voice: enVoice || null,
        voiceName: enVoice?.name || 'Default English',
        isFemale: false,
        canSpeak: !!enVoice,
      };
    }

    // 1. Look for explicit female voice matching name hints without male keywords
    for (const v of matchingVoices) {
      const vName = v.name.toLowerCase();
      if (MALE_VOICE_REGEX.test(vName)) continue;
      if (hints.some((hint) => vName.includes(hint))) {
        return {
          voice: v,
          voiceName: v.name,
          isFemale: true,
          canSpeak: true,
        };
      }
    }

    // 2. Look for any voice not explicitly marked male
    const nonMale = matchingVoices.find((v) => !MALE_VOICE_REGEX.test(v.name.toLowerCase()));
    if (nonMale) {
      return {
        voice: nonMale,
        voiceName: nonMale.name,
        isFemale: true, // Pitch parameter will ensure gentle feminine tone
        canSpeak: true,
      };
    }

    // 3. Fallback to first matching language voice
    return {
      voice: matchingVoices[0],
      voiceName: matchingVoices[0].name,
      isFemale: false,
      canSpeak: true,
    };
  }

  /**
   * Split text into sentence chunks at punctuation boundaries (. ! ? । | \n)
   */
  public chunkText(text: string): string[] {
    if (!text) return [];
    // Clean emojis, markdown symbols, asterisks, URLs, hashes before speech
    const clean = text
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[*_#`~>[\]()]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    // Split on Indian danda (| / ।), periods, exclamation, questions, newlines
    const rawChunks = clean.split(/([.!?।|\n]+)/);
    const chunks: string[] = [];
    let current = '';

    for (let i = 0; i < rawChunks.length; i++) {
      const part = rawChunks[i].trim();
      if (!part) continue;
      if (/^[.!?।|\n]+$/.test(part)) {
        current += part;
      } else {
        current += (current ? ' ' : '') + part;
      }
      // If current chunk is over 60 characters or ends in punctuation, push it
      if (current.length >= 60 || /[.!?।|\n]$/.test(part)) {
        chunks.push(current);
        current = '';
      }
    }
    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [clean];
  }

  /**
   * Speak response with female tone and sentence chunking
   */
  public speak(
    text: string,
    lang: VoiceLangCode,
    onFinished?: () => void,
    onError?: (err: string) => void
  ): { success: boolean; reason?: string } {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError?.('Speech synthesis not supported in this browser.');
      return { success: false, reason: 'unsupported' };
    }

    // Cancel any current utterance before starting new one
    this.stop();

    const resolution = this.resolveVoice(lang);
    if (!resolution.canSpeak || !resolution.voice) {
      const err = resolution.reason || `No voice available for ${lang}.`;
      onError?.(err);
      return { success: false, reason: err };
    }

    const chunks = this.chunkText(text);
    if (chunks.length === 0) {
      onFinished?.();
      return { success: true };
    }

    this.isSpeaking = true;
    this.onFinishedCallback = onFinished || null;
    this.onErrorCallback = onError || null;
    this.currentChunkIndex = 0;

    this.currentUtteranceChunks = chunks.map((chunk) => {
      const utt = new SpeechSynthesisUtterance(chunk);
      utt.voice = resolution.voice;
      utt.lang = resolution.voice!.lang;
      utt.rate = 0.9; // Calm, deliberate pace suitable for rural healthcare
      utt.pitch = 1.05; // Friendly, warm female tone

      utt.onend = () => {
        if (!this.isSpeaking) return;
        this.currentChunkIndex++;
        if (this.currentChunkIndex < this.currentUtteranceChunks.length) {
          window.speechSynthesis.speak(this.currentUtteranceChunks[this.currentChunkIndex]);
        } else {
          this.stop();
          this.onFinishedCallback?.();
        }
      };

      utt.onerror = (e) => {
        // If aborted by barge-in or cancel, do not treat as error
        if (e.error === 'canceled' || e.error === 'interrupted') {
          return;
        }
        this.stop();
        this.onErrorCallback?.(`TTS Error: ${e.error}`);
      };

      return utt;
    });

    // Start Chrome watchdog: every 8s call resume() to avoid silence stalls
    this.startWatchdog();

    try {
      window.speechSynthesis.speak(this.currentUtteranceChunks[0]);
      return { success: true };
    } catch (e: any) {
      this.stop();
      onError?.(e.message || 'Speech execution failed');
      return { success: false, reason: e.message };
    }
  }

  private startWatchdog(): void {
    this.clearWatchdog();
    this.resumeWatchdog = setInterval(() => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    }, 5000);
  }

  private clearWatchdog(): void {
    if (this.resumeWatchdog) {
      clearInterval(this.resumeWatchdog);
      this.resumeWatchdog = null;
    }
  }

  /**
   * Stop speaking immediately (Barge-in / Cancel)
   */
  public stop(): void {
    this.isSpeaking = false;
    this.clearWatchdog();
    this.currentUtteranceChunks = [];
    this.currentChunkIndex = 0;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cancel errors
      }
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}
