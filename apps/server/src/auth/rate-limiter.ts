type RateLimitEntry = { resetAt: number; attempts: number };

/** Process-local protection for credential endpoints. Production can replace this port with shared storage. */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  public constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  public consume(key: string): boolean {
    const now = this.now();
    const current = this.entries.get(key);
    if (current === undefined || current.resetAt <= now) {
      this.entries.set(key, { attempts: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.attempts >= this.maxAttempts) return false;
    current.attempts += 1;
    return true;
  }
}
