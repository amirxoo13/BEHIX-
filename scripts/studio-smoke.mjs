#!/usr/bin/env node
/**
 * آزمون واقعی هستهٔ استودیو: شخصیت → فریم کلیدی → نمای Veo، همه در Cloud Storage.
 * اجرا:  node --experimental-strip-types scripts/studio-smoke.mjs
 * نیاز: GOOGLE_CLOUD_PROJECT و MEDIA_BUCKET. (یک ویدیوی ۴ ثانیه‌ای Veo می‌سازد و هزینه دارد.)
 */
import { createCharacter, createKeyframe, startVideo, videoStatus } from "../src/lib/studio-media.server.ts";
const c = await createCharacter("An Iranian woman in her late twenties named Sara: slim, loose mustard headscarf showing dark brown hair, terracotta long coat, black trousers.");
console.log("character", c.key);
const f = await createKeyframe([c.key], "Medium shot: she stands on a Tehran street at golden hour, turning toward the camera with a slight smile.");
console.log("keyframe", f.key);
const v = await startVideo(f.key, "She smiles and says in Persian (Farsi): «سلام، خوش اومدی!». Natural blinking, gentle breeze moves her scarf, slow push-in.", 4);
console.log("operation", v.op);
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 10_000));
  const s = await videoStatus(v.op);
  if (s.done) { console.log("video", JSON.stringify(s)); process.exit(s.key ? 0 : 2); }
}
console.log("timeout"); process.exit(3);
