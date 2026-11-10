import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Intelligent 2D AI Robotic Assistant API Tests', () => {
  const app = createApp();

  it('allows unauthenticated guest queries with optionalAuth and returns structured animation metadata', async () => {
    const res = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'Hello Drishti, can you introduce yourself?',
        language: 'en',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.answerText).toBeDefined();
    expect(data.animation).toBeDefined();
    expect(['greeting', 'idle', 'explaining', 'happy']).toContain(data.animation);
    expect(data.expression).toBeDefined();
    expect(data.gesture).toBeDefined();
    expect(Array.isArray(data.suggestedActions)).toBe(true);
  });

  it('triggers immediate medical safety warning and animation for red-flag symptoms', async () => {
    const res = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'I have had a non healing ulcer for 3 weeks and difficulty swallowing',
        language: 'en',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.animation).toBe('warning');
    expect(data.expression).toBe('concerned');
    expect(data.gesture).toBe('gentle_warning');
    expect(data.topic).toBe('medical_safety');
    expect(data.navigateTo).toBe('hospitals');
    expect(data.answerText).toContain('Clinical Safety Warning');
  });

  it('triggers guided registration intent when asked how to sign up or create account', async () => {
    const res = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'How do I register an account?',
        language: 'en',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.intent).toBe('guided_registration');
    expect(data.animation).toBe('pointing');
  });

  it('supports multilingual queries in Telugu and Hindi', async () => {
    const resTe = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'నమస్కారం, క్యాంప్ వివరాలు చెప్పండి',
        language: 'te',
      });

    expect(resTe.status).toBe(200);
    expect(resTe.body.data.language).toBe('te');

    const resHi = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'नमस्ते, स्क्रीनिंग कैसे होती है?',
        language: 'hi',
      });

    expect(resHi.status).toBe(200);
    expect(resHi.body.data.language).toBe('hi');

    const resTa = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'வணக்கம், உதவி தேவை',
        language: 'ta',
      });

    expect(resTa.status).toBe(200);
    expect(resTa.body.data.language).toBe('ta');

    const resKn = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'ನಮಸ್ಕಾರ, ಮಾಹಿತಿ ನೀಡಿ',
        language: 'kn',
      });

    expect(resKn.status).toBe(200);
    expect(resKn.body.data.language).toBe('kn');

    const resMl = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'നമസ്കാരം, സഹായം വേണം',
        language: 'ml',
      });

    expect(resMl.status).toBe(200);
    expect(resMl.body.data.language).toBe('ml');
  });

  it('accurately understands acute fever inquiries in Telugu and responds with natural female voice speechText', async () => {
    const resTe = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'నాకు రెండు రోజులుగా జ్వరం వస్తోంది',
        language: 'te',
      });

    expect(resTe.status).toBe(200);
    expect(resTe.body.data.language).toBe('te');
    expect(resTe.body.data.intent).toBe('fever_general_symptom_inquiry');
    expect(resTe.body.data.speechText).toBeDefined();
    expect(resTe.body.data.speechText).toContain('జ్వరం');
    // Verifies friendly conversational follow-up question (one question at a time)
    expect(resTe.body.data.speechText).toContain('?');
    // Verifies strict clinical safety (no forbidden terms)
    expect(resTe.body.data.speechText.toLowerCase()).not.toMatch(/\b(cancer|malignant|carcinoma|curative|diagnosis|diagnose)\b/i);
  });

  it('accurately understands fever inquiries in Hindi and English with natural speechText', async () => {
    const resHi = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'मुझे दो दिनों से तेज बुखार और सिरदर्द है',
        language: 'hi',
      });

    expect(resHi.status).toBe(200);
    expect(resHi.body.data.language).toBe('hi');
    expect(resHi.body.data.intent).toBe('fever_general_symptom_inquiry');
    expect(resHi.body.data.speechText).toContain('बुखार');

    const resEn = await request(app)
      .post('/api/v1/assistant/query')
      .send({
        message: 'I have had a mild fever and body pain since yesterday',
        language: 'en',
      });

    expect(resEn.status).toBe(200);
    expect(resEn.body.data.language).toBe('en');
    expect(resEn.body.data.intent).toBe('fever_general_symptom_inquiry');
    expect(resEn.body.data.speechText.toLowerCase()).toContain('fever');
    expect(resEn.body.data.speechText.toLowerCase()).not.toMatch(/\b(cancer|malignant|carcinoma|curative|diagnosis|diagnose)\b/i);
  });
});
