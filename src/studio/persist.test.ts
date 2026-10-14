import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BACKUP_FORMAT,
  IDB_KEY,
  LEGACY_KEY,
  exportBackup,
  importBackup,
  loadProject,
  memoryKV,
  saveProject,
  byteLength,
  type KV,
  type LegacyStorage,
  type Persist,
} from "./persist.ts";

function fakeLS(init: Record<string, string> = {}): LegacyStorage & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const goodShot = {
  id: "s1",
  duration: 4,
  heading: "داخلی. خانه — شب",
  actionLine: "x",
  dialogue: "سلام",
  background: "cafe",
  camera: "push",
  speaker: "b",
  sfx: "clink",
  pitch: 1.2,
  actorA: { charId: "sara", emotion: "smile", action: "tea" },
  actorB: { charId: "kian", emotion: "cry", action: "walk" },
};
const legacyProject = { shots: [goodShot, { id: "s2", duration: 2 }], aspect: "story", showRig: true, title: "T", logline: "L", genre: "G" };

const failingKV = (failSet = true, failGet = false): KV => ({
  async get() {
    if (failGet) throw new Error("get fail");
    return undefined;
  },
  async set() {
    if (failSet) throw new Error("set fail");
  },
});

describe("migration localStorage → IndexedDB", () => {
  it("UT-PER-01 migrates, repairs, and clears legacy only after success", async () => {
    const ls = fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) });
    const kv = memoryKV();
    const res = await loadProject(kv, ls);
    assert.equal(res.source, "migrated");
    assert.equal(res.data?.shots.length, 2);
    assert.deepEqual(res.data?.shots[0], goodShot); // valid data untouched
    const repaired = res.data!.shots[1];
    assert.equal(repaired.dialogue, "");
    assert.equal(repaired.speaker, "a");
    assert.equal(repaired.actorA.charId, "parviz");
    assert.equal(res.data?.aspect, "story");
    assert.equal(res.data?.title, "T");
    const { savedAt, ...stored } = kv.data[IDB_KEY] as Record<string, unknown>;
    assert.deepEqual(stored, res.data); // repaired version saved
    assert.equal(typeof savedAt, "number");
    assert.equal(ls.data[LEGACY_KEY], undefined);
  });

  it("UT-PER-02 keeps localStorage when IndexedDB write fails", async () => {
    const raw = JSON.stringify(legacyProject);
    const ls = fakeLS({ [LEGACY_KEY]: raw });
    const res = await loadProject(failingKV(true), ls);
    assert.equal(res.source, "legacy-fallback");
    assert.equal(res.data?.shots.length, 2);
    assert.equal(ls.data[LEGACY_KEY], raw);
  });

  it("UT-PER-03 keeps localStorage when IndexedDB read fails", async () => {
    const raw = JSON.stringify(legacyProject);
    const ls = fakeLS({ [LEGACY_KEY]: raw });
    const res = await loadProject(failingKV(true, true), ls);
    assert.equal(res.source, "legacy-fallback");
    assert.equal(ls.data[LEGACY_KEY], raw);
  });

  it("UT-PER-04 IndexedDB wins over legacy and is re-saved normalized", async () => {
    const kv = memoryKV({ [IDB_KEY]: { shots: [{ id: "x", duration: 1 }] } });
    const ls = fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) });
    const res = await loadProject(kv, ls);
    assert.equal(res.source, "idb");
    assert.equal(res.data?.shots[0].id, "x");
    assert.equal((kv.data[IDB_KEY] as { shots: { dialogue: string }[] }).shots[0].dialogue, "");
    assert.ok(ls.data[LEGACY_KEY]); // untouched
  });

  it("UT-PER-05 no data anywhere → none", async () => {
    const res = await loadProject(memoryKV(), fakeLS());
    assert.equal(res.data, null);
    assert.equal(res.source, "none");
    assert.equal(res.saveLocked, false);
    assert.deepEqual(res.quarantined, []);
  });

  it("UT-PER-06 no IndexedDB at all → legacy read only", async () => {
    const ls = fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) });
    const res = await loadProject(null, ls);
    assert.equal(res.source, "legacy-fallback");
    assert.ok(ls.data[LEGACY_KEY]);
  });
});

