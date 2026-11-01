import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { ChargeToolInputDto } from "../dto/charge-tool-input.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { PaymentDeclinedError, PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/**
 * The model's charge tool (PS7). Each call is a step of its own (its own `callId`): keyed by the
 * step, two calls are two charges; keyed by the order, one.
 */
@Tool({
  name: "charge-order-tool",
  description: "Charges the order the conversation is about",
  input: ChargeToolInputDto,
  output: PaymentDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class ChargeOrderTool implements ToolHandler<ChargeToolInputDto, PaymentDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async run({ orderId, amountCents }: ChargeToolInputDto): Promise<PaymentDto> {
    const charge = await this.paymentOperations.charge(this.executionContext, {
      orderId,
      amountCents,
      paymentMethod: "card_ok",
      capture: true,
    });
    if (charge.status === "declined") throw new PaymentDeclinedError(orderId);
    await this.orderBookService.book(this.executionContext, "book-charge", `order:${orderId}`, orderId, {
      status: "paid",
      chargeId: charge.chargeId,
      heldDeltaCents: amountCents,
    });
    return { orderId, chargeId: charge.chargeId, amountCents, refundableCents: amountCents, status: charge.status };
  }
}
