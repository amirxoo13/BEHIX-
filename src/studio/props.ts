/**
 * اشیاء جدا از پس‌زمینه (ماشین، درخت، سماور، میز، ...).
 * هر شیء در هر نما جای خودش را دارد (x از ۰ تا ۱ عرض قاب) و در لایهٔ «عقب» (پشت بازیگران)
 * یا «جلو» (جلوی بازیگران، مثل میز) کشیده می‌شود.
 * واحد اندازه همان واحد بدن شخصیت‌هاست (قد آدم ≈ ۲۱۶)، پس اشیاء با بازیگران هم‌مقیاس‌اند.
 */
import { INK, box, car, circle, cypress, line, plant, poly, tree, type Ctx } from "./bg-kit.ts";

export type PropId =
  | "samovar"
  | "teapot"
  | "hookah"
  | "table"
  | "chair"
  | "tv"
  | "lamp"
  | "plant"
  | "flowers"
  | "cake"
  | "fruit"
  | "suitcase"
  | "tree"
  | "cypress"
  | "bench"
  | "streetlight"
  | "trash"
  | "peykan"
  | "pride"
  | "samand"
  | "taxi"
  | "suv"
  | "motorbike"
  | "bicycle"
  | "cat";

export type PropLayer = "back" | "front";

export type PropPlacement = { id: PropId; x: number; layer: PropLayer };

/** حداکثر شیء در یک نما. */
export const MAX_PROPS = 6;

type PropDef = {
  id: PropId;
  label: string;
  /** اسم‌های فارسی که در متن سناریو این شیء را صدا می‌زنند. */
  aliases: string[];
  /** «table» یعنی روی میز گذاشته می‌شود (اگر میزی در قاب نباشد، میز هم اضافه می‌شود). */
  mount: "floor" | "table";
  layer: PropLayer;
  /** اندازهٔ بزرگ (ماشین، درخت) کنار قاب می‌نشیند تا جلوی بازیگران را نگیرد. */
  big: boolean;
  draw: (ctx: Ctx) => void;
};

const BRASS = "#d4a73a";
const SILVER = "#c8ced6";
const WOOD = "#8a5a36";
const WOOD_DARK = "#6b3a22";

