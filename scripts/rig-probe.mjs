#!/usr/bin/env node
/**
 * آزمون فرض اصلیِ خط تولید دارایی:
 *   ۱) Gemini Image یک شخصیت حرفه‌ای در ژست A روی پس‌زمینهٔ یکدست می‌سازد.
 *   ۲) Gemini مختصات پیکسلیِ مفاصل همان تصویر را برمی‌گرداند.
 *   ۳) اسکلت روی تصویر کشیده می‌شود تا دقت را با چشم ببینیم.
 * اگر این کار کند، موتور خودِ BEHIX می‌تواند هنرِ Gemini را عروسک‌گردانی کند (بدون Veo).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { generateImage, STYLE } from "../src/lib/studio-media.server.ts";
import { gcpAccessToken, gcpProject } from "../src/lib/gcp-auth.server.ts";

const out = process.env.PROBE_OUT || "verify-out";
await mkdir(out, { recursive: true });

const who = process.env.RIG_WHO ||
  "an Iranian man in his early thirties: tall and lean, short dark curly hair, light stubble, olive skin, dark green overshirt over a cream t-shirt, charcoal trousers, white sneakers";

console.log("[1/3] ساخت تصویر ژست A …");
const img = await generateImage(
  `Full-body character turnaround reference, THREE-QUARTER front view, standing in a relaxed A-pose: legs straight and slightly apart, both arms straight and held away from the body at about 45 degrees, palms facing forward, fingers relaxed and separated. Nothing overlaps the body. Character: ${who}. The entire figure is fully visible head to toe with generous empty margin. Flat uniform pure white background (#FFFFFF), no floor, no shadow on the background, no props. ${STYLE}`,
  [],
  "3:4",
);
const file = `${out}/rig-apose.png`;
await writeFile(file, Buffer.from(img.data, "base64"));
console.log("     →", file);

console.log("[2/3] پرسش مختصات مفاصل از Gemini …");
const project = await gcpProject();
const JOINTS = ["headTop","headCenter","chin","neck","chest","pelvis","shoulderL","elbowL","wristL","handL","shoulderR","elbowR","wristR","handR","hipL","kneeL","ankleL","toeL","hipR","kneeR","ankleR","toeR"];
const r = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${process.env.RIG_TEXT_MODEL || "gemini-3.8-flash"}:generateContent`, {
  method: "POST",
  headers: { authorization: `Bearer ${await gcpAccessToken()}`, "x-goog-user-project": project, "content-type": "application/json" },
  body: JSON.stringify({
    contents: [{ role: "user", parts: [
      { inlineData: img },
      { text: `This is a character turnaround on a white background. Report the pixel coordinates of each anatomical landmark, measured in a coordinate system where (0,0) is the TOP-LEFT corner of the image, x grows to the right and y grows downward, and the image is exactly ${"${W}"} wide and ${"${H}"} tall — use the normalized range 0..1000 for BOTH axes instead of raw pixels. "L" means the character's own left (appears on the RIGHT side of the image when facing us). Report every landmark, estimating if partly hidden. Also report "scale": the vertical distance from headTop to the lower of the two ankles, in the same 0..1000 units.` },
    ] }],
    generationConfig: {
      temperature: 0, maxOutputTokens: 4000, responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: Object.fromEntries([...JOINTS.map((j) => [j, { type: "OBJECT", properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } }, required: ["x", "y"] }]), ["scale", { type: "NUMBER" }]]),
        required: [...JOINTS, "scale"],
      },
    },
  }),
  signal: AbortSignal.timeout(120_000),
});
const j = await r.json();
if (!r.ok) { console.error("خطا:", j.error?.message?.slice(0, 300)); process.exit(2); }
const rig = JSON.parse(j.candidates[0].content.parts.map((p) => p.text ?? "").join(""));
await writeFile(`${out}/rig-joints.json`, JSON.stringify(rig, null, 2));
console.log("     →", `${out}/rig-joints.json`, " توکن:", j.usageMetadata?.totalTokenCount);

console.log("[3/3] کشیدن اسکلت روی تصویر …");
const { chromium } = await import("playwright");
const b = await chromium.launch();
const p = await b.newPage();
const png = await p.evaluate(async ({ data, rig, JOINTS }) => {
  const im = new Image();
  await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = "data:image/png;base64," + data; });
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const x = c.getContext("2d"); x.drawImage(im, 0, 0);
  const P = (n) => ({ x: rig[n].x / 1000 * im.width, y: rig[n].y / 1000 * im.height });
  const line = (a, bb, col) => { x.beginPath(); x.moveTo(P(a).x, P(a).y); x.lineTo(P(bb).x, P(bb).y); x.strokeStyle = col; x.lineWidth = 5; x.lineCap = "round"; x.stroke(); };
  for (const [a, bb] of [["neck","chest"],["chest","pelvis"],["headTop","chin"],["chin","neck"]]) line(a, bb, "#00a0ff");
  for (const s of ["L","R"]) { line("chest","shoulder"+s,"#ff8800"); line("shoulder"+s,"elbow"+s,"#ff8800"); line("elbow"+s,"wrist"+s,"#ff8800"); line("wrist"+s,"hand"+s,"#ffcc00"); line("pelvis","hip"+s,"#00cc66"); line("hip"+s,"knee"+s,"#00cc66"); line("knee"+s,"ankle"+s,"#00cc66"); line("ankle"+s,"toe"+s,"#aaff00"); }
  for (const n of JOINTS) { const q = P(n); x.beginPath(); x.arc(q.x, q.y, 7, 0, 7); x.fillStyle = "#ff0044"; x.fill(); x.font = "bold 16px sans-serif"; x.fillStyle = "#000"; x.fillText(n, q.x + 10, q.y - 8); }
  return c.toDataURL("image/png");
}, { data: img.data, rig, JOINTS });
await b.close();
await writeFile(`${out}/rig-overlay.png`, Buffer.from(png.split(",")[1], "base64"));
console.log("     →", `${out}/rig-overlay.png`);
