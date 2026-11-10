import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { trustedOriginHosts } from "./trusted-hosts.ts";

describe("CR-12 trusted origin hosts", () => {
  it("UT-CR-12 hostname drops the port", () => {
    assert.deepEqual(
      trustedOriginHosts(["https://behix.example.com", "https://cdn.example.com:8443"]),
      ["behix.example.com", "cdn.example.com"],
    );
  });

  it("UT-CR-12 allowedHosts spreads trustedOriginHosts(extraTrustedOrigins)", () => {
    const line = readFileSync(new URL("./server.ts", import.meta.url), "utf8")
      .split("\n")
      .find((row) => row.includes("allowedHosts: ["));
    assert.equal(line?.includes("...trustedOriginHosts(extraTrustedOrigins)"), true, line);
  });
});
