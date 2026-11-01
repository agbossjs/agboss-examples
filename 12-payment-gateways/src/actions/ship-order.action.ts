import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { ShipmentDto } from "../dto/shipment.dto.js";
import { CarrierRefusedError } from "../errors.js";

/** Hands the order to the carrier — which refuses it on demand (`failShipping`). */
@Action({
  name: "ship-order-action",
  description: "Hands the paid order to the carrier",
  input: { order: CheckoutRequestDto, payment: PaymentDto },
  output: ShipmentDto,
})
export class ShipOrderAction implements ActionHandler<ShipOrderAction> {
  execute(input: InputOf<ShipOrderAction>): Promise<OutputOf<ShipOrderAction>> {
    if (input.order.value.failShipping) return Promise.reject(new CarrierRefusedError(input.order.value.orderId));
    return Promise.resolve({ trackingNumber: `track-${input.payment.value.paymentId}` });
  }
}
