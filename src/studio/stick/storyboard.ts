/**
 * برگهٔ استوری‌بورد (مثل خروجی storyboard در Animation Desk و نمای Plot در Plotagon):
 * از وسط هر بخش داستان یک قاب برداشته می‌شود و همه با شماره، زمان و متن، روی یک تصویر PNG چیده می‌شوند.
 * چیدمان راست‌به‌چپ است؛ قاب اول بالا-راست.
 */
import { frameFor, type Format } from "./layout.ts";
import { makePaper } from "./paper.ts";
import { renderStory } from "./story-render.ts";
import type { BeatTiming, Directed } from "./story-direct.ts";

export const STORYBOARD_MAX = 36;

export type BoardCell = { beat: BeatTiming; no: number; t: number; x: number; y: number; w: number; h: number };
export type BoardLayout = { width: number; height: number; header: number; pad: number; textH: number; cells: BoardCell[] };

/** اگر بخش‌ها زیاد باشند، به‌طور یکنواخت نمونه برداشته می‌شود (اولی و آخری همیشه هستند). */
export function pickBeats<T>(items: T[], max = STORYBOARD_MAX): T[] {
  if (items.length <= max) return items;
  return Array.from({ length: max }, (_, i) => items[Math.round((i * (items.length - 1)) / (max - 1))]);
}

/** چیدمان برگه؛ تابع خالص تا بدون مرورگر آزمون شود. */
export function storyboardLayout(beats: BeatTiming[], format: Format): BoardLayout {
  const picked = pickBeats(beats);
  const frame = frameFor(format);
  const cols = format === "portrait" ? 4 : 3;
  const w = format === "portrait" ? 360 : 480;
  const h = Math.round((w * frame.h) / frame.w);
  const textH = 118, gap = 24, pad = 48, header = 120;
  const rows = Math.max(1, Math.ceil(picked.length / cols));
  const width = pad * 2 + cols * w + (cols - 1) * gap;
  const height = header + rows * (h + textH) + (rows - 1) * gap + pad;
  const cells = picked.map((beat, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    return {
      beat,
      no: beats.indexOf(beat) + 1,
      t: (beat.from + beat.to) / 2,
      x: width - pad - (col + 1) * w - col * gap,
      y: header + row * (h + textH + gap),
      w,
      h,
    };
  });
  return { width, height, header, pad, textH, cells };
}

const faDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
const clock = (sec: number) => faDigits(`${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`);

/** شکستن متن به حداکثر چند سطر با اندازه‌گیری واقعی فونت. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (measure(next) <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) {
      lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** ساخت تصویر PNG برگهٔ استوری‌بورد در مرورگر. */
export async function renderStoryboard(directed: Directed, format: Format, title: string, names: Record<string, string>): Promise<Blob> {
  // فونت با import پویا: آزمون‌های Node فایل woff2 را بار نمی‌کنند
  const { loadRenderFonts } = await import("./fonts.ts");
  await loadRenderFonts();
  const layout = storyboardLayout(directed.beats, format);
  if (!layout.cells.length) throw new Error("داستان هنوز بخشی ندارد.");
  const frame = frameFor(format);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت تصویر ممکن نشد.");
  const paper = makePaper(frame.w, frame.h);
  try {
    ctx.fillStyle = "#f4f2ec";
    ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#14161f";
    ctx.font = "800 44px Vazirmatn";
    ctx.fillText(title, layout.width - layout.pad, 74);
    ctx.font = "800 22px Vazirmatn";
    ctx.fillStyle = "#6b6f80";
    ctx.textAlign = "left";
    ctx.fillText(`استوری‌بورد · ${faDigits(String(directed.beats.length))} بخش · ${clock(directed.timeline.duration)}`, layout.pad, 74);
    for (const cell of layout.cells) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(cell.x, cell.y, cell.w, cell.h);
      ctx.clip();
      ctx.translate(cell.x, cell.y);
      ctx.scale(cell.w / frame.w, cell.h / frame.h);
      renderStory(ctx, directed.timeline, Math.min(cell.t, directed.timeline.duration - 0.001), paper, { captions: false, format });
      ctx.restore();
      ctx.strokeStyle = "#14161f";
      ctx.lineWidth = 3;
      ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
      // شماره و زمان
      const right = cell.x + cell.w;
      ctx.fillStyle = "#14161f";
      ctx.fillRect(right - 64, cell.y + cell.h + 14, 64, 34);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "800 22px Vazirmatn";
      ctx.fillText(faDigits(String(cell.no)), right - 32, cell.y + cell.h + 39);
      ctx.textAlign = "left";
      ctx.fillStyle = "#6b6f80";
      ctx.font = "800 18px Vazirmatn";
      ctx.fillText(clock(cell.beat.from), cell.x, cell.y + cell.h + 39);
      ctx.textAlign = "right";
      ctx.fillStyle = "#14161f";
      ctx.font = "800 20px Vazirmatn";
      const who = cell.beat.speaker ? `${names[cell.beat.speaker] ?? cell.beat.speaker}: ` : cell.beat.kind === "narration" ? "راوی: " : "";
      const lines = wrapLines(`${who}${cell.beat.text}`, cell.w - 150, (s) => ctx.measureText(s).width);
      lines.forEach((line, i) => ctx.fillText(line, right - 76, cell.y + cell.h + 38 + i * 30));
    }
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("ساخت تصویر ممکن نشد."))), "image/png"));
  } finally {
    canvas.width = 1;
    canvas.height = 1;
    paper.width = 1;
    paper.height = 1;
  }
}
