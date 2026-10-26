import { Agent } from "@agboss/core";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { ItineraryBriefDto } from "../../dto/itinerary-brief.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";

@Agent({
  name: "itinerary-brief-agent",
  description: "Generates an executive itinerary brief (used to test BudgetExceededError rollback)",
  model: "saga-model",
  promptUrls: ["./itinerary-brief.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: ItineraryBriefDto,
  maxTokens: 512,
})
export class ItineraryBriefAgent {}
