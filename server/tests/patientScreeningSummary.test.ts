import { describe, it, expect, afterEach } from 'vitest';
import { buildPatientScreeningSummary } from '../src/modules/ai/patientScreeningSummary.js';
import { getModelCard } from '../src/modules/ai/modelEvaluation.js';

const PROHIBITED = /\b(?:cancer|malignant|carcinoma|curative)\b|\bstage\s*(?:\d+|[ivx]+)\b|\bdiagnostic confirmation\b/i;

describe('Patient-safe AI screening summary (Invariant 1)', () => {
  const screening = {
    screeningId: 'SCR-1',
    createdAt: new Date(),
    label: 'high_risk_support',
    confidence: 0.82,
    modelVersion: 'gemini-vision-test',
    referToSpecialist: true,
    clinicianReview: { status: 'PENDING' },
    geminiAnalysis: {
      riskTier: 'high_risk_support',
      conditionCategory: 'white_lesion',
      observedCondition: 'Possible leukoplakia',
      possibleConditions: ['oral carcinoma', 'leukoplakia'],
      anatomicalSite: 'Left inner cheek',
      visualFindings: ['White patch about 1 cm', 'Rough surface texture', 'Looks like stage 2 carcinoma'],
      riskFactors: ['Reported tobacco chewing'],
      possibleCauses: ['Long-term irritation from tobacco'],
      urgentRedFlags: ['Patch that bleeds easily'],
      lifestyleAdvice: ['Eat more vegetables'],
      recommendedDoctor: { specialty: 'Oral medicine specialist', facility: 'District hospital', urgency: 'urgent', timelineDays: 3, consultationReason: 'x' },
    },
  };

  it('reports risk level, findings, possible conditions, causes and confidence while dropping prohibited wording', () => {
    const summary = buildPatientScreeningSummary(screening);
    expect(summary.riskLevel).toBe('high');
    expect(summary.confidence).toBe(0.82);
    expect(summary.findingTypeLabel).toBe('White patch on the mouth lining');
    expect(summary.visualFindings).toEqual(['White patch about 1 cm', 'Rough surface texture']);
    expect(summary.reasons).toContain('Reported tobacco chewing');
    expect(summary.possibleCauses).toContain('Long-term irritation from tobacco');
    expect(summary.possibleConditions).toEqual(['leukoplakia']);
    expect(summary.analysisSource).toBe('detailed');
    expect(summary.nextStep.suggestedDoctorType).toBe('Oral medicine specialist');
    expect(summary.nextStep.urgency).toBe('urgent');
    expect(summary.label).toBe('DEMO AI');
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toMatch(PROHIBITED);
    expect(serialized).not.toContain('vegetables');
  });

  it('falls back to the triage badge when no Gemini tier exists', () => {
    const basic = buildPatientScreeningSummary({ screeningId: 'S2', label: 'x', confidence: 0.38, combinedRecommendation: { badgeColor: 'AMBER' } });
    expect(basic.riskLevel).toBe('moderate');
    expect(basic.analysisSource).toBe('basic');
    expect(basic.lowConfidence).toBe(true);
  });
});

describe('AI model card never fabricates accuracy', () => {
  afterEach(() => { delete process.env.AI_MODEL_EVALUATION; delete process.env.AI_MODEL_EVALUATION_FILE; });

  it('reports not validated when no evaluation is configured', () => {
    process.env.AI_MODEL_EVALUATION_FILE = '/nonexistent/model-evaluation.json';
    expect(getModelCard().validated).toBe(false);
  });

  it('returns configured evaluation metrics and rejects invalid ones', () => {
    process.env.AI_MODEL_EVALUATION = JSON.stringify({ modelVersion: 'v1', datasetDescription: 'Held-out synthetic set', sampleSize: 200, evaluatedAt: '2026-10-01', accuracy: 0.87, sensitivity: 0.9 });
    expect(getModelCard()).toMatchObject({ validated: true, accuracy: 0.87, sampleSize: 200 });
    process.env.AI_MODEL_EVALUATION = JSON.stringify({ modelVersion: 'v1', accuracy: 1.7 });
    expect(getModelCard().validated).toBe(false);
  });
});
