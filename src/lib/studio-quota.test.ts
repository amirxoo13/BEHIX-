import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bumpCounter, quotaKey, refundStudio, reserveStudio, studioLimits, type QuotaDeps } from "./studio-quota.ts";
import { createStudioApi } from "./studio-api.server.ts";

/** Cloud Storage ساختگی با همان قراردادهای precondition (ifGenerationMatch / ifMetagenerationMatch). */
export function fakeGcs() {
  const objects = new Map<string, { generation: number; metageneration: number; metadata: Record<string, string>; body: string }>();
  let gen = 1;
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    if (url.pathname.startsWith("/upload/storage/v1/b/")) {
      const name = url.searchParams.get("name")!;
      const igm = url.searchParams.get("ifGenerationMatch");
      const cur = objects.get(name);
      if (igm !== null && String(cur?.generation ?? 0) !== igm) return new Response("precondition", { status: 412 });
      objects.set(name, { generation: ++gen, metageneration: 1, metadata: {}, body: String(init.body ?? "") });
      return Response.json({ name });
    }
    const m = /^\/storage\/v1\/b\/[^/]+\/o\/(.+)$/.exec(url.pathname);
    if (!m) return new Response("bad", { status: 400 });
    const name = decodeURIComponent(m[1]);
    const cur = objects.get(name);
    if (!cur) return new Response("nf", { status: 404 });
    if (method === "PATCH") {
      const img = url.searchParams.get("ifMetagenerationMatch");
      if (img !== null && String(cur.metageneration) !== img) return new Response("precondition", { status: 412 });
      const patch = JSON.parse(String(init.body)) as { metadata?: Record<string, string> };
      cur.metadata = { ...cur.metadata, ...patch.metadata };
      cur.metageneration++;
      return Response.json({});
    }
    return Response.json({ metageneration: String(cur.metageneration), metadata: cur.metadata });
  }) as typeof fetch;
  return { objects, fetch: fetchImpl };
}

const deps = (g: ReturnType<typeof fakeGcs>, now = Date.UTC(2026, 10, 10, 12)): QuotaDeps => ({ bucket: "b", auth: async () => ({ authorization: "Bearer t" }), fetch: g.fetch, now: () => now });
const count = (g: ReturnType<typeof fakeGcs>, key: string) => Number(g.objects.get(key)?.metadata.count ?? 0);

describe("studio durable quota (GCS counters)", () => {
  it("per-user limit: the (n+1)th reservation of the day is refused", async () => {
    const g = fakeGcs();
    const lim = { perUser: 3, perDay: 100 };
    for (let i = 0; i < 3; i++) assert.ok(!("error" in (await reserveStudio(deps(g), "alice", lim))));
    const r = await reserveStudio(deps(g), "alice", lim);
    assert.ok("error" in r);
    assert.equal(count(g, quotaKey("2026-11-10", "u/alice")), 3);
    // another user is independent
    assert.ok(!("error" in (await reserveStudio(deps(g), "bob", lim))));
  });
  it("global limit refuses and gives back the user's unit", async () => {
    const g = fakeGcs();
    const lim = { perUser: 10, perDay: 2 };
    await reserveStudio(deps(g), "a", lim);
    await reserveStudio(deps(g), "b", lim);
    const r = await reserveStudio(deps(g), "c", lim);
    assert.ok("error" in r);
    assert.equal(count(g, quotaKey("2026-11-10", "u/c")), 0);
    assert.equal(count(g, quotaKey("2026-11-10", "all")), 2);
  });
  it("is shared across 'instances' and survives restarts (state lives in GCS)", async () => {
    const g = fakeGcs();
    const lim = { perUser: 2, perDay: 100 };
    await reserveStudio(deps(g), "alice", lim); // instance 1
    await reserveStudio({ ...deps(g) }, "alice", lim); // instance 2, fresh memory
    assert.ok("error" in (await reserveStudio({ ...deps(g) }, "alice", lim)));
  });
  it("concurrent reservations never exceed the limit (metageneration CAS)", async () => {
    const g = fakeGcs();
    const lim = { perUser: 5, perDay: 100 };
    const results = await Promise.all(Array.from({ length: 12 }, () => reserveStudio(deps(g), "alice", lim)));
    assert.equal(results.filter((r) => !("error" in r)).length, 5);
    assert.equal(count(g, quotaKey("2026-11-10", "u/alice")), 5);
  });
  it("refund returns the units to the reservation's own day", async () => {
    const g = fakeGcs();
    const r = await reserveStudio(deps(g), "alice", { perUser: 1, perDay: 10 });
    assert.ok(!("error" in r));
    await refundStudio(deps(g, Date.UTC(2026, 10, 11, 1)), r);
    assert.equal(count(g, quotaKey("2026-11-10", "u/alice")), 0);
    assert.equal(count(g, quotaKey("2026-11-10", "all")), 0);
    assert.equal(await bumpCounter(deps(g), quotaKey("2026-11-12", "x"), 5, -1), true); // refund on a missing counter is a no-op
  });
  it("limits come from env with safe defaults", () => {
    assert.deepEqual(studioLimits({}), { perUser: 20, perDay: 400 });
    assert.deepEqual(studioLimits({ STUDIO_PER_USER_DAY: "5", STUDIO_PER_DAY: "x" }), { perUser: 5, perDay: 400 });
  });
});

describe("/api/studio uses the durable quota", () => {
  it("429 when the user's quota is exhausted, and refunds when the paid call fails", async () => {
    const g = fakeGcs();
    const lim = { perUser: 1, perDay: 100 };
    let fail = true;
    const api = createStudioApi({
      bucket: () => "b",
      auth: async () => ({ ok: true, user: { uid: "u1", appId: null, dev: false } }),
      ip: async () => "1.1.1.1",
      run: async () => { if (fail) throw new Error("model down"); return { key: "cast/x.png" }; },
      getObject: async () => new Response(""),
      reserve: (owner) => reserveStudio(deps(g), owner, lim),
      refund: (r) => refundStudio(deps(g), r),
    });
    const req = () => new Request("http://x/api/studio", { method: "POST", body: JSON.stringify({ action: "character", description: "a tall woman in a coat" }) });
    assert.equal((await api.post(req())).status, 502); // failed → refunded
    fail = false;
    assert.equal((await api.post(req())).status, 200); // the refunded unit is usable
    assert.equal((await api.post(req())).status, 429); // now exhausted
  });
});
