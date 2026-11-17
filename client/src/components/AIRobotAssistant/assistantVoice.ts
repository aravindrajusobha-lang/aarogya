import { LanguageCode } from '../../i18n';
import { SUPPORTED_LANGUAGES } from './languageConfig';

export interface FemaleVoiceInfo {
  voice: SpeechSynthesisVoice | null;
  name: string;
  isExplicitFemale: boolean;
  canSpeak: boolean;
  limitationNotice?: string;
  pitch: number;
  rate: number;
}

export interface VoiceCallbacks {
  onStartListening?: () => void;
  onStopListening?: () => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (errMessage: string) => void;
  onStartSpeaking?: (text: string, lang: LanguageCode, voiceInfo: FemaleVoiceInfo) => void;
  onPauseSpeaking?: () => void;
  onResumeSpeaking?: () => void;
  onStopSpeaking?: () => void;
  onVoicesLoaded?: (voices: SpeechSynthesisVoice[]) => void;
  onContinuousCycleReady?: (lang: LanguageCode) => void;
}

// Explicit male keywords to reject when selecting female voices
const MALE_KEYWORD_REGEX = /\b(male|david|mark|george|ravi|mohan|madhav|valluvar|gagan|midhun|prabhat|guy|steven|james|richard|stefan|bernard)\b/i;

// Preferred female voice targets per language
const FEMALE_VOICE_TARGETS: Record<LanguageCode, string[]> = {
  en: [
    'heera',
    'neerja',
    'jenny',
    'zira',
    'sonia',
    'libby',
    'hazel',
    'priya',
    'samantha',
    'victoria',
    'karen',
    'google uk english female',
    'google us english female',
    'en-in',
  ],
  te: [
    'shruti',
    'telugu female',
    'te-in-shruti',
    'swathi',
    'vani',
    'chitra',
    'google తెలుగు',
    'te-in',
    'telugu',
    'heera', // Fallback to Indian English/Hindi voice for phonetic clarity if Telugu pack is missing
    'neerja',
    'swara',
  ],
  hi: [
    'kalpana',
    'swara',
    'hindi female',
    'hi-in-kalpana',
    'hi-in-swara',
    'ananya',
    'geeta',
    'sunita',
    'google हिन्दी',
    'hi-in',
    'hindi',
    'heera',
    'neerja',
  ],
  ta: ['pallavi', 'saranya', 'tamil female', 'ta-in', 'tamil', 'heera'],
  kn: ['sapna', 'kannada female', 'kn-in', 'kannada', 'heera'],
  ml: ['sobhana', 'malayalam female', 'ml-in', 'malayalam', 'heera'],
};

export class AssistantVoiceEngine {
  private recognition: any = null;
  private isListening = false;
  private isMuted = false;
  private isSpeaking = false;
  private isPaused = false;
  private isContinuousMode = true;
  private currentText = '';
  private lastSpokenText = '';
  private finalTranscript = '';
  private currentLang: LanguageCode = 'te';
  private callbacks: VoiceCallbacks = {};
  private voices: SpeechSynthesisVoice[] = [];
  private resumeTimeoutTimer: any = null;
  private silenceTimer: any = null;
  private currentChunks: SpeechSynthesisUtterance[] = [];
  private currentChunkIndex = 0;
  private watchdogTimer: any = null;

  constructor(callbacks: VoiceCallbacks = {}) {
    this.callbacks = callbacks;
    this.initSpeechRecognition();
    this.initVoices();
  }

