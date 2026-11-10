import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipInTests?: boolean;
}

/**
 * High-performance sliding-window in-memory rate limiter middleware.
 * Prevents brute-force credential attacks, HTTP floods, and volumetric DoS.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || req.headers['x-forwarded-for']?.toString() || '127.0.0.1',
    skipInTests = true,
  } = options;

  const hits = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
      if (record.timestamps.length === 0) {
        hits.delete(key);
      }
    }
  }, Math.min(windowMs, 60000)).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // Optionally skip during standard unit testing unless explicitly enabled via header
    if (skipInTests && process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let record = hits.get(key);
    if (!record) {
      record = { timestamps: [] };
      hits.set(key, record);
    }

    // Keep only timestamps within the active sliding window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const resetTimeSec = Math.ceil((windowMs - (now - (record.timestamps[0] || now))) / 1000);

    // Standard RateLimit Headers
    res.setHeader('RateLimit-Limit', maxRequests.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetTimeSec.toString());

    if (currentCount >= maxRequests) {
      res.setHeader('Retry-After', resetTimeSec.toString());
      res.envelopeError(
        'TOO_MANY_REQUESTS',
        `Rate limit exceeded. Maximum ${maxRequests} requests per ${Math.round(windowMs / 1000)} seconds.`,
        { retryAfterSeconds: resetTimeSec },
        429
      );
      return;
    }

    record.timestamps.push(now);
    next();
  };
}

// Preset Limiters
export const apiGlobalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300,
});

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 15, // 15 login attempts per min per IP
});
