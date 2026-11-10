import type { Ctx } from "./figure-base.ts";
import type { Env, PlaceDef } from "./places.ts";
export type ExtraPlaceId =
  "hospital" | "shop" | "elevator" | "metro" | "bus" | "roof" | "yard" | "wedding";
const line = (c: Ctx, x: number, y: number, x2: number, y2: number, w = 4) => {
  c.strokeStyle = "#141414";
  c.lineWidth = w;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x2, y2);
  c.stroke();
};
const box = (c: Ctx, x: number, y: number, w: number, h: number, fill = "white", r = 8) => {
  c.fillStyle = fill;
  c.strokeStyle = "#141414";
  c.lineWidth = 4;
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fill();
  c.stroke();
};
const circle = (c: Ctx, x: number, y: number, r: number, fill = "white") => {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
};
const label = (c: Ctx, s: string, x: number, y: number, size = 34) => {
  c.fillStyle = "#141414";
  c.font = `800 ${size}px Vazirmatn`;
  c.direction = "rtl";
  c.textAlign = "center";
  c.fillText(s, x, y);
};
function room(c: Ctx, e: Env) {
  c.fillStyle = e.fill;
  c.fillRect(0, 180, 1080, e.floor - 180);
  line(c, 0, e.floor, 1080, e.floor, 5);
  line(c, 0, 230, 1080, 230, 3);
  for (let x = -1080; x < 2160; x += 180) line(c, 540 + (x - 540) * 0.65, e.floor, x, e.h, 1.6);
  for (let y = e.floor + 110; y < e.h; y += 170) line(c, 0, y, 1080, y, 1.4);
}
function windowPane(c: Ctx, e: Env, x: number, y: number, w: number, h: number) {
  box(c, x, y, w, h, e.night ? "#444" : "#eee", 12);
  for (let i = 0; i < 4; i++) {
    const shift = (e.t * 30 + i * 91) % w;
    box(c, x + shift, y + h * 0.6, Math.min(40, w - shift), h * 0.4, e.night ? "#777" : "#ccc", 0);
  }
  line(c, x + w / 2, y, x + w / 2, y + h, 3);
}
function plant(c: Ctx, x: number, y: number) {
  box(c, x - 27, y - 55, 54, 55, "#ddd", 6);
  line(c, x, y - 55, x, y - 170, 3);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(x + side * 22, y - 85 - i * 28, 28, 10, side * 0.5, 0, Math.PI * 2);
      c.fillStyle = "white";
      c.fill();
      c.stroke();
    }
}
function seat(c: Ctx, e: Env, x: number, width = 200) {
  box(c, x - width / 2, e.seatTop - 230, width, 235, e.fill, 22);
  box(c, x - width / 2 - 8, e.seatTop, width + 16, 30, "#ddd", 12);
  for (const s of [-1, 1])
    line(c, x + s * width * 0.35, e.seatTop + 30, x + s * width * 0.35, e.floor, 7);
}
function outside(c: Ctx, e: Env) {
  c.fillStyle = e.night ? "#555" : "#f6f6f6";
  c.fillRect(0, 180, 1080, e.floor - 180);
  circle(c, 850, 350, 48, e.night ? "white" : "#ddd");
  for (let i = 0; i < 8; i++) box(c, i * 155 - 30, 620 + (i % 3) * 60, 130, 420, "#ddd", 0);
  line(c, 0, e.floor, 1080, e.floor, 5);
}
export const EXTRA_PLACES: Record<ExtraPlaceId, PlaceDef> = {
  hospital: {
    id: "hospital",
    label: "بیمارستان",
    aliases: ["درمانگاه", "بیمارستان", "مطب"],
    interior: true,
    seats: [0.3, 0.7],
    spots: [0.3, 0.7],
    back(c, e) {
      room(c, e);
      box(c, 100, 310, 880, 110);
      label(c, "درمانگاه", 540, 384, 48);
      line(c, 830, 337, 830, 394, 13);
      line(c, 802, 366, 858, 366, 13);
      box(c, 65, 500, 220, 400, e.fill);
      line(c, 175, 500, 175, 900);
      circle(c, 156, 720, 5);
      circle(c, 194, 720, 5);
      box(c, 790, 540, 160, 120, "#ddd");
      line(c, 805, 605, 835, 605);
      line(c, 835, 605, 850, 565);
      line(c, 850, 565, 867, 635);
      line(c, 867, 635, 883, 605);
      line(c, 883, 605, 934, 605);
      seat(c, e, 324);
      seat(c, e, 756);
      plant(c, 995, e.floor);
    },
  },
  shop: {
    id: "shop",
    label: "مغازه",
    aliases: ["فروشگاه", "سوپرمارکت", "مغازه"],
    interior: true,
    seats: [],
    spots: [0.3, 0.7],
    back(c, e) {
      room(c, e);
      label(c, "فروشگاه", 540, 350, 52);
      for (let y = 520; y <= 900; y += 190) {
        box(c, 70, y, 940, 18, "#aaa", 2);
        for (let x = 110; x < 1000; x += 96) {
          box(c, x, y - 105, 50, 100, x % 3 ? e.fill : "#ddd");
          line(c, x + 10, y - 70, x + 40, y - 70, 2);
        }
      }
      box(c, 60, 1020, 220, 300, e.fill);
      box(c, 95, 950, 140, 65, "#ddd");
      label(c, "خرید", 170, 1180);
    },
  },
  elevator: {
    id: "elevator",
    label: "آسانسور",
    aliases: ["آسانسور", "بالابر"],
    interior: true,
    seats: [],
    spots: [0.35, 0.65],
    back(c, e) {
      room(c, e);
      box(c, 190, 370, 700, e.floor - 370, "#dedede", 4);
      line(c, 540, 370, 540, e.floor, 5);
      box(c, 440, 265, 200, 75, "#eee");
      label(c, "↑  ۳", 540, 318, 38);
      box(c, 950, 660, 60, 200, e.fill);
      for (let y = 700; y < 840; y += 45) circle(c, 980, y, 10);
      line(c, 220, 1050, 860, 1050, 8);
    },
  },
  metro: {
    id: "metro",
    label: "مترو",
    aliases: ["مترو", "قطار شهری", "واگن"],
    interior: true,
    seats: [0.27, 0.73],
    spots: [0.27, 0.73],
    back(c, e) {
      room(c, e);
      windowPane(c, e, 55, 410, 380, 320);
      windowPane(c, e, 645, 410, 380, 320);
      box(c, 455, 390, 170, 760, e.fill, 2);
      line(c, 540, 390, 540, 1150, 3);
      label(c, "ایستگاه بعد", 540, 320);
      seat(c, e, 292, 290);
      seat(c, e, 788, 290);
      line(c, 30, 300, 1050, 300, 8);
      for (let x = 140; x < 1080; x += 200) {
        line(c, x, 300, x, 390, 4);
        circle(c, x, 415, 23);
      }
    },
    front(c, e) {
      line(c, 70, 300, 70, e.floor, 7);
      line(c, 1010, 300, 1010, e.floor, 7);
    },
  },
  bus: {
    id: "bus",
    label: "اتوبوس",
    aliases: ["اتوبوس", "داخل اتوبوس"],
    interior: true,
    seats: [0.3, 0.7],
    spots: [0.3, 0.7],
    back(c, e) {
      room(c, e);
      for (const x of [60, 590]) windowPane(c, e, x, 400, 430, 340);
      label(c, "اتوبوس شهری", 540, 300, 42);
      seat(c, e, 324, 240);
      seat(c, e, 756, 240);
      for (const x of [80, 1000]) line(c, x, 280, x, e.floor, 7);
      for (let x = 200; x < 1000; x += 180) {
        line(c, x, 290, x, 370, 4);
        circle(c, x, 389, 18);
      }
    },
  },
  roof: {
    id: "roof",
    label: "پشت‌بام",
    aliases: ["پشت بام", "پشت‌بام", "روی بام"],
    interior: false,
    seats: [],
    spots: [0.3, 0.7],
    back(c, e) {
      outside(c, e);
      box(c, 0, 1050, 1080, 290, e.fill, 0);
      for (let x = 0; x < 1080; x += 140) line(c, x, 1050, x, 1340, 2);
      box(c, 55, 850, 230, 200, "#ddd");
      for (let y = 880; y < 1010; y += 24) line(c, 80, y, 255, y, 3);
      line(c, 920, 520, 920, 1050, 6);
      for (let y = 580; y < 750; y += 45) line(c, 860, y, 980, y, 4);
      plant(c, 1020, e.floor);
    },
  },
  yard: {
    id: "yard",
    label: "حیاط",
    aliases: ["حیاط", "حیاط خانه"],
    interior: false,
    seats: [0.3, 0.7],
    spots: [0.3, 0.7],
    back(c, e) {
      outside(c, e);
      box(c, 150, 420, 780, 600, e.fill, 2);
      box(c, 450, 660, 180, 360, "#ddd", 8);
      for (const x of [225, 700]) windowPane(c, { ...e, t: 0 }, x, 540, 150, 200);
      for (let x = 30; x < 1080; x += 110) {
        line(c, x, 900, x, 1080, 8);
        line(c, x, 930, x + 100, 930, 4);
      }
      seat(c, e, 324, 230);
      seat(c, e, 756, 230);
      plant(c, 75, e.floor);
      plant(c, 1005, e.floor);
    },
  },
  wedding: {
    id: "wedding",
    label: "سالن عروسی",
    aliases: ["عروسی", "تالار", "سالن عروسی"],
    interior: true,
    seats: [0.3, 0.7],
    spots: [0.3, 0.7],
    back(c, e) {
      room(c, e);
      c.beginPath();
      c.moveTo(150, 1100);
      c.lineTo(150, 650);
      c.bezierCurveTo(150, 240, 930, 240, 930, 650);
      c.lineTo(930, 1100);
      c.lineWidth = 12;
      c.stroke();
      for (let i = 0; i < 13; i++) {
        const a = Math.PI + (i * Math.PI) / 12;
        circle(c, 540 + 390 * Math.cos(a), 650 + 300 * Math.sin(a), 22, e.fill);
      }
      label(c, "پیوندتان مبارک", 540, 620, 44);
      seat(c, e, 324, 240);
      seat(c, e, 756, 240);
      line(c, 540, 230, 540, 310, 4);
      for (const x of [450, 540, 630]) {
        line(c, 540, 310, x, 360, 4);
        circle(c, x, 380, 16);
      }
      plant(c, 100, e.floor);
      plant(c, 980, e.floor);
    },
  },
};
