import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CaptureRequestDto } from "../dto/capture-request.dto.js";
import { MovementDto } from "../dto/movement.dto.js";
import { PaymentOperations } from "../payments/payment-operations.js";
import { OrderBookService } from "../services/order-book.service.js";

/** Captures one shipment of an authorization and books it (PS18). */
@Action({
  name: "capture-shipment-action",
  description: "Captures one shipment of the order's authorization",
  input: { capture: CaptureRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, PaymentOperations, OrderBookService],
})
export class CaptureShipmentAction implements ActionHandler<CaptureShipmentAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly paymentOperations: PaymentOperations,
    private readonly orderBookService: OrderBookService,
  ) {}

  async execute(input: InputOf<CaptureShipmentAction>): Promise<OutputOf<CaptureShipmentAction>> {
    const { orderId, chargeId, shipment, amountCents } = input.capture.value;
    // the charge id is the caller's word: it moves only the order's own charge, by the shop's books
    this.orderBookService.assertOrdersCharge(orderId, chargeId);
    const captured = await this.paymentOperations.capture(this.executionContext, { chargeId, shipment, amountCents });
    await this.orderBookService.book(
      this.executionContext,
      "book-capture",
      `capture:${chargeId}:${String(shipment)}`,
      orderId,
      { status: "captured", heldDeltaCents: amountCents },
    );
    return { orderId, movementId: captured.id, kind: "capture", amountCents };
  }
}
