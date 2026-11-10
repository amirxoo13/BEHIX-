import { spawn } from "node:child_process";

/** Exit 1 if any suite failed. Both suites are always started by `main`.
 * @param {Array<number | null>} codes
 */
export function combineStatus(codes) {
  return codes.some((code) => code !== 0) ? 1 : 0;
}

/**
 * @param {string[]} args
 * @returns {Promise<number>}
 */
function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function main() {
  const scripts = await runNode(["--test", "scripts/**/*.test.mjs"]);
  const ts = await runNode([
    "--experimental-strip-types",
    "--test",
    "src/lib/app-data/app-data.test.ts",
    "src/lib/app-data/readiness-schedule.test.ts",
    "src/lib/auth/email-password.test.ts",
    "src/lib/auth/gate-identity.test.ts",
    "src/lib/auth/sign-in-gate.test.ts",
    "src/lib/auth/trusted-hosts.test.ts",
    "src/lib/preview-path-prefix.test.ts",
    "src/lib/rate-limit.test.ts",
    "src/lib/tts-quota.test.ts",
    "src/studio/*.test.ts",
    "src/studio/stick/*.test.ts",
  ]);
  process.exit(combineStatus([scripts, ts]));
}

if (process.argv[1]?.endsWith("run-tests.mjs")) {
  await main();
}
