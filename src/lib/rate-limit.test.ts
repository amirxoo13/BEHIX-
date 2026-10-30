import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientIp, createLimiter, positiveInt } from "./rate-limit.ts";

describe("model rate limit", () => {
  it("UT-RL-04 client IP prefers Vercel headers and never trusts x-forwarded-for", () => {
    const spoofed = new Headers({ "x-forwarded-for": "6.6.6.6", "x-vercel-forwarded-for": "1.2.3.4" });
    assert.equal(clientIp(spoofed, "10.0.0.1"), "1.2.3.4");
    assert.equal(clientIp(new Headers({ "x-real-ip": "5.5.5.5, 7.7.7.7" }), undefined), "5.5.5.5");
    assert.equal(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6" }), "10.0.0.1"), "10.0.0.1");
    assert.equal(clientIp(new Headers(), undefined), "unknown");
  });
  it("UT-RL-01 each IP gets perHour requests, then waits; other IPs are separate", () => {
    let t = Date.UTC(2026, 9, 15, 10);
    const lim = createLimiter({ perHour: 2, dailyTokens: 1000 }, () => t);
    assert.ok(lim.check("1.1.1.1").ok);
    assert.ok(lim.check("1.1.1.1").ok);
    const third = lim.check("1.1.1.1");
    assert.equal(third.ok, false);
    if (!third.ok) assert.match(third.error, /دقیقه/);
    assert.ok(lim.check("2.2.2.2").ok);
    t += 3_600_001;
    assert.ok(lim.check("1.1.1.1").ok, "after an hour the IP may ask again");
  });
  it("UT-RL-02 daily token budget blocks everyone and resets the next UTC day", () => {
    let t = Date.UTC(2026, 9, 15, 23);
    const lim = createLimiter({ perHour: 100, dailyTokens: 500 }, () => t);
    assert.ok(lim.check("a").ok);
    lim.record(600);
    const r = lim.check("b");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /روزانه/);
    t += 2 * 3_600_000;
    assert.ok(lim.check("b").ok);
    assert.equal(lim.spentToday(), 0);
  });
  it("UT-RL-03 env numbers fall back when invalid", () => {
    assert.equal(positiveInt("25", 10), 25);
    assert.equal(positiveInt("-3", 10), 10);
    assert.equal(positiveInt("abc", 10), 10);
    assert.equal(positiveInt(undefined, 10), 10);
  });
});
