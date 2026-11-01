import { Action, ExecutionContext, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CaptureRequestDto } from "../dto/capture-request.dto.js";
import { MovementDto } from "../dto/movement.dto.js";
import { GatewayPayments } from "../gateway-payments.js";

/** Captures one shipment of an authorization. */
@Action({
  name: "capture-shipment-action",
  description: "Captures one shipment of the order's authorization",
  input: { capture: CaptureRequestDto },
  output: MovementDto,
  deps: [ExecutionContext, GatewayPayments],
})
export class CaptureShipmentAction implements ActionHandler<CaptureShipmentAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly gatewayPayments: GatewayPayments,
  ) {}

  execute(input: InputOf<CaptureShipmentAction>): Promise<OutputOf<CaptureShipmentAction>> {
    return this.gatewayPayments.capture(this.executionContext, input.capture.value);
  }
}
