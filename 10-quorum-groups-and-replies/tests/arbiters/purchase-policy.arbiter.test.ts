import { decideWith, testUnit } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect, it } from "vitest";
import { BudgetCheckAgent } from "../../src/agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../src/agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../src/agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../src/agents/price-benchmark/price-benchmark.agent.js";
import { PurchasePolicyArbiter } from "../../src/arbiters/purchase-policy/purchase-policy.arbiter.js";
import { BUDGET_OK, COMPLIANCE_OK, COMPLIANCE_UNCITED, LEGAL_CLEARED, PRICE_FAIR } from "../support/reviews.js";

/**
 * One arbiter, three steps (#1282: no `anyOf`): a review must be cited (code), then clear the
 * policy's threshold (code, $0), and only a review that cites but misses its threshold is put to the
 * arbiter's own decision model — one paid decision per answer, under `arbiter:<name>`.
 */

const runArbiter = testUnit(PurchasePolicyArbiter, { model: decideWith({ counts: 0.9 }) });

describe("PurchasePolicyArbiter — well formed", () => {
  it("the legal review: a clause counts, a blank one does not (and no model is asked)", async () => {
    expect((await runArbiter(LegalReviewAgent, LEGAL_CLEARED)).output).toBe(true);
    const blank = await runArbiter(LegalReviewAgent, { ...LEGAL_CLEARED, clause: "  ", isCleared: false });
    expect(blank.output).toBe(false);
    expect(blank.spend.totalUsd).toBe(0);
  });

  it("the compliance review: a clause counts, none does not", async () => {
    expect((await runArbiter(ComplianceReviewAgent, COMPLIANCE_OK)).output).toBe(true);
    expect((await runArbiter(ComplianceReviewAgent, COMPLIANCE_UNCITED)).output).toBe(false);
  });

  it("the price benchmark: a source counts, none does not", async () => {
    expect((await runArbiter(PriceBenchmarkAgent, PRICE_FAIR)).output).toBe(true);
    expect((await runArbiter(PriceBenchmarkAgent, { ...PRICE_FAIR, source: "", isFairPrice: false })).output).toBe(false);
  });

  it("the budget check: a budget line counts, none does not", async () => {
    expect((await runArbiter(BudgetCheckAgent, BUDGET_OK)).output).toBe(true);
    expect((await runArbiter(BudgetCheckAgent, { ...BUDGET_OK, budgetLine: "" })).output).toBe(false);
  });
});

describe("PurchasePolicyArbiter — the policy's thresholds, at $0", () => {
  it("a review that clears its threshold counts without a model call", async () => {
    for (const run of [
      await runArbiter(LegalReviewAgent, LEGAL_CLEARED),
      await runArbiter(ComplianceReviewAgent, COMPLIANCE_OK),
      await runArbiter(PriceBenchmarkAgent, PRICE_FAIR),
      await runArbiter(BudgetCheckAgent, { ...BUDGET_OK, remainingUsd: 0 }),
    ]) {
      expect(run.output).toBe(true);
      expect(run.spend.totalUsd).toBe(0);
    }
  });
});

describe("PurchasePolicyArbiter — a decision model judges a cited review the thresholds rejected", () => {
  it("P(counts) above one half: the review counts; the decision is paid under arbiter:<name>", async () => {
    const run = await testUnit(PurchasePolicyArbiter, {
      model: decideWith({ counts: 0.9 }, { cost: usd(0.00002) }),
    })(PriceBenchmarkAgent, { ...PRICE_FAIR, isFairPrice: false });

    expect(run.output).toBe(true);
    expect(run.spend.byCaller).toEqual({ "arbiter:purchase-policy-arbiter": 0.00002 });
  });

  it("P(counts) below one half: the review does not count", async () => {
    const run = await testUnit(PurchasePolicyArbiter, { model: decideWith({ counts: 0.1 }) })(
      BudgetCheckAgent,
      { ...BUDGET_OK, remainingUsd: -200 },
    );

    expect(run.output).toBe(false);
  });
});
