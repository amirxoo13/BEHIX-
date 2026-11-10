// T10-v2 (M1): Better Auth must key rate limiting on x-vercel-forwarded-for
// first. Exercises Better Auth's own getIp() with the exact header list parsed
// from src/lib/auth/server.ts, so the test fails if the config drifts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getIp } from "@better-auth/core/utils/ip";

const src = readFileSync(new URL("../src/lib/auth/server.ts", import.meta.url), "utf8");
const m = src.match(/ipAddressHeaders:\s*\[([^\]]*)\]/);
const headers = m ? [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : null;
const options = { advanced: { ipAddress: { ipAddressHeaders: headers } } };
const ip = (h) => getIp(new Headers(h), options);

test("server.ts declares the M1 header order", () => {
  assert.deepEqual(headers, ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"]);
});
test("x-vercel-forwarded-for wins over a spoofed x-forwarded-for", () => {
  assert.equal(ip({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }), "203.0.113.7");
  assert.equal(ip({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.2" }), "203.0.113.7");
});
test("x-real-ip is second, x-forwarded-for last", () => {
  assert.equal(ip({ "x-real-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.1" }), "203.0.113.8");
  assert.equal(ip({ "x-forwarded-for": "198.51.100.1" }), "198.51.100.1");
});
