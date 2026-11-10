/**
 * Minimal Cloud Storage JSON API helpers (server only): get/put an object with a Bearer token from ADC.
 * Shared by /api/tts, /api/voice and /api/music. Object names are always built server-side.
 */
const enc = encodeURIComponent;

/** Object bytes, or null when missing or unreadable (callers treat any failure as a cache miss). */
export async function gcsGet(bucket: string, name: string, auth: Record<string, string>): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  try {
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${enc(bucket)}/o/${enc(name)}?alt=media`, { headers: auth });
    if (!r.ok) return null;
    return { bytes: await r.arrayBuffer(), type: r.headers.get("content-type") ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/**
 * Upload (overwrite). Errors are logged, not thrown: a failed cache write must not fail the request.
 * One retry on a network error, 429 or 5xx: a lost cache write means the next identical request pays again.
 */
export async function gcsPut(bucket: string, name: string, body: Uint8Array | string, type: string, auth: Record<string, string>, retry = true): Promise<boolean> {
  try {
    const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${enc(bucket)}/o?uploadType=media&name=${enc(name)}`, {
      method: "POST",
      headers: { ...auth, "content-type": type },
      body: body as BodyInit,
    });
    if (r.ok) return true;
    if (retry && (r.status === 429 || r.status >= 500)) return gcsPut(bucket, name, body, type, auth, false);
    console.error("[gcs] put", name, r.status);
    return false;
  } catch (e) {
    if (retry) return gcsPut(bucket, name, body, type, auth, false);
    console.error("[gcs] put", name, e);
    return false;
  }
}