describe("corrupt data", () => {
  it("UT-PER-07 corrupt legacy JSON: quarantined to IDB, original kept, notice set", async () => {
    const ls = fakeLS({ [LEGACY_KEY]: "{bad json" });
    const kv = memoryKV();
    const res = await loadProject(kv, ls, 1000);
    assert.equal(res.data, null);
    assert.ok(res.error);
    assert.equal(res.saveLocked, false);
    assert.ok(res.notice && /خراب/.test(res.notice));
    assert.deepEqual(res.quarantined, ["idb:corrupt-1000-legacy"]);
    assert.equal(kv.data["corrupt-1000-legacy"], "{bad json");
    assert.equal(ls.data[LEGACY_KEY], "{bad json");
    assert.equal(kv.data[IDB_KEY], undefined);
  });

  it("UT-PER-08 corrupt IndexedDB: quarantined first, then valid legacy migrated", async () => {
    const kv = memoryKV({ [IDB_KEY]: "garbage" });
    const ls = fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) });
    const res = await loadProject(kv, ls, 2000);
    assert.equal(res.source, "migrated");
    assert.equal(kv.data["corrupt-2000-idb"], "garbage");
    assert.equal(res.data?.shots.length, 2);
  });

  for (const [name, value] of [
    ["array", []],
    ["shots not array", { shots: "x" }],
    ["no valid shots", { shots: [{ id: 1 }, null, { id: "a", duration: -1 }] }],
    ["null", null],
  ] as const) {
    it(`UT-PER-09 legacy shape '${name}' rejected gracefully`, async () => {
      const ls = fakeLS({ [LEGACY_KEY]: JSON.stringify(value) });
      const res = await loadProject(memoryKV(), ls);
      assert.equal(res.data, null);
      assert.ok(ls.data[LEGACY_KEY]);
    });
  }
});

describe("backup", () => {
  it("UT-PER-10 round-trip export → import preserves project", async () => {
    const kv = memoryKV();
    const ls = fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) });
    const { data } = await loadProject(kv, ls);
    const text = exportBackup(data!, new Date("2026-10-14T09:00:00Z"));
    const parsed = JSON.parse(text);
    assert.equal(parsed.format, BACKUP_FORMAT);
    assert.equal(parsed.version, 1);
    const back = importBackup(text);
    assert.ok(back.ok);
    if (back.ok) assert.deepEqual(back.data, data);
  });

  for (const [name, input] of [
    ["empty", ""],
    ["not string", 42],
    ["invalid json", "{oops"],
    ["wrong format", JSON.stringify({ format: "other", version: 1, project: legacyProject })],
    ["future version", JSON.stringify({ format: BACKUP_FORMAT, version: 99, project: legacyProject })],
    ["no project", JSON.stringify({ format: BACKUP_FORMAT, version: 1 })],
    ["no valid shots", JSON.stringify({ format: BACKUP_FORMAT, version: 1, project: { shots: [] } })],
    ["too big", "x".repeat(5 * 1024 * 1024 + 1)],
  ] as const) {
    it(`UT-PER-11 import rejects '${name}' without throwing`, () => {
      const res = importBackup(input as unknown);
      assert.equal(res.ok, false);
      if (!res.ok) assert.ok(res.error.length > 0);
    });
  }

  it("UT-PER-12 saveProject falls back to localStorage when IndexedDB fails", async () => {
    const ls = fakeLS();
    const { data } = await loadProject(memoryKV(), fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) }));
    assert.equal(await saveProject(failingKV(true), data!, ls), "legacy");
    assert.ok(ls.data[LEGACY_KEY]);
    assert.equal(await saveProject(memoryKV(), data!, ls), "idb");
  });
});

