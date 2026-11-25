import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { days } from "@agboss/core/units";
import { SupervisorQueueService } from "../services/supervisor-queue.service.js";
import { RefundSignOffToolApproval } from "./refund-sign-off.tool-approval.js";

@Channel({
  name: "supervisor-queue-refund-sign-off-channel",
  description: "Puts the refund in the supervisors' queue",
  deps: [SupervisorQueueService],
  target: RefundSignOffToolApproval,
  ttl: days(14), // how long a closed pause is kept for the channel
})
export class SupervisorQueueRefundSignOffChannel {
  constructor(private readonly supervisorQueueService: SupervisorQueueService) {}

  async send(
    ask: ChannelAsk<RefundSignOffToolApproval>,
  ): Promise<ChannelOutcome<RefundSignOffToolApproval>> {
    const { orderId, amountCents } = ask.input;
    await this.supervisorQueueService.notify(
      ask.pauseId,
      `Refund ${String(amountCents)} cents on order ${String(orderId)}?`,
    );
    return ChannelOutcome.awaitReply();
  }
}
