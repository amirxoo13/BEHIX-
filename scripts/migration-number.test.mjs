import assert from "node:assert/strict";
import { test } from "node:test";
import { migrationNumberStart } from "./migration-plan.mjs";

test("numbering may start at 2 when 0001_auth.sql is absent but 0002 remains", () => {
  assert.equal(migrationNumberStart(false, [2]), 2);
  assert.equal(migrationNumberStart(false, [2, 3]), 2);
  assert.equal(migrationNumberStart(false, [1, 2]), 1);
  assert.equal(migrationNumberStart(true, [2]), 2);
  assert.deepEqual(
    [2, 3].map((_, i) => migrationNumberStart(false, [2, 3]) + i),
    [2, 3],
  );
});
