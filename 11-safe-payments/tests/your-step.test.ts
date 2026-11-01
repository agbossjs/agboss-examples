import { describe, expect } from "vitest";
import { mismatchesOf } from "../scenarios/expect.js";
import { SCENARIOS } from "../scenarios/index.js";
import { scenarioTest } from "../scenarios/run-scenario.js";
import { Variant } from "../scenarios/scenario.types.js";
import { ForgotRefundKeyPaymentOperations } from "./fixtures/forgot-refund-key.payment-operations.js";

/**
 * AC3 — "check your own gateway call" catches a step that forgets the idempotency key on a refund:
 * the refund-retry scenario (PS19) turns red, and no row without a refund does.
 */
describe("a step that forgets the refund key", () => {
  for (const scenario of SCENARIOS)
    for (const row of scenario.rows) {
      if (row.right.boundary !== undefined || row.rightOperations !== undefined) continue;
      const operations = ForgotRefundKeyPaymentOperations;
      if (row.row === "ps19")
        scenarioTest(row, Variant.Right, { operations })("a step that forgets the refund key turns ps19 red", (outcome) => {
          expect(mismatchesOf(outcome, row.right)).toContain("refunds: 2, expected 1");
        });
      else if (row.refundRow !== true)
        scenarioTest(row, Variant.Right, { operations })(`${row.row} stays green (no refund in it)`, (outcome) => {
          expect(mismatchesOf(outcome, row.right)).toEqual([]);
        });
    }
});
