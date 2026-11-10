/** فقط برای آزمون‌ها. */
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

