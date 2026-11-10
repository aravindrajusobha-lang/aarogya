import fs from 'fs';
import path from 'path';

export interface IRiskQuestionnaireAnswers {
  smoked_tobacco?: boolean;
  chewed_tobacco_gutka?: boolean;
  areca_nut_betel_quid?: boolean;
  alcohol?: boolean;
  years_of_use?: number | string; // '0' | '1_5' | '6_10' | '10_plus' | number
  ulcer_longer_than_2_weeks?: boolean;
  white_red_patch?: boolean;
  difficulty_opening_mouth?: boolean;
  burning_sensation?: boolean;
  neck_lump?: boolean;
  additionalNotes?: string;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface IRiskScoreResult {
  score: number;
  level: RiskLevel;
  flaggedSymptoms: string[];
  flaggedHabits: string[];
  clinicalValidationRequired: boolean;
  disclaimer: string;
  rationale: string;
  reportedByPatient: boolean;
  breakdown: {
    habitScore: number;
    symptomScore: number;
    yearsMultiplier: number;
  };
}

export interface IRiskWeightsConfig {
  version: string;
  weights: {
    habits: {
      chewed_tobacco_gutka: number;
      areca_nut_betel_quid: number;
      smoked_tobacco: number;
      alcohol: number;
      years_multiplier: Record<string, number>;
    };
    symptoms: {
      ulcer_longer_than_2_weeks: number;
      white_red_patch: number;
      difficulty_opening_mouth: number;
      neck_lump: number;
      burning_sensation: number;
    };
  };
  immediate_high_risk_symptoms: string[];
  thresholds: {
    high: number;
    moderate: number;
  };
}

const DEFAULT_CONFIG: IRiskWeightsConfig = {
  version: '1.0.0',
  weights: {
    habits: {
      chewed_tobacco_gutka: 25,
      areca_nut_betel_quid: 20,
      smoked_tobacco: 15,
      alcohol: 10,
      years_multiplier: {
        '0': 0.0,
        '1_5': 1.0,
        '6_10': 1.5,
        '10_plus': 2.0,
      },
    },
    symptoms: {
      ulcer_longer_than_2_weeks: 40,
      white_red_patch: 35,
      difficulty_opening_mouth: 35,
      neck_lump: 40,
      burning_sensation: 15,
    },
  },
  immediate_high_risk_symptoms: [
    'ulcer_longer_than_2_weeks',
    'white_red_patch',
    'difficulty_opening_mouth',
    'neck_lump',
  ],
  thresholds: {
    high: 60,
    moderate: 25,
  },
};

export function loadRiskWeightsConfig(): IRiskWeightsConfig {
  try {
    const configPath = path.resolve(__dirname, '../../config/risk_weights.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && parsed.weights && parsed.thresholds) {
        return parsed as IRiskWeightsConfig;
      }
    }
  } catch (err) {
    // Safe fallback to defaults
  }
  return DEFAULT_CONFIG;
}

export function calculateRiskScore(
  answers: IRiskQuestionnaireAnswers,
  customConfig?: IRiskWeightsConfig
): IRiskScoreResult {
  const config = customConfig || loadRiskWeightsConfig();

  const flaggedHabits: string[] = [];
  const flaggedSymptoms: string[] = [];
  let habitBaseScore = 0;
  let symptomScore = 0;

  // 1. Evaluate Habits (Explicitly reported by patient)
  if (answers.chewed_tobacco_gutka) {
    flaggedHabits.push('Chewed tobacco / gutka');
    habitBaseScore += config.weights.habits.chewed_tobacco_gutka;
  }
  if (answers.areca_nut_betel_quid) {
    flaggedHabits.push('Areca nut / betel quid (paan)');
    habitBaseScore += config.weights.habits.areca_nut_betel_quid;
  }
  if (answers.smoked_tobacco) {
    flaggedHabits.push('Smoked tobacco (bidi / cigarette)');
    habitBaseScore += config.weights.habits.smoked_tobacco;
  }
  if (answers.alcohol) {
    flaggedHabits.push('Alcohol consumption');
    habitBaseScore += config.weights.habits.alcohol;
  }

  // Duration multiplier
  let yearsKey = '1_5';
  if (typeof answers.years_of_use === 'number') {
    if (answers.years_of_use <= 0) yearsKey = '0';
    else if (answers.years_of_use <= 5) yearsKey = '1_5';
    else if (answers.years_of_use <= 10) yearsKey = '6_10';
    else yearsKey = '10_plus';
  } else if (answers.years_of_use) {
    yearsKey = String(answers.years_of_use);
  } else if (flaggedHabits.length === 0) {
    yearsKey = '0';
  }

  const multiplier = config.weights.habits.years_multiplier[yearsKey] ?? (flaggedHabits.length > 0 ? 1.0 : 0.0);
  const totalHabitScore = Math.round(habitBaseScore * multiplier);

  // 2. Evaluate Clinical Symptoms (Oral Red Flags)
  let hasImmediateHighRiskSymptom = false;

  if (answers.ulcer_longer_than_2_weeks) {
    flaggedSymptoms.push('Non-healing ulcer > 2 weeks');
    symptomScore += config.weights.symptoms.ulcer_longer_than_2_weeks;
    hasImmediateHighRiskSymptom = true;
  }
  if (answers.white_red_patch) {
    flaggedSymptoms.push('White / red oral patch');
    symptomScore += config.weights.symptoms.white_red_patch;
    hasImmediateHighRiskSymptom = true;
  }
  if (answers.difficulty_opening_mouth) {
    flaggedSymptoms.push('Difficulty opening mouth (Trismus)');
    symptomScore += config.weights.symptoms.difficulty_opening_mouth;
    hasImmediateHighRiskSymptom = true;
  }
  if (answers.neck_lump) {
    flaggedSymptoms.push('Palpable neck swelling / lump');
    symptomScore += config.weights.symptoms.neck_lump;
    hasImmediateHighRiskSymptom = true;
  }
  if (answers.burning_sensation) {
    flaggedSymptoms.push('Oral burning sensation on spicy food');
    symptomScore += config.weights.symptoms.burning_sensation;
  }

  // Total risk score
  const totalScore = totalHabitScore + symptomScore;

  // Determine Level: Any immediate high-risk symptom OR score >= 60 -> HIGH
  let level: RiskLevel = 'LOW';
  if (hasImmediateHighRiskSymptom || totalScore >= config.thresholds.high) {
    level = 'HIGH';
  } else if (totalScore >= config.thresholds.moderate) {
    level = 'MODERATE';
  }

  const rationaleParts: string[] = [];
  if (hasImmediateHighRiskSymptom) {
    rationaleParts.push(`Immediate high-risk symptom present: ${flaggedSymptoms.join(', ')}`);
  }
  if (flaggedHabits.length > 0) {
    rationaleParts.push(`Reported habits: ${flaggedHabits.join(', ')} (${yearsKey.replace('_', '-')} years)`);
  }
  if (rationaleParts.length === 0) {
    rationaleParts.push('No significant oral mucosal risk habits or symptoms reported.');
  }

  return {
    score: totalScore,
    level,
    flaggedSymptoms,
    flaggedHabits,
    clinicalValidationRequired: true,
    disclaimer: 'To be validated by a clinician. Screening risk scoring aid only; not clinical confirmation.',
    rationale: rationaleParts.join(' | '),
    reportedByPatient: true,
    breakdown: {
      habitScore: totalHabitScore,
      symptomScore,
      yearsMultiplier: multiplier,
    },
  };
}
