import arabic from "@fontsource/vazirmatn/files/vazirmatn-arabic-800-normal.woff2?url";
import latin from "@fontsource/vazirmatn/files/vazirmatn-latin-800-normal.woff2?url";
let pending: Promise<void> | undefined;
/** Same font bytes in workers and on the page, including Persian glyphs. */
export function loadRenderFonts(): Promise<void> {
  pending ??= (async () => {
    const fonts =
      (globalThis as unknown as { fonts?: { add: (f: FontFace) => void } }).fonts ?? document.fonts;
    for (const [url, range] of [
      [arabic, "U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFF"],
      [latin, "U+0000-00FF"],
    ]) {
      const face = await new FontFace("Vazirmatn", `url(${url})`, {
        weight: "800",
        unicodeRange: range,
      }).load();
      fonts.add(face);
    }
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
