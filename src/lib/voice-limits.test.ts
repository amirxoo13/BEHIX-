import { test } from "node:test";
import assert from "node:assert/strict";
import { resetHits, takeHits, WINDOW_MS } from "./voice-limits.server.ts";
import { reserveDaily } from "./tts-quota.ts";

test("IP limit counts weighted hits and frees them after the window", () => {
  resetHits();
  assert.equal(takeHits("a", 2, 3, 0), true);
  assert.equal(takeHits("a", 2, 3, 1), false, "2 + 2 > 3");
  assert.equal(takeHits("a", 1, 3, 2), true);
  assert.equal(takeHits("b", 3, 3, 2), true, "other IPs are separate");
  assert.equal(takeHits("a", 3, 3, WINDOW_MS + 5), true, "window slid");
});

test("daily quota reserves a weighted cost and refunds it (no bucket)", async () => {
  const day = "2099-01-01";
  assert.equal(await reserveDaily({}, undefined, 3, 2, day), day);
  assert.equal(await reserveDaily({}, undefined, 3, 2, day), null, "2 + 2 > 3");
  assert.equal(await reserveDaily({}, undefined, 3, 1, day), day);
  await reserveDaily({}, undefined, 3, -2, day);
  assert.equal(await reserveDaily({}, undefined, 3, 2, day), day);
});
