import { testArbiter } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { BudgetCheckAgent } from "../../src/agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../src/agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../src/agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../src/agents/price-benchmark/price-benchmark.agent.js";
import { WellFormedReviewArbiter } from "../../src/arbiters/well-formed-review/well-formed-review.arbiter.js";
import {
  BUDGET_OK,
  COMPLIANCE_OK,
  COMPLIANCE_UNCITED,
  LEGAL_CLEARED,
  PRICE_FAIR,
} from "../support/reviews.js";

/** Every `@OnAnswer` path of the code arbiter: a review counts only when it cites what it rests on. */

const runArbiter = testArbiter(WellFormedReviewArbiter);

describe("WellFormedReviewArbiter — a review cites a clause, a source or a budget line", () => {
  it("the legal review: a clause counts, a blank one does not", async () => {
    expect((await runArbiter(LegalReviewAgent, LEGAL_CLEARED)).output).toBe(true);
    expect((await runArbiter(LegalReviewAgent, { ...LEGAL_CLEARED, clause: "  " })).output).toBe(
      false,
    );
  });

  it("the compliance review: a clause counts, none does not", async () => {
    expect((await runArbiter(ComplianceReviewAgent, COMPLIANCE_OK)).output).toBe(true);
    expect((await runArbiter(ComplianceReviewAgent, COMPLIANCE_UNCITED)).output).toBe(false);
  });

  it("the price benchmark: a source counts, none does not", async () => {
    expect((await runArbiter(PriceBenchmarkAgent, PRICE_FAIR)).output).toBe(true);
    expect((await runArbiter(PriceBenchmarkAgent, { ...PRICE_FAIR, source: "" })).output).toBe(
      false,
    );
  });

  it("the budget check: a budget line counts, none does not", async () => {
    expect((await runArbiter(BudgetCheckAgent, BUDGET_OK)).output).toBe(true);
    expect((await runArbiter(BudgetCheckAgent, { ...BUDGET_OK, budgetLine: "" })).output).toBe(
      false,
    );
  });

  it("a code arbiter calls no model: $0", async () => {
    const run = await runArbiter(LegalReviewAgent, LEGAL_CLEARED);

    expect(run.spend.calls).toBe(0);
  });
});