describe("T07-v2 fixes", () => {
  const corruptIdb = { shots: "broken" };

  it("UT-F1-01 corrupt IDB alone: copied to corrupt-<ts>, save stays unlocked, original intact", async () => {
    const kv = memoryKV({ [IDB_KEY]: corruptIdb });
    const res = await loadProject(kv, fakeLS(), 3000);
    assert.equal(res.data, null);
    assert.equal(res.saveLocked, false);
    assert.deepEqual(kv.data["corrupt-3000-idb"], corruptIdb);
    assert.deepEqual(kv.data[IDB_KEY], corruptIdb);
    assert.ok(res.notice);
  });

  it("UT-F1-02 quarantine impossible (IDB write fails, no localStorage) → saveLocked + Persian notice", async () => {
    const kv: KV = {
      async get(k) {
        return k === IDB_KEY ? corruptIdb : undefined;
      },
      async set() {
        throw new Error("quota");
      },
    };
    const res = await loadProject(kv, null, 4000);
    assert.equal(res.saveLocked, true);
    assert.match(res.notice ?? "", /ذخیرهٔ خودکار متوقف شد/);
  });

  it("UT-F1-03 IDB quarantine fails → falls back to localStorage copy (not locked)", async () => {
    const kv: KV = {
      async get(k) {
        return k === IDB_KEY ? corruptIdb : undefined;
      },
      async set() {
        throw new Error("quota");
      },
    };
    const ls = fakeLS();
    const res = await loadProject(kv, ls, 5000);
    assert.equal(res.saveLocked, false);
    assert.equal(ls.data["behix-corrupt-5000-idb"], JSON.stringify(corruptIdb));
  });

  it("UT-F1-04 corrupt legacy and no IDB and localStorage copy fails → locked", async () => {
    const ls = fakeLS({ [LEGACY_KEY]: "{bad" });
    ls.setItem = () => {
      throw new Error("quota");
    };
    const res = await loadProject(null, ls, 6000);
    assert.equal(res.saveLocked, true);
    assert.equal(ls.data[LEGACY_KEY], "{bad");
  });

  it("UT-F1-05 IDB read error → IDB not used for later saves (useKV=false)", async () => {
    const res = await loadProject(failingKV(false, true), fakeLS(), 1);
    assert.equal(res.useKV, false);
  });

  it("UT-F2-01 newer localStorage (after IDB save failure) wins over stale IDB and is migrated", async () => {
    const kv = memoryKV();
    const ls = fakeLS();
    const { data } = await loadProject(memoryKV(), fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) }));
    await saveProject(kv, { ...data!, title: "OLD" }, ls, 100); // IDB ok
    assert.equal(await saveProject(failingKV(true), { ...data!, title: "NEW" }, ls, 200), "legacy"); // IDB fails
    const res = await loadProject(kv, ls, 300);
    assert.equal(res.data?.title, "NEW");
    assert.equal(res.source, "migrated");
    assert.equal((kv.data[IDB_KEY] as { title: string; savedAt: number }).title, "NEW");
    assert.equal((kv.data[IDB_KEY] as { savedAt: number }).savedAt, 200);
    assert.equal(ls.data[LEGACY_KEY], undefined);
  });

  it("UT-F2-02 newer IDB wins over older localStorage", async () => {
    const kv = memoryKV();
    const ls = fakeLS();
    const { data } = await loadProject(memoryKV(), fakeLS({ [LEGACY_KEY]: JSON.stringify(legacyProject) }));
    ls.setItem(LEGACY_KEY, JSON.stringify({ ...data!, title: "OLD", savedAt: 100 }));
    await saveProject(kv, { ...data!, title: "NEW" }, ls, 200);
    const res = await loadProject(kv, ls, 300);
    assert.equal(res.data?.title, "NEW");
    assert.equal(res.source, "idb");
  });

  it("UT-LOW-01 backup cap measured in UTF-8 bytes", () => {
    const fa = "ب".repeat(3 * 1024 * 1024); // 3M chars = 6MB UTF-8
    assert.ok(fa.length < 5 * 1024 * 1024);
    assert.ok(byteLength(fa) > 5 * 1024 * 1024);
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, project: { ...legacyProject, title: fa } });
    const res = importBackup(text);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /بزرگ/);
  });
});

