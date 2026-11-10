import { LanguageCode } from '../../i18n';

export interface VoiceStateCallbacks {
  onStartListening?: () => void;
  onStopListening?: () => void;
  onSpeechResult?: (transcript: string) => void;
  onSpeechError?: (error: string) => void;
  onStartSpeaking?: () => void;
  onStopSpeaking?: () => void;
}

export class AssistantVoiceManager {
  private recognition: any = null;
  private synth: SpeechSynthesis | null = null;
  private isListeningActive = false;
  private isSpeakingActive = false;
  private callbacks: VoiceStateCallbacks = {};

  constructor(callbacks?: VoiceStateCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis || null;
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = false;
          this.recognition.interimResults = false;
          this.recognition.maxAlternatives = 1;

          this.recognition.onstart = () => {
            this.isListeningActive = true;
            this.callbacks.onStartListening?.();
          };

          this.recognition.onresult = (event: any) => {
            const transcript = event.results?.[0]?.[0]?.transcript || '';
            this.callbacks.onSpeechResult?.(transcript);
          };

          this.recognition.onerror = (event: any) => {
            this.isListeningActive = false;
            this.callbacks.onStopListening?.();
            this.callbacks.onSpeechError?.(event.error || 'Speech recognition error');
          };

          this.recognition.onend = () => {
            this.isListeningActive = false;
            this.callbacks.onStopListening?.();
          };
        } catch (e) {
          console.warn('SpeechRecognition initialization error:', e);
        }
      }
    }
  }

  public setCallbacks(callbacks: VoiceStateCallbacks): void {
    this.callbacks = callbacks;
  }

  public isSpeechSupported(): boolean {
    return !!this.recognition;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingActive;
  }

  public isSynthesisSupported(): boolean {
    return !!this.synth;
  }

  public startListening(lang: LanguageCode = 'en'): void {
    if (!this.recognition) {
      this.callbacks.onSpeechError?.('Speech recognition is not available in this browser.');
      return;
    }

    // Stop speaking if currently speaking
    this.stopSpeaking();

    try {
      this.recognition.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      this.recognition.start();
    } catch {
      // If already started or aborting, ignore
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListeningActive) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListeningActive = false;
  }

  public speak(
    text: string,
    lang: LanguageCode = 'en',
    onComplete?: () => void
  ): void {
    if (!this.synth) {
      onComplete?.();
      return;
    }

    this.stopSpeaking();

    // Clean markdown and formatting tags from spoken text
    const cleanSpeech = text
      .replace(/[*_#`~[\]]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/•/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanSpeech) {
      onComplete?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = lang === 'te' ? 0.95 : 1.0;
    utterance.pitch = 1.05; // Friendly female pitch

    // Prefer Indian English / Female voice if available
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find((v) => {
      const name = v.name.toLowerCase();
      if (lang === 'te') return name.includes('telugu') || v.lang.includes('te');
      if (lang === 'hi') return name.includes('hindi') || v.lang.includes('hi');
      return (
        (name.includes('india') || name.includes('female') || name.includes('natural')) &&
        (v.lang.includes('en') || v.lang.includes('IN'))
      );
    });

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      this.isSpeakingActive = true;
      this.callbacks.onStartSpeaking?.();
    };

    utterance.onend = () => {
      this.isSpeakingActive = false;
      this.callbacks.onStopSpeaking?.();
      onComplete?.();
    };

    utterance.onerror = () => {
      this.isSpeakingActive = false;
      this.callbacks.onStopSpeaking?.();
      onComplete?.();
    };

    try {
      this.synth.speak(utterance);
    } catch {
      onComplete?.();
    }
  }

  public stopSpeaking(): void {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {}
    }
    this.isSpeakingActive = false;
    this.callbacks.onStopSpeaking?.();
  }

  public stopAll(): void {
    this.destroy();
  }

  public destroy(): void {
    this.stopListening();
    this.stopSpeaking();
    this.callbacks = {};
  }
}
