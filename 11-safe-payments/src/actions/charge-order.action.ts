import {
  Action,
  ExecutionContext,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { PaymentDeclinedError, PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";
import { StubGatewayError } from "../stub/stub-gateway.client.js";
import { RefundOrderAction } from "./refund-order.action.js";

/**
 * Charges the order through `PaymentOperations` (the right wiring, or a wrong one), then books it
 * on the order's row — once per order (`order:<id>`), whoever charged.
 */
@Action({
  name: "charge-order-action",
  description: "Charges the order once, whoever asks and whatever fails",
  input: { order: CheckoutRequestDto },
  output: PaymentDto,
  compensateWith: RefundOrderAction,
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class ChargeOrderAction implements ActionHandler<ChargeOrderAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async execute(input: InputOf<ChargeOrderAction>): Promise<OutputOf<ChargeOrderAction>> {
    const { orderId, amountCents, paymentMethod, capture, restockingFeeCents } = input.order.value;
    const charge = await this.paymentOperations
      .charge(this.executionContext, { orderId, amountCents, paymentMethod, capture })
      .catch((error: unknown) => {
        // a decline is the gateway's definite "no": a real failure, the saga undoes what it did
        if (error instanceof StubGatewayError && error.status === 402) throw new PaymentDeclinedError(orderId);
        throw error;
      });
    if (charge.status === "declined") throw new PaymentDeclinedError(orderId);
    await this.orderBookService.book(this.executionContext, "book-charge", `order:${orderId}`, orderId, {
      status: capture ? "paid" : "authorized",
      chargeId: charge.chargeId,
      heldDeltaCents: capture ? amountCents : 0,
    });
    const refundableCents = amountCents - restockingFeeCents;
    return { orderId, chargeId: charge.chargeId, amountCents, refundableCents, status: charge.status };
  }
}
