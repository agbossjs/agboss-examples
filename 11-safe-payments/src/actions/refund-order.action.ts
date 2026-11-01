import { Action, ExecutionContext, type ActionHandler, type InputOf } from "@agboss/core";
import { PaymentDto } from "../dto/payment.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/**
 * The charge's undo: refunds the payment less the restocking fee — the first refund of it
 * (`refund:<charge>:1`), the key every path that refunds it uses (PS19) — and books the refund on
 * the order's row.
 */
@Action({
  name: "refund-order-action",
  description: "Refunds the order's payment",
  input: { payment: PaymentDto },
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class RefundOrderAction implements ActionHandler<RefundOrderAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async execute(input: InputOf<RefundOrderAction>): Promise<void> {
    const { orderId, chargeId, refundableCents: amountCents } = input.payment.value;
    await this.paymentOperations.refund(this.executionContext, { chargeId, amountCents, refundNumber: 1 });
    await this.orderBookService.book(this.executionContext, "book-refund", `refund:${chargeId}:1`, orderId, {
      status: "refunded",
      heldDeltaCents: -amountCents,
    });
  }
}
