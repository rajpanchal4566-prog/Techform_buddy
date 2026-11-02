interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const MAX_TOKENS = 30; // Max 30 requests
const REFILL_INTERVAL_MS = 60 * 1000; // per minute

class UserRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  public check(userId: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    let bucket = this.buckets.get(userId);

    if (!bucket) {
      bucket = { tokens: MAX_TOKENS - 1, lastRefill: now };
      this.buckets.set(userId, bucket);
      return { allowed: true };
    }

    // Refill tokens if interval passed
    const timePassed = now - bucket.lastRefill;
    if (timePassed >= REFILL_INTERVAL_MS) {
      bucket.tokens = MAX_TOKENS;
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return { allowed: true };
    }

    const retryAfterSeconds = Math.ceil((REFILL_INTERVAL_MS - timePassed) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  public reset(): void {
    this.buckets.clear();
  }
}

export const userRateLimiter = new UserRateLimiter();
