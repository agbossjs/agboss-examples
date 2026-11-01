import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { PaymentDto } from "../dto/payment.dto.js";
import { ShipmentDto } from "../dto/shipment.dto.js";
import { StockReservationDto } from "../dto/stock-reservation.dto.js";
import { CarrierRefusedError } from "../errors/carrier-refused.error.js";

/** Hands the order to the carrier — which refuses it on demand (`failShipping`, PS10). */
@Action({
  name: "ship-order-action",
  description: "Hands the order to the carrier",
  input: { order: CheckoutRequestDto, reservation: StockReservationDto, payment: PaymentDto },
  output: ShipmentDto,
})
export class ShipOrderAction implements ActionHandler<ShipOrderAction> {
  execute(input: InputOf<ShipOrderAction>): Promise<OutputOf<ShipOrderAction>> {
    const { orderId, failShipping } = input.order.value;
    if (failShipping) return Promise.reject(new CarrierRefusedError(orderId));
    return Promise.resolve({ trackingNumber: `track-${input.reservation.value.reservationId}-${input.payment.value.chargeId}` });
  }
}
