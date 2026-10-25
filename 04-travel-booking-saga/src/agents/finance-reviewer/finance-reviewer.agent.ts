import { Agent } from "agboss";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { ReviewerVoteDto } from "../../dto/reviewer-vote.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";

@Agent({
  name: "finance-reviewer-agent",
  description: "Evaluates budget compliance for the travel booking",
  model: "saga-model",
  promptUrls: ["./finance-reviewer.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: ReviewerVoteDto,
  maxTokens: 512,
})
export class FinanceReviewerAgent {}
