import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, generateKeyPair, type JWTVerifyGetKey, type CryptoKey } from "jose";
import { studioAuthConfig, verifyStudioRequest, isProductionEnv, DEV_UID, type StudioAuthConfig } from "./studio-auth.server.ts";
import { createStudioApi, type StudioDeps } from "./studio-api.server.ts";

const PID = "behix-test", PNUM = "123456789";
const NOW = 1_800_000_000; // seconds
let good: CryptoKey, evil: CryptoKey, pub: CryptoKey;
let keys: JWTVerifyGetKey;

before(async () => {
  const a = await generateKeyPair("RS256");
  const b = await generateKeyPair("RS256");
  good = a.privateKey; pub = a.publicKey; evil = b.privateKey;
  keys = async (h) => { if (h.kid !== "k1") throw new Error("kid"); return pub; };
});

type Claims = Record<string, unknown>;
const idToken = (over: Claims = {}, key = () => good, kid = "k1") =>
  new SignJWT({ auth_time: NOW - 100, ...over })
    .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .setIssuer((over.iss as string) ?? `https://securetoken.google.com/${PID}`)
    .setAudience((over.aud as string) ?? PID)
    .setSubject((over.sub as string) ?? "user-1")
    .setIssuedAt((over.iat as number) ?? NOW - 100)
    .setExpirationTime((over.exp as number) ?? NOW + 3000)
    .sign(key());
const appCheck = (over: Claims = {}) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: "k1", typ: "JWT" })
    .setIssuer((over.iss as string) ?? `https://firebaseappcheck.googleapis.com/${PNUM}`)
    .setAudience((over.aud as string[]) ?? [`projects/${PNUM}`, `projects/${PID}`])
    .setSubject("1:123:web:abc")
    .setIssuedAt(NOW - 10)
    .setExpirationTime((over.exp as number) ?? NOW + 3000)
    .sign(good);

const cfg = (o: Partial<StudioAuthConfig> = {}): StudioAuthConfig => ({ projectId: PID, projectNumber: PNUM, appCheck: "verify", devBypass: false, ...o });
const hdr = (token?: string, ac?: string) => {
  const h = new Headers();
  if (token) h.set("authorization", `Bearer ${token}`);
  if (ac) h.set("x-firebase-appcheck", ac);
  return h;
};
const verify = (h: Headers, c = cfg()) => verifyStudioRequest(h, c, { idKeys: keys, appCheckKeys: keys, now: () => NOW * 1000 });

describe("studio auth: Firebase ID token", () => {
  it("accepts a valid token and returns its uid", async () => {
    const r = await verify(hdr(await idToken()));
    assert.deepEqual(r, { ok: true, user: { uid: "user-1", appId: null, dev: false } });
  });
  it("rejects a missing token with 401", async () => {
    const r = await verify(hdr());
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.status, 401);
  });
  for (const [name, make] of [
    ["wrong signature", () => idToken({}, () => evil)],
    ["unknown kid", () => idToken({}, () => good, "k2")],
    ["wrong audience", () => idToken({ aud: "other" })],
    ["wrong issuer", () => idToken({ iss: "https://securetoken.google.com/other" })],
    ["expired", () => idToken({ exp: NOW - 3600 })],
    ["issued in the future", () => idToken({ iat: NOW + 3600, exp: NOW + 7200 })],
    ["auth_time in the future", () => idToken({ auth_time: NOW + 3600 })],
    ["empty subject", () => idToken({ sub: "" })],
  ] as const) {
    it(`rejects ${name} with 401`, async () => {
      const r = await verify(hdr(await make()));
      assert.equal(!r.ok && r.status, 401);
    });
  }
  it("rejects a non-JWT bearer", async () => {
    const r = await verify(hdr("x".repeat(40)));
    assert.equal(!r.ok && r.status, 401);
  });
  it("fails closed (503) when FIREBASE_PROJECT_ID is not configured", async () => {
    const r = await verify(hdr(await idToken()), cfg({ projectId: null }));
    assert.equal(!r.ok && r.status, 503);
  });
});

