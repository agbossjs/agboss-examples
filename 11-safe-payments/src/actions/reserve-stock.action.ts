import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { StockReservationDto } from "../dto/stock-reservation.dto.js";
import { ReleaseStockAction } from "./release-stock.action.js";

@Action({
  name: "reserve-stock-action",
  description: "Reserves the order's stock",
  input: { order: CheckoutRequestDto },
  output: StockReservationDto,
  compensateWith: ReleaseStockAction,
})
export class ReserveStockAction implements ActionHandler<ReserveStockAction> {
  execute(input: InputOf<ReserveStockAction>): Promise<OutputOf<ReserveStockAction>> {
    return Promise.resolve({ reservationId: `reservation-${input.order.value.orderId}` });
  }
}
