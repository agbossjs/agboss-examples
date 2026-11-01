import { Action, ExecutionContext, type ActionHandler, type InputOf } from "@agboss/core";
import { PaymentDto } from "../dto/payment.dto.js";
import { GatewayPayments } from "../gateway-payments.js";

/** The charge's undo: the payment's first refund (`refund:<payment>:1`, every path's key). */
@Action({
  name: "refund-order-action",
  description: "Refunds the order's payment",
  input: { payment: PaymentDto },
  deps: [ExecutionContext, GatewayPayments],
})
export class RefundOrderAction implements ActionHandler<RefundOrderAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly gatewayPayments: GatewayPayments,
  ) {}

  async execute(input: InputOf<RefundOrderAction>): Promise<void> {
    const { orderId, paymentId, amountCents } = input.payment.value;
    await this.gatewayPayments.refund(this.executionContext, { orderId, paymentId, amountCents, refundNumber: 1 });
  }
}
