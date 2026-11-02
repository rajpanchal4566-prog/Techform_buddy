/**
 * In-memory rate limiter for auth endpoints.
 * Keyed by IP (or IP+endpoint for finer control).
 * 
 * ABUSE PROTECTION (Requirement 4):
 * - Login: 5 attempts per 15 minutes per IP
 * - Signup: 3 attempts per 15 minutes per IP
 * - Resend verification: 1 per 60 seconds per IP
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 } as RateLimitConfig,
  signup: { maxAttempts: 3, windowMs: 15 * 60 * 1000 } as RateLimitConfig,
  resend: { maxAttempts: 1, windowMs: 60 * 1000 } as RateLimitConfig,
} as const;

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= config.maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Extract client IP from request headers (works behind proxies).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return '127.0.0.1';
}

/** Reset rate limit for a key (for testing). */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/** Clear all rate limits (for testing). */
export function clearAllRateLimits(): void {
  store.clear();
}

