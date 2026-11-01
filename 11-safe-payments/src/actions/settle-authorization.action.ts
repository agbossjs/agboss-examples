import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { DispositionRequestDto } from "../dto/disposition-request.dto.js";
import { MovementDto } from "../dto/movement.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/** Fulfilment captures the whole authorization: one of its two dispositions (PS20). */
@Action({
  name: "settle-authorization-action",
  description: "Captures the whole authorization of a shipped order",
  input: { disposition: DispositionRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class SettleAuthorizationAction implements ActionHandler<SettleAuthorizationAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async execute(input: InputOf<SettleAuthorizationAction>): Promise<OutputOf<SettleAuthorizationAction>> {
    const { orderId, chargeId, amountCents } = input.disposition.value;
    const captured = await this.paymentOperations.settle(this.executionContext, chargeId, amountCents);
    await this.orderBookService.book(this.executionContext, "book-settle", `settle:${chargeId}`, orderId, {
      status: "captured",
      heldDeltaCents: amountCents,
    });
    return { orderId, movementId: captured.id, kind: "capture", amountCents };
  }
}
