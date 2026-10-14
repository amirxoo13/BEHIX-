/** Fields that make a rendered file stale if they change during export. */
export type ExportSnap = {
  shots: unknown;
  aspect: unknown;
  title: string;
  logline: string;
  genre: string;
  showRig: boolean;
  audioUrls: unknown;
};

export function exportSnapOf(s: ExportSnap): ExportSnap {
  return {
    shots: s.shots,
    aspect: s.aspect,
    title: s.title,
    logline: s.logline,
    genre: s.genre,
    showRig: s.showRig,
    audioUrls: s.audioUrls,
  };
}

export function exportSnapChanged(before: ExportSnap, after: ExportSnap): boolean {
  return (
    before.shots !== after.shots ||
    before.aspect !== after.aspect ||
    before.title !== after.title ||
    before.logline !== after.logline ||
    before.genre !== after.genre ||
    before.showRig !== after.showRig ||
    before.audioUrls !== after.audioUrls
  );
}
