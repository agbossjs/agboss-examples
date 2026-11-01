import { Arbiter, DecidedBy, OnAnswer, type ArbiterAnswerOf } from "@agboss/core";
import { BudgetCheckAgent } from "../../agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../agents/price-benchmark/price-benchmark.agent.js";

/**
 * By code, the cheap half of `anyOf(PolicyThresholdArbiter, PolicyJudgementArbiter)`: a review that
 * clears the purchasing policy's thresholds counts at once — the contract cleared, the supplier
 * compliant, the price fair, something left on the budget line after the purchase (a number, checked here —
 * not the model's word for it). When it does not, the model arbiter
 * judges whether the review still holds; `anyOf` stops at the first that accepts, so the model is
 * asked only about the reviews this arbiter rejects.
 */
@Arbiter({
  name: "policy-threshold-arbiter",
  decidedBy: DecidedBy.Code,
})
export class PolicyThresholdArbiter {
  @OnAnswer(LegalReviewAgent)
  fromLegalReview(answer: ArbiterAnswerOf<typeof LegalReviewAgent>): boolean {
    return answer.isCleared;
  }

  @OnAnswer(ComplianceReviewAgent)
  fromComplianceReview(answer: ArbiterAnswerOf<typeof ComplianceReviewAgent>): boolean {
    return answer.isCompliant;
  }

  @OnAnswer(PriceBenchmarkAgent)
  fromPriceBenchmark(answer: ArbiterAnswerOf<typeof PriceBenchmarkAgent>): boolean {
    return answer.isFairPrice;
  }

  @OnAnswer(BudgetCheckAgent)
  fromBudgetCheck(answer: ArbiterAnswerOf<typeof BudgetCheckAgent>): boolean {
    // a number code can check beats a model's yes / no: the line carries it when something is left
    return answer.remainingUsd >= 0;
  }
}
