import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CaptureRequestDto } from "../dto/capture-request.dto.js";
import { MovementDto } from "../dto/movement.dto.js";
import { GatewayPayments } from "../gateway-payments.js";
import { PaymentBooksService } from "../services/payment-books.service.js";

/** Captures one shipment of an authorization. */
@Action({
  name: "capture-shipment-action",
  description: "Captures one shipment of the order's authorization",
  input: { capture: CaptureRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, GatewayPayments, PaymentBooksService],
})
export class CaptureShipmentAction implements ActionHandler<CaptureShipmentAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly gatewayPayments: GatewayPayments,
    private readonly paymentBooksService: PaymentBooksService,
  ) {}

  async execute(input: InputOf<CaptureShipmentAction>): Promise<OutputOf<CaptureShipmentAction>> {
    const capture = input.capture.value;
    this.paymentBooksService.assertOrdersPayment(capture.orderId, capture.paymentId);
    return this.gatewayPayments.capture(this.executionContext, capture);
  }
}
