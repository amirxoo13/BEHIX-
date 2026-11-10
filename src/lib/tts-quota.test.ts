import { test } from "node:test";
import assert from "node:assert/strict";
import { reserveDaily } from "./tts-quota.ts";

/** شبیه‌ساز رفتار واقعی JSON API Cloud Storage برای شرط‌های ifGenerationMatch / ifMetagenerationMatch. */
function fakeStorage() {
  const objects = new Map<string, { metageneration: number; metadata: Record<string, string> }>();
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 5));
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    await tick();
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    if (method === "POST") {
      const name = url.searchParams.get("name")!;
      if (url.searchParams.get("ifGenerationMatch") === "0" && objects.has(name)) return new Response(null, { status: 412 });
      objects.set(name, { metageneration: 1, metadata: {} });
      return Response.json({});
    }
    const name = decodeURIComponent(url.pathname.split("/o/")[1]);
    const o = objects.get(name);
    if (!o) return new Response(null, { status: 404 });
    if (method === "GET") return Response.json({ metageneration: String(o.metageneration), metadata: o.metadata });
    if (Number(url.searchParams.get("ifMetagenerationMatch")) !== o.metageneration) return new Response(null, { status: 412 });
    o.metadata = { ...o.metadata, ...(JSON.parse(String(init!.body)) as { metadata: Record<string, string> }).metadata };
    o.metageneration++;
    return Response.json({});
  }) as typeof fetch;
  return objects;
}

test("concurrent reservations never exceed the shared daily limit", async () => {
  const objects = fakeStorage();
  const results = await Promise.all(Array.from({ length: 6 }, () => reserveDaily({}, "b", 3, 1)));
  assert.equal(results.filter((r) => r !== null).length, 3);
  assert.equal([...objects.values()][0].metadata.count, "3");
});

test("a refund frees the allowance again", async () => {
  fakeStorage();
  const day = await reserveDaily({}, "b", 1, 1);
  assert.ok(day);
  assert.equal(await reserveDaily({}, "b", 1, 1), null);
  assert.equal(await reserveDaily({}, "b", 1, -1, day), day);
  assert.ok(await reserveDaily({}, "b", 1, 1));
});

test("without a bucket the in-process counter reserves before synthesis", async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => reserveDaily({}, undefined, 2, 1)));
  assert.equal(results.filter((r) => r !== null).length, 2);
});

test("a refund after midnight goes back to the reservation's own day", async () => {
  const objects = fakeStorage();
  assert.ok(await reserveDaily({}, "b", 1, 1, "2026-01-01"));
  assert.ok(await reserveDaily({}, "b", 1, 1, "2026-01-02"));
  await reserveDaily({}, "b", 1, -1, "2026-01-01");
  assert.equal(objects.get("quota/2026-01-01")!.metadata.count, "0");
  assert.equal(objects.get("quota/2026-01-02")!.metadata.count, "1");
  assert.equal(await reserveDaily({}, "b", 1, 1, "2026-01-02"), null);
});
