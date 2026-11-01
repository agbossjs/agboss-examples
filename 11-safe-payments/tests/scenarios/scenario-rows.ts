import { describe, expect } from "vitest";
import { assertShows } from "../../scenarios/expect.js";
import { scenarioTest } from "../../scenarios/run-scenario.js";
import { Variant, type PaymentScenario } from "../../scenarios/scenario.types.js";

/**
 * AC1: every right row exactly once (or the documented boundary, asserted as such), every wrong row
 * shows its failure — so the injection bites. Every number is the stub's own.
 */
export function describeRows(scenarios: readonly PaymentScenario[]): void {
  for (const scenario of scenarios)
    describe(`${scenario.id}: ${scenario.title}`, () => {
      for (const row of scenario.rows) {
        const boundary = row.right.boundary;
        scenarioTest(row, Variant.Right)(
          boundary === undefined
            ? `${row.row}: right — exactly once`
            : `${row.row}: right — today's known boundary ${boundary}, not a guarantee`,
          (outcome) => {
            assertShows(outcome, row.right);
            expect(outcome.variant).toBe(Variant.Right);
          },
        );
        const wrong = row.wrong;
        if (wrong !== undefined)
          scenarioTest(row, Variant.Wrong)(`${row.row}: wrong — the failure shows in the stub's records`, (outcome) => {
            assertShows(outcome, wrong);
            expect(outcome.variant).toBe(Variant.Wrong);
          });
      }
    });
}
