import { Tool, type ToolHandler } from "@agboss/core";
import { CheckoutApprovalToolApproval } from "../channels/checkout-approval.tool-approval.js";
import { ChargeToolInputDto } from "../dto/charge-tool-input.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/** Charges a large order once the customer approves it (PS11): every call waits on the approval. */
@Tool({
  name: "approved-charge-tool",
  description: "Charges the order once the customer approves it",
  input: ChargeToolInputDto,
  output: PaymentDto,
  approval: CheckoutApprovalToolApproval,
  deps: [PaymentOperations, OrderBookService],
})
export class ApprovedChargeTool implements ToolHandler<ChargeToolInputDto, PaymentDto> {
  constructor(
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async execute({ orderId, amountCents }: ChargeToolInputDto): Promise<PaymentDto> {
    const charge = await this.paymentOperations.charge({
      orderId,
      amountCents,
      paymentMethod: "card_ok",
      capture: true,
    });
    await this.orderBookService.book("book-charge", `order:${orderId}`, orderId, {
      status: "paid",
      chargeId: charge.chargeId,
      heldDeltaCents: amountCents,
    });
    return { orderId, chargeId: charge.chargeId, amountCents, refundableCents: amountCents, status: charge.status };
  }
}
