/** Per-key rate limit: each key may act once every `ms` milliseconds. */
export class Cooldown {
  private readonly lastUse = new Map<string, number>();

  constructor(private readonly ms: number) {}

  /**
   * Record a use by `key` if it's allowed now, returning 0. Otherwise returns
   * the milliseconds left until it is.
   */
  take(key: string): number {
    const now = Date.now();
    const last = this.lastUse.get(key);
    if (last !== undefined && now - last < this.ms) {
      return this.ms - (now - last);
    }
    this.lastUse.set(key, now);
    this.prune(now);
    return 0;
  }

  /** Drop expired entries, so the map holds only recent users. */
  private prune(now: number): void {
    if (this.lastUse.size < 100) return;
    for (const [key, last] of this.lastUse) {
      if (now - last >= this.ms) this.lastUse.delete(key);
    }
  }
}
