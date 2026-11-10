import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { startMic } from "./audio.ts";

type Mode = "support" | "start" | "ok";

function install(mode: Mode) {
  const tracks = [{ stopped: false, stop() { this.stopped = true; } }];
  const stream = { getTracks: () => tracks };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: async () => stream } },
  });
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = class {
    static isTypeSupported() {
      if (mode === "support") throw new Error("support");
      return true;
    }
    ondataavailable: ((ev: { data: Blob }) => void) | null = null;
    start() {
      if (mode === "start") throw new Error("start");
    }
  };
  return tracks;
}

describe("CR-2 startMic releases the microphone", () => {
  afterEach(() => {
    delete (globalThis as { navigator?: unknown }).navigator;
  });

  it("UT-CR-02 stops tracks when isTypeSupported throws", async () => {
    const tracks = install("support");
    await assert.rejects(() => startMic(), /support/);
    assert.equal(tracks[0].stopped, true);
  });

  it("UT-CR-02b stops tracks when recorder.start throws", async () => {
    const tracks = install("start");
    await assert.rejects(() => startMic(), /start/);
    assert.equal(tracks[0].stopped, true);
  });
});
