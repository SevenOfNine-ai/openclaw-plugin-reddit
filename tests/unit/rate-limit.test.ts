import { describe, expect, it } from "vitest";
import { RedditRatePolicy, SlidingWindowRateLimiter } from "../../src/rate-limit.js";

describe("SlidingWindowRateLimiter", () => {
  it("allows until limit then blocks", () => {
    const limiter = new SlidingWindowRateLimiter(2, 60_000);
    expect(limiter.consume(0).ok).toBe(true);
    expect(limiter.consume(1).ok).toBe(true);

    const blocked = limiter.consume(2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("prunes old entries after window", () => {
    const limiter = new SlidingWindowRateLimiter(1, 10);
    expect(limiter.consume(0).ok).toBe(true);
    expect(limiter.consume(5).ok).toBe(false);
    expect(limiter.consume(11).ok).toBe(true);
  });
});

describe("RedditRatePolicy", () => {
  it("enforces min interval between writes", () => {
    const policy = new RedditRatePolicy({
      readPerMinute: 100,
      writePerMinute: 100,
      minWriteIntervalMs: 5000,
    });

    expect(policy.checkWrite(1000).ok).toBe(true);
    const blocked = policy.checkWrite(2000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(4000);
    expect(policy.checkWrite(7000).ok).toBe(true);
  });

  it("enforces write per-minute cap", () => {
    const policy = new RedditRatePolicy({
      readPerMinute: 100,
      writePerMinute: 2,
      minWriteIntervalMs: 0,
    });

    expect(policy.checkWrite(0).ok).toBe(true);
    expect(policy.checkWrite(1).ok).toBe(true);
    expect(policy.checkWrite(2).ok).toBe(false);
  });

  it("reports snapshot counts", () => {
    const policy = new RedditRatePolicy({
      readPerMinute: 10,
      writePerMinute: 10,
      minWriteIntervalMs: 100,
    });

    policy.checkRead(0);
    policy.checkRead(1);
    policy.checkWrite(2);

    const snapshot = policy.snapshot(3);
    expect(snapshot.readInWindow).toBe(2);
    expect(snapshot.writeInWindow).toBe(1);
    expect(snapshot.lastWriteAt).toBe(2);
    expect(snapshot.minWriteIntervalMs).toBe(100);
  });
});
