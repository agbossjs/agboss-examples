import { testArbiter } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { BudgetCheckAgent } from "../../src/agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../src/agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../src/agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../src/agents/price-benchmark/price-benchmark.agent.js";
import { PolicyThresholdArbiter } from "../../src/arbiters/policy-threshold/policy-threshold.arbiter.js";
import { BUDGET_OK, COMPLIANCE_OK, LEGAL_CLEARED, PRICE_FAIR } from "../support/reviews.js";

/** Every `@OnAnswer` path of the cheap half of the `anyOf`: the policy's thresholds, in code. */

const runArbiter = testArbiter(PolicyThresholdArbiter);

describe("PolicyThresholdArbiter — the purchasing policy's thresholds", () => {
  it("the legal review counts when the contract is cleared", async () => {
    expect((await runArbiter(LegalReviewAgent, LEGAL_CLEARED)).output).toBe(true);
    expect((await runArbiter(LegalReviewAgent, { ...LEGAL_CLEARED, isCleared: false })).output).toBe(
      false,
    );
  });

  it("the compliance review counts when the supplier complies", async () => {
    expect((await runArbiter(ComplianceReviewAgent, COMPLIANCE_OK)).output).toBe(true);
    expect(
      (await runArbiter(ComplianceReviewAgent, { ...COMPLIANCE_OK, isCompliant: false })).output,
    ).toBe(false);
  });

  it("the price benchmark counts when the price is fair", async () => {
    expect((await runArbiter(PriceBenchmarkAgent, PRICE_FAIR)).output).toBe(true);
    expect((await runArbiter(PriceBenchmarkAgent, { ...PRICE_FAIR, isFairPrice: false })).output).toBe(
      false,
    );
  });

  it("the budget check counts when something is left on the line — 0 counts, -1 does not", async () => {
    expect((await runArbiter(BudgetCheckAgent, BUDGET_OK)).output).toBe(true);
    expect((await runArbiter(BudgetCheckAgent, { ...BUDGET_OK, remainingUsd: 0 })).output).toBe(true);
    expect((await runArbiter(BudgetCheckAgent, { ...BUDGET_OK, remainingUsd: -1 })).output).toBe(
      false,
    );
  });
});
