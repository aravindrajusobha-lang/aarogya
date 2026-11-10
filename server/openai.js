// =========================================================================
// AAROGYA-DRISHTI: AI INTEGRATION NOTICE
// OpenAI is disabled per platform architecture and user directive.
// Aarogya-Drishti exclusively uses the official Google Gemini API (Multimodal Vision & Chat).
// =========================================================================

import {
  isGeminiConfigured,
  getGeminiModelName,
  analyzeOralPhotoWithGemini,
  generateChatResponseWithGemini
} from './src/modules/assistant/geminiService.js';

console.warn('⚠️ OpenAI is disabled. Aarogya-Drishti uses Google Gemini API exclusively.');

export {
  isGeminiConfigured,
  getGeminiModelName,
  analyzeOralPhotoWithGemini,
  generateChatResponseWithGemini
};

export default {
  isGeminiConfigured,
  getGeminiModelName,
  analyzeOralPhotoWithGemini,
  generateChatResponseWithGemini
};
