import {
  Channel,
  ChannelOutcome,
  type ChannelAsk,
  type ChannelPauseExpiringEvent,
  type ChannelPauseExtendedEvent,
} from "@agboss/core";
import { ApprovalInboxService } from "../services/approval-inbox.service.js";
import { RefundApproverQuestion } from "./refund-approver.channel-role.js";

@Channel({
  name: "on-call-refund-approver-channel",
  description: "Posts the refund approval to the on-call support lead's inbox",
  deps: [ApprovalInboxService],
})
export class OnCallRefundApproverChannel extends RefundApproverQuestion {
  constructor(private readonly inbox: ApprovalInboxService) {
    super();
  }

  send(ask: ChannelAsk<RefundApproverQuestion>): Promise<ChannelOutcome<RefundApproverQuestion>> {
    this.inbox.post({
      approver: "approver",
      pauseId: ask.pauseId,
      orderId: ask.value.orderId,
      amountUsd: ask.value.amountUsd,
    });
    return Promise.resolve(ChannelOutcome.awaitReply());
  }

  // told once per deadline (`remindBefore` on the role), at least once: the inbox line is idempotent
  override onPauseExpiring(event: ChannelPauseExpiringEvent<RefundApproverQuestion>): Promise<void> {
    this.inbox.note(`reminder: ${event.value.orderId} expires at ${event.expiresAt} (${event.deliveryId})`);
    return Promise.resolve();
  }

  // told when `app.extendPause` moved the deadline; the reminder is made again before the new one
  override onPauseExtended(event: ChannelPauseExtendedEvent<RefundApproverQuestion>): Promise<void> {
    this.inbox.note(`extended: ${event.value.orderId} until ${event.expiresAt}`);
    return Promise.resolve();
  }
}
