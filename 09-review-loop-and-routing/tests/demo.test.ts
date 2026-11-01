import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `npm run demo` as a newcomer runs it: offline, no key. The demo checks its own promises on the
 * executions' state (routes, spend, the stubborn run's finish) and exits non-zero when one fails.
 */

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = join(PROJECT, "node_modules", ".bin", "tsx");

describe("npm run demo", () => {
  it("AC1: runs offline without a key and every check it makes holds", () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.OPENROUTER_API_KEY;
    delete env.AGBOSS_LIVE_DEMO;
    const run = spawnSync(TSX, ["src/demo.ts"], { cwd: PROJECT, encoding: "utf8", env });

    expect(run.stderr).not.toMatch(/demo check failed/);
    expect(run.status).toBe(0);
  });
});
