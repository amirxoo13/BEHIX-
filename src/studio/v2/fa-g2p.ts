/**
 * Persian (fa-IR) grapheme → phoneme → viseme, rule-based (pure; testable in Node).
 * Persian script omits short vowels, so this is a heuristic: diacritics are honoured when present,
 * otherwise a short vowel is inserted where Persian phonotactics need one (no word-initial clusters,
 * no CCC). Good enough for mouth shapes, not for speech synthesis.
 *
 * Phoneme → viseme table (LOCKED, rig-spec §4 / behix-audio SKILL §2):
 *   p b m → mbp · f v → fv · ɒ æ → ah · e (and final ه) → eh · i j → ee · o → oh · u → oo
 *   s z ʃ ʒ tʃ dʒ → sz · l r n t d → l · k g q ɣ x h ʔ → eh · wide = open vowel under emphasis/emotion
 */
import type { VisemeId, WordViseme } from "./viseme-timeline.ts";

export type Phoneme =
  | "p" | "b" | "m" | "f" | "v" | "ɒ" | "æ" | "e" | "i" | "j" | "o" | "u"
  | "s" | "z" | "ʃ" | "ʒ" | "tʃ" | "dʒ" | "l" | "r" | "n" | "t" | "d"
  | "k" | "g" | "q" | "ɣ" | "x" | "h" | "ʔ";

export const PHONEME_VISEME: Readonly<Record<Phoneme, VisemeId>> = {
  p: "mbp", b: "mbp", m: "mbp",
  f: "fv", v: "fv",
  ɒ: "ah", æ: "ah",
  e: "eh",
  i: "ee", j: "ee",
  o: "oh",
  u: "oo",
  s: "sz", z: "sz", ʃ: "sz", ʒ: "sz", tʃ: "sz", dʒ: "sz",
  l: "l", r: "l", n: "l", t: "l", d: "l",
  k: "eh", g: "eh", q: "eh", ɣ: "eh", x: "eh", h: "eh", ʔ: "eh",
};

const VOWELS = new Set<Phoneme>(["ɒ", "æ", "e", "i", "o", "u"]);
const LONG = new Set<Phoneme>(["ɒ", "i", "u"]);
const OPEN = new Set<Phoneme>(["ɒ", "æ"]);
export const isVowel = (p: Phoneme) => VOWELS.has(p);

/** Plain consonant letters. ه، و، ی، ا are context-dependent and handled in `faPhonemes`. */
const CONS: Record<string, Phoneme> = {
  "ب": "b", "پ": "p", "ت": "t", "ث": "s", "ج": "dʒ", "چ": "tʃ", "ح": "h", "خ": "x", "د": "d", "ذ": "z",
  "ر": "r", "ز": "z", "ژ": "ʒ", "س": "s", "ش": "ʃ", "ص": "s", "ض": "z", "ط": "t", "ظ": "z", "ع": "ʔ",
  "غ": "ɣ", "ف": "f", "ق": "q", "ک": "k", "ك": "k", "گ": "g", "ل": "l", "م": "m", "ن": "n",
  "ء": "ʔ", "ئ": "ʔ", "ؤ": "ʔ",
};
const FATHA = "\u064E", KASRA = "\u0650", DAMMA = "\u064F", SHADDA = "\u0651", SUKUN = "\u0652", TANWIN_FATH = "\u064B";
const DIACRITIC: Record<string, Phoneme[]> = { [FATHA]: ["æ"], [KASRA]: ["e"], [DAMMA]: ["o"], [TANWIN_FATH]: ["æ", "n"] };
const IGNORE = /\u200C|\u200D|\u0640|\u0670|\u0654|\u0655/g; // ZWNJ, ZWJ, tatweel, superscript alef, hamza marks

/** Normalised Persian word: Arabic yeh/kaf → Persian, ZWNJ/tatweel removed, punctuation stripped. */
export function normalizeFa(word: string): string {
  return word
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(IGNORE, "")
    .replace(/[^\u0600-\u06FF]|[\u060C\u061B\u061F\u06D4\u066A-\u066D\u06F0-\u06F9\u0660-\u0669]/g, "");
}

/**
 * Phonemes of one written Persian word. A ZWNJ splits stem and suffix (آماده‌ای، کتاب‌ها):
 * the stem's last ه counts as final, and the suffix starts without a glottal stop.
 */
export function faPhonemes(raw: string): Phoneme[] {
  const parts = raw.split("\u200C").filter((x) => normalizeFa(x));
  const out: Phoneme[] = [];
  parts.forEach((part, i) => out.push(...letters(part, i > 0)));
  return epenthesis(out);
}

