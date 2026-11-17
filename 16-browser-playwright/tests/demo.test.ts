import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/**
 * `npm run demo` as a newcomer runs it: offline, no key, a real headless Chromium against the local
 * site. The demo checks its own promises on the executions' state and the site's records and exits
 * non-zero when one fails.
 */

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = join(PROJECT, "node_modules", ".bin", "tsx");

it("runs offline without a key: both ways read, look and file; 127.0.0.1 is refused; the browser closes with the app", () => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.OPENROUTER_API_KEY;
  delete env.OPEN_ROUTER_KEY;
  delete env.AGBOSS_LIVE_DEMO;
  const run = spawnSync(TSX, ["src/demo.ts"], { cwd: PROJECT, encoding: "utf8", env });

  expect(run.stderr).not.toMatch(/demo check failed/u);
  expect(run.status).toBe(0);
  expect(run.stdout).toContain("The Starter plan is 12 USD per agent per month.");
  expect(run.stdout).toContain("an image of the page reached me as a file");
  expect(run.stdout).toContain("That address is not an allowed site");
  expect(run.stdout).toContain("browser still open after app.close(): false");
  expect(run.stdout).toContain("All checks passed.");
});
