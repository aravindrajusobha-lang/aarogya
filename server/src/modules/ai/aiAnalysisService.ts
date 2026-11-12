import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../../config/logger.js';
import { analyzeOralPhotoWithGemini, isGeminiConfigured, OralPhotoAnalysisResult } from '../assistant/geminiService.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

export interface OralImageAnalysis {
  label: string;
  confidence: number;
  probabilities: Record<string, number>;
  referToSpecialist: boolean;
  modelVersion: string;
  imageQuality?: { ok: boolean; reason?: string | null; blurScore?: number; brightness?: number };
  geminiAnalysis?: OralPhotoAnalysisResult;
}

export class AiProviderUnavailableError extends Error {
  readonly statusCode = 503;
  readonly code = 'AI_PROVIDER_UNAVAILABLE';
}

export class InvalidScreeningImageError extends Error {
  readonly statusCode = 422;
  readonly code = 'IMAGE_QUALITY_REJECTED';
}

function validateModelResult(data: any): OralImageAnalysis {
  if (data?.is_placeholder === true || data?.isPlaceholder === true) {
    throw new AiProviderUnavailableError('The configured screening model is not trained and cannot analyze this image.');
  }
  if (data?.image_quality?.ok === false) {
    throw new InvalidScreeningImageError(data.image_quality.reason || 'The image is not clear enough. Please capture it again.');
  }
  if (typeof data?.label !== 'string' || !data.label.trim()) {
    throw new AiProviderUnavailableError('The screening model did not return a usable result.');
  }
  if (typeof data?.confidence !== 'number' || !Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1) {
    throw new AiProviderUnavailableError('The screening model did not return a valid confidence value.');
  }

  return {
    label: data.label,
    confidence: data.confidence,
    probabilities: data.probabilities && typeof data.probabilities === 'object' ? data.probabilities : {},
    referToSpecialist: Boolean(data.refer_to_specialist),
    modelVersion: String(data.model_version || 'configured-screening-model'),
    ...(data.image_quality ? { imageQuality: {
      ok: Boolean(data.image_quality.ok),
      reason: data.image_quality.reason ?? null,
      ...(typeof data.image_quality.blur_score === 'number' ? { blurScore: data.image_quality.blur_score } : {}),
      ...(typeof data.image_quality.brightness === 'number' ? { brightness: data.image_quality.brightness } : {}),
    } } : {}),
  };
}

export async function analyzeOralScreeningImage(input: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  patientNote?: string;
  language?: 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';
}): Promise<OralImageAnalysis> {
  if (isGeminiConfigured()) {
    try {
      const geminiAnalysis = await analyzeOralPhotoWithGemini({
        imageBase64: input.buffer.toString('base64'),
        mimeType: input.mimeType,
        patientNote: input.patientNote,
        language: input.language,
      });
      if (!Number.isFinite(geminiAnalysis.confidenceScore) || geminiAnalysis.confidenceScore < 0 || geminiAnalysis.confidenceScore > 1) {
        throw new Error('Gemini returned an invalid confidence value.');
      }
      return {
        label: geminiAnalysis.riskTier,
        confidence: geminiAnalysis.confidenceScore,
        probabilities: {},
        referToSpecialist: geminiAnalysis.recommendedDoctor.urgency === 'urgent',
        modelVersion: `gemini-vision-${geminiAnalysis.analyzedByModel}`,
        geminiAnalysis,
      };
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : 'Unknown Gemini error' }, 'Gemini image analysis failed; trying the configured local model');
    }
  }

  try {
    const formData = new FormData();
    formData.append('image', input.buffer, { filename: input.filename || 'screening.jpg', contentType: input.mimeType });
    const response = await axios.post(`${AI_SERVICE_URL}/predict`, formData, {
      headers: formData.getHeaders(),
      timeout: 20000,
      maxBodyLength: 8 * 1024 * 1024,
    });
    return validateModelResult(response.data);
  } catch (error) {
    if (error instanceof AiProviderUnavailableError || error instanceof InvalidScreeningImageError) throw error;
    logger.error({ err: axios.isAxiosError(error) ? error.message : 'Invalid model response' }, 'Configured oral screening model is unavailable');
    throw new AiProviderUnavailableError('Oral screening is temporarily unavailable. No result was saved; please try again when the screening service is online.');
  }
}