function letters(raw: string, suffix: boolean): Phoneme[] {
  const w = [...normalizeFa(raw)];
  if (!w.length) return [];
  // standalone «و» (and) is /o/
  if (w.length === 1 && w[0] === "و") return ["o"];
  const out: Phoneme[] = [];
  const last = () => out[out.length - 1];
  const prevVowel = () => out.length > 0 && isVowel(last());
  // index of the next base letter (skipping diacritics)
  const nextLetter = (i: number) => {
    for (let k = i + 1; k < w.length; k++) if (!DIACRITIC[w[k]] && w[k] !== SHADDA && w[k] !== SUKUN) return w[k];
    return undefined;
  };
  const isFinal = (i: number) => nextLetter(i) === undefined;
  const vowelLetter = (c: string | undefined) => c === "ا" || c === "آ" || c === "و" || c === "ی";
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const first = out.length === 0 && !suffix;
    if (DIACRITIC[c]) {
      out.push(...DIACRITIC[c]);
      continue;
    }
    if (c === SUKUN) continue;
    if (c === SHADDA) {
      const p = last();
      if (p && !isVowel(p)) out.push(p);
      continue;
    }
    if (c === "آ") {
      if (first) out.push("ʔ");
      out.push("ɒ");
      continue;
    }
    if (c === "ا" || c === "أ" || c === "إ") {
      if (suffix && out.length === 0) {
        // suffix -ای /i/, -ام /æm/, -اش /æʃ/
        if (w[i + 1] === "ی") { out.push("i"); i++; } else out.push("æ");
        continue;
      }
      if (first) {
        out.push("ʔ");
        // initial «ای» /ʔi/ (ایران) and «او» /ʔu/ (او، اون)
        if (w[i + 1] === "ی") { out.push("i"); i++; continue; }
        if (w[i + 1] === "و") { out.push("u"); i++; continue; }
        const d = w[i + 1];
        if (!DIACRITIC[d]) out.push(c === "إ" ? "e" : "æ"); // initial bare alef: usually /æ/ (اسب، امروز)
      } else out.push("ɒ");
      continue;
    }
    if (c === "و") {
      // «خوا…» silent vav (خواب، خواهر)
      if (last() === "x" && nextLetter(i) === "ا") continue;
      // consonant /v/ at the start, after a vowel or before a vowel letter (وقت، دوا)؛ otherwise the vowel /u/ (دور، تو)
      if (first || prevVowel() || vowelLetter(nextLetter(i)) || DIACRITIC[w[i + 1]]) out.push("v");
      else out.push("u");
      continue;
    }
    if (c === "ی") {
      if (suffix && out.length === 0 && w.length === 1) out.push("i");
      else if (first || prevVowel()) out.push("j");
      else if (nextLetter(i) === "ا" || nextLetter(i) === "و") out.push("i", "j");
      else out.push("i");
      continue;
    }
    if (c === "ه") {
      // final ه after a consonant is the vowel /e/ (خانه، مدرسه); otherwise /h/
      if (isFinal(i) && out.length > 0 && !prevVowel()) out.push("e");
      else out.push("h");
      continue;
    }
    const p = CONS[c];
    if (!p) continue;
    out.push(p);
  }
  return out;
}

/** Insert unwritten short vowels: /æ/ after a word-initial consonant (no initial clusters), /e/ to break CCC. */
function epenthesis(ph: Phoneme[]): Phoneme[] {
  const out: Phoneme[] = [];
  for (let i = 0; i < ph.length; i++) {
    const a = ph[i], b = ph[i + 1];
    out.push(a);
    if (b === undefined || isVowel(a) || isVowel(b)) continue;
    if (out.length === 1) out.push("æ");
    else if (!isVowel(out[out.length - 2])) out.push("e");
  }
  return out;
}

/**
 * Visemes of a word: consecutive identical ids are merged (the longer flag wins).
 * emphasis (strong emphasis or an emotion tag) turns open vowels (ɒ æ) into `wide`.
 */
export function wordVisemes(word: string, opts: { emphasis?: boolean } = {}): WordViseme[] {
  const out: WordViseme[] = [];
  for (const p of faPhonemes(word)) {
    const id: VisemeId = opts.emphasis && OPEN.has(p) ? "wide" : PHONEME_VISEME[p];
    const prev = out[out.length - 1];
    if (prev && prev.id === id) {
      prev.long ||= LONG.has(p);
      continue;
    }
    out.push({ id, weight: 1, long: LONG.has(p) });
  }
  return out;
}

export type ScriptWord = { text: string; norm: string; emphasis: boolean };

/** Words of a line, in order. «!» right after a word marks it emphasised. Words without Persian letters are dropped. */
export function scriptWords(text: string): ScriptWord[] {
  const out: ScriptWord[] = [];
  for (const m of text.matchAll(/\S+/g)) {
    const tok = m[0];
    const norm = normalizeFa(tok).replace(/[\u064B-\u0652]/g, "");
    if (!norm) {
      if (/[!！]/.test(tok) && out.length) out[out.length - 1].emphasis = true;
      continue;
    }
    out.push({ text: tok.replace(/^[«"'([]+|[»"')\].,،؛;:!?؟…]+$/g, ""), norm, emphasis: /[!！]/.test(tok) });
  }
  return out;
}
