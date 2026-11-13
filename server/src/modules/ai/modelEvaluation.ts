import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { logger } from '../../config/logger.js';

/**
 * Model evaluation metrics ("model card") for the DEMO AI screening support model.
 *
 * Metrics are NEVER invented by the platform. They are shown only when an operator supplies
 * results from a real held-out evaluation, either via the AI_MODEL_EVALUATION env var (JSON)
 * or the file at AI_MODEL_EVALUATION_FILE (default: server/config/model-evaluation.json).
 * Without that, the API reports `validated: false` and the UI says "Not yet validated".
 */
const Fraction = z.number().min(0).max(1);
export const ModelEvaluationSchema = z.object({
  modelVersion: z.string().trim().min(1).max(120),
  datasetDescription: z.string().trim().min(1).max(500),
  sampleSize: z.number().int().positive(),
  evaluatedAt: z.string().trim().min(4).max(40),
  accuracy: Fraction,
  sensitivity: Fraction.optional(),
  specificity: Fraction.optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type ModelEvaluation = z.infer<typeof ModelEvaluationSchema>;

export type ModelCard =
  | ({ validated: true } & ModelEvaluation & { disclaimer: string })
  | { validated: false; disclaimer: string };

const DISCLAIMER = 'DEMO AI screening support. Results help decide who should see a doctor; they are not a clinical finding.';

function readRawEvaluation(): unknown {
  const inline = process.env.AI_MODEL_EVALUATION?.trim();
  if (inline) return JSON.parse(inline);
  const file = process.env.AI_MODEL_EVALUATION_FILE?.trim() || path.resolve(process.cwd(), 'config', 'model-evaluation.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getModelCard(): ModelCard {
  try {
    const raw = readRawEvaluation();
    if (!raw) return { validated: false, disclaimer: DISCLAIMER };
    const parsed = ModelEvaluationSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ issues: parsed.error.issues.map((issue) => issue.path.join('.')) }, 'Ignoring invalid AI model evaluation configuration');
      return { validated: false, disclaimer: DISCLAIMER };
    }
    return { validated: true, ...parsed.data, disclaimer: DISCLAIMER };
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : 'unknown' }, 'AI model evaluation configuration could not be read');
    return { validated: false, disclaimer: DISCLAIMER };
  }
}
