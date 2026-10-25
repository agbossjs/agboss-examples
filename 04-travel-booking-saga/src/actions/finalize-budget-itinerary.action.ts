import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { ItineraryBriefDto } from "../dto/itinerary-brief.dto.js";
import { TravelBookingOutcomeDto } from "../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";

@Action({
  name: "finalize-budget-itinerary-action",
  description: "Finalizes itinerary after LLM brief generation",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
    brief: ItineraryBriefDto,
  },
  output: TravelBookingOutcomeDto,
})
export class FinalizeBudgetItineraryAction
  implements ActionHandler<FinalizeBudgetItineraryAction>
{
  async execute(
    input: InputOf<FinalizeBudgetItineraryAction>,
  ): Promise<OutputOf<FinalizeBudgetItineraryAction>> {
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: "CONFIRMED",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: input.brief.value.brief,
    });
  }
}
