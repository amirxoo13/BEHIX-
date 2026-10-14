import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderMixOffline, type MixCue } from "./audio.ts";

describe("CR-4 offline mix skips a bad clip", () => {
  it("UT-CR-04 a failed voice fetch does not reject the mix", async () => {
    const decoded: string[] = [];
    (globalThis as unknown as { OfflineAudioContext: unknown }).OfflineAudioContext = class {
      destination = {};
      decodeAudioData(buf: ArrayBuffer) {
        if (buf.byteLength === 0) throw new Error("decode");
        decoded.push("ok");
        return { duration: 0 };
      }
      createBufferSource() {
        return { buffer: null, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {} };
      }
      async startRendering() {
        return { duration: 0.1 };
      }
    };
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes("bad")) {
        return { ok: false, status: 500, async arrayBuffer() { return new ArrayBuffer(0); } };
      }
      return { ok: true, status: 200, async arrayBuffer() { return new ArrayBuffer(8); } };
    }) as typeof fetch;

    const cues: MixCue[] = [
      { at: 0, end: 0.1, sfx: "none", url: "bad://clip", pitch: 1 },
      { at: 0, end: 0.1, sfx: "none", url: "good://clip", pitch: 1 },
    ];
    const mix = await renderMixOffline(cues, 0.1, 8000);
    assert.ok(mix);
    assert.deepEqual(decoded, ["ok"]);
  });
});
