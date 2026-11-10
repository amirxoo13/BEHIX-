import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanStyle, DIRECTION_BASE, directionPrompt, directionSystem, fallbackDirection, repairDirection, type DirectionIn } from "./voice-direction.ts";
import { buildTextRequest, audioTextConfig } from "./gemini-text.server.ts";
import { buildTtsRequest } from "./gemini-tts.server.ts";
import { loadSkills, skillSystem } from "../ai/skills.ts";
import { readFileSync } from "node:fs";

const input: DirectionIn = {
  cast: [{ id: "c1", kind: "man", voice: "Charon" }, { id: "c2", kind: "girl", voice: "Leda" }],
  lines: [
    { id: "b1", speaker: "c1", text: "سلام، حالت چطوره؟", mood: "smile", style: "warmly, with a smile; natural, colloquial Tehrani Persian" },
    { id: "b2", speaker: "c2", text: "خوبم، مرسی!", style: "natural, colloquial Tehrani Persian" },
  ],
};

test("text model defaults to gemini-3.8-flash and refuses retired ids", () => {
  assert.equal(audioTextConfig({}).model, "gemini-3.8-flash");
  assert.equal(audioTextConfig({ AUDIO_TEXT_MODEL: "gemini-2.5-flash" }).model, "gemini-3.8-flash");
  assert.equal(audioTextConfig({ AUDIO_TEXT_MODEL: "gemini-3.8-flash-lite" }).model, "gemini-3.8-flash-lite");
});

test("tts.line skill goes into the TEXT call's systemInstruction, never into the TTS request", () => {
  const files = { "/skills/audio-voice-direction/SKILL.md": readFileSync(new URL("../../skills/audio-voice-direction/SKILL.md", import.meta.url), "utf8") };
  const skill = skillSystem("tts.line", loadSkills(files));
  assert.ok(skill && skill.includes("audio-voice-direction"));
  const sys = directionSystem(skill);
  assert.ok(sys.startsWith(skill!) && sys.endsWith(DIRECTION_BASE));
  const req = buildTextRequest(sys, directionPrompt(input), {});
  assert.equal(req.systemInstruction?.parts[0].text, sys);
  const tts = JSON.stringify(buildTtsRequest("سلام", "Kore", "calm"));
  assert.ok(!tts.includes("audio-voice-direction") && !tts.includes("systemInstruction"));
  assert.equal(directionSystem(undefined), DIRECTION_BASE);
});

test("prompt lists allowed voices, cast and lines", () => {
  const p = directionPrompt(input);
  assert.ok(p.includes("Kore") && p.includes("c1: man") && p.includes("b2 [c2]: خوبم"));
});

test("styles: English, ≤15 words, no dialogue, no reading instructions", () => {
  const l = input.lines[0];
  assert.equal(cleanStyle("Warm, relaxed, smiling; colloquial Tehrani Persian.", l), "Warm, relaxed, smiling; colloquial Tehrani Persian");
  assert.equal(cleanStyle("گرم و صمیمی", l), null);
  assert.equal(cleanStyle("Read this line warmly", l), null);
  assert.equal(cleanStyle(Array(20).fill("very").join(" "), l), null);
  assert.equal(cleanStyle(42, l), null);
});

test("repair merges valid fields over the current casting; garbage falls back", () => {
  const out = repairDirection({ cast: [{ id: "c1", voice: "Puck" }, { id: "c2", voice: "NotAVoice" }, { id: "zz", voice: "Kore" }], lines: [{ id: "b1", style: "teasing, upbeat, quick" }, { id: "b2", style: "سلام" }] }, input, "gemini-3.8-flash");
  assert.equal(out.source, "gemini");
  assert.deepEqual(out.cast, { c1: "Puck", c2: "Leda" });
  assert.deepEqual(out.lines, [{ id: "b1", voice: "Puck", style: "teasing, upbeat, quick" }, { id: "b2", voice: "Leda", style: input.lines[1].style }]);
  const bad = repairDirection("nope", input);
  assert.equal(bad.source, "fallback");
  assert.deepEqual(bad.lines, fallbackDirection(input).lines);
  assert.ok(bad.warning);
});
