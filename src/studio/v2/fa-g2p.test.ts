import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { faPhonemes, normalizeFa, PHONEME_VISEME, scriptWords, wordVisemes } from "./fa-g2p.ts";

const ph = (w: string) => faPhonemes(w).join("");
const vis = (w: string, emphasis = false) => wordVisemes(w, { emphasis }).map((v) => v.id).join(" ");

describe("fa-g2p phoneme table (locked)", () => {
  it("maps every phoneme exactly as rig-spec §4", () => {
    const want: Record<string, string> = {
      p: "mbp", b: "mbp", m: "mbp", f: "fv", v: "fv", ɒ: "ah", æ: "ah", e: "eh", i: "ee", j: "ee", o: "oh", u: "oo",
      s: "sz", z: "sz", ʃ: "sz", ʒ: "sz", tʃ: "sz", dʒ: "sz", l: "l", r: "l", n: "l", t: "l", d: "l",
      k: "eh", g: "eh", q: "eh", ɣ: "eh", x: "eh", h: "eh", ʔ: "eh",
    };
    assert.deepEqual({ ...PHONEME_VISEME }, want);
  });
});

describe("fa-g2p words", () => {
  it("common words", () => {
    assert.equal(ph("سلام"), "sælɒm");
    assert.equal(ph("امروز"), "ʔæmruz");
    assert.equal(ph("کتاب"), "kætɒb");
    assert.equal(ph("مدرسه"), "mædrese");
    assert.equal(ph("ایران"), "ʔirɒn");
    assert.equal(ph("شیر"), "ʃir");
  });
  it("final ه is /e/ (→ eh); medial ه is /h/", () => {
    assert.equal(ph("خانه"), "xɒne");
    assert.ok(vis("خانه").endsWith("eh"));
    assert.equal(ph("شهر"), "ʃæhr");
  });
  it("و: standalone /o/, silent in خوا, vowel /u/ after a consonant, /v/ at the start", () => {
    assert.equal(ph("و"), "o");
    assert.equal(ph("خواب"), "xɒb");
    assert.equal(ph("دور"), "dur");
    assert.equal(ph("وقت"), "væqt");
  });
  it("ی: /j/ at the start or after a vowel, /i/ otherwise", () => {
    assert.equal(ph("یک"), "jæk");
    assert.equal(ph("میز"), "miz");
    assert.equal(ph("پاییز"), "pɒjiz");
  });
  it("diacritics and ZWNJ suffixes", () => {
    assert.equal(ph("بُرد"), "bord", "damma → o → oh");
    assert.equal(vis("بُرد"), "mbp oh l");
    assert.equal(ph("آماده\u200Cای"), "ʔɒmɒdei");
    assert.equal(ph("کتاب\u200Cها"), "kætɒbhɒ");
    assert.match(ph("مدّت"), /dd/, "shadda doubles the consonant");
  });
  it("S/Z letters give sz, not ee", () => {
    for (const w of ["س", "ز", "ص", "ض", "ظ", "ذ", "ث", "ش", "ژ", "چ", "ج"]) assert.ok(vis(w).startsWith("sz"), w);
  });
  it("Arabic yeh/kaf are normalised; punctuation and digits stripped", () => {
    assert.equal(normalizeFa("كتابي،"), "کتابی");
    assert.equal(normalizeFa("۱۲۳؟"), "");
  });
  it("emphasis turns open vowels wide; identical neighbours merge", () => {
    assert.equal(vis("سلام", true), "sz wide l wide mbp");
    assert.equal(vis("بابا"), "mbp ah mbp ah");
    assert.deepEqual(wordVisemes("آب")[1], { id: "ah", weight: 1, long: true });
  });
});

describe("scriptWords", () => {
  it("tokenises, strips quotes/punctuation and marks «!» emphasis", () => {
    const w = scriptWords("«سلام»، امروز آماده‌ای؟ نه ! 123");
    assert.deepEqual(w.map((x) => x.text), ["سلام", "امروز", "آماده‌ای", "نه"]);
    assert.deepEqual(w.map((x) => x.emphasis), [false, false, false, true]);
    assert.equal(w[2].norm, "آمادهای");
  });
});
