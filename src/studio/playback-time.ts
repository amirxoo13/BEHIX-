/** Shared film-relative clock: wall-clock origin must not change motion phase. */
export function filmTime(now: number, start: number): number {
  return Math.max(0, (now - start) / 1000);
}
