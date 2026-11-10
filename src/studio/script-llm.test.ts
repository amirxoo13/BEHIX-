import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { autoLayout, clearModelCache, type ModelCall } from "./auto-layout.ts";
import { IDS } from "./catalog.ts";
import {
  CHUNK_LINES,
  MAX_CHUNK_TOKENS,
  buildMessages,
  chunkScript,
  extractJson,
  maxOutputTokens,
  planFromModelReplies,
  planFromModelReply,
  salvageItems,
} from "./script-llm.ts";

const SCRIPT = `قهوه‌خانه، شب
پرویز وارد می‌شود، استکان در دست. پهلوان اژدر با تعجب نگاهش می‌کند.
پرویز: سلام پهلوان! (خندان، اشاره)
پهلوان: دیر کردی. (اخم، دست به کمر)

خیابان فرشته، شب
سارا: کجا می‌روی؟ (گریه)
کیان: من هم میام!`;

// پاسخ واقعی qwen3.8-flash (Alibaba Model Studio، 2026-10-14) به همین SCRIPT با پرامپت فشرده؛
// مصرف واقعی: ۵۱۷ توکن ورودی + ۱۱۵ توکن خروجی. عمداً بدون تغییر: ردیف ۲ دو گوینده دارد، ستون‌ها
// جابه‌جا شده‌اند و «خیابان فرشته» را street گفته — کد باید همهٔ این‌ها را درست کند.
const REAL_QWEN_REPLY =
  '{"s":[[1,"cafe","","", ""],[2,"cafe","parviz, pahlavan","pahlavan:shock:idle","", "door"],[3,"cafe","parviz","parviz:laugh:point","", ""],[4,"cafe","pahlavan","pahlavan:angry:hips","", ""],[6,"street","","","", ""],[7,"street","sara","sara:cry:idle","", ""],[8,"street","kian","kian:neutral:idle","", ""]]}';

describe("compact prompt", () => {
  it("UT-LLM-01 lists every catalog id and numbers the script lines", () => {
    const [system, user] = buildMessages(SCRIPT);
    for (const id of [...IDS.characters, ...IDS.backgrounds, ...IDS.emotions, ...IDS.actions]) {
      assert.ok(system.content.includes(id), id);
    }
    assert.match(user.content, /^1\|قهوه‌خانه، شب/);
    assert.match(user.content, /\n8\|کیان: من هم میام!$/);
    assert.ok(!user.content.includes("5|"), "empty lines are not sent");
  });
  it("UT-LLM-02 system prompt stays small and output is capped by line count", () => {
    assert.ok(buildMessages("").at(0)!.content.length < 1400);
    assert.equal(maxOutputTokens(SCRIPT), 60 + 40 * 7);
    assert.equal(maxOutputTokens("x\n".repeat(500)), MAX_CHUNK_TOKENS);
  });
  it("UT-LLM-03 extracts JSON wrapped in code fences", () => {
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.throws(() => extractJson("no json here"));
  });
});

