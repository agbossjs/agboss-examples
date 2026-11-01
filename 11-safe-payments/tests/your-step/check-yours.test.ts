import { describe, expect } from "vitest";
import { mismatchesOf } from "../../scenarios/expect.js";
import { SCENARIOS } from "../../scenarios/index.js";
import { scenarioTest } from "../../scenarios/run-scenario.js";
import { Variant } from "../../scenarios/scenario.types.js";
import { YourPaymentOperations } from "../../src/your-step/your-payment-operations.js";

/**
 * `npm run check:yours` — every scenario's right-version assertion with YOUR `PaymentOperations`
 * (`src/your-step/your-payment-operations.ts`) instead of the example's. The rows that assert
 * today's known boundary of the framework (#657, #658) and the rows of another wiring (PS17 d) are
 * not about your step and are left out.
 */
describe("your gateway call, through every scenario", () => {
  for (const scenario of SCENARIOS)
    for (const row of scenario.rows)
      if (row.right.boundary === undefined && row.rightOperations === undefined)
        scenarioTest(row, Variant.Right, { operations: YourPaymentOperations })(`${row.row}: exactly once with yours`, (outcome) => {
          expect(mismatchesOf(outcome, row.right)).toEqual([]);
        });
});
