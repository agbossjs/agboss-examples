import { Arbiter, Arbitrate, ArbiterModel, Decision, type ArbiterAnswerOf } from "@agboss/core";
import { BudgetCheckAgent } from "../../agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../agents/price-benchmark/price-benchmark.agent.js";
import { DecisionsModelProvider } from "../../model-providers/openrouter.model-provider.js";
import { DECISION_MODEL } from "../../model-providers/models.js";

/**
 * One arbiter for the launch (#1282: no `anyOf`, no chain — the rule, and how it escalates from code
 * to a model, live in the class). A review counts when it is well formed, then when it clears the
 * purchasing policy's threshold, and only otherwise a decision model is asked whether its findings
 * still let the purchase go ahead:
 *
 * 1. **well formed** (code): the review cites what it rests on — a clause, a source, a budget line. A
 *    review that cites nothing is rejected without a model call; its group cannot complete.
 * 2. **the threshold** (code, `$0`): the contract cleared, the supplier compliant, the price fair,
 *    something left on the budget line after the purchase (a number, checked here — not the model's word for it).
 * 3. **the judgement** (`ArbiterModel`): a review that missed its threshold counts only if its findings still
 *    let the purchase go ahead, by the criterion of the review that gave it — one decision per answer,
 *    paid, under `arbiter:purchase-policy-arbiter`.
 */
@Arbiter({
  name: "purchase-policy-arbiter",
  deps: [ArbiterModel],
  model: DECISION_MODEL,
  modelProvider: DecisionsModelProvider,
})
export class PurchasePolicyArbiter {
  constructor(private readonly arbiterModel: ArbiterModel) {}

  @Arbitrate(LegalReviewAgent)
  fromLegalReview(answer: ArbiterAnswerOf<typeof LegalReviewAgent>): Promise<boolean> {
    return this.counts(answer, {
      isCited: answer.clause,
      clearsThreshold: answer.isCleared,
      criterion: "The findings name a remediation that makes the contract acceptable",
    });
  }

  @Arbitrate(ComplianceReviewAgent)
  fromComplianceReview(answer: ArbiterAnswerOf<typeof ComplianceReviewAgent>): Promise<boolean> {
    return this.counts(answer, {
      isCited: answer.clause,
      clearsThreshold: answer.isCompliant,
      criterion: "The findings name a remediation that makes the supplier compliant",
    });
  }

  @Arbitrate(PriceBenchmarkAgent)
  fromPriceBenchmark(answer: ArbiterAnswerOf<typeof PriceBenchmarkAgent>): Promise<boolean> {
    return this.counts(answer, {
      isCited: answer.source,
      clearsThreshold: answer.isFairPrice,
      criterion: "The findings justify the price above the benchmark",
    });
  }

  @Arbitrate(BudgetCheckAgent)
  fromBudgetCheck(answer: ArbiterAnswerOf<typeof BudgetCheckAgent>): Promise<boolean> {
    return this.counts(answer, {
      isCited: answer.budgetLine,
      // a number code can check beats a model's yes / no: the line carries it when something is left
      clearsThreshold: answer.remainingUsd >= 0,
      criterion: "The findings name where the missing budget comes from",
    });
  }

  private async counts(
    review: object,
    check: { readonly isCited: string; readonly clearsThreshold: boolean; readonly criterion: string },
  ): Promise<boolean> {
    if (check.isCited.trim().length === 0) return false;
    if (check.clearsThreshold) return true;
    const judged = await this.arbiterModel.decide({
      state: {
        instructions:
          "A review of a purchase did not clear the purchasing policy's threshold. Count it only if its " +
          "findings still let the purchase go ahead, by the criterion of the review that gave it.",
        review: JSON.stringify(review),
      },
      questions: { counts: Decision.boolean(check.criterion) },
    });
    return judged.counts.probability > 0.5;
  }
}
