import { Agent } from "agboss";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { ReviewerVoteDto } from "../../dto/reviewer-vote.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";
import { RequestManagerApprovalTool } from "../../tools/request-manager-approval.tool.js";

@Agent({
  name: "risk-reviewer-agent",
  description: "Evaluates destination and vendor risk",
  model: "saga-model",
  promptUrls: ["./risk-reviewer.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: ReviewerVoteDto,
  tools: [RequestManagerApprovalTool],
  maxTokens: 512,
})
export class RiskReviewerAgent {}
