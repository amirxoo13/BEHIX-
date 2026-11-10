import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVoiceResults, resolveAudioUrl, voiceRequest } from "./voice-batch.ts";
import { alignLine } from "../v2/align.ts";

const jobs = [
  { beatId: "a", text: "سلام", voice: "Kore", prompt: "calm" },
  { beatId: "b", text: "خداحافظ", voice: "Puck", prompt: "sad" },
  { beatId: "c", text: "باشه", voice: "Puck", prompt: "" },
];

test("request body maps beats to lines", () => {
  assert.deepEqual(voiceRequest(jobs.slice(0, 1)), { lines: [{ id: "a", text: "سلام", voice: "Kore", style: "calm" }] });
});

test("results keep job order; errors, fatal flags and garbage become per-line errors", () => {
  const timeline = alignLine({ text: "سلام", duration: 0.8 });
  const out = parseVoiceResults([
    { id: "b", error: "full", fatal: true },
    { id: "a", audioUrl: "/api/voice?clip=x.wav", timeline },
  ], jobs);
  assert.equal(out[0].beatId, "a");
  assert.equal(out[0].audioUrl, "/api/voice?clip=x.wav");
  assert.equal(out[0].timeline?.timing, "text");
  assert.deepEqual(out[1], { beatId: "b", error: "full", fatal: true });
  assert.ok(out[2].error && !out[2].fatal, "missing id");
  assert.ok(parseVoiceResults({ nope: 1 }, jobs).every((r) => r.error));
  assert.ok(parseVoiceResults([{ id: "a", audioUrl: "/x", timeline: { bad: 1 } }], jobs)[0].error);
});

test("audio URLs resolve against the API base", () => {
  assert.equal(resolveAudioUrl("https://api.example", "/api/voice?clip=1.wav"), "https://api.example/api/voice?clip=1.wav");
  assert.equal(resolveAudioUrl("https://api.example", "data:audio/wav;base64,AA"), "data:audio/wav;base64,AA");
});

test("clips without STT get an amplitude timeline keyed like the clip", async () => {
  const { amplitudeTimeline } = await import("./voice-batch.ts");
  const rate = 24000, samples = new Float32Array(rate);
  for (let i = 4800; i < 18000; i++) samples[i] = Math.sin(i / 10) * 0.5;
  const t = amplitudeTimeline({ beatId: "b1", text: "سلام دنیا", voice: "Kore", key: "k1" }, { samples, sampleRate: rate });
  assert.equal(t.timing, "amplitude");
  assert.equal(t.clipKey, "k1");
  assert.equal(t.lineId, "b1");
  assert.equal(t.duration, 1);
  assert.ok(t.visemes.length > 1);
});
