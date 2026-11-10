import { Patient, IPatient } from './patientModel.js';

export function jaroWinkler(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, str2.length);
    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / str1.length +
      matches / str2.length +
      (matches - transpositions / 2) / matches) /
    3.0;

  // Winkler prefix scaling (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(str1.length, str2.length)); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return Math.min(1.0, jaro + prefix * 0.1 * (1.0 - jaro));
}

export interface CandidateEvaluationInput {
  fullName: string;
  gender: 'male' | 'female' | 'other';
  ageEstimated: number;
  phone?: string;
  guardianName?: string;
  villageId: string;
  mandal: string;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  topCandidate: IPatient | null;
  matchScore: number;
  matchReasons: string[];
}

export async function evaluateDuplicateCandidate(
  input: CandidateEvaluationInput
): Promise<DuplicateDetectionResult> {
  // Query existing patients in the same mandal or matching phone (broad candidate pool)
  const query: Record<string, unknown>[] = [{ mandal: input.mandal }];
  if (input.phone && input.phone.trim().length > 5) {
    query.push({ phone: input.phone.trim() });
  }

  const existingPatients = await Patient.find({
    $or: query,
  }).limit(100).lean();

  if (existingPatients.length === 0) {
    return {
      isDuplicate: false,
      topCandidate: null,
      matchScore: 0,
      matchReasons: [],
    };
  }

  let highestScore = 0;
  let bestCandidate: any = null;
  let bestReasons: string[] = [];

  for (const candidate of existingPatients) {
    let score = 0;
    const reasons: string[] = [];

    // Factor A: Name Similarity (up to 35 pts)
    const nameSim = jaroWinkler(input.fullName, candidate.fullName);
    if (nameSim >= 0.95) {
      score += 35;
      reasons.push('EXACT_OR_HIGH_NAME_SIMILARITY');
    } else if (nameSim >= 0.85) {
      score += 25;
      reasons.push('PHONETIC_NAME_SIMILARITY');
    } else if (nameSim >= 0.75) {
      score += 15;
      reasons.push('PARTIAL_NAME_SIMILARITY');
    }

    // Factor B: Geographic & Village Proximity (up to 25 pts)
    if (input.villageId === candidate.villageId) {
      score += 25;
      reasons.push('SAME_VILLAGE_HABITATION');
    } else if (input.mandal === candidate.mandal) {
      score += 15;
      reasons.push('SAME_MANDAL');
    }

    // Factor C: Gender & Age Demographics (up to 20 pts)
    if (input.gender === candidate.gender) {
      const ageDiff = Math.abs(input.ageEstimated - candidate.ageEstimated);
      if (ageDiff <= 2) {
        score += 20;
        reasons.push('AGE_WITHIN_2_YEARS');
      } else if (ageDiff <= 5) {
        score += 10;
        reasons.push('AGE_WITHIN_5_YEARS');
      }
    }

    // Factor D: Phone & Family Proximity (up to 20 pts)
    if (
      input.phone &&
      candidate.phone &&
      input.phone.trim() === candidate.phone.trim() &&
      input.phone.trim().length >= 6
    ) {
      score += 20;
      reasons.push('PHONE_NUMBER_MATCH');
    } else if (input.guardianName && candidate.guardianName) {
      const guardianSim = jaroWinkler(input.guardianName, candidate.guardianName);
      if (guardianSim >= 0.85) {
        score += 15;
        reasons.push('GUARDIAN_NAME_SIMILARITY');
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = candidate;
      bestReasons = reasons;
    }
  }

  // Threshold: >= 75 points flags as duplicate candidate
  const isDuplicate = highestScore >= 75;

  return {
    isDuplicate,
    topCandidate: bestCandidate,
    matchScore: highestScore,
    matchReasons: bestReasons,
  };
}
