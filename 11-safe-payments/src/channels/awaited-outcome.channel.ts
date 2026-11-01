import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { OrderBookRepository } from "../repositories/order-book.repository.js";
import { ThreeDsOutcomeChannel } from "./three-ds-outcome.channel-role.js";

/** Notes which pause the order's 3DS outcome answers, and waits for it. */
@Channel({
  name: "awaited-outcome-channel",
  description: "Waits for the 3DS outcome of a payment",
  deps: [OrderBookRepository],
})
export class AwaitedOutcomeChannel extends ThreeDsOutcomeChannel {
  constructor(private readonly orderBookRepository: OrderBookRepository) {
    super();
  }

  send(ask: ChannelAsk<ThreeDsOutcomeChannel>): Promise<ChannelOutcome<ThreeDsOutcomeChannel>> {
    const { orderId } = ask.value.arguments;
    const chargeId = this.orderBookRepository.order(orderId)?.chargeId ?? "unknown";
    this.orderBookRepository.awaitOutcome(ask.pauseId, orderId, chargeId);
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}
