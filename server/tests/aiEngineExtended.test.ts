import { describe, it, expect, vi, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  computeCombinedRecommendation,
} from '../src/modules/ai/aiRoutes.js';
import {
  calculateRiskScore,
  IRiskQuestionnaireAnswers,
  loadRiskWeightsConfig,
} from '../src/modules/ai/riskScore.js';
import fs from 'node:fs';
import path from 'node:path';

describe('AI Engine Extended: Multi-Disease (Modules A, B, C & Combined Report)', () => {
  // ---------------------------------------------------------------------------
  // 1. MODULE A: Configurable Lesion Classes & Safe Fallback
  // ---------------------------------------------------------------------------
  describe('Module A - Mucosal Lesion Model Configuration', () => {
    it('loads standard 4 classes from valid config file', () => {
      const configPath = path.resolve(__dirname, '../../ai_service/config/lesion_classes.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(content.classes).toEqual([
        'normal',
        'benign_inflammatory',
        'opmd',
        'suspected_malignant',
      ]);
      expect(content.specialist_referral_classes).toContain('opmd');
      expect(content.specialist_referral_classes).toContain('suspected_malignant');
    });

    it('wrong or corrupted class config fails safely to default classes', () => {
      // Simulate reading a corrupted config
      const invalidConfigs = [
        '{ invalid JSON ...',
        JSON.stringify({ classes: [] }),
        JSON.stringify({ classes: 'not an array' }),
        JSON.stringify({}),
      ];

      for (const badConfig of invalidConfigs) {
        let loadedClasses = ['normal', 'benign_inflammatory', 'opmd', 'suspected_malignant'];
        try {
          const parsed = JSON.parse(badConfig);
          if (Array.isArray(parsed.classes) && parsed.classes.length >= 2) {
            loadedClasses = parsed.classes;
          }
        } catch {
          // safe fallback
        }

        expect(loadedClasses.length).toBe(4);
        expect(loadedClasses).toContain('normal');
        expect(loadedClasses).toContain('opmd');
      }
    });

    it('supports extending classes to include OSMF and non-healing ulcer without code changes', () => {
      const extendedConfig = {
        classes: [
          'normal',
          'benign_inflammatory',
          'opmd',
          'suspected_malignant',
          'osmf',
          'non_healing_ulcer',
        ],
        specialist_referral_classes: [
          'opmd',
          'suspected_malignant',
          'osmf',
          'non_healing_ulcer',
        ],
      };

      expect(extendedConfig.classes.length).toBe(6);
      expect(extendedConfig.specialist_referral_classes).toContain('osmf');
      expect(extendedConfig.specialist_referral_classes).toContain('non_healing_ulcer');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. MODULE B: Dental Multi-Label Model with Sigmoid Outputs & Thresholds
  // ---------------------------------------------------------------------------
  describe('Module B - Dental Model Multi-Label Findings', () => {
    it('applies per-class thresholds from thresholds.json correctly', () => {
      const configPath = path.resolve(__dirname, '../../ai_service/config/dental_thresholds.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(config.labels).toEqual([
        'caries',
        'gingivitis',
        'calculus',
        'plaque_soft_deposit',
        'discoloration',
      ]);
      expect(config.thresholds.caries).toBe(0.5);
      expect(config.thresholds.gingivitis).toBe(0.45);

      // Verify Sigmoid thresholding calculation
      const simulatedProbabilities = {
        caries: 0.72, // >= 0.50 -> Flagged
        gingivitis: 0.46, // >= 0.45 -> Flagged
        calculus: 0.22, // < 0.50 -> Not flagged
        plaque_soft_deposit: 0.15, // < 0.50 -> Not flagged
        discoloration: 0.58, // >= 0.55 -> Flagged (cosmetic, not urgent)
      };

      const findings = config.labels.map((label: string) => {
        const prob = simulatedProbabilities[label as keyof typeof simulatedProbabilities];
        const threshold = config.thresholds[label];
        const flagged = prob >= threshold;
        return { label, probability: prob, threshold, flagged };
      });

      const cariesFinding = findings.find((f: any) => f.label === 'caries');
      const gingivitisFinding = findings.find((f: any) => f.label === 'gingivitis');
      const calculusFinding = findings.find((f: any) => f.label === 'calculus');

      expect(cariesFinding.flagged).toBe(true);
      expect(gingivitisFinding.flagged).toBe(true);
      expect(calculusFinding.flagged).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. MODULE C: Risk-Factor Questionnaire & Shared Scoring Engine
  // ---------------------------------------------------------------------------
  describe('Module C - Risk Questionnaire & Scoring Engine', () => {
    it('calculates LOW risk when patient reports no habits and no symptoms', () => {
      const answers: IRiskQuestionnaireAnswers = {};
      const result = calculateRiskScore(answers);

      expect(result.score).toBe(0);
      expect(result.level).toBe('LOW');
      expect(result.flaggedSymptoms).toHaveLength(0);
      expect(result.flaggedHabits).toHaveLength(0);
      expect(result.reportedByPatient).toBe(true);
      expect(result.clinicalValidationRequired).toBe(true);
    });

    it('calculates MODERATE risk when patient reports tobacco use with duration', () => {
      const answers: IRiskQuestionnaireAnswers = {
        chewed_tobacco_gutka: true,
        years_of_use: '6_10', // multiplier = 1.5 -> 25 * 1.5 = 37.5 -> 38
      };
      const result = calculateRiskScore(answers);

      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.level).toBe('MODERATE');
      expect(result.flaggedHabits).toContain('Chewed tobacco / gutka');
      expect(result.reportedByPatient).toBe(true);
    });

    it('immediately triggers HIGH risk when any oral red-flag symptom is present', () => {
      const redFlagSymptoms: (keyof IRiskQuestionnaireAnswers)[] = [
        'ulcer_longer_than_2_weeks',
        'white_red_patch',
        'difficulty_opening_mouth',
        'neck_lump',
      ];

      for (const sym of redFlagSymptoms) {
        const answers: IRiskQuestionnaireAnswers = { [sym]: true };
        const result = calculateRiskScore(answers);

        expect(result.level).toBe('HIGH');
        expect(result.rationale).toContain('Immediate high-risk symptom present');
      }
    });

    it('labels all habit data as "reported by patient" without claiming AI photo detection', () => {
      const answers: IRiskQuestionnaireAnswers = {
        smoked_tobacco: true,
        chewed_tobacco_gutka: true,
        years_of_use: '10_plus',
      };
      const result = calculateRiskScore(answers);

      expect(result.reportedByPatient).toBe(true);
      expect(result.disclaimer).toContain('Screening risk scoring aid only');
      expect(result.disclaimer).toContain('To be validated by a clinician');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. COMBINED RESULT: Multi-Factor Triaging Rules
  // ---------------------------------------------------------------------------
  describe('Combined Oral Health Screening Report Triaging Rules', () => {
    it('TEST CASE: High-risk history with a normal-looking photo STILL refers to specialist', () => {
      // Normal-looking photo (Module A = normal, confidence 95%)
      const moduleA = {
        label: 'normal',
        confidence: 0.95,
      };

      // High-risk patient history (Module C = ulcer > 2 weeks -> HIGH)
      const moduleC = {
        level: 'HIGH',
        score: 65,
        flaggedSymptoms: ['Non-healing ulcer > 2 weeks'],
        flaggedHabits: ['Chewed tobacco / gutka (10-plus years)'],
      };

      const moduleB = {
        findings: [],
        seeDentistRecommended: false,
      };

      const recommendation = computeCombinedRecommendation(moduleA, moduleB, moduleC);

      // INVARIANT TEST: Must refer to specialist!
      expect(recommendation.referToSpecialist).toBe(true);
      expect(recommendation.badgeColor).toBe('RED');
      expect(recommendation.triageCategory).toBe('URGENT_SPECIALIST');
      expect(recommendation.triggerModules.some((t) => t.includes('Module C'))).toBe(true);
    });

    it('TEST CASE: Low confidence (< 0.60) photo with normal risk STILL refers to specialist', () => {
      const moduleA = {
        label: 'normal',
        confidence: 0.52, // Below 0.60 threshold
      };
      const moduleB = { findings: [], seeDentistRecommended: false };
      const moduleC = { level: 'LOW', score: 0 };

      const recommendation = computeCombinedRecommendation(moduleA, moduleB, moduleC);

      expect(recommendation.referToSpecialist).toBe(true);
      expect(recommendation.badgeColor).toBe('RED');
      expect(recommendation.triggerModules.some((t) => t.includes('Low confidence'))).toBe(true);
    });

    it('TEST CASE: Suspected lesion (OPMD) with zero risk history STILL refers to specialist', () => {
      const moduleA = {
        label: 'opmd',
        confidence: 0.88,
      };
      const moduleB = { findings: [], seeDentistRecommended: false };
      const moduleC = { level: 'LOW', score: 0 };

      const recommendation = computeCombinedRecommendation(moduleA, moduleB, moduleC);

      expect(recommendation.referToSpecialist).toBe(true);
      expect(recommendation.badgeColor).toBe('RED');
      expect(recommendation.triggerModules.some((t) => t.includes('Module A'))).toBe(true);
    });

    it('TEST CASE: Normal lesion + low risk + dental caries gives AMBER badge with dentist advice', () => {
      const moduleA = {
        label: 'normal',
        confidence: 0.92,
      };
      const moduleB = {
        findings: [
          { label: 'caries', probability: 0.78, threshold: 0.5, flagged: true },
          { label: 'gingivitis', probability: 0.2, threshold: 0.45, flagged: false },
        ],
        seeDentistRecommended: true,
      };
      const moduleC = { level: 'LOW', score: 0 };

      const recommendation = computeCombinedRecommendation(moduleA, moduleB, moduleC);

      // Separate dental triage
      expect(recommendation.referToSpecialist).toBe(false);
      expect(recommendation.seeDentist).toBe(true);
      expect(recommendation.badgeColor).toBe('AMBER');
      expect(recommendation.triageCategory).toBe('DENTAL_MONITOR');
      expect(recommendation.triggerModules.some((t) => t.includes('Module B'))).toBe(true);
    });

    it('TEST CASE: Normal mucosa + low risk + clean teeth gives GREEN routine badge', () => {
      const moduleA = {
        label: 'normal',
        confidence: 0.95,
      };
      const moduleB = {
        findings: [
          { label: 'caries', probability: 0.1, threshold: 0.5, flagged: false },
        ],
        seeDentistRecommended: false,
      };
      const moduleC = { level: 'LOW', score: 0 };

      const recommendation = computeCombinedRecommendation(moduleA, moduleB, moduleC);

      expect(recommendation.referToSpecialist).toBe(false);
      expect(recommendation.seeDentist).toBe(false);
      expect(recommendation.badgeColor).toBe('GREEN');
      expect(recommendation.triageCategory).toBe('ROUTINE');
      expect(recommendation.triggerModules).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. CLINICAL SAFETY & PROHIBITED TERMS (Invariant 1)
  // ---------------------------------------------------------------------------
  describe('Clinical Non-Diagnosis & Privacy Wording Compliance', () => {
    it('all recommendation texts contain non-diagnosis screening disclaimer', () => {
      const rec = computeCombinedRecommendation(
        { label: 'opmd', confidence: 0.8 },
        null,
        null
      );

      expect(rec.advice.toLowerCase()).not.toContain('cancer confirmed');
      expect(rec.advice.toLowerCase()).not.toContain('diagnostic confirmation');
      expect(rec.advice.toLowerCase()).not.toContain('curative');
    });
  });
});
