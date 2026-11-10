import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KEY_RE, assetKey, canRead, newId, ownerOfKey, puppetKeys } from "./studio-keys.ts";
import { ObjectExistsError, putObjectWith } from "./studio-media.server.ts";
import { ownerId } from "./studio-auth.server.ts";
import { createStudioApi } from "./studio-api.server.ts";
import { fakeGcs } from "./testing/fake-gcs.ts";

const A = ownerId("alice"), B = ownerId("bob");

describe("studio keys: owner-bound and versioned", () => {
  it("ownerId is stable, 24 hex and does not contain the uid", () => {
    assert.match(A, /^[0-9a-f]{24}$/);
    assert.equal(A, ownerId("alice"));
    assert.notEqual(A, B);
  });
  it("every new asset / puppet build gets a fresh key under its owner", () => {
    const keys = new Set(Array.from({ length: 200 }, () => assetKey("cast", A, "image/png")));
    assert.equal(keys.size, 200);
    for (const k of keys) { assert.ok(KEY_RE.test(k)); assert.equal(ownerOfKey(k), A); }
    const p1 = puppetKeys(A, "sara"), p2 = puppetKeys(A, "sara");
    assert.notEqual(p1.png, p2.png);
    assert.ok(p1.png.startsWith(`cast/${A}/sara/`) && p1.json.endsWith(".json"));
    assert.throws(() => puppetKeys("not-an-owner", "sara"));
    assert.throws(() => assetKey("frames", "../x", "image/png"));
    assert.ok(newId().length >= 20);
  });
  it("KEY_RE rejects traversal-looking and other-prefix keys", () => {
    for (const k of ["cast/../quota/x", "cast//x.png", "quota/studio/x", "tts/x.mp3", "videos/x.mp4"]) assert.equal(KEY_RE.test(k), false, k);
  });
  it("canRead: own files and legacy unowned files only", () => {
    assert.equal(canRead(`cast/${A}/x.png`, A), true);
    assert.equal(canRead(`cast/${A}/sara/v1.json`, A), true);
    assert.equal(canRead(`cast/${A}/x.png`, B), false);
    assert.equal(canRead("cast/legacy.png", B), true);
    assert.equal(canRead("cast/someone/x.png", B), false); // not a legacy key, not an owner key
  });
});

describe("immutable writes (ifGenerationMatch=0)", () => {
  it("a second write to the same key is refused and the first stays intact", async () => {
    const g = fakeGcs();
    const key = `cast/${A}/sara/v1.json`;
    await putObjectWith(g.fetch, "Bearer t", "b", key, new TextEncoder().encode("first"), "application/json");
    await assert.rejects(putObjectWith(g.fetch, "Bearer t", "b", key, new TextEncoder().encode("second"), "application/json"), ObjectExistsError);
    assert.equal(g.objects.size, 1);
    assert.equal(g.objects.get(key)?.generation, 2); // still the first write's generation
  });
  it("sends the precondition on every studio write", async () => {
    const urls: string[] = [];
    const f = (async (u: string | URL | Request) => { urls.push(String(u)); return new Response("{}"); }) as typeof fetch;
    await putObjectWith(f, "Bearer t", "b", "cast/x.png", new Uint8Array(1), "image/png");
    assert.match(urls[0], /ifGenerationMatch=0/);
  });
});

describe("/api/studio ownership", () => {
  const api = (uid: string) => {
    const ran: string[] = [];
    const a = createStudioApi({
      bucket: () => "b",
      auth: async () => ({ ok: true, user: { uid, appId: null, dev: false } }),
      ip: async () => "1.1.1.1",
      run: async (b) => { ran.push(b.action); return {}; },
      getObject: async () => new Response("x"),
      reserve: async () => ({ day: "d", keys: [] }),
      refund: async () => {},
    });
    return { a, ran };
  };
  it("GET of another user's file is 404", async () => {
    const { a } = api("bob");
    assert.equal((await a.get(new Request(`http://x/api/studio?key=cast/${A}/x.png`))).status, 404);
    assert.equal((await a.get(new Request(`http://x/api/studio?key=cast/${B}/x.png`))).status, 200);
  });
  it("keyframe referencing another user's cast is 403 and nothing runs", async () => {
    const { a, ran } = api("bob");
    const r = await a.post(new Request("http://x/api/studio", { method: "POST", body: JSON.stringify({ action: "keyframe", cast: [`cast/${A}/x.png`], direction: "she walks into the room" }) }));
    assert.equal(r.status, 403);
    assert.deepEqual(ran, []);
  });
});
