import {
  Channel,
  ChannelOutcome,
  PauseExpiration,
  type ChannelAsk,
  type PauseExpiryHandler,
} from "@agboss/core";
import { ApprovalInboxService } from "../services/approval-inbox.service.js";
import { SeniorRefundApproverQuestion } from "./senior-refund-approver.channel-role.js";

@Channel({
  name: "on-call-senior-approver-channel",
  description: "Posts the escalated refund approval to the head of support's inbox",
  deps: [ApprovalInboxService],
})
export class OnCallSeniorApproverChannel
  extends SeniorRefundApproverQuestion
  implements PauseExpiryHandler<SeniorRefundApproverQuestion>
{
  constructor(private readonly inbox: ApprovalInboxService) {
    super();
  }

  send(
    ask: ChannelAsk<SeniorRefundApproverQuestion>,
  ): Promise<ChannelOutcome<SeniorRefundApproverQuestion>> {
    this.inbox.post({
      approver: "senior-approver",
      pauseId: ask.pauseId,
      orderId: ask.value.orderId,
      amountUsd: ask.value.amountUsd,
      customerEmail: ask.value.customerEmail,
      reason: ask.value.reason,
    });
    return Promise.resolve(ChannelOutcome.awaitReply());
  }

  /**
   * Nobody is left to escalate to: when the head of support does not answer either, the desk
   * declines — an answer the channel gives, recorded as the channel's own (`DecidedOnExpiry`),
   * never an approval nobody looked at. Without this method the step would fail with
   * `PauseExpiredError`. It runs once per expiry and only reads.
   */
  onPauseExpired(): PauseExpiration<SeniorRefundApproverQuestion> {
    return PauseExpiration.decide({
      approved: false,
      comment: "nobody answered in time: declined by the desk",
    });
  }
}
