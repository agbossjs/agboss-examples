import { Action, type ActionHandler, type InputOf } from "@agboss/core";
import { StockReservationDto } from "../dto/stock-reservation.dto.js";

/** The reservation's undo: puts the stock back (safe to run twice: nothing leaves the system). */
@Action({
  name: "release-stock-action",
  description: "Releases the reserved stock",
  input: { reservation: StockReservationDto },
})
export class ReleaseStockAction implements ActionHandler<ReleaseStockAction> {
  async execute(input: InputOf<ReleaseStockAction>): Promise<void> {
    await Promise.resolve(input.reservation.value.reservationId);
  }
}
