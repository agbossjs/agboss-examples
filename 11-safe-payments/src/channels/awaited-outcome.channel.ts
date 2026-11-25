import { Channel, ChannelOutcome, TenantContext, type ChannelAsk } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { OrderBookRepository } from "../repositories/order-book.repository.js";
import { ThreeDsOutcomeToolApproval } from "./three-ds-outcome.tool-approval.js";

/** Notes which pause the order's 3DS outcome answers, and waits for it. */
@Channel({
  name: "awaited-outcome-channel",
  description: "Waits for the 3DS outcome of a payment",
  target: ThreeDsOutcomeToolApproval,
  ttl: hours(24),
  deps: [OrderBookRepository, TenantContext],
})
export class AwaitedOutcomeChannel {
  constructor(
    private readonly orderBookRepository: OrderBookRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  send(ask: ChannelAsk<ThreeDsOutcomeToolApproval>): Promise<ChannelOutcome<ThreeDsOutcomeToolApproval>> {
    const { orderId } = ask.input as { orderId: string };
    const { tenantId } = this.tenantContext;
    const chargeId = this.orderBookRepository.order(tenantId, orderId)?.chargeId ?? "unknown";
    this.orderBookRepository.awaitOutcome(ask.pauseId, tenantId, orderId, chargeId);
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}
