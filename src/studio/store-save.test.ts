import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

async function flush() {
  for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
}

describe("CR-7 failed autosave", () => {
  it("UT-CR-07 a failed save locks storage and sets a notice", async () => {
    await useStudio.getState().boot();
    useStudio.getState().setMeta({ title: "UNSAVED" });
    await flush();
    const s = useStudio.getState();
    assert.equal(s.storageLocked, true);
    assert.match(s.storageNotice, /ذخیره/);
  });
});
