import {
  Channel,
  ChannelOf,
  ChannelOutcome,
  ChannelRole,
  PauseAnswerer,
  type ChannelAsk,
} from "agboss";
import { RefundOrderDto } from "../support.dto.js";
import { SupervisorQueueService } from "../support.services.js";

@ChannelRole({
  name: "refund-sign-off-channel",
  description: "A supervisor signs off a large refund before it is issued",
  approves: RefundOrderDto,
  answeredBy: PauseAnswerer.ThreadOwner,
})
export abstract class RefundSignOffChannel extends ChannelOf<RefundSignOffChannel> {}

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
