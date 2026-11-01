import { Arbiter, DecidedBy, OnAnswer, type ArbiterAnswerOf } from "@agboss/core";
import { BudgetCheckAgent } from "../../agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../agents/price-benchmark/price-benchmark.agent.js";

/**
 * By code, first of the chain: a review counts only when it cites what it rests on — a clause, a
 * source, a budget line. A review that cites nothing is `Rejected` by this arbiter
 * (`rejectedBy: ["well-formed-review-arbiter"]`) and its group cannot complete. One `@OnAnswer`
 * per agent of the launch (`[arbiter.unhandled-agent]` otherwise).
 */
@Arbiter({
  name: "well-formed-review-arbiter",
  decidedBy: DecidedBy.Code,
})
export class WellFormedReviewArbiter {
  @OnAnswer(LegalReviewAgent)
  fromLegalReview(answer: ArbiterAnswerOf<typeof LegalReviewAgent>): boolean {
    return this.isCited(answer.clause);
  }

  @OnAnswer(ComplianceReviewAgent)
  fromComplianceReview(answer: ArbiterAnswerOf<typeof ComplianceReviewAgent>): boolean {
    return this.isCited(answer.clause);
  }

  @OnAnswer(PriceBenchmarkAgent)
  fromPriceBenchmark(answer: ArbiterAnswerOf<typeof PriceBenchmarkAgent>): boolean {
    return this.isCited(answer.source);
  }

  @OnAnswer(BudgetCheckAgent)
  fromBudgetCheck(answer: ArbiterAnswerOf<typeof BudgetCheckAgent>): boolean {
    return this.isCited(answer.budgetLine);
  }

  private isCited(reference: string): boolean {
    return reference.trim().length > 0;
  }
}