function samovar(ctx: Ctx) {
  poly(ctx, [[-22, 0], [22, 0], [14, -14], [-14, -14]], BRASS);
  ctx.fillStyle = SILVER;
  ctx.beginPath();
  ctx.ellipse(0, -44, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  box(ctx, -16, -80, 32, 8, BRASS, { lw: 2, r: 3 });
  // قوری کوچک روی سماور
  ctx.fillStyle = "#3d6fb8";
  ctx.beginPath();
  ctx.ellipse(0, -92, 13, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  line(ctx, 12, -94, 20, -100, INK, 3);
  // شیر
  box(ctx, 22, -40, 12, 5, BRASS, { lw: 2 });
  line(ctx, 32, -36, 32, -30, INK, 3);
  // دسته‌ها
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-28, -54, 7, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
}

function teapot(ctx: Ctx) {
  ctx.fillStyle = "#f4efe6";
  ctx.beginPath();
  ctx.ellipse(0, -14, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#3d6fb8";
  ctx.beginPath();
  ctx.ellipse(0, -14, 8, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  line(ctx, 16, -16, 28, -26, INK, 4);
  circle(ctx, 0, -30, 4, "#3d6fb8", INK, 2);
}

function hookah(ctx: Ctx) {
  ctx.fillStyle = "rgba(120,170,200,0.75)";
  ctx.beginPath();
  ctx.ellipse(0, -24, 22, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  box(ctx, -5, -112, 10, 66, BRASS, { lw: 2 });
  poly(ctx, [[-14, -112], [14, -112], [8, -124], [-8, -124]], "#c2412d");
  circle(ctx, 0, -128, 5, "#e8743b", INK, 2);
  ctx.strokeStyle = "#3a2a20";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(5, -70);
  ctx.bezierCurveTo(60, -60, 50, -10, 80, -20);
  ctx.stroke();
}

function table(ctx: Ctx) {
  box(ctx, -78, -72, 156, 12, WOOD, { r: 3 });
  box(ctx, -70, -60, 10, 60, WOOD_DARK, { lw: 2 });
  box(ctx, 60, -60, 10, 60, WOOD_DARK, { lw: 2 });
}

function chair(ctx: Ctx) {
  box(ctx, -24, -54, 48, 9, WOOD, { lw: 2, r: 2 });
  box(ctx, 14, -112, 9, 58, WOOD_DARK, { lw: 2 });
  box(ctx, -20, -45, 7, 45, WOOD_DARK, { lw: 2 });
  box(ctx, 14, -45, 7, 45, WOOD_DARK, { lw: 2 });
}

function tv(ctx: Ctx) {
  box(ctx, -62, -40, 124, 40, WOOD_DARK, { r: 3 });
  box(ctx, -50, -28, 44, 20, WOOD, { lw: 2 });
  box(ctx, 6, -28, 44, 20, WOOD, { lw: 2 });
  box(ctx, -58, -118, 116, 72, "#1f2933", { r: 4 });
  box(ctx, -52, -112, 104, 60, "#3d6fb8", { lw: 2 });
  box(ctx, -6, -46, 12, 6, "#1f2933", { lw: 2 });
}

function lamp(ctx: Ctx) {
  box(ctx, -18, -8, 36, 8, "#3a3f46", { lw: 2, r: 3 });
  box(ctx, -3, -150, 6, 142, "#3a3f46", { lw: 2 });
  poly(ctx, [[-30, -140], [30, -140], [18, -180], [-18, -180]], "#f2c230");
}

function flowers(ctx: Ctx) {
  poly(ctx, [[-10, 0], [10, 0], [14, -30], [-14, -30]], "#3d6fb8");
  const colors = ["#e15b6a", "#f2c230", "#c45b78", "#f4efe6"];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.35;
    const ex = Math.cos(a) * 34;
    const ey = -30 + Math.sin(a) * 34;
    line(ctx, 0, -30, ex, ey, "#2f6b3a", 2);
    circle(ctx, ex, ey, 7, colors[i % colors.length], INK, 2);
  }
}

function cake(ctx: Ctx) {
  box(ctx, -30, -30, 60, 30, "#f4d6e0", { r: 4 });
  box(ctx, -30, -34, 60, 8, "#f4efe6", { lw: 2, r: 4 });
  for (const x of [-16, 0, 16]) {
    box(ctx, x - 2, -50, 4, 16, "#3d6fb8", { lw: 1.5 });
    circle(ctx, x, -54, 3, "#f2c230", null);
  }
}

function fruit(ctx: Ctx) {
  ctx.fillStyle = "#e7d3a1";
  ctx.beginPath();
  ctx.ellipse(0, -8, 34, 10, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  circle(ctx, -16, -16, 11, "#e15b6a");
  circle(ctx, 4, -20, 12, "#f2a03a");
  circle(ctx, 20, -14, 10, "#7cbf4a");
}

function suitcase(ctx: Ctx) {
  box(ctx, -32, -70, 64, 70, "#b4533a", { r: 6 });
  box(ctx, -12, -82, 24, 12, "rgba(0,0,0,0)", { lw: 4, r: 4 });
  line(ctx, -32, -36, 32, -36, INK, 2);
}

function bench(ctx: Ctx) {
  box(ctx, -86, -48, 172, 10, WOOD, { lw: 2, r: 2 });
  box(ctx, -86, -86, 172, 10, WOOD, { lw: 2, r: 2 });
  box(ctx, -86, -70, 172, 10, WOOD, { lw: 2, r: 2 });
  for (const x of [-74, 66]) box(ctx, x, -48, 8, 48, "#3a3f46", { lw: 2 });
}

function streetlight(ctx: Ctx) {
  box(ctx, -5, -300, 10, 300, "#3a3f46", { lw: 2 });
  box(ctx, -5, -300, 46, 8, "#3a3f46", { lw: 2 });
  box(ctx, 28, -294, 22, 12, "#fff3c4", { lw: 2 });
}

function trash(ctx: Ctx) {
  poly(ctx, [[-22, 0], [22, 0], [26, -64], [-26, -64]], "#2f6b3a");
  box(ctx, -30, -72, 60, 9, "#245232", { lw: 2, r: 2 });
  for (const x of [-10, 0, 10]) line(ctx, x, -54, x * 0.9, -10, "#1d3f27", 2);
}

function motorbike(ctx: Ctx) {
  circle(ctx, -46, -22, 22, "#1f2933");
  circle(ctx, 46, -22, 22, "#1f2933");
  circle(ctx, -46, -22, 8, SILVER, INK, 2);
  circle(ctx, 46, -22, 8, SILVER, INK, 2);
  poly(ctx, [[-40, -30], [30, -30], [40, -56], [-20, -60]], "#c2412d");
  box(ctx, -36, -70, 40, 10, "#1f2933", { lw: 2, r: 4 });
  line(ctx, 40, -56, 52, -84, INK, 4);
  line(ctx, 46, -84, 60, -84, INK, 4);
}

function bicycle(ctx: Ctx) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  for (const x of [-40, 40]) {
    ctx.beginPath();
    ctx.arc(x, -26, 26, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#3d6fb8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-40, -26);
  ctx.lineTo(-6, -26);
  ctx.lineTo(24, -58);
  ctx.lineTo(-18, -58);
  ctx.closePath();
  ctx.moveTo(-6, -26);
  ctx.lineTo(-18, -64);
  ctx.moveTo(24, -58);
  ctx.lineTo(40, -26);
  ctx.moveTo(24, -58);
  ctx.lineTo(28, -72);
  ctx.stroke();
  box(ctx, -28, -70, 22, 6, "#1f2933", { lw: 2, r: 3 });
}

function cat(ctx: Ctx) {
  ctx.fillStyle = "#e8743b";
  ctx.beginPath();
  ctx.ellipse(0, -18, 26, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  circle(ctx, 24, -40, 14, "#e8743b");
  poly(ctx, [[14, -50], [18, -64], [24, -52]], "#e8743b", INK, 2);
  poly(ctx, [[26, -52], [32, -64], [36, -48]], "#e8743b", INK, 2);
  circle(ctx, 22, -42, 2, INK, null);
  circle(ctx, 30, -42, 2, INK, null);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-24, -20);
  ctx.quadraticCurveTo(-48, -30, -40, -52);
  ctx.stroke();
}

const carKind = (kind: Parameters<typeof car>[1]) => (ctx: Ctx) => car(ctx, kind, 0, -40, 1.9);

export const PROPS: PropDef[] = [
  { id: "samovar", label: "سماور", aliases: ["سماور"], mount: "table", layer: "front", big: false, draw: samovar },
  { id: "teapot", label: "قوری", aliases: ["قوری"], mount: "table", layer: "front", big: false, draw: teapot },
  { id: "hookah", label: "قلیان", aliases: ["قلیان"], mount: "floor", layer: "back", big: false, draw: hookah },
  { id: "table", label: "میز", aliases: ["میز", "سفره"], mount: "floor", layer: "front", big: false, draw: table },
  { id: "chair", label: "صندلی", aliases: ["صندلی"], mount: "floor", layer: "back", big: false, draw: chair },
  { id: "tv", label: "تلویزیون", aliases: ["تلویزیون", "تی‌وی"], mount: "floor", layer: "back", big: false, draw: tv },
  { id: "lamp", label: "آباژور", aliases: ["آباژور", "چراغ پایه‌دار"], mount: "floor", layer: "back", big: false, draw: lamp },
  { id: "plant", label: "گلدان", aliases: ["گلدان", "گیاه"], mount: "floor", layer: "back", big: false, draw: (c) => plant(c, 0, 0, 1.5) },
  { id: "flowers", label: "دسته گل", aliases: ["دسته گل", "دسته‌گل", "گل‌ها", "شاخه گل"], mount: "table", layer: "front", big: false, draw: flowers },
  { id: "cake", label: "کیک", aliases: ["کیک", "کیک تولد"], mount: "table", layer: "front", big: false, draw: cake },
  { id: "fruit", label: "ظرف میوه", aliases: ["ظرف میوه", "میوه"], mount: "table", layer: "front", big: false, draw: fruit },
  { id: "suitcase", label: "چمدان", aliases: ["چمدان", "ساک"], mount: "floor", layer: "back", big: false, draw: suitcase },
  { id: "tree", label: "درخت", aliases: ["درخت", "درختان", "چنار"], mount: "floor", layer: "back", big: true, draw: (c) => tree(c, 0, 0, 1.9) },
  { id: "cypress", label: "سرو", aliases: ["سرو", "درخت سرو"], mount: "floor", layer: "back", big: true, draw: (c) => cypress(c, 0, 0, 2.2) },
  { id: "bench", label: "نیمکت", aliases: ["نیمکت"], mount: "floor", layer: "back", big: false, draw: bench },
  { id: "streetlight", label: "تیر چراغ برق", aliases: ["تیر چراغ برق", "تیر برق", "چراغ برق"], mount: "floor", layer: "back", big: true, draw: streetlight },
  { id: "trash", label: "سطل زباله", aliases: ["سطل زباله", "سطل آشغال", "سطل"], mount: "floor", layer: "back", big: false, draw: trash },
  { id: "peykan", label: "پیکان", aliases: ["پیکان"], mount: "floor", layer: "back", big: true, draw: carKind("peykan") },
  { id: "pride", label: "پراید", aliases: ["پراید"], mount: "floor", layer: "back", big: true, draw: carKind("pride") },
  { id: "samand", label: "سمند", aliases: ["سمند"], mount: "floor", layer: "back", big: true, draw: carKind("samand") },
  { id: "taxi", label: "تاکسی", aliases: ["تاکسی"], mount: "floor", layer: "back", big: true, draw: carKind("taxi") },
  { id: "suv", label: "شاسی‌بلند", aliases: ["شاسی‌بلند", "شاسی بلند"], mount: "floor", layer: "back", big: true, draw: carKind("suv") },
  { id: "motorbike", label: "موتور", aliases: ["موتور", "موتورسیکلت", "موتورگازی"], mount: "floor", layer: "back", big: false, draw: motorbike },
  { id: "bicycle", label: "دوچرخه", aliases: ["دوچرخه"], mount: "floor", layer: "back", big: false, draw: bicycle },
  { id: "cat", label: "گربه", aliases: ["گربه"], mount: "floor", layer: "front", big: false, draw: cat },
];

export const PROP_IDS = PROPS.map((p) => p.id);

export function propDef(id: PropId): PropDef {
  return PROPS.find((p) => p.id === id) ?? PROPS[0];
}

/** بلندی سطح میز (برای اشیائی که روی میز گذاشته می‌شوند). */
const TABLE_TOP = 72;

/**
 * جای اشیائی که از سناریو آمده‌اند: اشیاء بزرگ کنار قاب، بقیه بین بازیگران؛
 * اشیاء رومیزی روی یک میز وسط قاب (اگر میزی نبود، اضافه می‌شود).
 */
export function placeProps(ids: PropId[]): PropPlacement[] {
  const unique = [...new Set(ids)];
  const needsTable = unique.some((id) => propDef(id).mount === "table");
  if (needsTable && !unique.includes("table")) unique.unshift("table");
  const out: PropPlacement[] = [];
  const bigSpots = [0.08, 0.93, 0.18, 0.83];
  const smallSpots = [0.5, 0.06, 0.94, 0.16, 0.86];
  const onTable = [0.47, 0.55, 0.41, 0.61];
  let big = 0;
  let small = 0;
  let top = 0;
  for (const id of unique) {
    if (out.length >= MAX_PROPS) break;
    const d = propDef(id);
    let x: number;
    if (id === "table") x = 0.51;
    else if (d.mount === "table") x = onTable[top++ % onTable.length];
    else if (d.big) x = bigSpots[big++ % bigSpots.length];
    else x = smallSpots[small++ % smallSpots.length];
    out.push({ id, x, layer: d.layer });
  }
  return out;
}

/**
 * کشیدن اشیاء یک لایه. `ground` خط زمین (پای بازیگران)، `scale` همان مقیاس بازیگران،
 * `scroll` جابه‌جایی پس‌زمینه هنگام راه رفتن (اشیاء همراه پس‌زمینه حرکت می‌کنند).
 */
export function drawProps(
  ctx: Ctx,
  props: PropPlacement[],
  layer: PropLayer,
  w: number,
  ground: number,
  scale: number,
  scroll: number,
) {
  const tableHere = props.some((p) => p.id === "table");
  const depth = layer === "back" ? 0.86 : 1.05;
  const y0 = layer === "back" ? ground - scale * 36 : ground + scale * 10;
  for (const p of props) {
    if (p.layer !== layer) continue;
    const d = propDef(p.id);
    const lift = d.mount === "table" && tableHere ? TABLE_TOP * scale * depth : 0;
    ctx.save();
    // با پس‌زمینه جابه‌جا می‌شود و مثل خود پس‌زمینه دوباره از آن طرف قاب می‌آید.
    const span = w * 1.3;
    const px = scroll ? ((((p.x * w - scroll + w * 0.15) % span) + span) % span) - w * 0.15 : p.x * w;
    ctx.translate(px, y0 - lift);
    ctx.scale(scale * depth, scale * depth);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    d.draw(ctx);
    ctx.restore();
  }
}
