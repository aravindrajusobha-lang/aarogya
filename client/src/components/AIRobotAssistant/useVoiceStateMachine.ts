/**
 * MULTILINGUAL VOICE CONVERSATION STATE MACHINE HOOK
 * 
 * Explicit State Machine:
 * idle -> listening -> processing -> speaking -> (listening | idle), plus error.
 * 
 * Guarantees:
 * 1. Echo prevention: Recognition is stopped before synthesis starts.
 * 2. Barge-in: Tapping mic while speaking instantly stops speech and starts listening.
 * 3. Silence timeout: ~7 seconds ends listening automatically.
 * 4. Cleanup on unmount and visibility change (tab hidden).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceLangCode, LanguageSessionManager } from './languageDetectionEngine';
import { MultilingualVoiceSynthesizer } from './voiceSynthesisEngine';
import { VOICE_SESSION_DISCLAIMER, RED_FLAG_SYMPTOM_RULES } from './safetyMessages';

export type AssistantVoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface UseVoiceStateMachineProps {
  initialLang?: VoiceLangCode;
  onUserMessage?: (text: string, lang: VoiceLangCode) => Promise<{ answerText: string; speechText: string; language: VoiceLangCode }>;
  onErrorState?: (errorKey: string, details?: string) => void;
}

export function useVoiceStateMachine({
  initialLang = 'te',
  onUserMessage,
  onErrorState,
}: UseVoiceStateMachineProps) {
  const [state, setState] = useState<AssistantVoiceState>('idle');
  const [activeLang, setActiveLang] = useState<VoiceLangCode>(initialLang);
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(true);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [finalTranscript, setFinalTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSpokenDisclaimer, setHasSpokenDisclaimer] = useState<boolean>(false);

  // Engine references
  const recognitionRef = useRef<any>(null);
  const synthesizerRef = useRef<MultilingualVoiceSynthesizer>(new MultilingualVoiceSynthesizer());
  const langManagerRef = useRef<LanguageSessionManager>(new LanguageSessionManager(initialLang, 'auto'));
  const silenceTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // Sync external language change
  useEffect(() => {
    setActiveLang(initialLang);
    langManagerRef.current.setManualLanguage(initialLang);
  }, [initialLang]);

  // Clear silence timer
  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  // Stop STT listening cleanly
  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop on inactive instance
      }
      recognitionRef.current = null;
    }
  }, [clearSilenceTimer]);

  // Stop Speech synthesis cleanly
  const stopSpeaking = useCallback(() => {
    synthesizerRef.current.stop();
  }, []);

  // Full stop & reset to idle
  const stopAll = useCallback(() => {
    stopListening();
    stopSpeaking();
    if (isMountedRef.current) {
      setState('idle');
      setInterimTranscript('');
    }
  }, [stopListening, stopSpeaking]);

  /**
   * Check for red-flag symptoms in transcript
   */
  const checkRedFlags = useCallback((text: string, lang: VoiceLangCode) => {
    const lower = text.toLowerCase();
    for (const rule of RED_FLAG_SYMPTOM_RULES) {
      const keywords = [...(rule.keywords.en || []), ...(rule.keywords[lang] || [])];
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          return {
            triggered: true,
            urgency: rule.urgency,
            spokenAdvice: rule.spokenAdvice[lang] || rule.spokenAdvice.en,
            writtenAdvice: rule.writtenAdvice[lang] || rule.writtenAdvice.en,
          };
        }
      }
    }
    return { triggered: false };
  }, []);

  /**
   * Speak output and transition states
   */
  const speakResponse = useCallback(
    (speechText: string, targetLang: VoiceLangCode, nextState: 'listening' | 'idle' = isContinuousMode ? 'listening' : 'idle') => {
      stopListening(); // Echo prevention: Stop mic completely while speaking!
      setState('speaking');

      synthesizerRef.current.speak(
        speechText,
        targetLang,
        () => {
          // On speech finish:
          if (!isMountedRef.current) return;
          if (nextState === 'listening' && isContinuousMode) {
            startListeningInternal(targetLang);
          } else {
            setState('idle');
          }
        },
        (err) => {
          // On speech error:
          if (!isMountedRef.current) return;
          setErrorMessage(err);
          setState('idle');
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isContinuousMode, stopListening]
  );

  /**
   * Process complete user utterance
   */
  const processUtterance = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) {
        if (isContinuousMode) {
          startListeningInternal(activeLang);
        } else {
          setState('idle');
        }
        return;
      }

      setState('processing');
      stopListening();

      // Language detection & resolution
      const targetLang = langManagerRef.current.processTranscript(text);
      setActiveLang(targetLang);

      // 1. Check for clinical red-flag escalation
      const redFlag = checkRedFlags(text, targetLang);
      if (redFlag.triggered && redFlag.spokenAdvice) {
        speakResponse(redFlag.spokenAdvice, targetLang);
        return;
      }

      // 2. Query assistant backend
      if (onUserMessage) {
        try {
          const res = await onUserMessage(text, targetLang);
          const replyLang = res.language || targetLang;
          setActiveLang(replyLang);
          speakResponse(res.speechText || res.answerText, replyLang);
        } catch {
          setErrorMessage('aiTimeout');
          onErrorState?.('aiTimeout');
          setState('error');
        }
      } else {
        setState('idle');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeLang, checkRedFlags, isContinuousMode, onUserMessage, onErrorState, speakResponse, stopListening]
  );

  /**
   * Internal start listening routine
   */
  const startListeningInternal = useCallback(
    (langToUse: VoiceLangCode) => {
      stopSpeaking(); // Stop any speech
      stopListening(); // Clear previous session

      if (typeof window === 'undefined' || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        setState('error');
        setErrorMessage('sttUnsupported');
        onErrorState?.('sttUnsupported');
        return;
      }

      const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognitionConstructor();
      recognitionRef.current = rec;

      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = langToUse === 'te' ? 'te-IN' : langToUse === 'hi' ? 'hi-IN' : 'en-IN';

      setState('listening');
      setInterimTranscript('');
      setErrorMessage(null);

      // Reset 7-second silence timeout
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        stopListening();
        if (isMountedRef.current) {
          setState('idle');
          setErrorMessage('noSpeechDetected');
        }
      }, 7000);

      rec.onresult = (event: any) => {
        clearSilenceTimer();
        let interim = '';
        let finalTxt = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTxt += transcript;
          } else {
            interim += transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
          // Restart silence timer on interim speech
          silenceTimerRef.current = setTimeout(() => {
            stopListening();
            processUtterance(interim);
          }, 3500);
        }

        if (finalTxt) {
          setFinalTranscript(finalTxt);
          setInterimTranscript('');
          stopListening();
          processUtterance(finalTxt);
        }
      };

      rec.onerror = (event: any) => {
        clearSilenceTimer();
        if (event.error === 'no-speech') {
          // If in auto mode and no speech, try next candidate language once
          if (langManagerRef.current.getMode() === 'auto') {
            const nextCandidate = langManagerRef.current.getNextCandidateLanguage();
            if (nextCandidate !== langToUse) {
              startListeningInternal(nextCandidate);
              return;
            }
          }
          setErrorMessage('noSpeechDetected');
          setState('idle');
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setErrorMessage('micPermissionDenied');
          onErrorState?.('micPermissionDenied');
          setState('error');
        } else {
          setErrorMessage(event.error);
          setState('idle');
        }
      };

      rec.onend = () => {
        clearSilenceTimer();
      };

      try {
        rec.start();
      } catch (err: any) {
        setState('error');
        setErrorMessage(err.message || 'Failed to start microphone');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearSilenceTimer, onErrorState, processUtterance, stopListening, stopSpeaking]
  );

  /**
   * User Mic Button Tap (Handles Barge-In & Disclaimer)
   */
  const handleMicTap = useCallback(() => {
    // 1. Barge-in: If currently speaking, stop immediately and start listening
    if (state === 'speaking') {
      stopSpeaking();
      startListeningInternal(activeLang);
      return;
    }

    // 2. If listening, stop listening and return to idle
    if (state === 'listening') {
      stopListening();
      setState('idle');
      return;
    }

    // 3. First-time session disclaimer
    if (!hasSpokenDisclaimer) {
      setHasSpokenDisclaimer(true);
      const disclaimer = VOICE_SESSION_DISCLAIMER[activeLang] || VOICE_SESSION_DISCLAIMER.en;
      speakResponse(disclaimer.spokenText, activeLang, 'listening');
      return;
    }

    // 4. Start listening
    startListeningInternal(activeLang);
  }, [state, stopSpeaking, startListeningInternal, activeLang, hasSpokenDisclaimer, speakResponse, stopListening]);

  /**
   * Set language manually
   */
  const setLanguage = useCallback((lang: VoiceLangCode, mode: 'auto' | 'manual' = 'manual') => {
    setActiveLang(lang);
    if (mode === 'manual') {
      langManagerRef.current.setManualLanguage(lang);
    } else {
      langManagerRef.current.setMode('auto');
    }
  }, []);

  // Cleanup on unmount & visibility change
  useEffect(() => {
    isMountedRef.current = true;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopAll();
    };
  }, [stopAll]);

  return {
    state,
    activeLang,
    mode: langManagerRef.current.getMode(),
    isContinuousMode,
    interimTranscript,
    finalTranscript,
    errorMessage,
    hasSpokenDisclaimer,
    handleMicTap,
    setLanguage,
    setIsContinuousMode,
    stopAll,
    stopSpeaking,
    speakResponse,
    processUtterance,
  };
}

