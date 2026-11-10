/**
 * کشیدن شخصیتِ کیت Gemini روی اسکلت خود موتور BEHIX (rig.ts → BodyPose).
 * زاویه‌ها از موتور می‌آید و طول‌ها از خود نقاشی (با یک مقیاس واحد)، پس تکه‌ها همیشه به هم وصل‌اند
 * و تناسب نقاشی خراب نمی‌شود. اندام سمت چپ قاب = دست/پای راستِ شخصیت (نقاشی اصلی)، سمت دیگر قرینه.
 */
import { RIG, type BodyPose, type Limb, type Pt } from "../rig.ts";
import type { CharacterKit, KitEnd, KitImage, KitLimb, KitMouth } from "./kit.ts";

export type KitFace = { mouth: KitMouth; blink: boolean };
export type ImageLoader = (src: string) => CanvasImageSource | null;

const len = (p: Pt, q: Pt) => Math.hypot(q.x - p.x, q.y - p.y);
const ang = (p: Pt, q: Pt) => Math.atan2(q.y - p.y, q.x - p.x);

/** مقیاس واحد: پای نقاشی (ران + ساق + مچ تا کف کفش) تقریباً همان ارتفاع لگن اسکلت؛ پا در نمای روبه‌رو تقریباً صاف است. */
export function kitScale(kit: CharacterKit): number {
  const legPx = len(kit.thigh.a, kit.thigh.b) + len(kit.shin.a, kit.shin.b) + (kit.foot.h - kit.foot.a.y) * 0.75;
  return (-RIG.hipY * 0.995) / legPx;
}

/** یک تکه: مفصل a روی نقطهٔ `at`، محور a→b در جهت زاویهٔ `dir`. */
function limb(ctx: CanvasRenderingContext2D, img: CanvasImageSource, part: KitLimb, at: Pt, dir: number, s: number, mirror: boolean): Pt {
  const own = ang(part.a, part.b);
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(dir - own);
  ctx.scale(s * (mirror ? -1 : 1), s);
  // قرینه حول محور خود تکه: محور a→b تقریباً عمودی است، پس x نسبت به a برعکس می‌شود
  ctx.drawImage(img, -part.a.x, -part.a.y, part.w, part.h);
  ctx.restore();
  const l = len(part.a, part.b) * s;
  return { x: at.x + Math.cos(dir) * l, y: at.y + Math.sin(dir) * l };
}

/**
 * IK دو استخوانی با طول‌های خود نقاشی: از `root` به سمت `target`، مفصل وسط به سمت `bend` (۱ یا ۱-) خم می‌شود.
 * اگر هدف دورتر از طول کل باشد، عضو صاف به سمت هدف کشیده می‌شود.
 */
export function ik(root: Pt, target: Pt, l1: number, l2: number, bend: number): { mid: Pt; a1: number; a2: number } {
  const dx = target.x - root.x, dy = target.y - root.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3);
  const base = Math.atan2(dy, dx);
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const a1 = base - bend * Math.acos(Math.max(-1, Math.min(1, cosA)));
  const mid = { x: root.x + Math.cos(a1) * l1, y: root.y + Math.sin(a1) * l1 };
  const tx = root.x + Math.cos(base) * d, ty = root.y + Math.sin(base) * d;
  return { mid, a1, a2: Math.atan2(ty - mid.y, tx - mid.x) };
}

function end(ctx: CanvasRenderingContext2D, img: CanvasImageSource, part: KitEnd, at: Pt, rot: number, s: number, mirror: boolean) {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.rotate(rot);
  ctx.scale(s * (mirror ? -1 : 1), s);
  ctx.drawImage(img, -part.a.x, -part.a.y, part.w, part.h);
  ctx.restore();
}

/**
 * کل شخصیت در مختصات اسکلت (پا روی y=0). ctx باید از قبل به جای بازیگر و مقیاس صحنه منتقل شده باشد.
 * برمی‌گرداند false اگر هنوز تصویری بار نشده.
 */
