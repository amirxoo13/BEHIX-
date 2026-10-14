import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { useStudio } from "./store.ts";

describe("CR-8 edits during boot", () => {
  it("UT-CR-08 an edit before boot finishes is ignored, then edits work", async () => {
    const title = useStudio.getState().title;
    useStudio.getState().setMeta({ title: "DURING-BOOT" });
    assert.equal(useStudio.getState().title, title);
    await useStudio.getState().boot();
    assert.notEqual(useStudio.getState().title, "DURING-BOOT");
    useStudio.getState().setMeta({ title: "AFTER-BOOT" });
    assert.equal(useStudio.getState().title, "AFTER-BOOT");
  });
});
