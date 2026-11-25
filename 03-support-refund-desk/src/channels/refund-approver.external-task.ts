import { ExternalTask, PauseRespondent } from "@agboss/core";
import { APPROVAL_REMINDER, APPROVAL_WINDOW } from "../config/approval-window.js";
import { RefundApprovalAskDto } from "../dto/refund-approval-ask.dto.js";
import { RefundApprovalDecisionDto } from "../dto/refund-approval-decision.dto.js";

/** The first approver: the on-call support lead, who has `APPROVAL_WINDOW` to answer. */
@ExternalTask({
  name: "refund-approver-external-task",
  description: "Asks the on-call support lead to approve a refund above the self-service cap",
  input: RefundApprovalAskDto,
  output: RefundApprovalDecisionDto,
  respondent: PauseRespondent.Delegate,
  timeout: APPROVAL_WINDOW,
  remindBefore: APPROVAL_REMINDER,
})
export class RefundApproverExternalTask {}
