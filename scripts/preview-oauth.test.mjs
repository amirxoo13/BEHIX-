import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { bearer, genericOAuth } from "better-auth/plugins";
import ts from "typescript";

// Evaluate the real server configuration with an isolated environment and no
// database startup. Use the installed OAuth plugin to inspect registered clients.
function evaluateModule(file, env, dependencies = {}) {
  const source = readFileSync(new URL(`../src/lib/auth/${file}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    process: { env },
    require(id) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return exports;
}

function configure(env = {}) {
  const local = (file) => evaluateModule(file, env);
  return evaluateModule("server", env, {
    "better-auth": { betterAuth: (options) => ({ options }) },
    "better-auth/plugins": { bearer, genericOAuth },
    "better-auth/tanstack-start": { tanstackStartCookies: () => ({ id: "cookies" }) },
    "@tanstack/react-start/server": { getCookie: () => undefined },
    "node:crypto": { randomBytes },
    pg: { Pool: class {} },
    "../db": { ensureDbReady: async () => {}, getPglite: () => {} },
    "./email-password": local("email-password"),
    "./gate-session.server": {
      GATE_PROVIDER_ID: "grok-gate",
      gateIdentitySessions: () => ({ id: "grok-gate" }),
    },
    "./providers": local("providers"),
    "./pglite-dialect": { pgliteDialect: () => ({}) },
    "./trusted-hosts": local("trusted-hosts"),
    "./preview": local("preview"),
  });
}

function oauthPlugin(server) {
  return server.auth.options.plugins.find((plugin) => plugin.id === "generic-oauth");
}

test("missing or blank server credentials never register broker OAuth", () => {
  for (const env of [
    {},
    { GROK_AUTH_CLIENT_SECRET: "" },
    { GROK_AUTH_CLIENT_SECRET: " \n\t " },
    { GROK_AUTH_CLIENT_ID: "app-client" },
    { VITE_GROK_AUTH_CLIENT_SECRET: "public-value-must-not-be-used" },
  ]) {
    const server = configure(env);
    assert.equal(server.authConfigured, false);
    assert.equal(oauthPlugin(server), undefined);
    assert.equal(server.auth.options.emailAndPassword.enabled, true);
    assert.ok(server.auth.options.plugins.some((plugin) => plugin.id === "grok-gate"));
  }
});

test("preview OAuth uses only the injected server secret", () => {
  const server = configure({ GROK_AUTH_CLIENT_SECRET: " synthetic-preview-secret " });
  assert.equal(server.authConfigured, true);
  for (const provider of oauthPlugin(server).options.config) {
    assert.equal(provider.clientId, "grok_preview");
    assert.equal(provider.clientSecret, "synthetic-preview-secret");
  }
});

test("deployed OAuth uses the injected per-app credentials", () => {
  const server = configure({
    GROK_AUTH_CLIENT_ID: "app-client",
    GROK_AUTH_CLIENT_SECRET: "synthetic-app-secret",
  });
  assert.equal(server.authConfigured, true);
  const providers = oauthPlugin(server).options.config;
  assert.equal(providers.length, 2);
  for (const provider of providers) {
    assert.equal(provider.clientId, "app-client");
    assert.equal(provider.clientSecret, "synthetic-app-secret");
  }
});

test("the explicit auth off switch still disables configured OAuth", () => {
  const server = configure({
    VITE_AUTH_ENABLED: "false",
    GROK_AUTH_CLIENT_SECRET: "synthetic-preview-secret",
  });
  assert.equal(server.authConfigured, false);
  assert.equal(oauthPlugin(server), undefined);
});
