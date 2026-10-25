import { Channel, ChannelOutcome, type ChannelAsk } from "agboss";
import { SupervisorQueueService } from "../services/supervisor-queue.service.js";
import { RefundSignOffChannel } from "./refund-sign-off.channel-role.js";

@Channel({
  name: "supervisor-queue-refund-sign-off-channel",
  description: "Puts the refund in the supervisors' queue",
  deps: [SupervisorQueueService],
})
export class SupervisorQueueRefundSignOffChannel extends RefundSignOffChannel {
  constructor(private readonly supervisorQueueService: SupervisorQueueService) {
    super();
  }

  async send(
    ask: ChannelAsk<RefundSignOffChannel>,
  ): Promise<ChannelOutcome<RefundSignOffChannel>> {
    const { orderId, amountCents } = ask.value.arguments;
    await this.supervisorQueueService.notify(
      ask.pauseId,
      `Refund ${String(amountCents)} cents on order ${orderId}?`,
    );
    return ChannelOutcome.awaitReply();
  }
}