export function drawKitActor(ctx: CanvasRenderingContext2D, kit: CharacterKit, pose: BodyPose, face: KitFace, load: ImageLoader): boolean {
  const im = (p: KitImage) => load(p.src);
  const parts = [kit.torso, kit.upperArm, kit.forearm, kit.hand, kit.thigh, kit.shin, kit.foot, kit.head].map(im);
  if (parts.some((p) => !p)) return false;
  const [torsoI, upperI, foreI, handI, thighI, shinI, footI, headI] = parts as CanvasImageSource[];
  const s = kitScale(kit);
  const t = kit.torso;
  // لگن نقاشی روی لگن اسکلت؛ شانه و گردن از خود نقاشی
  const hipMid = { x: (pose.left.hip.x + pose.right.hip.x) / 2, y: (pose.left.hip.y + pose.right.hip.y) / 2 };
  const cx = t.w / 2;
  const toBody = (p: Pt): Pt => ({ x: hipMid.x + (p.x - cx) * s, y: hipMid.y + (p.y - t.hip.y) * s });
  const shoulderOf = (side: number) => toBody({ x: cx + side * Math.abs(t.shoulder.x - cx), y: t.shoulder.y });
  const hipOf = (side: number) => toBody({ x: cx + side * Math.abs(t.hip.x - cx), y: t.hip.y });

  const L = (p: KitLimb) => len(p.a, p.b) * s;
  // پا: کف پا همان جای موتور (روی زمین، با قدم راه رفتن)، زانو با طول‌های نقاشی کمی به جلو/بیرون
  const leg = (l: Limb, side: number) => {
    const mirror = side > 0;
    const hip = hipOf(side);
    const ankleLift = (kit.foot.h - kit.foot.a.y) * 0.75 * s;
    // کیت فعلاً فقط نمای روبه‌رو دارد: در راه رفتنِ نیم‌رخ، جابه‌جایی جلو/عقب پا کوچک می‌شود و فقط بالا آمدن پا می‌ماند
    const fx = (l.foot.x - l.hip.x) * (pose.profile ? 0.15 : 0.8);
    const target = { x: hip.x + fx, y: l.foot.y - ankleLift };
    const k = ik(hip, target, L(kit.thigh), L(kit.shin), side);
    const knee = limb(ctx, thighI, kit.thigh, hip, k.a1, s, mirror);
    const ankle = limb(ctx, shinI, kit.shin, knee, k.a2, s, mirror);
    end(ctx, footI, kit.foot, ankle, 0, s, mirror);
  };
  // دست: جهت و فاصلهٔ دست از شانه از موتور؛ برای دستِ آویزان، باز شدن به پهلو کم می‌شود تا حالت طبیعی بماند
  const arm = (l: Limb, side: number) => {
    const mirror = side > 0;
    const sh = shoulderOf(side);
    const reach = L(kit.upperArm) + L(kit.forearm);
    let rx = l.hand.x - l.shoulder.x;
    const ry = l.hand.y - l.shoulder.y;
    if (pose.profile) rx *= 0.25;
    const hanging = ry > Math.abs(rx);
    if (hanging) rx *= 0.4;
    const k0 = reach / (RIG.upper + RIG.fore);
    let tx = rx * k0, ty = ry * k0;
    // دست آویزان تقریباً صاف (آرنج کمی خم)، نه حالت آماده‌باش
    if (hanging) { const d = Math.hypot(tx, ty) || 1; tx = (tx / d) * reach * 0.96; ty = (ty / d) * reach * 0.96; }
    const target = { x: sh.x + tx, y: sh.y + ty };
    const k = ik(sh, target, L(kit.upperArm), L(kit.forearm), side);
    const elbow = limb(ctx, upperI, kit.upperArm, sh, k.a1, s, mirror);
    const wrist = limb(ctx, foreI, kit.forearm, elbow, k.a2, s, mirror);
    end(ctx, handI, kit.hand, wrist, k.a2 - Math.PI / 2, s, mirror);
  };

  ctx.save();
  // سایهٔ زیر پا
  ctx.fillStyle = "rgba(18,16,12,0.22)";
  ctx.beginPath();
  ctx.ellipse(hipMid.x, 4, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  leg(pose.left, -1);
  leg(pose.right, 1);
  // تنه با چرخش کم دور لگن
  ctx.save();
  ctx.translate(hipMid.x, hipMid.y);
  ctx.rotate((pose.torso * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.drawImage(torsoI, -cx, -t.hip.y, t.w, t.h);
  ctx.restore();
  // سر روی گردن تنه
  const neck = toBody(t.neck);
  const h = kit.head;
  ctx.save();
  ctx.translate(neck.x, neck.y);
  ctx.rotate((pose.head * Math.PI) / 180);
  const hs = s * headScale(kit);
  ctx.scale(hs, hs);
  ctx.translate(-h.neck.x, -h.neck.y);
  ctx.drawImage(headI, 0, 0, h.w, h.h);
  const m = kit.mouths[face.mouth] ?? kit.mouths.rest;
  const mi = load(m.src);
  if (mi) {
    const mw = h.mouth.w, mh = (m.h / m.w) * mw;
    ctx.drawImage(mi, h.mouth.x - mw / 2, h.mouth.y - mh / 2, mw, mh);
  }
  if (face.blink && kit.blink) {
    const bi = load(kit.blink.src);
    const e = h.eyes;
    if (bi && e.length === 2) {
      const x0 = Math.min(e[0].x, e[1].x) - e[0].w * 0.15, x1 = Math.max(e[0].x + e[0].w, e[1].x + e[1].w) + e[1].w * 0.15;
      const bw = x1 - x0, bh = (kit.blink.h / kit.blink.w) * bw, cy = (e[0].y + e[0].h / 2 + e[1].y + e[1].h / 2) / 2;
      ctx.drawImage(bi, x0, cy - bh / 2, bw, bh);
    }
  }
  ctx.restore();
  arm(pose.left, -1);
  arm(pose.right, 1);
  ctx.restore();
  return true;
}

/** سر نسبت به بدن (نقاشی‌ها جدا کشیده شده‌اند): پهنای سر حدود ۰٫۷۸ پهنای تنه، مثل کارتون‌های تلویزیونی. */
export function headScale(kit: CharacterKit): number {
  return (0.78 * kit.torso.w) / kit.head.w;
}
