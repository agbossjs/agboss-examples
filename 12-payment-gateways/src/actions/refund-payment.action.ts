import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { MovementDto } from "../dto/movement.dto.js";
import { RefundRequestDto } from "../dto/refund-request.dto.js";
import { GatewayPayments } from "../gateway-payments.js";

/** A refund an operator or the customer asks for. */
@Action({
  name: "refund-payment-action",
  description: "Refunds part of a payment, once whoever asks",
  input: { refund: RefundRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, GatewayPayments],
})
export class RefundPaymentAction implements ActionHandler<RefundPaymentAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly gatewayPayments: GatewayPayments,
  ) {}

  execute(input: InputOf<RefundPaymentAction>): Promise<OutputOf<RefundPaymentAction>> {
    return this.gatewayPayments.refund(this.executionContext, input.refund.value);
  }
}
