import { Action, type ActionHandler, type InputOf, type OutputOf, listOf } from "agboss";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { ReviewerVoteDto } from "../dto/reviewer-vote.dto.js";
import { TravelBookingOutcomeDto } from "../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";

@Action({
  name: "finalize-quorum-booking-action",
  description: "Finalizes booking once 2-of-3 reviewer quorum is reached",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
    votes: listOf(ReviewerVoteDto),
  },
  output: TravelBookingOutcomeDto,
})
export class FinalizeQuorumBookingAction
  implements ActionHandler<FinalizeQuorumBookingAction>
{
  async execute(
    input: InputOf<FinalizeQuorumBookingAction>,
  ): Promise<OutputOf<FinalizeQuorumBookingAction>> {
    const countedDepartments = input.votes.map((v) => v.value.department);

    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: "CONFIRMED_BY_QUORUM",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: `Quorum achieved (${String(countedDepartments.length)}/3): ${countedDepartments.join(", ")}`,
    });
  }
}