describe("compact reply → plan", () => {
  it("UT-LLM-04 real Qwen reply: text comes from the script, description merges into next shot", () => {
    const r = planFromModelReply(REAL_QWEN_REPLY, SCRIPT);
    assert.ok(r.ok);
    if (!r.ok) return;
    const s = r.plan.shots;
    assert.equal(r.plan.warnings.length, 0);
    assert.equal(s.length, 4);
    assert.equal(s[0].speaker, "parviz");
    assert.equal(s[0].dialogue, "سلام پهلوان!");
    assert.match(s[0].actionLine, /^پرویز وارد می‌شود/);
    assert.equal(s[0].emotion.parviz, "laugh", "the spoken line's own emotion wins");
    assert.equal(s[0].action.parviz, "point");
    assert.equal(s[0].emotion.pahlavan, "shock", "description emotions are kept");
    assert.equal(s[0].heading, "قهوه‌خانه، شب");
    assert.deepEqual(s.map((x) => x.scene), [0, 0, 1, 1]);
    assert.equal(s[2].background, "fereshteh", "heading place beats the model's generic street");
    assert.ok(s.every((x) => x.night));
    assert.equal(s[3].dialogue, "من هم میام!");
  });
  it("UT-LLM-05 ids outside the catalog, invalid speakers and bad line numbers are dropped", () => {
    const r = planFromModelReply(
      '{"s":[[3,"moon","batman","sara:dancing:fly,joker",""],[99,"cafe","parviz","",""],[1,"cafe","parviz","",""],[4,"cafe","pahlavan","","explosion"]]}',
      SCRIPT,
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.plan.shots.length, 1, "line 99 does not exist, line 1 is a heading, line 3 has no valid speaker");
    const [only] = r.plan.shots;
    assert.equal(only.speaker, "pahlavan");
    assert.equal(only.background, "cafe", "the heading decides the place, not the model's 'moon'");
    assert.equal(only.sfx, "none");
    assert.ok(only.cast.includes("sara"), "people mentioned on the merged row stay in the scene");
    assert.deepEqual(only.emotion, {});
    for (const bad of ["dancing", "fly", "joker", "explosion"]) {
      assert.ok(r.plan.warnings.some((w) => w.includes(bad)), bad);
    }
  });
  it("UT-LLM-06 garbage or empty replies are errors", () => {
    assert.equal(planFromModelReply("I cannot help", SCRIPT).ok, false);
    assert.equal(planFromModelReply('{"s":[]}', SCRIPT).ok, false);
  });
});

describe("method selection saves tokens", () => {
  beforeEach(() => clearModelCache());
  const realModel: ModelCall = async (script) => {
    const p = planFromModelReply(REAL_QWEN_REPLY, script);
    if (!p.ok) throw new Error(p.error);
    return { ok: true, plan: p.plan, model: "qwen3.8-flash", usage: { input: 517, output: 115 } };
  };
  const counting = () => {
    let calls = 0;
    const fn: ModelCall = async (s) => {
      calls++;
      return realModel(s);
    };
    return { fn, calls: () => calls };
  };

  it("UT-LLM-07 smart: a fully understood script never calls the model", async () => {
    const m = counting();
    const r = await autoLayout(SCRIPT, "smart", m.fn);
    assert.equal(m.calls(), 0);
    assert.equal(r.used, "dictionary");
    assert.deepEqual(r.usage, { input: 0, output: 0 });
  });
  it("UT-LLM-08 smart: an unknown direction sends the script to the model once, then cache", async () => {
    const odd = SCRIPT.replace("(گریه)", "(دلخور و بی‌قرار)");
    const m = counting();
    const first = await autoLayout(odd, "smart", m.fn);
    assert.equal(first.used, "model");
    assert.deepEqual(first.usage, { input: 517, output: 115 });
    const again = await autoLayout(odd, "smart", m.fn);
    assert.equal(m.calls(), 1, "same text is not paid for twice");
    assert.deepEqual(again.usage, { input: 0, output: 0 });
  });
  it("UT-LLM-09 model method always asks; failures fall back to the dictionary", async () => {
    const m = counting();
    assert.equal((await autoLayout(SCRIPT, "model", m.fn)).used, "model");
    assert.equal(m.calls(), 1);
    clearModelCache();
    const failed = await autoLayout(SCRIPT, "model", async () => ({ ok: false, error: "خطای 500" }));
    assert.equal(failed.used, "dictionary");
    assert.match(failed.warnings[0], /خطای 500/);
    const thrown = await autoLayout(SCRIPT, "model", async () => {
      throw new Error("network");
    });
    assert.equal(thrown.used, "dictionary");
  });
  it("UT-LLM-10 dictionary method never calls the model", async () => {
    const m = counting();
    await autoLayout(SCRIPT, "dictionary", m.fn);
    assert.equal(m.calls(), 0);
  });
});

