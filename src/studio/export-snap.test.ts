import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { exportSnapChanged, type ExportSnap } from "./export-snap.ts";

const base: ExportSnap = {
  shots: ["s"],
  aspect: "wide",
  title: "t",
  logline: "l",
  genre: "g",
  showRig: false,
  audioUrls: {},
};

describe("CR-3 stale export", () => {
  it("UT-CR-03 different project identity is stale", () => {
    assert.equal(exportSnapChanged(base, base), false);
    assert.equal(exportSnapChanged(base, { ...base, shots: ["other"] }), true);
    assert.equal(exportSnapChanged(base, { ...base, title: "x" }), true);
    assert.equal(exportSnapChanged(base, { ...base, audioUrls: { a: "b" } }), true);
  });

  it("UT-CR-03 deliver skips download when the snap changed", () => {
    const src = readFileSync(new URL("../routes/deliver.tsx", import.meta.url), "utf8");
    const download = src.indexOf("downloadFile(file)");
    const guard = src.indexOf("exportSnapChanged(");
    assert.ok(guard !== -1 && guard < download, "exportSnapChanged must run before downloadFile");
  });
});
