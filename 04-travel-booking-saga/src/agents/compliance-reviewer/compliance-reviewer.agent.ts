import { Agent } from "agboss";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { ReviewerVoteDto } from "../../dto/reviewer-vote.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";

@Agent({
  name: "compliance-reviewer-agent",
  description: "Evaluates corporate travel policy compliance",
  model: "saga-model",
  promptUrls: ["./compliance-reviewer.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: ReviewerVoteDto,
  maxTokens: 512,
})
export class ComplianceReviewerAgent {}
