import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_PROPS, PROP_GAP, PROPS, nextPropPlacement, placeProps, propDef, withPropId, type PropId } from "./props.ts";

const kinds = (ids: PropId[]) => {
  const out = placeProps(ids);
  const by = (f: (id: PropId) => boolean) => out.filter((p) => f(p.id)).map((p) => p.x);
  return {
    out,
    table: by((id) => id !== "table" && propDef(id).mount === "table"),
    big: by((id) => propDef(id).mount === "floor" && propDef(id).big),
    small: by((id) => id !== "table" && propDef(id).mount === "floor" && !propDef(id).big),
  };
};
const distinct = (xs: number[], gap: number) => {
  const s = [...xs].sort((a, b) => a - b);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] - s[i - 1] >= gap - 1e-9, `overlap ${s.join(",")}`);
};
const TABLE_ITEMS = PROPS.filter((p) => p.mount === "table").map((p) => p.id);
const BIG = PROPS.filter((p) => p.big).map((p) => p.id);
const SMALL_FLOOR = PROPS.filter((p) => p.mount === "floor" && !p.big && p.id !== "table").map((p) => p.id);

describe("placeProps", () => {
  it("keeps the original layout for small lists (existing projects/tests unchanged)", () => {
    assert.deepEqual(placeProps(["peykan", "taxi", "tree"]).map((p) => p.x), [0.08, 0.93, 0.18]);
    assert.deepEqual(placeProps(["samovar", "cake"]).map((p) => [p.id, p.x]), [["table", 0.51], ["samovar", 0.47], ["cake", 0.55]]);
    assert.deepEqual(placeProps(["bench", "cat", "lamp"]).map((p) => p.x), [0.5, 0.06, 0.94]);
  });
  it("five table items share the table without overlap", () => {
    const k = kinds(TABLE_ITEMS.slice(0, 5));
    assert.equal(k.out.length, MAX_PROPS);
    assert.equal(k.table.length, 5);
    distinct(k.table, 0.05);
    for (const x of k.table) assert.ok(x >= 0.39 && x <= 0.63);
  });
  it("5-6 big or small floor props get distinct slots", () => {
    distinct(kinds(BIG.slice(0, 6)).big, 0.05);
    distinct(kinds(SMALL_FLOOR.slice(0, 6)).small, 0.05);
    assert.equal(kinds(BIG.slice(0, 6)).big.length, 6);
  });
  it("is deterministic and capped", () => {
    const ids = PROPS.map((p) => p.id);
    assert.deepEqual(placeProps(ids), placeProps(ids));
    assert.equal(placeProps(ids).length, MAX_PROPS);
  });
});

describe("panel helpers", () => {
  it("adding a second copy of a prop never lands on the first", () => {
    const one = placeProps(["tree"]);
    const two = nextPropPlacement(one, "tree");
    assert.ok(Math.abs(two.x - one[0].x) >= PROP_GAP);
    let list = [...one, two];
    while (list.length < MAX_PROPS) list = [...list, nextPropPlacement(list, "cat")];
    distinct(list.map((p) => p.x), PROP_GAP);
  });
  it("falls back to the widest free gap when every slot of the kind is taken", () => {
    const crowd = [0.08, 0.93, 0.18, 0.83, 0.28, 0.73].map((x) => ({ id: "tree" as PropId, x, layer: "back" as const }));
    const p = nextPropPlacement(crowd, "taxi");
    assert.ok(crowd.every((c) => Math.abs(c.x - p.x) >= PROP_GAP), String(p.x));
  });
  it("changing a prop's id takes the new kind's layer", () => {
    const tree = placeProps(["tree"])[0];
    assert.equal(tree.layer, "back");
    const cat = withPropId(tree, "cat");
    assert.equal(cat.layer, propDef("cat").layer);
    assert.equal(cat.x, tree.x);
  });
});
