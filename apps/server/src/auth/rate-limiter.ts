type RateLimitEntry = { resetAt: number; attempts: number };

/**
 * Process-local protection for credential/gameplay endpoints.
 *
 * Credential keys are derived from public input, so the map itself is bounded; a TTL alone would
 * still allow one entry per unique email/IP pair inside a window. Production can replace this
 * port with shared storage when it scales horizontally.
 */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  public constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 10_000,
  ) {
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0)
      throw new Error('Rate limiter maxAttempts must be a positive integer.');
    if (!Number.isFinite(windowMs) || windowMs <= 0)
      throw new Error('Rate limiter windowMs must be positive.');
    if (!Number.isInteger(maxEntries) || maxEntries <= 0)
      throw new Error('Rate limiter maxEntries must be a positive integer.');
  }

  public consume(key: string): boolean {
    const now = this.now();
    const current = this.entries.get(key);
    if (current === undefined || current.resetAt <= now) {
      if (current !== undefined) this.entries.delete(key);
      this.removeExpired(now);
      // Fail closed when the bounded table is full; evicting an active key would let a caller
      // rotate identifiers and bypass the limit for the evicted identity.
      if (this.entries.size >= this.maxEntries) return false;
      this.entries.set(key, { attempts: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.attempts >= this.maxAttempts) return false;
    current.attempts += 1;
    return true;
  }

  private removeExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }
}
