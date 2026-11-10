#!/usr/bin/env node
/**
 * آزمون واقعی هستهٔ استودیو: شخصیت → فریم کلیدی، هر دو در Cloud Storage.
 * اجرا:  node --experimental-strip-types scripts/studio-smoke.mjs
 * نیاز: GOOGLE_CLOUD_PROJECT و MEDIA_BUCKET. (دو تصویر Gemini می‌سازد و هزینه دارد.)
 */
import { createCharacter, createKeyframe } from "../src/lib/studio-media.server.ts";
const c = await createCharacter("An Iranian woman in her late twenties named Sara: slim, loose mustard headscarf showing dark brown hair, terracotta long coat, black trousers.");
console.log("character", c.key);
const f = await createKeyframe([c.key], "Medium shot: she stands on a Tehran street at golden hour, turning toward the camera with a slight smile.");
console.log("keyframe", f.key);
