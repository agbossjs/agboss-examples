import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { APPROVAL_WINDOW } from "../config/approval-window.js";
import { RefundApprovalAskDto } from "../dto/refund-approval-ask.dto.js";
import { RefundApprovalDecisionDto } from "../dto/refund-approval-decision.dto.js";

/** The second approver, asked when the first did not answer in time. */
@ChannelRole({
  name: "senior-refund-approver-question",
  description: "Asks the head of support when the first approver did not answer",
  ask: RefundApprovalAskDto,
  answer: RefundApprovalDecisionDto,
  answerer: PauseAnswerer.Channel,
  expiresIn: APPROVAL_WINDOW,
})
export abstract class SeniorRefundApproverQuestion extends ChannelOf<SeniorRefundApproverQuestion> {}
