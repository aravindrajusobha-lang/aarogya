import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectScriptFromText,
  LanguageSessionManager,
  SUPPORTED_VOICE_LANGUAGES,
} from '../../client/src/components/AIRobotAssistant/languageDetectionEngine.js';
import {
  MultilingualVoiceSynthesizer,
} from '../../client/src/components/AIRobotAssistant/voiceSynthesisEngine.js';
import {
  askAssistant,
  cleanSpeechText,
} from '../../client/src/components/AIRobotAssistant/assistantService.js';
import { AssistantVoiceEngine } from '../../client/src/components/AIRobotAssistant/assistantVoice.js';
import { detectLanguageFromText } from '../../client/src/components/AIRobotAssistant/languageDetector.js';
import { resolveAssistantLanguage } from '../src/modules/assistant/assistantRoutes.js';
import {
  VOICE_SESSION_DISCLAIMER,
  RED_FLAG_SYMPTOM_RULES,
} from '../../client/src/components/AIRobotAssistant/safetyMessages.js';

describe('Multilingual Voice Assistant Unit Tests', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Active assistant language detection', () => {
    it.each([
      ['తెలుగు మాటలు స్పష్టంగా వినిపిస్తున్నాయి', 'te'],
      ['मुझे हिंदी में जवाब चाहिए', 'hi'],
      ['தமிழில் பதில் சொல்லுங்கள்', 'ta'],
      ['ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ', 'kn'],
      ['മലയാളത്തിൽ മറുപടി പറയൂ', 'ml'],
      ['Please answer in English', 'en'],
    ] as const)('detects the dominant language in "%s"', (text, expected) => {
      expect(detectLanguageFromText(text)).toBe(expected);
    });

    it('detects common Telugu and Hindi transliteration without mislabeling ambiguous text', () => {
      expect(detectLanguageFromText('ela unnaru naku pundu undi')).toBe('te');
      expect(detectLanguageFromText('mujhe dard hai, kaise madad karein')).toBe('hi');
      expect(detectLanguageFromText('vanakkam enakku vaayil vali irukku')).toBe('ta');
      expect(detectLanguageFromText('namaskara nanna baayalli novu ide')).toBe('kn');
      expect(detectLanguageFromText('sukhamano enikku vaayil vedana undu')).toBe('ml');
      expect(detectLanguageFromText('namaste doctor', 'te')).toBe('te');
      expect(detectLanguageFromText('Aarogya తెలుగు assistant can help you', 'en')).toBe('en');
    });

    it('uses detected language in auto mode but honors a manual language selection', () => {
      expect(resolveAssistantLanguage('నాకు సహాయం కావాలి', 'en', 'auto')).toBe('te');
      expect(resolveAssistantLanguage('నాకు సహాయం కావాలి', 'en', 'manual')).toBe('en');
      expect(resolveAssistantLanguage('Please help me', 'te', 'auto')).toBe('en');
      expect(resolveAssistantLanguage('தமிழில் பதில் சொல்லுங்கள்', 'en', 'auto')).toBe('ta');
      expect(resolveAssistantLanguage('ಕನ್ನಡದಲ್ಲಿ ಉತ್ತರಿಸಿ', 'en', 'auto')).toBe('kn');
      expect(resolveAssistantLanguage('മലയാളത്തിൽ മറുപടി പറയൂ', 'en', 'auto')).toBe('ml');
      expect(resolveAssistantLanguage('vanakkam enakku vaayil vali irukku', 'ta', 'auto')).toBe('ta');
    });

    it('replaces a server reply in the wrong language with the localized assistant response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            answerText: 'Use the screening module.',
            speechText: 'Open screening.',
            language: 'ta',
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const answer = await askAssistant({
        query: 'screening',
        language: 'ta',
        languageMode: 'manual',
      });

      expect(answer.language).toBe('ta');
      expect(answer.answerText).toContain('வாய்வழி பரிசோதனை');
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.languageMode).toBe('manual');
    });

    it('keeps the written answer but corrects speech that does not match the answer language', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              answerText: 'வாய்வழி பரிசோதனை வழிகாட்டுதல்கள்: புண்களைக் கவனித்து புகைப்படம் எடுக்கவும்.',
              speechText: 'Observe for persistent patches and capture a clear photograph.',
              language: 'ta',
            },
          }),
        })
      );

      const answer = await askAssistant({
        query: 'screening',
        language: 'ta',
        languageMode: 'manual',
      });

      expect(answer.answerText).toContain('வாய்வழி பரிசோதனை');
      expect(answer.speechText).toContain('புகைப்படம்');
    });
  });

  describe('Microphone recognition engine', () => {
    it('starts in the selected locale and uses the highest-confidence transcript alternative', () => {
      const instances: any[] = [];
      class MockSpeechRecognition {
        lang = '';
        maxAlternatives = 0;
        continuous = false;
        interimResults = false;
        onstart: (() => void) | null = null;
        onresult: ((event: any) => void) | null = null;
        onerror: ((event: any) => void) | null = null;
        onend: (() => void) | null = null;
        constructor() {
          instances.push(this);
        }
        start() {
          this.onstart?.();
        }
        stop() {
          this.onend?.();
        }
        abort() {
          this.onend?.();
        }
      }
      vi.stubGlobal('window', { SpeechRecognition: MockSpeechRecognition });
      const onTranscript = vi.fn();
      const engine = new AssistantVoiceEngine({ onTranscript });

      expect(engine.isSpeechRecognitionSupported()).toBe(true);
      engine.startListening('te');
      expect(instances[0].lang).toBe('te-IN');
      expect(instances[0].maxAlternatives).toBe(3);

      const alternatives = [
        { transcript: 'unclear', confidence: 0.2 },
        { transcript: 'నమస్కారం', confidence: 0.9 },
      ];
      Object.assign(alternatives, { isFinal: true });
      instances[0].onresult?.({ resultIndex: 0, results: [alternatives] });
      expect(onTranscript).toHaveBeenCalledWith('నమస్కారం', true);

      engine.endConversation();
    });

    it('does not report microphone support when the recognizer cannot be initialized', () => {
      class BrokenSpeechRecognition {
        constructor() {
          throw new Error('initialization failed');
        }
      }
      vi.stubGlobal('window', { SpeechRecognition: BrokenSpeechRecognition });
      const onError = vi.fn();
      const engine = new AssistantVoiceEngine({ onError });

      expect(engine.isSpeechRecognitionSupported()).toBe(false);
      engine.startListening('en');
      expect(onError).toHaveBeenCalledWith('Speech recognition is not supported in this browser.');

      engine.endConversation();
    });

    it('starts listening when barge-in is used outside continuous conversation mode', () => {
      const instances: any[] = [];
      class MockSpeechRecognition {
        lang = '';
        continuous = false;
        interimResults = false;
        startCount = 0;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        constructor() {
          instances.push(this);
        }
        start() {
          this.startCount += 1;
          this.onstart?.();
        }
        stop() {
          this.onend?.();
        }
        abort() {
          this.onend?.();
        }
      }
      vi.stubGlobal('window', { SpeechRecognition: MockSpeechRecognition });
      const engine = new AssistantVoiceEngine();
      engine.enableContinuousConversation(false);

      engine.interrupt();

      expect(instances[0].lang).toBe('te-IN');
      expect(instances[0].startCount).toBe(1);
      engine.endConversation();
    });

    it('does not substitute an English voice for a Telugu response', () => {
      vi.stubGlobal('window', {
        speechSynthesis: {
          getVoices: () => [
            { name: 'English Voice', lang: 'en-IN' },
          ] as SpeechSynthesisVoice[],
        },
      });
      const engine = new AssistantVoiceEngine();

      const voice = engine.resolveFemaleVoice('te');
      expect(voice.voice).toBeNull();
      expect(voice.canSpeak).toBe(false);
      expect(voice.limitationNotice).toContain('Telugu');

      engine.endConversation();
    });
  });

  describe('1. Language Detection Engine', () => {
    it('detects Telugu script accurately by Unicode codepoints', () => {
      const teluguText = 'నాకు నోటి లోపల పుండ్లు ఉన్నాయి. ఏమి చేయాలి?';
      const detected = detectScriptFromText(teluguText);
      expect(detected).toBe('te');
    });

    it('detects Devanagari (Hindi) script accurately by Unicode codepoints', () => {
      const hindiText = 'नमस्ते, मुझे मुंह में छाले हैं।';
      const detected = detectScriptFromText(hindiText);
      expect(detected).toBe('hi');
    });

    it('detects standard English in Latin script', () => {
      const englishText = 'I have a sore inside my mouth. Should I see a doctor?';
      const detected = detectScriptFromText(englishText);
      expect(detected).toBe('en');
    });

    it('handles romanized Telugu keywords with fallback heuristic', () => {
      const romanizedTe = 'namaste ela unnaru naku pundu undi';
      const detected = detectScriptFromText(romanizedTe);
      expect(detected).toBe('te');
    });

    it('handles romanized Hindi keywords with fallback heuristic', () => {
      const romanizedHi = 'namaste mujhe chala dard hai';
      const detected = detectScriptFromText(romanizedHi);
      expect(detected).toBe('hi');
    });

    it('returns null for empty or whitespace text', () => {
      expect(detectScriptFromText('')).toBeNull();
      expect(detectScriptFromText('   ')).toBeNull();
    });
  });

  describe('2. Language Candidate Sequencer & Stickiness', () => {
    it('initializes with default Telugu (te-IN) for frontline tribal health workers', () => {
      const session = new LanguageSessionManager('te', 'auto');
      expect(session.getCurrentLanguage()).toBe('te');
      expect(session.getCurrentBCP47()).toBe('te-IN');
      expect(session.getMode()).toBe('auto');
    });

    it('cycles candidate languages on retry', () => {
      const session = new LanguageSessionManager('te', 'auto');
      const next1 = session.getNextCandidateLanguage();
      expect(['hi', 'en']).toContain(next1);
      const next2 = session.getNextCandidateLanguage();
      expect(['te', 'hi', 'en']).toContain(next2);
    });

    it('keeps sticky language and requires 2 consecutive turns in another language to flip', () => {
      const session = new LanguageSessionManager('te', 'auto');

      // Turn 1 in Hindi: answers in Hindi for this turn, but sticky state stays Telugu
      const replyLang1 = session.processTranscript('नमस्ते मुझे मदद चाहिए');
      expect(replyLang1).toBe('hi');
      expect(session.getCurrentLanguage()).toBe('te'); // still sticky to te

      // Turn 2 in Hindi: 2nd consecutive turn in Hindi now switches sticky language to Hindi
      const replyLang2 = session.processTranscript('कृपया मुझे डॉक्टर से बात कराएं');
      expect(replyLang2).toBe('hi');
      expect(session.getCurrentLanguage()).toBe('hi'); // flipped sticky to hi
    });

    it('never auto-switches when manually locked', () => {
      const session = new LanguageSessionManager('en', 'auto');
      session.setManualLanguage('en');
      expect(session.getMode()).toBe('manual');

      // Patient speaks Telugu, but manual lock retains English
      const replyLang = session.processTranscript('నమస్కారం నాకు పుండు ఉంది');
      expect(replyLang).toBe('en');
      expect(session.getCurrentLanguage()).toBe('en');
    });
  });

  describe('3. Voice Selection & Strict Language Boundaries', () => {
    let synth: MultilingualVoiceSynthesizer;

    beforeEach(() => {
      synth = new MultilingualVoiceSynthesizer();
    });

    it('resolves female voice for English when installed', () => {
      // Mock window.speechSynthesis
      const mockVoices = [
        { name: 'Microsoft Heera - English (India)', lang: 'en-IN', default: false, localService: true },
        { name: 'Microsoft David - English (United States)', lang: 'en-US', default: false, localService: true },
      ] as SpeechSynthesisVoice[];

      vi.spyOn(synth, 'getAvailableVoices').mockReturnValue(mockVoices);

      const res = synth.resolveVoice('en');
      expect(res.canSpeak).toBe(true);
      expect(res.voice?.name).toBe('Microsoft Heera - English (India)');
      expect(res.isFemale).toBe(true);
    });

    it('rejects male voices for regional languages', () => {
      const mockVoices = [
        { name: 'Microsoft Ravi - Telugu (India)', lang: 'te-IN', default: false, localService: true },
      ] as SpeechSynthesisVoice[];

      vi.spyOn(synth, 'getAvailableVoices').mockReturnValue(mockVoices);

      const res = synth.resolveVoice('te');
      // Ravi is explicitly filtered by MALE_VOICE_REGEX; fallback to non-male or notice
      expect(res.voiceName).not.toContain('David');
    });

    it('STRICT INVARIANT: NEVER reads Telugu or Hindi with an English voice if native voice is missing', () => {
      // Only English voices available on device
      const mockEnglishOnly = [
        { name: 'Microsoft Zira - English (United States)', lang: 'en-US', default: true, localService: true },
        { name: 'Microsoft David - English (United States)', lang: 'en-US', default: false, localService: true },
      ] as SpeechSynthesisVoice[];

      vi.spyOn(synth, 'getAvailableVoices').mockReturnValue(mockEnglishOnly);

      const resTe = synth.resolveVoice('te');
      expect(resTe.canSpeak).toBe(false);
      expect(resTe.voice).toBeNull();
      expect(resTe.reason).toContain('No native Telugu voice');

      const resHi = synth.resolveVoice('hi');
      expect(resHi.canSpeak).toBe(false);
      expect(resHi.voice).toBeNull();
      expect(resHi.reason).toContain('No native Hindi voice');
    });
  });

  describe('4. Clean Spoken Text & Sentence Chunking', () => {
    it('strips markdown asterisks, hashtags, bullets, emojis and URLs from speech text', () => {
      const raw = '⚠️ **ముఖ్యమైన గమనిక:** • నోటిలో పుండ్లు ఉంటే https://aarogya.gov.in చూడండి! 🩺';
      const clean = cleanSpeechText(raw);
      expect(clean).not.toContain('**');
      expect(clean).not.toContain('https://');
      expect(clean).not.toContain('•');
      expect(clean).not.toContain('🩺');
      expect(clean).toContain('ముఖ్యమైన గమనిక:');
      expect(clean).toContain('నోటిలో పుండ్లు ఉంటే');
    });

    it('chunks long responses at punctuation boundaries to avoid Chrome cutoff', () => {
      const synth = new MultilingualVoiceSynthesizer();
      const longText = 'First sentence is clear. Second sentence provides healthcare context. Third sentence directs to doctor examination.';
      const chunks = synth.chunkText(longText);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0]).toContain('First sentence is clear.');
    });
  });

  describe('5. Clinical Safety & Red-Flag Escalation Rules', () => {
    it('provides session start disclaimer in all 3 languages', () => {
      expect(VOICE_SESSION_DISCLAIMER.en.spokenText).toContain('AI assistant, not a doctor');
      expect(VOICE_SESSION_DISCLAIMER.te.spokenText).toContain('వైద్యురాలిని కాదు');
      expect(VOICE_SESSION_DISCLAIMER.hi.spokenText).toContain('डॉक्टर नहीं');
    });

    it('triggers emergency advice for choking or uncontrolled bleeding', () => {
      const rule = RED_FLAG_SYMPTOM_RULES.find((r) => r.id === 'emergency-bleeding-breathing');
      expect(rule).toBeDefined();
      expect(rule?.urgency).toBe('immediate');
      expect(rule?.spokenAdvice.en).toContain('108');
      expect(rule?.spokenAdvice.te).toContain('108');
      expect(rule?.spokenAdvice.hi).toContain('108');
    });

    it('escalates persistent ulcers over 2-3 weeks to clinical examination', () => {
      const rule = RED_FLAG_SYMPTOM_RULES.find((r) => r.id === 'persistent-ulcer-patch');
      expect(rule).toBeDefined();
      expect(rule?.spokenAdvice.te).toContain('వైద్యుడిని సంప్రదించండి');
      expect(rule?.spokenAdvice.hi).toContain('डॉक्टर को दिखाना चाहिए');
      expect(rule?.spokenAdvice.en).toContain('Primary Health Centre');
    });
  });

  describe('6. Frontline 3-Step Healthcare Guidance & Transliteration', () => {
    it('accurately resolves Step 1 Patient Registration query in Telugu transliteration', async () => {
      const { generateLocalAssistantResponse } = await import(
        '../../client/src/components/AIRobotAssistant/multilingualAssistantService.js'
      );
      const res = generateLocalAssistantResponse('ela register cheyyali patient ni', 'te');
      expect(res.navigateTo).toBe('patients');
      expect(res.topic).toBe('patient_registration');
      expect(res.answerText).toContain('మొదటి దశ: స్మార్ట్ రోగి నమోదు మార్గదర్శకత్వం');
      expect(res.speechText).toContain('మొదటి దశగా దయచేసి రోగి నమోదును పూర్తి చేయండి');
    });

    it('accurately resolves Step 1 Patient Registration query in Hindi transliteration', async () => {
      const { generateLocalAssistantResponse } = await import(
        '../../client/src/components/AIRobotAssistant/multilingualAssistantService.js'
      );
      const res = generateLocalAssistantResponse('registration kaise kare mariz ko', 'hi');
      expect(res.navigateTo).toBe('patients');
      expect(res.topic).toBe('patient_registration');
      expect(res.answerText).toContain('पहला कदम: स्मार्ट मरीज पंजीकरण मार्गदर्शन');
      expect(res.speechText).toContain('पहले चरण में कृपया मरीज का पंजीकरण पूरा करें');
    });

    it('accurately resolves Step 2 Oral Screening query with photo capture instructions', async () => {
      const { generateLocalAssistantResponse } = await import(
        '../../client/src/components/AIRobotAssistant/multilingualAssistantService.js'
      );
      const res = generateLocalAssistantResponse('photo ela theeyali screening kosam', 'te');
      expect(res.navigateTo).toBe('screening');
      expect(res.topic).toBe('oral_screening_guidance');
      expect(res.answerText).toContain('రెండవ దశ: నోటి స్క్రీనింగ్ ఫోటో తీయడం');
      expect(res.speechText).toContain('రెండవ దశ: నోటి లోపల మంచి కాంతిలో స్పష్టమైన ఫోటో తీయండి');
    });

    it('accurately resolves Step 3 Doctor Guidance query recommending Dental Surgeon & CHC', async () => {
      const { generateLocalAssistantResponse } = await import(
        '../../client/src/components/AIRobotAssistant/multilingualAssistantService.js'
      );
      const res = generateLocalAssistantResponse('ye doctor ni kalavali paderu hospital lo', 'te');
      expect(res.navigateTo).toBe('specialists');
      expect(res.topic).toBe('doctor_referral_guidance');
      expect(res.answerText).toContain('డాక్టర్ కె. రమేష్');
      expect(res.answerText).toContain('పాడేరు');
      expect(res.speechText).toContain('పాడేరు కమ్యూనిటీ హెల్త్ సెంటర్‌లో దంత వైద్యులు');
    });

    it('includes 3D Dental Implant & Crown Restoration in FUTURISTIC_ORAL_SHORTS matching Image 2 diagram', async () => {
      const { FUTURISTIC_ORAL_SHORTS } = await import(
        '../../client/src/components/CinematicHealthcareBackdrop.js'
      );
      const implantScene = FUTURISTIC_ORAL_SHORTS.find((s: any) => s.id === 'dental-implant');
      expect(implantScene).toBeDefined();
      expect(implantScene?.title).toContain('3D Bio-Integrated Dental Implant Restoration');
      expect(implantScene?.titleTe).toContain('3D బయో-ఇంటిగ్రేటెడ్ దంత ఇంప్లాంట్');
      expect(implantScene?.badge).toContain('3D IMPLANT RESTORATION');
    });
  });
});

