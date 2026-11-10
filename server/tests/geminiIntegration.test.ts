import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { isGeminiConfigured } from '../src/modules/assistant/geminiService.js';
import { offlineAnalyzeOralPhoto } from '../src/modules/assistant/assistantRoutes.js';

describe('Gemini Multimodal Vision & Chatbot Backend Integration', () => {
  const app = createApp();
  it('detects whether GEMINI_API_KEY is configured in environment', () => {
    const configured = isGeminiConfigured();
    expect(typeof configured).toBe('boolean');
  });

  it('offline fallback analyzer generates comprehensive doctor referral in English', () => {
    const result = offlineAnalyzeOralPhoto('Patient has persistent white patch on left cheek', 'en');
    expect(result).toBeDefined();
    expect(result.observedCondition).toContain('Keratosis');
    expect(result.riskTier).toBe('moderate_risk_support');
    expect(result.recommendedDoctor.specialty).toContain('Dental Surgeon');
    expect(result.recommendedDoctor.facility).toContain('Paderu');
    expect(result.recommendedDoctor.timelineDays).toBeGreaterThan(0);
    expect(result.speechText).toBeDefined();
    expect(result.answerText).toContain('Recommended Doctor to Consult');
  });

  it('offline fallback analyzer generates native Telugu speechText and doctor recommendation', () => {
    const result = offlineAnalyzeOralPhoto('నోటిలో తెల్లని మచ్చ మరియు మంట', 'te');
    expect(result).toBeDefined();
    expect(result.language).toBe('te');
    expect(result.recommendedDoctor.specialty).toBeDefined();
    expect(result.answerText).toContain('వైద్యులు');
    expect(result.speechText).toContain('సంప్రదించండి');
  });

  it('offline fallback analyzer flags red erythroplakic areas as high-priority referral', () => {
    const result = offlineAnalyzeOralPhoto('Red mucosal patch with bleeding on lateral tongue', 'en');
    expect(result.riskTier).toBe('high_risk_support');
    expect(result.recommendedDoctor.urgency).toBe('urgent');
    expect(result.recommendedDoctor.timelineDays).toBeLessThanOrEqual(7);
  });

  it('POST /api/v1/assistant/query accepts imageBase64 and returns doctor recommendation', async () => {
    // 1x1 transparent PNG base64
    const samplePngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'Please check this white spot on my tongue and tell me which doctor to see',
        language: 'en',
        imageBase64: samplePngBase64,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.doctorRecommendation).toBeDefined();
    expect(res.body.data.doctorRecommendation.specialty).toBeDefined();
    expect(res.body.data.doctorRecommendation.facility).toBeDefined();
    expect(res.body.data.photoAnalysis).toBeDefined();
    expect(res.body.data.speechText).toBeDefined();
  });

  it('POST /api/v1/assistant/analyze-photo handles direct photo screening requests', async () => {
    const samplePngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const res = await request(app)
      .post('/api/v1/assistant/analyze-photo')
      .send({
        imageBase64: samplePngBase64,
        patientNote: 'Lesion on right buccal mucosa, betel nut chewer for 10 years',
        language: 'te',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.observedCondition).toBeDefined();
    expect(res.body.data.recommendedDoctor).toBeDefined();
    expect(res.body.data.recommendedDoctor.facility).toBeDefined();
    expect(res.body.data.disclaimer).toContain('DEMO AI SCREENING SUPPORT');
  });
});
