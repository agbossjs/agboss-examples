import { PauseExpiredError, Workflow, start, toQuestion } from "@agboss/core";
import { SettleEscalatedRefundAction } from "../../actions/settle-refund.action.js";
import { SettleRefundAction } from "../../actions/settle-refund.action.js";
import { RefundApproverQuestion } from "../../channels/refund-approver.channel-role.js";
import { SeniorRefundApproverQuestion } from "../../channels/senior-refund-approver.channel-role.js";
import { RefundApprovalAskDto } from "../../dto/refund-approval-ask.dto.js";
import { RefundApprovalDecisionDto } from "../../dto/refund-approval-decision.dto.js";
import { RefundApprovalOutcomeDto } from "../../dto/refund-approval-outcome.dto.js";
import { SupportTicketIdPiiPolicy } from "../../pii-policies/support-ticket-id.pii-policy.js";
import { OrderBookService } from "../../services/order-book.service.js";
import { RefundApprovalWorkflowFinish } from "./refund-approval.workflow-finish.js";
import { RefundApprovalWorkflowStart } from "./refund-approval.workflow-start.js";

/**
 * The on-call support lead has `APPROVAL_EXPIRES_IN` to answer. When nobody does, the pause closes
 * `expired`, the question step fails with `PauseExpiredError` and the side path asks the head of
 * support, whose answer goes on to its own settle step.
 */
@Workflow({
  name: "refund-approval-workflow",
  version: "1.0.0",
  flow: [
    start(RefundApprovalWorkflowStart)
      .returns(RefundApprovalAskDto)
      .toQuestion(RefundApproverQuestion)
      .onError(
        PauseExpiredError,
        toQuestion(SeniorRefundApproverQuestion)
          .returns(RefundApprovalDecisionDto)
          .toAction(SettleEscalatedRefundAction)
          .returns(RefundApprovalOutcomeDto)
          .toFinish(RefundApprovalWorkflowFinish),
      )
      .returns(RefundApprovalDecisionDto)
      .toAction(SettleRefundAction)
      .returns(RefundApprovalOutcomeDto)
      .toFinish(RefundApprovalWorkflowFinish),
  ],
  // every workflow of this application declares the ticket-id policy: the run's span input is masked
  // by the policies the workflows share, so one without it would leave `TCK-…` raw in the others' traces
  piiPolicies: [SupportTicketIdPiiPolicy],
  providers: [OrderBookService],
})
export class RefundApprovalWorkflow {}
