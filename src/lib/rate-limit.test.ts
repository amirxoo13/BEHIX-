import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientIp, createIpWindow, createLimiter, positiveInt } from "./rate-limit.ts";

describe("model rate limit", () => {
  it("UT-RL-04 client IP trusts only the proxy header configured for this host", () => {
    const spoofed = new Headers({
      "x-forwarded-for": "6.6.6.6, 9.9.9.9",
      "x-vercel-forwarded-for": "1.2.3.4",
      "x-real-ip": "5.5.5.5",
    });
    // Own server, nothing configured: every header is client-controlled, use the socket.
    assert.equal(clientIp(spoofed, "10.0.0.1", {}), "10.0.0.1");
    assert.equal(clientIp(new Headers(), undefined, {}), "unknown");
    // Vercel writes x-vercel-forwarded-for itself.
    assert.equal(clientIp(spoofed, "10.0.0.1", { VERCEL: "1" }), "1.2.3.4");
    // nginx: X-Real-IP $remote_addr.
    assert.equal(clientIp(spoofed, "127.0.0.1", { TRUSTED_IP_HEADER: "X-Real-IP" }), "5.5.5.5");
    // nginx $proxy_add_x_forwarded_for / Cloud Run append the real address last.
    assert.equal(clientIp(spoofed, "127.0.0.1", { TRUSTED_IP_HEADER: "x-forwarded-for" }), "9.9.9.9");
    // Configured header missing: fall back to the socket.
    assert.equal(clientIp(new Headers(), "127.0.0.1", { TRUSTED_IP_HEADER: "x-real-ip" }), "127.0.0.1");
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
  it("UT-RL-05 IP window overflow prunes instead of wiping other IPs' counts", () => {
    let t = 1_000_000;
    const w = createIpWindow({ windowMs: 600_000, max: 2, maxKeys: 3 }, () => t);
    assert.ok(w.hit("victim"));
    assert.ok(w.hit("victim"));
    assert.equal(w.hit("victim"), false);
    for (let i = 0; i < 50; i++) { t += 1; w.hit(`flood-${i}`); w.hit("victim"); }
    assert.ok(w.size() <= 3, "map stays bounded");
    assert.equal(w.hit("victim"), false, "active victim keeps its count after overflow");
  });
  it("UT-RL-06 stale IPs are pruned first, then least-recently-used", () => {
    let t = 0;
    const w = createIpWindow({ windowMs: 100, max: 1, maxKeys: 2 }, () => t);
    w.hit("old");
    t = 200;
    w.hit("a");
    w.hit("b"); // overflow: "old" is stale and goes
    assert.equal(w.size(), 2);
    assert.equal(w.hit("a"), false);
    assert.equal(w.hit("b"), false);
    w.hit("c"); // no stale keys: LRU ("a") evicted
    assert.equal(w.size(), 2);
    assert.equal(w.hit("b"), false);
    assert.equal(w.hit("c"), false);
  });
});