describe("T07-v3 F6: IDB read error", () => {
  const real = { shots: [{ id: "r", duration: 2, dialogue: "REAL" }], aspect: "wide", showRig: false, title: "REAL", logline: "", genre: "", savedAt: 1000 };

  it("UT-F6-01 read throws → saveLocked, Persian notice, IDB not used", async () => {
    const res = await loadProject(failingKV(false, true), fakeLS(), 2000);
    assert.equal(res.saveLocked, true);
    assert.equal(res.useKV, false);
    assert.equal(res.data, null);
    assert.match(res.notice ?? "", /IndexedDB/);
    assert.match(res.notice ?? "", /متوقف شد/);
  });

  it("UT-F6-02 flaky read (audit f3 scenario): real IDB project survives next session", async () => {
    const store = memoryKV({ [IDB_KEY]: real });
    let fail = true;
    const flaky: KV = {
      get: async (k) => {
        if (fail) throw new Error("read");
        return store.get(k);
      },
      set: store.set,
    };
    const ls = fakeLS();
    const r1 = await loadProject(flaky, ls, 2000);
    assert.equal(r1.saveLocked, true);
    // store respects the lock: no save happens in session 1 (simulate the store contract)
    if (!r1.saveLocked) await saveProject(r1.useKV ? flaky : null, { ...(real as unknown as Persist), title: "DEFAULT-EDIT" }, ls, 3000);
    fail = false;
    const r2 = await loadProject(flaky, ls, 4000);
    assert.equal(r2.data?.title, "REAL");
    assert.equal(r2.source, "idb");
    assert.equal((store.data[IDB_KEY] as { title: string }).title, "REAL");
    assert.equal(ls.data[LEGACY_KEY], undefined);
  });

  it("UT-F6-03 read throws with valid legacy → legacy shown but locked and legacy untouched", async () => {
    const raw = JSON.stringify(legacyProject);
    const ls = fakeLS({ [LEGACY_KEY]: raw });
    const res = await loadProject(failingKV(false, true), ls, 1);
    assert.equal(res.saveLocked, true);
    assert.equal(res.data?.title, "T");
    assert.equal(ls.data[LEGACY_KEY], raw);
  });

  it("UT-F6-04 audit f3 verbatim: even if caller ignores lock, session-only save can't override IDB", async () => {
    const store = memoryKV({ [IDB_KEY]: real });
    let fail = true;
    const flaky: KV = {
      get: async (k) => {
        if (fail) throw new Error("read");
        return store.get(k);
      },
      set: store.set,
    };
    const ls = fakeLS();
    const r1 = await loadProject(flaky, ls, 2000);
    await saveProject(r1.useKV ? flaky : null, { ...(real as unknown as Persist), title: "DEFAULT-EDIT" }, ls, 3000);
    fail = false;
    const r2 = await loadProject(flaky, ls, 4000);
    assert.equal(r2.data?.title, "REAL");
    assert.equal((store.data[IDB_KEY] as { title: string }).title, "REAL");
  });

  it("UT-F6-05 provisional legacy still used when IDB is empty (no-IDB environments)", async () => {
    const ls = fakeLS();
    await saveProject(null, { ...(legacyProject as unknown as Persist), title: "ONLY" }, ls, 10);
    const res = await loadProject(memoryKV(), ls, 20);
    assert.equal(res.data?.title, "ONLY");
  });
});

describe("T07-v4 mixed valid + invalid shots", () => {
  const mixed = { shots: [goodShot, { id: "bad", heading: "BAD-NO-DURATION", dialogue: "user text" }], title: "T" };
  const NOW = 1700000000000;

  it("UT-V4-01 parseProject reports dropped count", async () => {
    const { parseProject } = await import("./persist.ts");
    const r = parseProject(mixed);
    assert.ok(r.ok);
    assert.equal(r.ok && r.dropped, 1);
    const clean = parseProject({ shots: [goodShot] });
    assert.equal(clean.ok && clean.dropped, 0);
  });

  it("UT-V4-02 legacy mixed: byte-equal backup, notice, valid shots kept, migration ok after backup", async () => {
    const raw = JSON.stringify(mixed);
    const ls = fakeLS({ [LEGACY_KEY]: raw });
    const kv = memoryKV();
    const res = await loadProject(kv, ls, NOW);
    assert.equal(kv.data[`corrupt-${NOW}-legacy`], raw);
    assert.deepEqual(res.quarantined, [`idb:corrupt-${NOW}-legacy`]);
    assert.match(res.notice ?? "", /1 نما خراب بود/);
    assert.equal(res.data?.shots.length, 1);
    assert.equal(res.data?.shots[0].id, "s1");
    assert.equal(res.saveLocked, false);
  });

  it("UT-V4-03 IDB mixed: backup deep-equal to original before re-save", async () => {
    const kv = memoryKV({ [IDB_KEY]: mixed });
    const res = await loadProject(kv, fakeLS(), NOW);
    assert.deepEqual(kv.data[`corrupt-${NOW}-idb`], mixed);
    assert.ok(res.notice);
    assert.equal(res.data?.shots.length, 1);
  });

  it("UT-V4-04 backup fails → legacy key kept, save locked, notice set", async () => {
    const raw = JSON.stringify(mixed);
    const data: Record<string, string> = { [LEGACY_KEY]: raw };
    const ls: LegacyStorage = {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: (k) => {
        delete data[k];
      },
    };
    const res = await loadProject(failingKV(true), ls, NOW);
    assert.equal(data[LEGACY_KEY], raw);
    assert.equal(res.saveLocked, true);
    assert.ok(res.notice);
    assert.equal(res.data?.shots.length, 1);
  });

  it("UT-V4-05 clean project: no backup, no notice", async () => {
    const kv = memoryKV({ [IDB_KEY]: { shots: [goodShot] } });
    const res = await loadProject(kv, fakeLS(), NOW);
    assert.deepEqual(res.quarantined, []);
    assert.equal(res.notice, undefined);
  });
});
