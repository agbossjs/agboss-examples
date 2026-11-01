import {
  anyOf,
  group,
  QuorumNotReachedError,
  start,
  toFinish,
  Workflow,
} from "@agboss/core";
import { minutes } from "@agboss/core/units";
import { DeferPurchaseAction } from "../../actions/defer-purchase.action.js";
import { BudgetCheckAgent } from "../../agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../agents/price-benchmark/price-benchmark.agent.js";
import { PurchaseOrderAgent } from "../../agents/purchase-order/purchase-order.agent.js";
import { PolicyJudgementArbiter } from "../../arbiters/policy-judgement/policy-judgement.arbiter.js";
import { PolicyThresholdArbiter } from "../../arbiters/policy-threshold/policy-threshold.arbiter.js";
import { WellFormedReviewArbiter } from "../../arbiters/well-formed-review/well-formed-review.arbiter.js";
import { BudgetCheckDto } from "../../dto/budget-check.dto.js";
import { ComplianceReviewDto } from "../../dto/compliance-review.dto.js";
import { LegalReviewDto } from "../../dto/legal-review.dto.js";
import { PriceBenchmarkDto } from "../../dto/price-benchmark.dto.js";
import { PurchaseDeferredDto } from "../../dto/purchase-deferred.dto.js";
import { PurchaseOrderDto } from "../../dto/purchase-order.dto.js";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";
import { PurchaseDeferredWorkflowFinish } from "./purchase-deferred.workflow-finish.js";
import { PurchaseOrderedWorkflowFinish } from "./purchase-ordered.workflow-finish.js";
import { PurchaseRejectedWorkflowFinish } from "./purchase-rejected.workflow-finish.js";
import { PurchaseRequestWorkflowStart } from "./purchase-request.workflow-start.js";

/**
 * Four reviews of a purchase at once, in two quorum groups. Every answer passes a chain of
 * arbiters before it counts — `WellFormedReviewArbiter` (code: it cites a clause or a source),
 * then `anyOf(PolicyThresholdArbiter, PolicyJudgementArbiter)` (code first; the model only when
 * the code rejects) — and each branch's verdict is recorded (`result.launches[0].branches`). The
 * first group complete by priority goes on its own path: legal + compliance (1) to the order, which
 * waits for an approver's free-text reply; price + budget (2) to a deferral. Neither in time →
 * `QuorumNotReachedError` → the rejected finish.
 */
@Workflow({
  name: "supplier-purchase-workflow",
  version: "1.0.0",
  flow: [
    start(PurchaseRequestWorkflowStart)
      .returns(PurchaseRequestDto)
      .toParallelAgents(LegalReviewAgent, ComplianceReviewAgent, PriceBenchmarkAgent, BudgetCheckAgent)
      .acceptedBy(WellFormedReviewArbiter)
      .acceptedBy(anyOf(PolicyThresholdArbiter, PolicyJudgementArbiter))
      .joinQuorumGroups(
        group(LegalReviewAgent, ComplianceReviewAgent)
          .priority(1)
          .returns(LegalReviewDto)
          .returns(ComplianceReviewDto)
          .toAgent(PurchaseOrderAgent)
          .returns(PurchaseOrderDto)
          .toFinish(PurchaseOrderedWorkflowFinish),
        group(PriceBenchmarkAgent, BudgetCheckAgent)
          .priority(2)
          .returns(PriceBenchmarkDto)
          .returns(BudgetCheckDto)
          .toAction(DeferPurchaseAction)
          .returns(PurchaseDeferredDto)
          .toFinish(PurchaseDeferredWorkflowFinish),
        { deadline: minutes(2) },
      )
      .onJoinError(QuorumNotReachedError, toFinish(PurchaseRejectedWorkflowFinish)),
  ],
  defaults: { models: { temperature: 0 } },
})
export class SupplierPurchaseWorkflow {}
