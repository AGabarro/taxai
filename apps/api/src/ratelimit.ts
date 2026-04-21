/**
 * Simple in-memory rate limiter: max N requests per window per IP.
 * Resets the counter each window. Not suitable for multi-process deployments.
 */
export class RateLimiter {
  private readonly counts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
  ) {}

  isAllowed(ip: string): boolean {
    const now = Date.now();
    const entry = this.counts.get(ip);

    if (!entry || now >= entry.resetAt) {
      this.counts.set(ip, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count += 1;
    return true;
  }
}

// 20 requests per minute for AI endpoints
export const aiRateLimiter = new RateLimiter(20, 60_000);
