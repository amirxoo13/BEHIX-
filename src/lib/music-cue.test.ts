import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CUE_BASE, cuePrompt, cueSystem, repairCue } from "./music-cue.ts";
import { musicPrompt } from "./lyria.server.ts";
import { loadSkills, skillSystem } from "../ai/skills.ts";

test("music.cue skill goes into the text call's system, then a deterministic English Lyria prompt", () => {
  const files = { "/skills/audio-mix/SKILL.md": readFileSync(new URL("../../skills/audio-mix/SKILL.md", import.meta.url), "utf8") };
  const skill = skillSystem("music.cue", loadSkills(files));
  assert.ok(skill?.includes("audio-mix"));
  assert.ok(cueSystem(skill).endsWith(CUE_BASE));
  assert.ok(cuePrompt("یک صحنهٔ تعقیب در بازار", 30, "tense").includes("30 s"));
  const cue = repairCue({ mood: "tense", style: "pulsing strings, تار", instruments: "santur, frame drum", bpm: 300, intensity: "medium", seconds: 999 }, { mood: "calm", seconds: 40 });
  assert.deepEqual(cue, { mood: "tense", seconds: 40, intensity: "medium", style: "pulsing strings", instruments: "santur, frame drum", bpm: 200 });
  const p = musicPrompt(cue);
  assert.ok(/Instrumental only/.test(p) && !/[\u0600-\u06FF]/.test(p) && p.includes("about 40 seconds"));
});

test("garbage keeps the requested mood/length", () => {
  assert.deepEqual(repairCue(null, { mood: "sad", seconds: 500 }), { mood: "sad", seconds: 184, intensity: "low" });
});
