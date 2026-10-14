import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emailAndPasswordEnabled, emailAndPasswordOptions } from "./email-password.ts";

describe("CR-11 email sign-up", () => {
  it("UT-CR-11 betterAuth emailAndPassword spread includes disableSignUp", () => {
    const lines = readFileSync(new URL("./server.ts", import.meta.url), "utf8").split("\n");
    const index = lines.findIndex((row) => row.includes("emailAndPassword: { ...emailAndPasswordOptions }"));
    assert.ok(index >= 0, "server.ts must spread emailAndPasswordOptions into the betterAuth call");
    assert.equal(emailAndPasswordEnabled, true);
    const passed = emailAndPasswordEnabled
      ? { emailAndPassword: { ...emailAndPasswordOptions } }
      : {};
    assert.equal(passed.emailAndPassword?.disableSignUp, true);
  });
});
