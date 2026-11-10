// =========================================================================
// AAROGYA-DRISHTI: GOOGLE GEMINI API MODULE
// Exclusively powers Multimodal Vision (Oral Lesion Triage) & Multilingual Chat
// =========================================================================

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import {
  isGeminiConfigured,
  getGeminiModelName,
  analyzeOralPhotoWithGemini,
  generateChatResponseWithGemini
} from './src/modules/assistant/geminiService.js';

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

