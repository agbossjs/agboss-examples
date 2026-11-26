import { ExternalTask, PauseExpiration, PauseRespondent, type PauseExpiryHandler } from "@agboss/core";
import { APPROVAL_WINDOW } from "../config/approval-window.js";
import { RefundApprovalAskDto } from "../dto/refund-approval-ask.dto.js";
import { RefundApprovalDecisionDto } from "../dto/refund-approval-decision.dto.js";

/**
 * The second approver, asked when the first did not answer in time. Nobody is left to escalate to:
 * when the head of support does not answer either, the desk declines — an answer the target gives,
 * recorded as its own (`DecidedOnExpiry`), never an approval nobody looked at. Without `onExpired`
 * the step would fail with `StepError.PauseExpired`. It runs once per expiry and only reads.
 */
@ExternalTask({
  name: "senior-refund-approver-external-task",
  description: "Asks the head of support when the first approver did not answer",
  input: RefundApprovalAskDto,
  output: RefundApprovalDecisionDto,
  respondent: PauseRespondent.Delegate,
  timeout: APPROVAL_WINDOW,
})
export class SeniorRefundApproverExternalTask
  implements PauseExpiryHandler<SeniorRefundApproverExternalTask>
{
  onExpired(): PauseExpiration<SeniorRefundApproverExternalTask> {
    return PauseExpiration.decide({
      approved: false,
      comment: "nobody answered in time: declined by the desk",
    });
  }
}
