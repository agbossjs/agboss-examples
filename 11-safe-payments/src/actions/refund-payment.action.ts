import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { MovementDto } from "../dto/movement.dto.js";
import { RefundRequestDto } from "../dto/refund-request.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/** A refund an operator or the customer asks for: the n-th refund of the payment (PS19). */
@Action({
  name: "refund-payment-action",
  description: "Refunds part of a payment, once whoever asks",
  input: { refund: RefundRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class RefundPaymentAction implements ActionHandler<RefundPaymentAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async execute(input: InputOf<RefundPaymentAction>): Promise<OutputOf<RefundPaymentAction>> {
    const { orderId, chargeId, amountCents, refundNumber } = input.refund.value;
    // the charge id is the caller's word: it moves only the order's own charge, by the shop's books
    this.orderBookService.assertOrdersCharge(orderId, chargeId);
    const refunded = await this.paymentOperations.refund(this.executionContext, { chargeId, amountCents, refundNumber });
    await this.orderBookService.book(
      this.executionContext,
      "book-refund",
      `refund:${chargeId}:${String(refundNumber)}`,
      orderId,
      { status: "refunded", heldDeltaCents: -amountCents },
    );
    return { orderId, movementId: refunded.id, kind: "refund", amountCents };
  }
}
