import assert from "node:assert/strict";
import { test } from "node:test";
import { combineStatus } from "./run-tests.mjs";

test("combineStatus is 1 when either suite fails and 0 only when both are 0", () => {
  assert.equal(combineStatus([0, 0]), 0);
  assert.equal(combineStatus([1, 0]), 1);
  assert.equal(combineStatus([0, 2]), 1);
  assert.equal(combineStatus([1, 1]), 1);
});