  public setCallbacks(callbacks: VoiceCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public isSpeechRecognitionSupported(): boolean {
    return this.recognition !== null;
  }

  public isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private initVoices() {
    if (!this.isSpeechSynthesisSupported()) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices() || [];
      if (v.length > 0) {
        this.voices = v;
        this.callbacks.onVoicesLoaded?.(this.voices);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  private initSpeechRecognition() {
    if (
      typeof window === 'undefined' ||
      !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      return;
    }

    try {
      const SpeechRec =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 3;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.callbacks.onStartListening?.();
        this.resetSilenceTimer();
      };

      this.recognition.onresult = (event: any) => {
        this.resetSilenceTimer();
        let interimTranscript = '';
        let hasInterimResult = false;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          let bestAlternative = result[0];
          for (let alternativeIndex = 1; alternativeIndex < result.length; alternativeIndex++) {
            if (result[alternativeIndex].confidence > bestAlternative.confidence) {
              bestAlternative = result[alternativeIndex];
            }
          }
          if (result.isFinal) {
            this.finalTranscript += bestAlternative.transcript;
          } else {
            interimTranscript += bestAlternative.transcript;
            hasInterimResult = true;
          }
        }

        const transcript = `${this.finalTranscript}${interimTranscript}`.trim();
        this.callbacks.onTranscript?.(transcript, !hasInterimResult && Boolean(this.finalTranscript.trim()));
      };

      this.recognition.onerror = (event: any) => {
        this.clearSilenceTimer();
        this.isListening = false;
        this.callbacks.onStopListening?.();
        const errorKey = event.error;
        if (errorKey === 'aborted') return;
        let userFriendly = 'Speech recognition error';
        if (errorKey === 'not-allowed' || errorKey === 'service-not-allowed') {
          userFriendly =
            'Microphone access was denied. Please allow microphone permissions in your browser.';
        } else if (errorKey === 'no-speech') {
          userFriendly = 'No speech was detected. Please try speaking again.';
        } else if (errorKey === 'audio-capture') {
          userFriendly = 'No microphone was found. Check your microphone and try again.';
        } else if (errorKey === 'network') {
          userFriendly = 'Network connection issue during speech recognition.';
        }
        this.callbacks.onError?.(userFriendly);
      };

      this.recognition.onend = () => {
        this.clearSilenceTimer();
        this.isListening = false;
        this.callbacks.onStopListening?.();
      };
    } catch {
      this.recognition = null;
    }
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.isListening) {
        this.stopListening();
        this.callbacks.onError?.('Silence timeout: No speech was detected.');
      }
    }, 7000);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /** Resolves a voice for the requested language without substituting another language. */
  public resolveFemaleVoice(lang: LanguageCode): FemaleVoiceInfo {
    if (this.voices.length === 0 && this.isSpeechSynthesisSupported()) {
      this.voices = window.speechSynthesis.getVoices() || [];
    }

    const langTargets = FEMALE_VOICE_TARGETS[lang] || FEMALE_VOICE_TARGETS.en;
    const bcp47 = SUPPORTED_LANGUAGES[lang]?.bcp47 || 'te-IN';
    const langPrefix = bcp47.split('-')[0].toLowerCase();
    const langName = SUPPORTED_LANGUAGES[lang]?.name || 'Target Language';

    // 1. Filter voices that strictly match the requested language
    const langMatchingVoices = this.voices.filter((v) => {
      const vLang = v.lang.toLowerCase().replace('_', '-');
      return vLang.startsWith(langPrefix) || vLang.includes(bcp47.toLowerCase());
    });
    const femaleVoices = langMatchingVoices.filter((voice) => !MALE_KEYWORD_REGEX.test(voice.name));

    // 2. Look for explicit female target name match
    for (const target of langTargets) {
      const match = femaleVoices.find(
        (v) =>
          v.name.toLowerCase().includes(target.toLowerCase()) ||
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('woman')
      );
      if (match) {
        return {
          voice: match,
          name: match.name,
          isExplicitFemale: true,
          canSpeak: true,
          pitch: 1.05,
          rate: 0.9,
        };
      }
    }

    // 3. If any voice matching the language exists, use female pitch adjustment
    if (femaleVoices.length > 0) {
      const chosen = femaleVoices[0];
      return {
        voice: chosen,
        name: chosen.name,
        isExplicitFemale: false,
        canSpeak: true,
        pitch: 1.15,
        rate: 0.9,
      };
    }

    if (langMatchingVoices.length > 0) {
      const chosen = langMatchingVoices[0];
      return {
        voice: chosen,
        name: chosen.name,
        isExplicitFemale: false,
        canSpeak: true,
        pitch: 1,
        rate: 0.9,
      };
    }

    return {
      voice: null,
      name: `${langName} voice unavailable`,
      isExplicitFemale: false,
      canSpeak: false,
      limitationNotice: `No ${langName} speech voice is installed. The reply is available as text.`,
      pitch: 1,
      rate: 0.9,
    };
  }

  public enableContinuousConversation(enabled: boolean) {
    this.isContinuousMode = enabled;
    if (!enabled && this.resumeTimeoutTimer) {
      clearTimeout(this.resumeTimeoutTimer);
      this.resumeTimeoutTimer = null;
    }
  }

  public getIsContinuousMode(): boolean {
    return this.isContinuousMode;
  }

  public startListening(lang: LanguageCode) {
    if (!this.recognition) {
      this.callbacks.onError?.('Speech recognition is not supported in this browser.');
      return;
    }

    if (this.resumeTimeoutTimer) {
      clearTimeout(this.resumeTimeoutTimer);
      this.resumeTimeoutTimer = null;
    }

    this.stopSpeaking();

    if (this.isListening) {
      this.stopListening();
      return;
    }

    const bcp47 = SUPPORTED_LANGUAGES[lang]?.bcp47 || 'te-IN';
    this.recognition.lang = bcp47;
    this.currentLang = lang;
    this.finalTranscript = '';

    try {
      this.recognition.start();
    } catch (err: any) {
      this.callbacks.onError?.(err?.message || 'Failed to start microphone');
    }
  }

  public stopListening() {
    this.clearSilenceTimer();
    if (this.resumeTimeoutTimer) {
      clearTimeout(this.resumeTimeoutTimer);
      this.resumeTimeoutTimer = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopSpeaking();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public interrupt() {
    this.stopSpeaking();
    this.startListening(this.currentLang);
  }

  public endConversation() {
    this.enableContinuousConversation(false);
    this.stopSpeaking();
    this.stopListening();
    this.clearSilenceTimer();
    if (this.resumeTimeoutTimer) {
      clearTimeout(this.resumeTimeoutTimer);
      this.resumeTimeoutTimer = null;
    }
  }

  private chunkText(text: string): string[] {
    const clean = text
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[*_#`~>[\]()]/g, '')
      .replace(/^[-•*]\s+/gm, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    const parts = clean.split(/([.!?।|\n]+)/);
    const chunks: string[] = [];
    let current = '';

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (!p) continue;
      current += (current ? ' ' : '') + p;
      if (current.length >= 60 || /[.!?।|\n]$/.test(p)) {
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
   * Converts response text into natural female speech and vocalizes immediately.
   */
  public speakFemale(text: string, lang: LanguageCode) {
    if (this.isMuted || !text) {
      if (this.isContinuousMode) {
        this.scheduleContinuousResume(lang);
      }
      return;
    }

    if (!this.isSpeechSynthesisSupported()) {
      this.callbacks.onError?.('Speech playback is not supported in this browser. The reply is available as text.');
      if (this.isContinuousMode) {
        this.scheduleContinuousResume(lang);
      }
      return;
    }

    this.stopListening();
    this.stopSpeaking();

    // Cancel any pending speech queue in browser
    try {
      window.speechSynthesis.cancel();
    } catch {}

    const voiceInfo = this.resolveFemaleVoice(lang);
    if (!voiceInfo.canSpeak) {
      this.callbacks.onError?.(
        voiceInfo.limitationNotice || `No ${SUPPORTED_LANGUAGES[lang]?.name || 'matching'} speech voice is installed.`
      );
      if (this.isContinuousMode) {
        this.scheduleContinuousResume(lang);
      }
      return;
    }

    const chunks = this.chunkText(text);
    if (chunks.length === 0) {
      if (this.isContinuousMode) {
        this.scheduleContinuousResume(lang);
      }
      return;
    }

    this.isSpeaking = true;
    this.isPaused = false;
    this.currentText = text;
    this.lastSpokenText = text;
    this.currentLang = lang;
    this.currentChunkIndex = 0;
    this.callbacks.onStartSpeaking?.(text, lang, voiceInfo);

    this.currentChunks = chunks.map((chunk) => {
      const utt = new SpeechSynthesisUtterance(chunk);
      if (voiceInfo.voice) {
        utt.voice = voiceInfo.voice;
        utt.lang = voiceInfo.voice.lang;
      } else {
        const bcp47 = SUPPORTED_LANGUAGES[lang]?.bcp47 || 'te-IN';
        utt.lang = bcp47;
      }
      utt.pitch = voiceInfo.pitch;
      utt.rate = voiceInfo.rate;

      utt.onend = () => {
        if (!this.isSpeaking) return;
        this.currentChunkIndex++;
        if (this.currentChunkIndex < this.currentChunks.length) {
          window.speechSynthesis.speak(this.currentChunks[this.currentChunkIndex]);
        } else {
          this.isSpeaking = false;
          this.isPaused = false;
          this.currentText = '';
          this.clearWatchdog();
          this.callbacks.onStopSpeaking?.();

          if (this.isContinuousMode) {
            this.scheduleContinuousResume(lang);
          }
        }
      };

      utt.onerror = (e) => {
        if (e.error === 'canceled' || e.error === 'interrupted') return;
        this.isSpeaking = false;
        this.isPaused = false;
        this.clearWatchdog();
        this.callbacks.onStopSpeaking?.();
        if (this.isContinuousMode) {
          this.scheduleContinuousResume(lang);
        }
      };

      return utt;
    });

    this.startWatchdog();

    try {
      window.speechSynthesis.speak(this.currentChunks[0]);
    } catch (err: any) {
      this.isSpeaking = false;
      this.clearWatchdog();
      this.callbacks.onError?.(err?.message || 'Failed to synthesize speech');
    }
  }

  public pauseSpeaking() {
    if (this.isSpeaking && !this.isPaused && this.isSpeechSynthesisSupported()) {
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.callbacks.onPauseSpeaking?.();
    }
  }

  public resumeSpeaking() {
    if (this.isSpeaking && this.isPaused && this.isSpeechSynthesisSupported()) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.callbacks.onResumeSpeaking?.();
    }
  }

  public stopSpeaking() {
    if (this.resumeTimeoutTimer) {
      clearTimeout(this.resumeTimeoutTimer);
      this.resumeTimeoutTimer = null;
    }
    this.clearWatchdog();
    if (this.isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentText = '';
    this.currentChunks = [];
    this.currentChunkIndex = 0;
  }

  public getCurrentText(): string {
    return this.currentText;
  }

  public replay() {
    if (this.lastSpokenText) {
      this.speakFemale(this.lastSpokenText, this.currentLang);
    }
  }

  private scheduleContinuousResume(lang: LanguageCode) {
    if (!this.isContinuousMode) return;
    if (this.resumeTimeoutTimer) {
      clearTimeout(this.resumeTimeoutTimer);
    }
    this.resumeTimeoutTimer = setTimeout(() => {
      this.callbacks.onContinuousCycleReady?.(lang);
    }, 1500);
  }

  private startWatchdog() {
    this.clearWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (this.isSpeaking && this.isSpeechSynthesisSupported()) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    }, 5000);
  }

  private clearWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}
