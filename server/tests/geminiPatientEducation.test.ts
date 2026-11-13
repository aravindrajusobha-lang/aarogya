import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeOralPhotoWithGemini } from '../src/modules/assistant/geminiService.js';

const geminiJson = {
  observedCondition: 'A small pale area is visible; the photo is not clear enough to characterize it further.',
  conditionCategory: 'other',
  riskTier: 'moderate_risk_support',
  confidenceScore: 0.42,
  anatomicalSite: 'Inner cheek',
  visualFindings: ['A pale area is visible in the image.'],
  recommendedDoctor: {
    specialty: 'Dental clinician',
    facility: 'Ask local health staff',
    urgency: 'routine',
    timelineDays: 14,
    consultationReason: 'An in-person review can consider the image and symptoms.',
  },
  urgentRedFlags: [],
  lifestyleAdvice: [],
  patientExplanation: 'The photo shows a pale area on the inner cheek, but an image cannot establish its cause. A clinician can examine it and consider how long it has been present.',
  possibleCauses: ['Similar-looking changes may follow cheek biting or irritation from a rough tooth.'],
  whatToTellClinician: ['Tell the clinician when it began and whether it is changing.'],
  whenToSeekReview: ['Arrange a review if it lasts more than three weeks or gets worse.'],
  answerText: 'The photo shows a pale area, but it cannot establish the cause. Please discuss it with a clinician.',
  speechText: 'The photo shows a pale area. A clinician can examine it and discuss what may be causing it.',
  suggestedActions: ['Book a clinician visit'],
};

describe('Gemini patient education response', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
    vi.stubEnv('GEMINI_MODEL', 'gemini-flash-lite-latest');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses the configured vision model and returns bounded patient education fields', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(geminiJson) }] } }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeOralPhotoWithGemini({
      imageBase64: 'aGVsbG8=',
      mimeType: 'image/jpeg',
      language: 'en',
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/models/gemini-flash-lite-latest:generateContent');
    expect(result.analyzedByModel).toBe('gemini-flash-lite-latest');
    expect(result.patientExplanation).toContain('cannot establish its cause');
    expect(result.possibleCauses).toHaveLength(1);
    expect(result.whatToTellClinician).toHaveLength(1);
    expect(result.whenToSeekReview).toHaveLength(1);
    expect(result.informationSources?.some((source) => source.url.includes('nhs.uk'))).toBe(true);
  });

  it('retries an overloaded model, then falls back to the next model in the chain', async () => {
    vi.stubEnv('GEMINI_FALLBACK_MODELS', 'gemini-backup-model');
    vi.stubEnv('GEMINI_ATTEMPTS_PER_MODEL', '2');
    const overloaded = { ok: false, status: 503, text: async () => 'overloaded', json: async () => ({}) };
    const success = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: JSON.stringify(geminiJson) }] } }] }) };
    const fetchMock = vi.fn().mockResolvedValueOnce(overloaded).mockResolvedValueOnce(overloaded).mockResolvedValueOnce(success);
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeOralPhotoWithGemini({ imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg', language: 'en' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/models/gemini-backup-model:generateContent');
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('key=');
    expect(result.analyzedByModel).toBe('gemini-backup-model');
  }, 20000);

  it('drops individual prohibited phrases instead of discarding the whole analysis', async () => {
    const unsafe = { ...geminiJson, possibleConditions: ['mouth ulcer', 'oral carcinoma'], visualFindings: ['Raised white patch about 1 cm', 'looks malignant'] };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(unsafe) }] } }] }) })));

    const result = await analyzeOralPhotoWithGemini({ imageBase64: 'aGVsbG8=', mimeType: 'image/jpeg', language: 'en' });

    expect(result.possibleConditions).toEqual(['mouth ulcer']);
    expect(result.visualFindings).toEqual(['Raised white patch about 1 cm']);
    expect(result.patientExplanation).toContain('cannot establish its cause');
  });
});
