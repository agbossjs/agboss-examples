import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { ChargeToolInputDto } from "../dto/charge-tool-input.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/** The payment form, submitted: creates a 3DS payment (it requires the customer's action, PS21). */
@Tool({
  name: "create-secure-payment-tool",
  description: "Creates the order's 3DS payment",
  input: ChargeToolInputDto,
  output: PaymentDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class CreateSecurePaymentTool implements ToolHandler<ChargeToolInputDto, PaymentDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async run({ orderId, amountCents }: ChargeToolInputDto): Promise<PaymentDto> {
    const charge = await this.paymentOperations.charge(this.executionContext, {
      orderId,
      amountCents,
      paymentMethod: "card_3ds",
      capture: true,
    });
    await this.orderBookService.book(this.executionContext, "book-3ds", `order:${orderId}`, orderId, {
      status: "new",
      chargeId: charge.chargeId,
      heldDeltaCents: 0,
    });
    return { orderId, chargeId: charge.chargeId, amountCents, refundableCents: amountCents, status: charge.status };
  }
}
