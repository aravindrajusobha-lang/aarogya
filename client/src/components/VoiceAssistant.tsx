import React, { useState, useEffect, useRef } from 'react';
import { LanguageCode } from '../i18n';

interface VoiceAssistantProps {
  currentLang: LanguageCode;
  onSelectLang: (lang: LanguageCode) => void;
  onNavigateTab: (tabId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  authToken?: string;
}

type AssistantState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  lang: LanguageCode;
  timestamp: string;
}

interface Position {
  x: number;
  y: number;
}

const POS_STORAGE_KEY = 'aarogya_va_pos';
const MIN_STORAGE_KEY = 'aarogya_va_minimized';

// Reusable Indian Female Healthcare AI Avatar SVG
export const DrishtiAvatarSvg: React.FC<{
  state: AssistantState;
  mouthD: string;
  className?: string;
}> = ({ state, mouthD, className = 'drishti-svg-avatar' }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <defs>
      <linearGradient id="bgGlowDrishti" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#059669" />
        <stop offset="100%" stopColor="#064e3b" />
      </linearGradient>
      <linearGradient id="faceGradDrishti" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="100%" stopColor="#fde68a" />
      </linearGradient>
    </defs>

    {/* Background Halo */}
    <circle cx="50" cy="50" r="48" fill="url(#bgGlowDrishti)" />

    {/* Healthcare Doctor Coat / Shoulders */}
    <path d="M20 95 Q50 78 80 95 L80 100 L20 100 Z" fill="#ffffff" />
    <path d="M42 85 L50 96 L58 85" stroke="#047857" strokeWidth="2" fill="none" />

    {/* Neck */}
    <rect x="44" y="66" width="12" height="15" fill="#fde68a" rx="3" />

    {/* Face */}
    <ellipse cx="50" cy="52" rx="22" ry="24" fill="url(#faceGradDrishti)" />

    {/* Traditional Indian Bindi */}
    <circle cx="50" cy="38" r="2.2" fill="#dc2626" />

    {/* Hair Bun and Fringe */}
    <path
      d="M26 48 Q24 22 50 20 Q76 22 74 48 Q68 34 50 32 Q32 34 26 48 Z"
      fill="#0f172a"
    />

    {/* Eyebrows */}
    <path d="M36 43 Q42 40 46 44" stroke="#0f172a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    <path d="M54 44 Q58 40 64 43" stroke="#0f172a" strokeWidth="1.8" fill="none" strokeLinecap="round" />

    {/* Animated Blinking Eyes */}
    <g className="animated-eyes">
      <ellipse cx="42" cy="49" rx="3.5" ry="4" fill="#0f172a" />
      <circle cx="43" cy="47" r="1.3" fill="#ffffff" />
      <ellipse cx="58" cy="49" rx="3.5" ry="4" fill="#0f172a" />
      <circle cx="59" cy="47" r="1.3" fill="#ffffff" />
    </g>

    {/* Nose */}
    <path d="M50 49 Q51 56 48 57" stroke="#d97706" strokeWidth="1.4" fill="none" strokeLinecap="round" />

    {/* Rosy Cheeks */}
    <circle cx="34" cy="56" r="3.5" fill="#fca5a5" opacity="0.6" />
    <circle cx="66" cy="56" r="3.5" fill="#fca5a5" opacity="0.6" />

    {/* Mouth (Lip-sync while speaking, gentle smile when idle) */}
    <path
      className="lip-sync-mouth"
      d={mouthD}
      stroke="#b91c1c"
      strokeWidth="2"
      fill={state === 'speaking' ? '#dc2626' : 'none'}
      strokeLinecap="round"
    />

    {/* Healthcare Stethoscope */}
    <path
      d="M34 84 Q50 98 66 84"
      stroke="#10b981"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="50" cy="97" r="3.5" fill="#34d399" />
  </svg>
);

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  currentLang,
  onSelectLang,
  onNavigateTab,
  isOpen,
  onClose,
  authToken,
}) => {
  const [state, setState] = useState<AssistantState>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Ready to help');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [mouthFrame, setMouthFrame] = useState<number>(0);

  // Position & Minimized state with localStorage persistence
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(POS_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            const maxX = Math.max(10, window.innerWidth - 120);
            const maxY = Math.max(48, window.innerHeight - 80);
            return {
              x: Math.min(Math.max(10, parsed.x), maxX),
              y: Math.min(Math.max(48, parsed.y), maxY),
            };
          }
        } catch {}
      }
      return {
        x: Math.max(16, window.innerWidth - 430),
        y: Math.max(64, window.innerHeight - 560),
      };
    }
    return { x: 800, y: 150 };
  });

  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(MIN_STORAGE_KEY) === 'true';
    }
    return false;
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-init',
      sender: 'assistant',
      text:
        currentLang === 'te'
          ? 'నమస్కారం! నేను ఆరోగ్య దృష్టి AI అసిస్టెంట్ "దృష్టి"ని. అల్లూరి సీతారామరాజు జిల్లాలోని 22 మండలాలు, గ్రామాలు, మరియు మెడికల్ క్యాంప్ ప్లానింగ్ గురించి నన్ను అడగవచ్చు.'
          : currentLang === 'hi'
          ? 'नमस्ते! मैं आरोग्य दृष्टि AI सहायिका "दृष्टि" हूँ। ASR जिले के 22 मंडलों, गांवों और मेडिकल कैंप योजना के बारे में मुझसे पूछें।'
          : 'Hello! I am Drishti, your AI Healthcare Guide for Alluri Sitharama Raju (ASR) District. Ask me about any of the 22 mandals, tribal hamlets, or medical camp planning.',
      lang: currentLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const mouthIntervalRef = useRef<any>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, state]);

  // Lip-sync mouth phoneme animation loop while speaking
  useEffect(() => {
    if (state === 'speaking') {
      mouthIntervalRef.current = setInterval(() => {
        setMouthFrame((prev) => (prev + 1) % 4);
      }, 140);
    } else {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
      setMouthFrame(0);
    }
    return () => {
      if (mouthIntervalRef.current) clearInterval(mouthIntervalRef.current);
    };
  }, [state]);

  // Update greeting when language changes
  useEffect(() => {
    if (messages.length === 1) {
      setMessages([
        {
          id: 'msg-init',
          sender: 'assistant',
          text:
            currentLang === 'te'
              ? 'నమస్కారం! నేను ఆరోగ్య దృష్టి AI అసిస్టెంట్ "దృష్టి"ని. అల్లూరి సీతారామరాజు జిల్లాలోని 22 మండలాలు, గ్రామాలు, మరియు మెడికల్ క్యాంప్ ప్లానింగ్ గురించి నన్ను అడగవచ్చు.'
              : currentLang === 'hi'
              ? 'नमस्ते! मैं आरोग्य दृष्टि AI सहायिका "दृष्टि" हूँ। ASR जिले के 22 मंडलों, गांवों और मेडिकल कैंप योजना के बारे में मुझसे पूछें।'
              : 'Hello! I am Drishti, your AI Healthcare Guide for Alluri Sitharama Raju (ASR) District. Ask me about any of the 22 mandals, tribal hamlets, or medical camp planning.',
          lang: currentLang,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [currentLang]);

  // Drag-and-drop mechanics (Mouse & Touch)
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: position.x,
      startY: position.y,
    };
  };

  const onMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a, select')) {
      return;
    }
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  const onTouchStartHeader = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a, select')) {
      return;
    }
    if (e.touches.length === 1) {
      handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = e.clientX - dragStartRef.current.mouseX;
      const deltaY = e.clientY - dragStartRef.current.mouseY;

      const width = isMinimized ? 240 : Math.min(410, window.innerWidth - 20);
      const height = isMinimized ? 52 : 530;

      const maxX = Math.max(10, window.innerWidth - width - 10);
      const maxY = Math.max(48, window.innerHeight - height - 10);

      const clampedX = Math.min(Math.max(10, dragStartRef.current.startX + deltaX), maxX);
      const clampedY = Math.min(Math.max(48, dragStartRef.current.startY + deltaY), maxY);

      setPosition({ x: clampedX, y: clampedY });
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.mouseX;
      const deltaY = touch.clientY - dragStartRef.current.mouseY;

      const width = isMinimized ? 240 : Math.min(410, window.innerWidth - 20);
      const height = isMinimized ? 52 : 530;

      const maxX = Math.max(10, window.innerWidth - width - 10);
      const maxY = Math.max(48, window.innerHeight - height - 10);

      const clampedX = Math.min(Math.max(10, dragStartRef.current.startX + deltaX), maxX);
      const clampedY = Math.min(Math.max(48, dragStartRef.current.startY + deltaY), maxY);

      setPosition({ x: clampedX, y: clampedY });
    };

    const onEnd = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(position));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [isDragging, isMinimized, position]);

  // Adjust on window resize to ensure widget remains in viewport
  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => {
        const width = isMinimized ? 240 : Math.min(410, window.innerWidth - 20);
        const height = isMinimized ? 52 : 530;
        const maxX = Math.max(10, window.innerWidth - width - 10);
        const maxY = Math.max(48, window.innerHeight - height - 10);
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(48, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMinimized]);

  // Toggle minimize state and persist
  const toggleMinimize = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsMinimized((prev) => {
      const next = !prev;
      localStorage.setItem(MIN_STORAGE_KEY, String(next));
      return next;
    });
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          setState('listening');
          setSpeechError(null);
          setStatusMessage(
            currentLang === 'te'
              ? 'తెలుగులో వింటున్నాను... మాట్లాడండి'
              : currentLang === 'hi'
              ? 'सुन रही हूँ... बोलिए'
              : 'Listening in English... Speak now'
          );
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleUserQuery(transcript);
        };

        recognition.onerror = (event: any) => {
          setState('idle');
          if (event.error === 'no-speech') {
            setStatusMessage('No speech detected. Please tap mic again.');
          } else if (event.error === 'not-allowed') {
            setSpeechError('Microphone permission blocked. You can type queries below.');
            setStatusMessage('Microphone access denied');
          } else {
            setSpeechError(`Speech error: ${event.error}`);
            setStatusMessage('Ready to help');
          }
        };

        recognition.onend = () => {
          if (state === 'listening') {
            setState('idle');
            setStatusMessage('Ready to help');
          }
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    } else {
      setSpeechError('Web Speech Recognition not available in this browser. Text interaction is ready.');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [currentLang, state]);

  // Speak Text via Web Speech Synthesis (TTS)
  const speakText = (text: string) => {
    if (isMuted || !synthRef.current) {
      setState('idle');
      setStatusMessage('Ready to help');
      return;
    }

    try {
      synthRef.current.cancel();
      const cleanText = text.replace(/[*_#•]/g, '').replace(/\n+/g, '. ');
      const utterance = new SpeechSynthesisUtterance(cleanText);

      const voices = synthRef.current.getVoices();
      if (currentLang === 'te') {
        utterance.lang = 'te-IN';
        const teVoice = voices.find((v) => v.lang.includes('te') || v.name.toLowerCase().includes('telugu'));
        if (teVoice) utterance.voice = teVoice;
      } else if (currentLang === 'hi') {
        utterance.lang = 'hi-IN';
        const hiVoice = voices.find((v) => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi'));
        if (hiVoice) utterance.voice = hiVoice;
      } else {
        utterance.lang = 'en-IN';
        const enVoice = voices.find(
          (v) =>
            v.lang.includes('en-IN') ||
            v.name.toLowerCase().includes('india') ||
            (v.lang.includes('en') && v.name.toLowerCase().includes('female'))
        );
        if (enVoice) utterance.voice = enVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.15;

      utterance.onstart = () => {
        setState('speaking');
        setStatusMessage(
          currentLang === 'te'
            ? 'దృష్టి సమాధానమిస్తోంది...'
            : currentLang === 'hi'
            ? 'दृष्टि बोल रही है...'
            : 'Drishti is speaking...'
        );
      };

      utterance.onend = () => {
        setState('idle');
        setStatusMessage('Ready to help');
      };

      utterance.onerror = () => {
        setState('idle');
        setStatusMessage('Ready to help');
      };

      synthRef.current.speak(utterance);
    } catch {
      setState('idle');
      setStatusMessage('Ready to help');
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch {}
    }
    setState('idle');
    setStatusMessage(
      currentLang === 'te' ? 'సిద్ధంగా ఉన్నాను' : currentLang === 'hi' ? 'तैयार' : 'Ready to help'
    );
  };

  // Repeat last assistant voice response
  const repeatResponse = () => {
    const lastAssistant = [...messages].reverse().find((m) => m.sender === 'assistant');
    if (lastAssistant) {
      speakText(lastAssistant.text);
    }
  };

  // Toggle Speech Recognition
  const toggleListening = () => {
    if (state === 'speaking') {
      stopSpeaking();
      return;
    }

    if (state === 'listening') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setState('idle');
      setStatusMessage('Ready to help');
      return;
    }

    if (!recognitionRef.current) {
      setSpeechError('Microphone not supported. You can type your question.');
      return;
    }

    try {
      if (currentLang === 'te') {
        recognitionRef.current.lang = 'te-IN';
      } else if (currentLang === 'hi') {
        recognitionRef.current.lang = 'hi-IN';
      } else {
        recognitionRef.current.lang = 'en-IN';
      }
      recognitionRef.current.start();
    } catch (err: any) {
      console.warn('Failed to start speech recognition:', err);
      setSpeechError('Microphone could not be started. Please type your query.');
      setState('idle');
    }
  };

  // Process User Queries with Backend MongoDB Assistant API
  const handleUserQuery = async (query: string) => {
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      lang: currentLang,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setState('thinking');
    setStatusMessage('Querying ASR District Database...');

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch('/api/v1/assistant/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, language: currentLang }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        const replyText = json.data.answerText;
        const speechOutput = json.data.speechText || replyText;

        const assistantMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: replyText,
          lang: currentLang,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        speakText(speechOutput);

        // Contextual navigation
        const qLower = query.toLowerCase();
        if (qLower.includes('map') || qLower.includes('మ్యాప్') || qLower.includes('मानचित्र')) {
          onNavigateTab('asr-map');
        } else if (qLower.includes('camp') || qLower.includes('క్యాంప్') || qLower.includes('कैंप')) {
          if (qLower.includes('plan') || qLower.includes('organize') || qLower.includes('ఎక్కడ')) {
            onNavigateTab('camp-planning');
          }
        }
      } else {
        throw new Error(json.error?.message || 'Server error');
      }
    } catch {
      // Fallback local response if network fails
      const fallbackText =
        currentLang === 'te'
          ? 'అల్లూరి సీతారామరాజు జిల్లాలో పాడేరు మరియు రంపచోడవరం డివిజన్లలో మొత్తం 22 మండలాలు ఉన్నాయి. మీరు మ్యాప్ లేదా క్యాంప్ ప్లానింగ్ ద్వారా పరిశీలించవచ్చు.'
          : currentLang === 'hi'
          ? 'ASR जिले में 22 मंडल हैं। आप मानचित्र या मेडिकल कैंप योजना में विस्तृत जानकारी देख सकते हैं।'
          : 'ASR District comprises 22 Mandals across Paderu and Rampachodavaram divisions. You can explore them on the ASR District Map.';

      const fallbackMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        lang: currentLang,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, fallbackMsg]);
      speakText(fallbackText);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const q = inputText;
    setInputText('');
    handleUserQuery(q);
  };

  // Quick prompt buttons
  const quickQuestions =
    currentLang === 'te'
      ? [
          'ASR జిల్లాలోని మండలాలు ఏవి?',
          'తదుపరి మెడికల్ క్యాంప్ ఎక్కడ నిర్వహించాలి?',
          'పాడేరు మండలంలోని గ్రామాలు చూపించు',
          'దగ్గరి PHC లు మరియు ఆసుపత్రులు చూపించు',
        ]
      : currentLang === 'hi'
      ? [
          'ASR जिले में कौन से मंडल हैं?',
          'अगला मेडिकल कैंप कहां आयोजित करें?',
          'पाडेरु मंडल के गांव दिखाओ',
          'निकटतम प्राथमिक स्वास्थ्य केंद्र दिखाओ',
        ]
      : [
          'Which mandals are available in ASR District?',
          'Where can we organize the next medical camp?',
          'Show all villages in Paderu Mandal',
          'Show nearby PHCs & Hospitals',
        ];

  // Dynamic SVG Mouth Path based on speaking phoneme frame
  const getMouthD = () => {
    if (state === 'speaking') {
      switch (mouthFrame) {
        case 0:
          return 'M43 68 Q50 78 57 68 Q50 73 43 68 Z'; // Open wide
        case 1:
          return 'M44 68 Q50 75 56 68 Q50 71 44 68 Z'; // Half open
        case 2:
          return 'M43 68 Q50 79 57 68 Q50 74 43 68 Z'; // Round vowel
        case 3:
          return 'M44 68 Q50 73 56 68 Z'; // Small slit
        default:
          return 'M43 68 Q50 76 57 68 Z';
      }
    }
    // Idle gentle smile
    return 'M43 68 Q50 74 57 68';
  };

  // When closed, render floating reopen FAB trigger
  if (!isOpen) {
    return (
      <button
        type="button"
        className={`floating-drishti-avatar-btn ${state}`}
        onClick={onClose}
        title="Open Drishti AI Voice Assistant"
        aria-label="Open AI Assistant"
      >
        <div className="avatar-mini-glow" style={{ width: 34, height: 34 }}>
          <DrishtiAvatarSvg state={state} mouthD={getMouthD()} />
        </div>
        <span className="floating-badge">Drishti AI</span>
        <span className="floating-mic-icon">🎙️</span>
      </button>
    );
  }

  // Active floating widget
  return (
    <div
      className="va-floating-container"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {isMinimized ? (
        <div
          className={`va-minimized-pill ${isDragging ? 'is-dragging' : ''}`}
          onMouseDown={onMouseDownHeader}
          onTouchStart={onTouchStartHeader}
          title="Drag to reposition • Click expand to view full assistant"
        >
          <span className="va-drag-grip" title="Drag">⋮⋮</span>
          <div className="va-min-avatar">
            <DrishtiAvatarSvg state={state} mouthD={getMouthD()} />
          </div>
          <div className="va-min-info">
            <span className="va-min-name">
              Drishti AI
              <span className={`status-pill-va ${state}`} style={{ fontSize: '0.6rem' }}>
                {state.toUpperCase()}
              </span>
            </span>
            <span className="va-min-status">{statusMessage}</span>
          </div>
          <div className="va-min-actions">
            {state === 'speaking' && (
              <button
                type="button"
                className="va-btn-icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  stopSpeaking();
                }}
                title="Stop Speaking"
              >
                ⏹️
              </button>
            )}
            <button
              type="button"
              className="va-btn-icon-sm"
              onClick={toggleMinimize}
              title="Expand Assistant"
            >
              ⤢
            </button>
            <button
              type="button"
              className="va-btn-icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close Assistant"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div className="voice-assistant-card">
          {/* Draggable Top Header */}
          <div
            className={`va-header ${isDragging ? 'is-dragging' : ''}`}
            onMouseDown={onMouseDownHeader}
            onTouchStart={onTouchStartHeader}
            title="Drag header to move assistant around screen"
          >
            <div className="va-drag-handle-area">
              <span className="va-drag-grip">⋮⋮</span>
              <div className={`animated-drishti-character ${state}`}>
                <DrishtiAvatarSvg state={state} mouthD={getMouthD()} />
                {state === 'listening' && (
                  <div className="listening-rings-container">
                    <span className="ring r1"></span>
                    <span className="ring r2"></span>
                    <span className="ring r3"></span>
                  </div>
                )}
              </div>

              <div className="va-identity">
                <div className="name-badge-row">
                  <h3>Drishti AI</h3>
                  <span className={`status-pill-va ${state}`}>{state.toUpperCase()}</span>
                </div>
                <span className="va-sub">
                  {currentLang === 'te'
                    ? 'ASR గిరిజన ఆరోగ్య మార్గదర్శి'
                    : currentLang === 'hi'
                    ? 'ASR आदिवासी स्वास्थ्य गाइड'
                    : 'ASR District Virtual Healthcare Guide'}
                </span>
              </div>
            </div>

            <div className="va-top-actions">
              {/* Language Switcher */}
              <div className="va-lang-toggle">
                <button
                  type="button"
                  className={currentLang === 'en' ? 'active' : ''}
                  onClick={() => onSelectLang('en')}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={currentLang === 'te' ? 'active' : ''}
                  onClick={() => onSelectLang('te')}
                >
                  తె
                </button>
                <button
                  type="button"
                  className={currentLang === 'hi' ? 'active' : ''}
                  onClick={() => onSelectLang('hi')}
                >
                  हि
                </button>
              </div>

              {/* Repeat Voice Response */}
              <button
                type="button"
                className="btn-round-icon"
                onClick={repeatResponse}
                title="Repeat voice response"
              >
                🔁
              </button>

              {/* Stop Speaking Button */}
              {state === 'speaking' && (
                <button
                  type="button"
                  className="btn-round-icon"
                  onClick={stopSpeaking}
                  title="Stop speaking"
                >
                  ⏹️
                </button>
              )}

              {/* Mute Button */}
              <button
                type="button"
                className={`btn-round-icon ${isMuted ? 'muted' : ''}`}
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>

              {/* Minimize to Pill */}
              <button
                type="button"
                className="btn-round-icon"
                onClick={toggleMinimize}
                title="Minimize to Floating Pill"
              >
                —
              </button>

              {/* Close Button */}
              <button
                type="button"
                className="btn-round-icon btn-close-va"
                onClick={onClose}
                title="Close Assistant"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Dynamic Waveform Spectrum Status Banner */}
          <div className={`va-spectrum-bar ${state}`}>
            <div className="wave-bars-box">
              <span className="w-bar b1"></span>
              <span className="w-bar b2"></span>
              <span className="w-bar b3"></span>
              <span className="w-bar b4"></span>
              <span className="w-bar b5"></span>
            </div>
            <span className="spectrum-msg">{statusMessage}</span>
          </div>

          {/* Speech Error Banner */}
          {speechError && (
            <div className="va-alert-banner">
              <span>⚠️</span>
              <span>{speechError}</span>
            </div>
          )}

          {/* Chat Message Scroll */}
          <div className="va-chat-scroll-area">
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble-row ${m.sender}`}>
                <div className="chat-bubble">
                  <p>{m.text}</p>
                  <span className="chat-timestamp">{m.timestamp}</span>
                </div>
              </div>
            ))}
            {state === 'thinking' && (
              <div className="chat-bubble-row assistant">
                <div className="chat-bubble thinking">
                  <span className="dot d1"></span>
                  <span className="dot d2"></span>
                  <span className="dot d3"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Question Chips */}
          <div className="va-quick-chips">
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                className="chip-btn"
                onClick={() => handleUserQuery(q)}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Interaction Form & Big Animated Mic Button */}
          <div className="va-input-area">
            <form className="va-text-form" onSubmit={handleSendText}>
              <input
                type="text"
                placeholder={
                  currentLang === 'te'
                    ? 'ఇక్కడ టైప్ చేయండి లేదా మైక్ నొక్కండి...'
                    : currentLang === 'hi'
                    ? 'यहाँ टाइप करें या माइक दबाएं...'
                    : 'Type a question or tap the mic to speak...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="va-text-input"
              />
              <button type="submit" className="va-send-btn" disabled={!inputText.trim()}>
                ➤
              </button>
            </form>

            {/* Central Animated Mic Button */}
            <button
              type="button"
              className={`va-big-mic-btn ${state === 'listening' ? 'listening' : ''}`}
              onClick={toggleListening}
              title={state === 'listening' ? 'Stop Listening' : 'Speak to Drishti'}
            >
              <span className="mic-icon">{state === 'listening' ? '🛑' : '🎙️'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
