export function fa(n: number) {
  return n.toLocaleString("fa-IR");
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${fa(m)}:${fa(r).padStart(2, "۰")}`;
}