/** سناریوی بلند: n صحنه، هر صحنه یک سرصحنه و چند دیالوگ. */
function longScript(scenes: number, lines: number): string {
  const out: string[] = [];
  for (let i = 0; i < scenes; i++) {
    out.push(i % 2 ? "قهوه‌خانه، شب" : "خیابان فرشته، شب");
    for (let j = 0; j < lines; j++) out.push(j % 2 ? `پهلوان: جواب ${i}-${j}.` : `پرویز: حرف ${i}-${j}.`);
  }
  return out.join("\n");
}
/** جواب درست مدل برای همهٔ دیالوگ‌های یک بازه. */
function replyFor(script: string, from: number, to: number): string {
  const rows = script
    .split("\n")
    .map((l, i) => [i + 1, l] as const)
    .filter(([n, l]) => n >= from && n <= to && /^(پرویز|پهلوان):/.test(l))
    .map(([n, l]) => `[${n},"cafe","${l.startsWith("پرویز") ? "parviz" : "pahlavan"}","",""]`);
  return `{"s":[${rows.join(",")}]}`;
}

describe("long scripts are chunked and truncation is never silent", () => {
  const script = longScript(12, 14); // 180 non-empty lines
  it("UT-LLM-11 chunks cover every line once, stay under the per-chunk line cap and cut at headings", () => {
    const ranges = chunkScript(script);
    assert.ok(ranges.length >= 3);
    const lines = script.split("\n");
    let next = 1;
    for (const r of ranges) {
      assert.equal(r.from, next);
      next = r.to + 1;
      const count = lines.slice(r.from - 1, r.to).filter(Boolean).length;
      assert.ok(count <= CHUNK_LINES, `${count} lines`);
      assert.ok(maxOutputTokens(script, r) < MAX_CHUNK_TOKENS);
    }
    assert.equal(next, lines.length + 1);
    for (const r of ranges.slice(1)) assert.ok(/، شب$/.test(lines[r.from - 1]), "chunk starts at a heading");
    // the chunk prompt only carries its own lines plus the scene heading for context
    const [, user] = buildMessages(script, [], ranges[1]);
    assert.ok(user.content.split("\n").every((l) => Number(l.split("|")[0]) >= ranges[1].from - 1 || /، شب$/.test(l)));
  });
  it("UT-LLM-12 chunk replies merge into one plan covering the whole script", () => {
    const ranges = chunkScript(script);
    const r = planFromModelReplies(
      ranges.map((x) => ({ content: replyFor(script, x.from, x.to), range: x })),
      script,
      [],
      { maxShots: 1000 },
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.plan.shots.length, 12 * 14);
    assert.equal(r.plan.warnings.length, 0);
    assert.deepEqual([...new Set(r.plan.shots.map((x) => x.scene))].length, 12);
  });
  it("UT-LLM-13 a truncated reply keeps its complete rows and warns visibly", () => {
    const full = replyFor(script, 1, 40);
    const cut = full.slice(0, Math.floor(full.length * 0.6));
    assert.throws(() => extractJson(cut));
    const saved = salvageItems(cut);
    assert.ok(saved.length > 5);
    const r = planFromModelReplies([{ content: cut, truncated: true, range: { from: 1, to: 40 } }], script);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.plan.shots.length, saved.length);
    assert.ok(r.plan.warnings.some((w) => w.includes("ناقص") && w.includes("سقف توکن") && w.includes("1 تا 40")));
    // a cut reply without the finish flag (unterminated JSON) is also reported, not silently dropped
    const r2 = planFromModelReplies([{ content: cut }], script);
    assert.ok(r2.ok && r2.plan.warnings.some((w) => w.includes("ناقص")));
  });
  it("UT-LLM-14 an unreadable chunk among good ones is reported with its line range", () => {
    const ranges = chunkScript(script);
    const replies = ranges.map((x, i) => ({ content: i === 1 ? "I cannot help" : replyFor(script, x.from, x.to), range: x }));
    const r = planFromModelReplies(replies, script, [], { maxShots: 1000 });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(r.plan.warnings.some((w) => w.includes(`${ranges[1].from} تا ${ranges[1].to}`)));
  });
});
