import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { BookingRequestDto } from "../dto/booking-request.dto.js";
import { SeatReservationDto } from "../dto/seat-reservation.dto.js";
import { ReleaseSeatCompensationAction } from "./release-seat-compensation.action.js";

@Action({
  name: "reserve-seat-fixed-action",
  description: "Reserves an airline seat (external side effect)",
  input: { booking: BookingRequestDto },
  output: SeatReservationDto,
  compensateWith: ReleaseSeatCompensationAction,
})
export class ReserveSeatAction implements ActionHandler<ReserveSeatAction> {
  async execute(input: InputOf<ReserveSeatAction>): Promise<OutputOf<ReserveSeatAction>> {
    return Object.assign(new SeatReservationDto(), {
      reservationCode: `RES-${input.booking.value.bookingId}`,
    });
  }
}
