import { Arbiter, DecidedBy } from "@agboss/core";
import { BudgetCheckAgent } from "../../agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../agents/price-benchmark/price-benchmark.agent.js";
import { DECISION_MODEL } from "../../model-providers/models.js";

/**
 * By model, the fallback of `anyOf(PolicyThresholdArbiter, PolicyJudgementArbiter)`: asked only
 * about a review the threshold arbiter rejected — whether its findings still let the purchase go
 * ahead (a remediation named, a justified exception). One decision per answer, paid, under
 * `arbiter:policy-judgement-arbiter`.
 */
@Arbiter({
  name: "policy-judgement-arbiter",
  decidedBy: DecidedBy.Model,
  model: DECISION_MODEL,
  prompt:
    "A review of a purchase did not clear the purchasing policy's threshold. Count it only if its " +
    "findings still let the purchase go ahead, by the criterion of the review that gave it.",
  criteria: [
    { agent: LegalReviewAgent, prompt: "The findings name a remediation that makes the contract acceptable" },
    { agent: ComplianceReviewAgent, prompt: "The findings name a remediation that makes the supplier compliant" },
    { agent: PriceBenchmarkAgent, prompt: "The findings justify the price above the benchmark" },
    { agent: BudgetCheckAgent, prompt: "The findings name where the missing budget comes from" },
  ],
})
export class PolicyJudgementArbiter {}
