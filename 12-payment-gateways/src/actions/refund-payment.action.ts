import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { MovementDto } from "../dto/movement.dto.js";
import { RefundRequestDto } from "../dto/refund-request.dto.js";
import { GatewayPayments } from "../gateway-payments.js";
import { PaymentBooksService } from "../services/payment-books.service.js";

/** A refund an operator or the customer asks for. */
@Action({
  name: "refund-payment-action",
  description: "Refunds part of a payment, once whoever asks",
  input: { refund: RefundRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, GatewayPayments, PaymentBooksService],
})
export class RefundPaymentAction implements ActionHandler<RefundPaymentAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly gatewayPayments: GatewayPayments,
    private readonly paymentBooksService: PaymentBooksService,
  ) {}

  async execute(input: InputOf<RefundPaymentAction>): Promise<OutputOf<RefundPaymentAction>> {
    const refund = input.refund.value;
    // the payment id is the caller's word: it refunds only the order's own payment, by the shop's books
    this.paymentBooksService.assertOrdersPayment(refund.orderId, refund.paymentId);
    return this.gatewayPayments.refund(this.executionContext, refund);
  }
}
