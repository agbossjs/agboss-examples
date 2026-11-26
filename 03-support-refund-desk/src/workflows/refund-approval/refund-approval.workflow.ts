import { StepError, Workflow, toExternalTask, onStart, Ttl } from "@agboss/core";
import { SettleEscalatedRefundAction } from "../../actions/settle-refund.action.js";
import { SettleRefundAction } from "../../actions/settle-refund.action.js";
import { RefundApproverExternalTask } from "../../channels/refund-approver.external-task.js";
import { SeniorRefundApproverExternalTask } from "../../channels/senior-refund-approver.external-task.js";
import { SupportTicketIdPiiPolicy } from "../../pii-policies/support-ticket-id.pii-policy.js";
import { OrderBookService } from "../../services/order-book.service.js";
import { RefundApprovalWorkflowFinish } from "./refund-approval.workflow-finish.js";
import { RefundApprovalWorkflowStart } from "./refund-approval.workflow-start.js";

/**
 * The on-call support lead has `APPROVAL_EXPIRES_IN` to answer. When nobody does, the pause closes
 * `expired`, the question step fails with `StepError.PauseExpired` and the side path asks the head of
 * support, whose answer goes on to its own settle step.
 */
@Workflow({
  name: "refund-approval-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(RefundApprovalWorkflowStart)
      .toExternalTask(RefundApproverExternalTask)
      .onError(
        StepError.PauseExpired,
        toExternalTask(SeniorRefundApproverExternalTask)
          .toAction(SettleEscalatedRefundAction)
          .toFinish(RefundApprovalWorkflowFinish),
      )
      .toAction(SettleRefundAction)
      .toFinish(RefundApprovalWorkflowFinish),
  ],
  // every workflow of this application declares the ticket-id policy: the run's span input is masked
  // by the policies the workflows share, so one without it would leave `TCK-…` raw in the others' traces
  piiPolicies: [SupportTicketIdPiiPolicy],
  providers: [OrderBookService],
})
export class RefundApprovalWorkflow {}
