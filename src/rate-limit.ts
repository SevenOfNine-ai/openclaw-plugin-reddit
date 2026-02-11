export type RateLimitResult = {
  ok: boolean;
  retryAfterMs: number;
};

export class SlidingWindowRateLimiter {
  private readonly timestamps: number[] = [];

  public constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  public consume(now: number = Date.now()): RateLimitResult {
    this.prune(now);

    if (this.timestamps.length >= this.limit) {
      const oldest = this.timestamps[0];
      const retryAfterMs = oldest === undefined ? this.windowMs : Math.max(this.windowMs - (now - oldest), 1);
      return { ok: false, retryAfterMs };
    }

    this.timestamps.push(now);
    return { ok: true, retryAfterMs: 0 };
  }

  public count(now: number = Date.now()): number {
    this.prune(now);
    return this.timestamps.length;
  }

  private prune(now: number): void {
    while (this.timestamps.length > 0 && now - (this.timestamps[0] ?? now) >= this.windowMs) {
      this.timestamps.shift();
    }
  }
}

export class RedditRatePolicy {
  private readonly readLimiter: SlidingWindowRateLimiter;
  private readonly writeLimiter: SlidingWindowRateLimiter;
  private readonly minWriteIntervalMs: number;
  private lastWriteAt: number | null = null;

  public constructor(rateLimit: {
    readPerMinute: number;
    writePerMinute: number;
    minWriteIntervalMs: number;
  }) {
    this.readLimiter = new SlidingWindowRateLimiter(rateLimit.readPerMinute, 60_000);
    this.writeLimiter = new SlidingWindowRateLimiter(rateLimit.writePerMinute, 60_000);
    this.minWriteIntervalMs = rateLimit.minWriteIntervalMs;
  }

  public checkRead(now: number = Date.now()): RateLimitResult {
    return this.readLimiter.consume(now);
  }

  public checkWrite(now: number = Date.now()): RateLimitResult {
    if (this.lastWriteAt !== null && this.minWriteIntervalMs > 0) {
      const elapsed = now - this.lastWriteAt;
      if (elapsed < this.minWriteIntervalMs) {
        return {
          ok: false,
          retryAfterMs: Math.max(this.minWriteIntervalMs - elapsed, 1),
        };
      }
    }

    const windowCheck = this.writeLimiter.consume(now);
    if (!windowCheck.ok) {
      return windowCheck;
    }

    this.lastWriteAt = now;
    return { ok: true, retryAfterMs: 0 };
  }

  public snapshot(now: number = Date.now()): {
    readInWindow: number;
    writeInWindow: number;
    lastWriteAt: number | null;
    minWriteIntervalMs: number;
  } {
    return {
      readInWindow: this.readLimiter.count(now),
      writeInWindow: this.writeLimiter.count(now),
      lastWriteAt: this.lastWriteAt,
      minWriteIntervalMs: this.minWriteIntervalMs,
    };
  }
}
