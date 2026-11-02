import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/**
 * `npm run demo` as a newcomer runs it: offline, no key. The demo checks its own promises on the
 * executions' state and the stub's records and exits non-zero when one fails.
 */

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = join(PROJECT, "node_modules", ".bin", "tsx");

it("runs offline without a key: the 27th candidate answers after reranking, a 503 falls back", () => {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.OPENROUTER_API_KEY;
  delete env.COHERE_API_KEY;
  const run = spawnSync(TSX, ["src/demo.ts"], { cwd: PROJECT, encoding: "utf8", env });

  expect(run.stderr).not.toMatch(/demo check failed/u);
  expect(run.status).toBe(0);
  expect(run.stdout).toContain("From the handbook [handbook/onboarding.md#on-call].");
  expect(run.stdout).toContain("fallback: the retriever's own order");
});
