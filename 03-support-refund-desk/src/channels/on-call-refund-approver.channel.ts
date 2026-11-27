import { Channel, ChannelOutcome, type ChannelAsk, type ChannelPauseExpiringEvent, type ChannelPauseTimeoutChangedEvent } from "@agboss/core";
import { days } from "@agboss/core/units";
import { ApprovalInboxService } from "../services/approval-inbox.service.js";
import { RefundApproverExternalTask } from "./refund-approver.external-task.js";

@Channel({
  name: "on-call-refund-approver-channel",
  description: "Posts the refund approval to the on-call support lead's inbox",
  deps: [ApprovalInboxService],
  target: RefundApproverExternalTask,
  ttl: days(14), // how long a closed pause is kept for the channel
})
export class OnCallRefundApproverChannel {
  constructor(private readonly inbox: ApprovalInboxService) {}

  send(ask: ChannelAsk<RefundApproverExternalTask>): Promise<ChannelOutcome<RefundApproverExternalTask>> {
    this.inbox.post({
      approver: "approver",
      pauseId: ask.pauseId,
      orderId: ask.input.orderId,
      amountUsd: ask.input.amountUsd,
      customerEmail: ask.input.customerEmail,
      reason: ask.input.reason,
    });
    return Promise.resolve(ChannelOutcome.awaitReply());
  }

  // told once per deadline (`remindBefore` on the target), at least once: the inbox line is idempotent
  onPauseExpiring(event: ChannelPauseExpiringEvent<RefundApproverExternalTask>): Promise<void> {
    this.inbox.note(`reminder: ${event.input.orderId} expires at ${event.expiresAt.toISOString()} (${event.deliveryId})`);
    return Promise.resolve();
  }

  // told when `app.setPauseTimeout` moved the deadline; the reminder is made again before the new one
  onPauseTimeoutChanged(event: ChannelPauseTimeoutChangedEvent<RefundApproverExternalTask>): Promise<void> {
    this.inbox.note(`extended: ${event.input.orderId} until ${event.expiresAt?.toISOString() ?? "no deadline"}`);
    return Promise.resolve();
  }
}
