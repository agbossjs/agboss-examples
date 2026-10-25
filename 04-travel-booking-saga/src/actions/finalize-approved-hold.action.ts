import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HighValueHoldOutputDto } from "../dto/high-value-hold-output.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { TravelBookingOutcomeDto } from "../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";

@Action({
  name: "finalize-approved-hold-action",
  description: "Finalizes booking after manager approval resumes",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
    hold: HighValueHoldOutputDto,
  },
  output: TravelBookingOutcomeDto,
})
export class FinalizeApprovedHoldAction
  implements ActionHandler<FinalizeApprovedHoldAction>
{
  async execute(
    input: InputOf<FinalizeApprovedHoldAction>,
  ): Promise<OutputOf<FinalizeApprovedHoldAction>> {
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: input.hold.value.approved ? "CONFIRMED" : "REJECTED",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: `Manager decision token: ${input.hold.value.approvalToken}`,
    });
  }
}
