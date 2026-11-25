import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { GatewayPayments } from "../gateway-payments.js";
import { PaymentBooksService } from "../services/payment-books.service.js";
import { RefundOrderAction } from "./refund-order.action.js";

/** Charges the order through the gateway's wiring; its undo refunds it. */
@Action({
  name: "charge-order-action",
  description: "Charges the order once, whoever asks and whatever fails",
  input: { order: CheckoutRequestDto },
  output: PaymentDto,
  compensateWith: RefundOrderAction,
  deps: [GatewayPayments, PaymentBooksService],
})
export class ChargeOrderAction implements ActionHandler<ChargeOrderAction> {
  constructor(
    private readonly gatewayPayments: GatewayPayments,
    private readonly paymentBooksService: PaymentBooksService,
  ) {}

  async execute(input: InputOf<ChargeOrderAction>): Promise<OutputOf<ChargeOrderAction>> {
    const { orderId, amountCents, capture } = input.order;
    const payment = await this.gatewayPayments.charge({ orderId, amountCents, capture });
    await this.paymentBooksService.book(orderId, payment.paymentId);
    return { orderId, paymentId: payment.paymentId, amountCents };
  }
}
