/** Allows at most `limit` actions in any `windowMs` (sliding window). */
export class RateLimiter {
  private readonly times: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Record an action and return true if it's within the limit. */
  tryTake(): boolean {
    const now = Date.now();
    this.expire(now);
    if (this.times.length >= this.limit) return false;
    this.times.push(now);
    return true;
  }

  /** Whether no action falls inside the current window. */
  isIdle(): boolean {
    this.expire(Date.now());
    return this.times.length === 0;
  }

  private expire(now: number): void {
    while (this.times.length > 0 && now - this.times[0]! >= this.windowMs) {
      this.times.shift();
    }
  }
}

/** A separate RateLimiter for each key, such as a client address. */
export class KeyedRateLimiter {
  private readonly limiters = new Map<string, RateLimiter>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  tryTake(key: string): boolean {
    let limiter = this.limiters.get(key);
    if (!limiter) {
      this.prune();
      limiter = new RateLimiter(this.limit, this.windowMs);
      this.limiters.set(key, limiter);
    }
    return limiter.tryTake();
  }

  /** Drop idle keys once there are many, so the map stays small. */
  private prune(): void {
    if (this.limiters.size < 1000) return;
    for (const [key, limiter] of this.limiters) {
      if (limiter.isIdle()) this.limiters.delete(key);
    }
  }
}
