import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { GatewayEventDto } from "../dto/gateway-event.dto.js";
import { OrderStatusDto } from "../dto/order-status.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookRepository } from "../repositories/order-book.repository.js";
import { OrderBookService } from "../services/order-book.service.js";
import type { StubEvent } from "../stub/stub-gateway.types.js";

/**
 * Applies one gateway event (PS15, PS16): what moves money for it goes through `PaymentOperations`,
 * and the booking is a fenced effect under the gateway's event id (`event:stub:<eventId>`) — a
 * second delivery of the same event replays it.
 */
@Action({
  name: "apply-gateway-event-action",
  description: "Applies a gateway event to the order, once per event",
  input: { event: GatewayEventDto },
  output: OrderStatusDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService, OrderBookRepository],
})
export class ApplyGatewayEventAction implements ActionHandler<ApplyGatewayEventAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
    private readonly orderBookRepository: OrderBookRepository,
  ) {}

  async execute(input: InputOf<ApplyGatewayEventAction>): Promise<OutputOf<ApplyGatewayEventAction>> {
    const event = input.event.value;
    // verified for this tenant: an event that names another tenant's order — or a charge that is not
    // the order's — moves nothing and books nothing (ChargeOwnershipError)
    this.orderBookService.assertOrdersCharge(event.reference, event.chargeId);
    const applied = await this.paymentOperations.applyEvent(this.executionContext, {
      eventId: event.eventId,
      type: event.type as StubEvent["type"],
      chargeId: event.chargeId,
      reference: event.reference,
      created: event.created,
    });
    const tenantId = this.orderBookService.tenantId;
    // an existing order of this tenant only: an event never creates a row
    // agbossjs/agboss#825: the event as delivered is the work — another payload under its id is a conflict
    const { type, chargeId, reference, created } = event;
    const identity = { businessKey: `event:stub:${event.eventId}`, fingerprint: { type, chargeId, reference, created } };
    const row = await this.orderBookService.once(this.executionContext, "apply-event", identity, (database) =>
      this.orderBookRepository.bookState(database, tenantId, applied.orderId, applied.status, applied.heldCents) ?? { orderId: applied.orderId, status: "unknown", heldCents: 0 },
    );
    return { orderId: row.orderId, status: row.status, heldCents: row.heldCents };
  }
}
