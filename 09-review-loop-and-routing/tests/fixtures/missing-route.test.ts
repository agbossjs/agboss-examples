import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The routing's failure injection (R5): `fixtures/missing-route/` is a model router whose flow
 * forgets one of its routes. `agboss check` on it fails before anything runs — the suite asserts the
 * failure and exits 0.
 */

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGBOSS = join(PROJECT, "node_modules", "@agboss", "cli", "bin", "agboss.js");

interface CheckReport {
  readonly ok: boolean;
  readonly result?: { readonly problems: readonly { code: string; message: string }[] };
}

function check(application: string): { status: number | null; report: CheckReport } {
  const run = spawnSync(
    process.execPath,
    [AGBOSS, "check", "--json", "--application", application],
    {
      cwd: PROJECT,
      encoding: "utf8",
    },
  );
  return { status: run.status, report: JSON.parse(run.stdout) as CheckReport };
}

describe("AC2 (failure injection): a model router's flow that misses a route", () => {
  it("agboss check fails with [router.routes-mismatch] naming the missing route", () => {
    const { status, report } = check("fixtures/missing-route/application.ts");

    expect(status).not.toBe(0);
    expect(report.ok).toBe(false);
    expect(report.result?.problems).toEqual([
      expect.objectContaining({
        code: "router.routes-mismatch",
        message: expect.stringContaining(
          "missing in .chooseOne(…): missing-route-declined-workflow-finish",
        ) as string,
      }),
    ]);
  });

  it("the example's own application passes the same check", () => {
    const { status, report } = check("src/credit-review.application.ts");

    expect(status).toBe(0);
    expect(report.ok).toBe(true);
  });
});
