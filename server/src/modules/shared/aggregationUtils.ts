/**
 * Small-count cell suppression & aggregation utilities
 * ITDA Paderu Tribal Health Initiative
 * Invariant 3: Any count between 1 and 4 must be suppressed to "< 5" to protect individual identity in sparse tribal hamlets.
 */

export const SMALL_COUNT_SUPPRESSION_THRESHOLD = 5;

export const SUPPRESSION_NOTICE =
  'Values between 1 and 4 are suppressed to "< 5" to protect tribal habitation privacy.';

export interface SuppressedMetric {
  count: number | null;
  displayValue: string;
  isSuppressed: boolean;
  suppressionReason?: string;
}

export const SuppressedMetric = {};

/**
 * Applies small-count cell suppression.
 * - 0 returns count: 0, displayValue: "0", isSuppressed: false
 * - 1 <= count < threshold returns count: null, displayValue: `< ${threshold}`, isSuppressed: true
 * - count >= threshold returns count, displayValue: `${count}`, isSuppressed: false
 */
export function applySmallCountSuppression(
  count: number,
  threshold: number = SMALL_COUNT_SUPPRESSION_THRESHOLD
): SuppressedMetric {
  if (count === 0) {
    return {
      count: 0,
      displayValue: '0',
      isSuppressed: false,
    };
  }

  if (count < threshold) {
    return {
      count: null,
      displayValue: `< ${threshold}`,
      isSuppressed: true,
      suppressionReason: 'Small-count cell suppression applied (< 5) to protect patient privacy',
    };
  }

  return {
    count,
    displayValue: String(count),
    isSuppressed: false,
  };
}

export interface SuppressedCoverage {
  screened: SuppressedMetric;
  displayPercentage: string;
  rawPercentage: number | null;
}

/**
 * Calculates screening coverage percentage with small-count suppression.
 */
export function calculateSuppressedCoverage(
  screenedCount: number,
  population: number,
  threshold: number = SMALL_COUNT_SUPPRESSION_THRESHOLD
): SuppressedCoverage {
  const screened = applySmallCountSuppression(screenedCount, threshold);

  if (screened.isSuppressed) {
    return {
      screened,
      displayPercentage: `< ${threshold}%`,
      rawPercentage: null,
    };
  }

  const rawPercentage =
    population > 0 ? Math.round((screenedCount / population) * 1000) / 10 : 0;

  return {
    screened,
    displayPercentage: `${rawPercentage}%`,
    rawPercentage,
  };
}
