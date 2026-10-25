import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { TravelBookingOutcomeDto } from "../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";

@Action({
  name: "format-rolled-back-booking-action",
  description: "Formats a clean ROLLED_BACK outcome after LIFO compensations run on the error side-path",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: TravelBookingOutcomeDto,
})
export class FormatRolledBackBookingAction
  implements ActionHandler<FormatRolledBackBookingAction>
{
  async execute(
    input: InputOf<FormatRolledBackBookingAction>,
  ): Promise<OutputOf<FormatRolledBackBookingAction>> {
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: "ROLLED_BACK",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: `Rolled back ${input.hotel.value.hotelReservationId} then ${input.flight.value.flightReservationId} after payment decline`,
    });
  }
}
