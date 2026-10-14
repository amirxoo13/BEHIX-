import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { exportBackup } from "./persist.ts";
import { useStudio } from "./store.ts";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error("full");
    },
    removeItem() {},
  },
});

describe("CR-9 importBackup", () => {
  it("UT-CR-09 returns failure when the imported project cannot be saved", async () => {
    await useStudio.getState().boot();
    const s = useStudio.getState();
    const text = exportBackup({
      shots: s.shots,
      aspect: s.aspect,
      showRig: s.showRig,
      title: "IMPORTED",
      logline: s.logline,
      genre: s.genre,
    });
    const res = await useStudio.getState().importBackup(text);
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /ذخیره نشد/);
  });
});
