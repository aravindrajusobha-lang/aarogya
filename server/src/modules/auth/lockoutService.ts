import { IUser } from './userModel.js';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LockoutCheckResult {
  isLocked: boolean;
  isBackoffActive: boolean;
  retryAfterSeconds?: number;
  message?: string;
}

/**
 * Calculates exponential backoff delay based on failed attempts:
 * Attempt 2: 1s, Attempt 3: 2s, Attempt 4: 4s, Attempt 5: 8s
 */
export function calculateBackoffMs(failedAttempts: number): number {
  if (failedAttempts < 2) return 0;
  return Math.min(1000 * Math.pow(2, failedAttempts - 2), 30000);
}

export function checkLockoutAndBackoff(user: IUser): LockoutCheckResult {
  const now = Date.now();

  // 1. Check account lockout threshold
  if (user.lockout.lockedUntil && user.lockout.lockedUntil.getTime() > now) {
    const remainingSec = Math.ceil((user.lockout.lockedUntil.getTime() - now) / 1000);
    return {
      isLocked: true,
      isBackoffActive: false,
      retryAfterSeconds: remainingSec,
      message: `Account is temporarily locked due to repeated failed login attempts. Try again in ${remainingSec} seconds.`,
    };
  }

  // 2. Check exponential backoff between attempts
  if (user.lockout.failedAttempts >= 2 && user.lockout.lastFailedAt) {
    const backoffMs = calculateBackoffMs(user.lockout.failedAttempts);
    const elapsedMs = now - user.lockout.lastFailedAt.getTime();
    if (elapsedMs < backoffMs) {
      const remainingSec = Math.ceil((backoffMs - elapsedMs) / 1000);
      return {
        isLocked: false,
        isBackoffActive: true,
        retryAfterSeconds: remainingSec,
        message: `Too many attempts in rapid succession. Please wait ${remainingSec} seconds before retrying.`,
      };
    }
  }

  return { isLocked: false, isBackoffActive: false };
}

export async function recordFailedAttempt(user: IUser): Promise<{ locked: boolean; attempts: number }> {
  const now = new Date();
  user.lockout.failedAttempts = (user.lockout.failedAttempts || 0) + 1;
  user.lockout.lastFailedAt = now;

  let locked = false;
  if (user.lockout.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockout.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
    user.status = 'locked';
    locked = true;
  }

  await user.save();
  return { locked, attempts: user.lockout.failedAttempts };
}

export async function resetFailedAttempts(user: IUser): Promise<void> {
  if (user.lockout.failedAttempts > 0 || user.lockout.lockedUntil) {
    user.lockout.failedAttempts = 0;
    user.lockout.lockedUntil = null;
    user.lockout.lastFailedAt = null;
    if (user.status === 'locked') {
      user.status = 'active';
    }
    await user.save();
  }
}
