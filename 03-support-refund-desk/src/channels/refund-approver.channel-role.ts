import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { APPROVAL_REMINDER, APPROVAL_WINDOW } from "../config/approval-window.js";
import { RefundApprovalAskDto } from "../dto/refund-approval-ask.dto.js";
import { RefundApprovalDecisionDto } from "../dto/refund-approval-decision.dto.js";

/** The first approver: the on-call support lead, who has `APPROVAL_EXPIRES_IN` to answer. */
@ChannelRole({
  name: "refund-approver-question",
  description: "Asks the on-call support lead to approve a refund above the self-service cap",
  ask: RefundApprovalAskDto,
  answer: RefundApprovalDecisionDto,
  answerer: PauseAnswerer.Channel,
  expiresIn: APPROVAL_WINDOW,
  remindBefore: APPROVAL_REMINDER,
})
export abstract class RefundApproverQuestion extends ChannelOf<RefundApproverQuestion> {}
