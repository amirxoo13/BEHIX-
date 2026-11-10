import { findChar } from "./characters";
import { totalDuration } from "./frame";
import { fa, clock } from "./format";
import { WORLD } from "./labels";
import type { Shot } from "./types";

export const PHASES = [
  {
    to: "/scenario",
    no: "01",
    label: "سناریو",
    en: "SCRIPT",
    lede: "اول داستان را بنویسید. هر نما یک صحنه است: سرصحنه، شرح تصویر، دیالوگ.",
  },
  {
    to: "/cast",
    no: "02",
    label: "شخصیت",
    en: "CAST",
    lede: "بازیگر هر قاب را از روی همین سناریو انتخاب کنید. طراحی چهره همان کسی است که حرف می‌زند.",
  },
  {
    to: "/world",
    no: "03",
    label: "فضا",
    en: "WORLD",
    lede: "مکان هر صحنه را ببندید. دکوپاژ و دوربین بعد از این می‌آیند.",
  },
  {
    to: "/board",
    no: "04",
    label: "دکوپاژ",
    en: "BOARDS",
    lede: "اندازهٔ نما، زمان و ترتیب مونتاژ. متن را اینجا عوض نکنید؛ آن مال سناریو است.",
  },
  {
    to: "/stage",
    no: "05",
    label: "انیمیت",
    en: "ANIMATE",
    lede: "حس چهره و حرکت بدن را روی نمای انتخاب‌شده اجرا کنید و کل فیلم را ببینید.",
  },
  {
    to: "/sound",
    no: "06",
    label: "صدا",
    en: "SOUND",
    lede: "گفتار را روی همان نما ضبط کنید و افکت را به تصویر وصل کنید، نه به یک لیست جدا.",
  },
  {
    to: "/deliver",
    no: "07",
    label: "خروجی",
    en: "DELIVER",
    lede: "قطع تصویر را انتخاب کنید، یک‌بار کامل ببینید، بعد فایل ویدیو را بگیرید.",
  },
] as const;

export type PhaseTo = (typeof PHASES)[number]["to"];

export const FLOW = [{ to: "/photo", label: "پروژه" }, ...PHASES.map((p) => ({ to: p.to, label: p.label }))] as const;

export function phaseStatus(to: string, shots: Shot[], audioUrls: Record<string, string>) {
  if (to === "/scenario") {
    const ready = shots.filter((s) => s.heading.trim() && (s.dialogue.trim() || s.actionLine.trim())).length;
    return `${fa(ready)} از ${fa(shots.length)} نما نوشته شده`;
  }
  if (to === "/cast") {
    const names = [
      ...new Set(shots.flatMap((s) => [s.actorA, s.actorB, ...s.extras].map((x) => findChar(x.charId).name))),
    ];
    return names.join("، ");
  }
  if (to === "/world") {
    const places = [...new Set(shots.map((s) => WORLD[s.background].place))];
    return places.join("، ");
  }
  if (to === "/board") return `${fa(shots.length)} نما در ترتیب مونتاژ`;
  if (to === "/stage") return "بازی و دوربین روی صحنه";
  if (to === "/sound") {
    const n = shots.filter((s) => audioUrls[s.id]).length;
    return n ? `${fa(n)} نما صدا دارد` : "گفتار هنوز ضبط نشده";
  }
  if (to === "/deliver") return clock(totalDuration(shots));
  return "";
}
