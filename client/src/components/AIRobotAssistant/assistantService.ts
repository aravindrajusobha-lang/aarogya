import { LanguageCode } from '../../i18n';
import {
  AssistantAnswer,
  generateLocalAssistantResponse,
} from './multilingualAssistantService';

export interface ChatHistoryEntry {
  sender: 'user' | 'assistant';
  text: string;
  language?: string;
}

export interface AssistantQueryOptions {
  query: string;
  language: LanguageCode;
  activeTab?: string;
  authToken?: string;
  conversationHistory?: ChatHistoryEntry[];
  image?: string;
  mimeType?: string;
}

/**
 * Remove markdown symbols, asterisks, hash headers, bullet points, emojis and URLs
 * so speechText is 100% natural and clean for speech synthesis.
 */
export function cleanSpeechText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[*_#`~>[\]()]/g, '')
    .replace(/[•●▪■]/g, ' ')
    .replace(/[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function askAssistant(
  options: AssistantQueryOptions
): Promise<AssistantAnswer> {
  const {
    query,
    language,
    activeTab = 'dashboard',
    authToken,
    conversationHistory = [],
    image,
    mimeType = 'image/jpeg',
  } = options;

  // Recent 6 turns history to preserve context without excessive payload
  const recentHistory = conversationHistory.slice(-6).map((item) => ({
    role: item.sender === 'user' ? 'user' : 'assistant',
    text: item.text,
  }));

  // Request timeout of 25 seconds as specified
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch('/api/v1/assistant/query', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: query,
        query,
        language,
        context: { activeTab },
        conversationHistory: recentHistory,
        image,
        imageBase64: image,
        mimeType,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const payload = await res.json();
      if (payload.success && payload.data) {
        const data = payload.data;
        const rawSpeech = data.speechText || data.answerText || '';
        return {
          answerText: data.answerText || data.response || '',
          speechText: cleanSpeechText(rawSpeech),
          language: (data.language as LanguageCode) || language,
          topic: data.topic || 'general',
          animation:
            data.animation === 'warning' || data.animation === 'error'
              ? 'error'
              : 'speaking',
          navigateTo: data.navigateTo || null,
          suggestedActions: data.suggestedActions || [],
          doctorRecommendation: data.doctorRecommendation || undefined,
          photoAnalysis: data.photoAnalysis || undefined,
        };
      }
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutMessages: Record<string, { written: string; spoken: string }> = {
        te: {
          written: 'సమాధానం ఇవ్వడంలో ఆలస్యం అయింది (25 సెకన్లు). దయచేసి నెట్‌వర్క్ తనిఖీ చేసి మరలా అడగండి.',
          spoken: 'సమాధానం ఇవ్వడంలో ఆలస్యం అయింది. దయచేసి మరొకసారి ప్రయత్నించండి.',
        },
        hi: {
          written: 'सर्वर से उत्तर मिलने में समय लगा (25 सेकंड)। कृपया नेटवर्क जांचें और पुनः प्रयास करें।',
          spoken: 'उत्तर मिलने में समय लग रहा है। कृपया पुनः प्रयास करें।',
        },
        en: {
          written: 'The response timed out after 25 seconds. Please check your network and try asking again.',
          spoken: 'The response timed out. Please try asking your question again.',
        },
      };
      const msg = timeoutMessages[language] || timeoutMessages.en;
      return {
        answerText: msg.written,
        speechText: msg.spoken,
        language,
        topic: 'timeout',
        animation: 'error',
        suggestedActions: ['Try again', 'Check connection'],
      };
    }
    // Network offline - seamlessly use local multilingual engine
  }

  // Resilient fallback to local comprehensive knowledge base
  const localRes = generateLocalAssistantResponse(query, language, activeTab);
  return {
    ...localRes,
    speechText: cleanSpeechText(localRes.speechText || localRes.answerText),
  };
}
