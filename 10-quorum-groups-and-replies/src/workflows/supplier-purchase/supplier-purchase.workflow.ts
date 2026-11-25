import { QuorumNotReachedError, toAction, toFinish, Workflow, onStart, toAgent, Ttl } from "@agboss/core";
import { minutes } from "@agboss/core/units";
import { DeferPurchaseAction } from "../../actions/defer-purchase.action.js";
import { BudgetCheckAgent } from "../../agents/budget-check/budget-check.agent.js";
import { ComplianceReviewAgent } from "../../agents/compliance-review/compliance-review.agent.js";
import { LegalReviewAgent } from "../../agents/legal-review/legal-review.agent.js";
import { PriceBenchmarkAgent } from "../../agents/price-benchmark/price-benchmark.agent.js";
import { PurchaseOrderAgent } from "../../agents/purchase-order/purchase-order.agent.js";
import { PurchasePolicyArbiter } from "../../arbiters/purchase-policy/purchase-policy.arbiter.js";
import { PurchaseDeferredWorkflowFinish } from "./purchase-deferred.workflow-finish.js";
import { PurchaseOrderedWorkflowFinish } from "./purchase-ordered.workflow-finish.js";
import { PurchaseRejectedWorkflowFinish } from "./purchase-rejected.workflow-finish.js";
import { PurchaseRequestWorkflowStart } from "./purchase-request.workflow-start.js";

/**
 * Four reviews of a purchase at once, in two quorum groups. Every answer passes an
 * arbiter before it counts — `PurchasePolicyArbiter` (code: it cites a clause or a source and clears
 * the policy's threshold; its own decision model only when the code rejects the threshold) — and each branch's verdict is recorded (`result.launches[0].branches`). The
 * first group complete by priority goes on its own path: legal + compliance (1) to the order, which
 * waits for an approver's free-text reply; price + budget (2) to a deferral. Neither in time →
 * `QuorumNotReachedError` → the rejected finish.
 */
@Workflow({
  name: "supplier-purchase-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(PurchaseRequestWorkflowStart)
      .inParallel([toAgent(LegalReviewAgent), toAgent(ComplianceReviewAgent), toAgent(PriceBenchmarkAgent), toAgent(BudgetCheckAgent)])
      .arbitratedBy(PurchasePolicyArbiter)
      .joinQuorumGroups({ deadline: minutes(2) })
      .onError(QuorumNotReachedError, toFinish(PurchaseRejectedWorkflowFinish))
      .onGroup(
        [LegalReviewAgent, ComplianceReviewAgent],
        { priority: 1 },
        toAgent(PurchaseOrderAgent)
          .toFinish(PurchaseOrderedWorkflowFinish),
      )
      .onGroup(
        [PriceBenchmarkAgent, BudgetCheckAgent],
        { priority: 2 },
        toAction(DeferPurchaseAction)
          .toFinish(PurchaseDeferredWorkflowFinish),
      ),
  ],
  defaults: { models: { temperature: 0 } },
})
export class SupplierPurchaseWorkflow {}
