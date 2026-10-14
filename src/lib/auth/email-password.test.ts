import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emailAndPasswordEnabled, emailAndPasswordOptions } from "./email-password.ts";

describe("CR-11 email sign-up", () => {
  it("UT-CR-11 betterAuth emailAndPassword spread includes disableSignUp", () => {
    const lines = readFileSync(new URL("./server.ts", import.meta.url), "utf8").split("\n");
    const line = lines[229];
    assert.equal(
      line?.includes("emailAndPassword: { ...emailAndPasswordOptions }"),
      true,
      `server.ts:230 is ${JSON.stringify(line)}`,
    );
    assert.equal(emailAndPasswordEnabled, true);
    const passed = emailAndPasswordEnabled
      ? { emailAndPassword: { ...emailAndPasswordOptions } }
      : {};
    assert.equal(passed.emailAndPassword?.disableSignUp, true);
  });
});
