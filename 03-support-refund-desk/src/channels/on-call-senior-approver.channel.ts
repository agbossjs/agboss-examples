import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { days } from "@agboss/core/units";
import { ApprovalInboxService } from "../services/approval-inbox.service.js";
import { SeniorRefundApproverExternalTask } from "./senior-refund-approver.external-task.js";

@Channel({
  name: "on-call-senior-approver-channel",
  description: "Posts the escalated refund approval to the head of support's inbox",
  deps: [ApprovalInboxService],
  target: SeniorRefundApproverExternalTask,
  ttl: days(14), // how long a closed pause is kept for the channel
})
export class OnCallSeniorApproverChannel {
  constructor(private readonly inbox: ApprovalInboxService) {}

  send(
    ask: ChannelAsk<SeniorRefundApproverExternalTask>,
  ): Promise<ChannelOutcome<SeniorRefundApproverExternalTask>> {
    this.inbox.post({
      approver: "senior-approver",
      pauseId: ask.pauseId,
      orderId: ask.input.orderId,
      amountUsd: ask.input.amountUsd,
      customerEmail: ask.input.customerEmail,
      reason: ask.input.reason,
    });
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}