describe("studio auth: App Check", () => {
  it("verify mode: absent header is allowed, valid header gives appId", async () => {
    assert.equal((await verify(hdr(await idToken()))).ok, true);
    const r = await verify(hdr(await idToken(), await appCheck()));
    assert.equal(r.ok && r.user.appId, "1:123:web:abc");
  });
  it("verify mode: an invalid App Check token is rejected", async () => {
    const r = await verify(hdr(await idToken(), await appCheck({ aud: ["projects/999"] })));
    assert.equal(!r.ok && r.status, 401);
  });
  it("enforce mode: missing header is rejected; misconfigured enforce fails closed", async () => {
    const t = await idToken();
    assert.equal((await verify(hdr(t), cfg({ appCheck: "enforce" }))).ok, false);
    const r = await verify(hdr(t, await appCheck()), cfg({ appCheck: "enforce", projectNumber: null }));
    assert.equal(!r.ok && r.status, 503);
    assert.equal((await verify(hdr(t, await appCheck()), cfg({ appCheck: "enforce" }))).ok, true);
  });
});

describe("studio auth: config and dev bypass", () => {
  it("dev bypass only outside production", () => {
    assert.equal(studioAuthConfig({ STUDIO_DEV_AUTH_BYPASS: "1" }).devBypass, true);
    for (const env of [{ NODE_ENV: "production" }, { K_SERVICE: "behix" }, { VERCEL: "1" }, { GROK_PROJECT_ID: "p" }]) {
      assert.equal(isProductionEnv(env), true);
      assert.equal(studioAuthConfig({ ...env, STUDIO_DEV_AUTH_BYPASS: "1" }).devBypass, false);
    }
    assert.equal(studioAuthConfig({ STUDIO_DEV_AUTH_BYPASS: "true" }).devBypass, false);
  });
  it("dev bypass yields the dev user even without Firebase config", async () => {
    const r = await verify(hdr(), cfg({ projectId: null, devBypass: true }));
    assert.deepEqual(r, { ok: true, user: { uid: DEV_UID, appId: null, dev: true } });
  });
  it("App Check mode parsing defaults to verify", () => {
    assert.equal(studioAuthConfig({}).appCheck, "verify");
    assert.equal(studioAuthConfig({ STUDIO_APP_CHECK: "ENFORCE" }).appCheck, "enforce");
    assert.equal(studioAuthConfig({ STUDIO_APP_CHECK: "off" }).appCheck, "off");
  });
});

describe("/api/studio handler rejects unauthenticated calls before any paid work", () => {
  const make = (over: Partial<StudioDeps> = {}) => {
    const calls: string[] = [];
    const api = createStudioApi({
      bucket: () => "b",
      auth: (h) => verify(h),
      ip: async () => "1.2.3.4",
      run: async (b) => { calls.push(b.action); return { key: "cast/x.png" }; },
      getObject: async () => { calls.push("get"); return new Response("img", { headers: { "content-type": "image/png" } }); },
      ...over,
    });
    return { api, calls };
  };
  const post = (body: unknown, h = new Headers()) => new Request("http://x/api/studio", { method: "POST", headers: h, body: JSON.stringify(body) });
  const bodies = [
    { action: "character", description: "a tall woman in a green coat" },
    { action: "keyframe", cast: ["cast/a.png"], direction: "she walks into the room" },
    { action: "puppet", id: "sara", name: "Sara", who: "a tall woman in a green coat" },
  ];
  for (const b of bodies) {
    it(`POST ${b.action} without token → 401, nothing runs`, async () => {
      const { api, calls } = make();
      const r = await api.post(post(b));
      assert.equal(r.status, 401);
      assert.deepEqual(calls, []);
    });
  }
  it("POST with a valid token runs the action", async () => {
    const { api, calls } = make();
    const h = hdr(await idToken());
    h.set("content-type", "application/json");
    const r = await api.post(post(bodies[0], h));
    assert.equal(r.status, 200);
    assert.deepEqual(calls, ["character"]);
  });
  it("removed actions (video/status) are rejected as invalid", async () => {
    const { api, calls } = make();
    for (const action of ["video", "status"]) {
      const r = await api.post(post({ action, op: "x" }, hdr(await idToken())));
      assert.equal(r.status, 400);
    }
    assert.deepEqual(calls, []);
  });
  it("GET asset requires a token", async () => {
    const { api, calls } = make();
    assert.equal((await api.get(new Request("http://x/api/studio?key=cast/a.png"))).status, 401);
    assert.deepEqual(calls, []);
    const ok = await api.get(new Request("http://x/api/studio?key=cast/a.png", { headers: hdr(await idToken()) }));
    assert.equal(ok.status, 200);
  });
});
