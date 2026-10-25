import {
  Agent,
  Arbiter,
  DecidedBy,
  OnAnswer,
} from "agboss";
import { RequestManagerApprovalTool } from "../channels/booking-approval.channel.js";
import {
  FlightReservationDto,
  HighValueHoldOutputDto,
  HotelReservationDto,
  ItineraryBriefDto,
  ReviewerVoteDto,
  TravelBookingRequestDto,
} from "../workflows/dtos.js";

@Agent({
  name: "itinerary-brief-agent",
  description: "Generates an executive itinerary brief (used to test BudgetExceededError rollback)",
  model: "saga-model",
  promptUrls: ["./itinerary-brief.agent.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: ItineraryBriefDto,
  maxTokens: 512,
})
export class ItineraryBriefAgent {}

@Agent({
  name: "manager-approval-coordinator-agent",
  description: "Coordinates human-in-the-loop manager approval via RequestManagerApprovalTool",
  model: "saga-model",
  promptUrls: ["./manager-approval-coordinator.agent.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: HighValueHoldOutputDto,
  tools: [RequestManagerApprovalTool],
  maxTokens: 512,
})
export class ManagerApprovalCoordinatorAgent {}

@Agent({
  name: "finance-reviewer-agent",
  description: "Evaluates budget compliance for the travel booking",
  model: "saga-model",
  promptUrls: ["./finance-reviewer.agent.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: ReviewerVoteDto,
  maxTokens: 512,
})
export class FinanceReviewerAgent {}

@Agent({
  name: "compliance-reviewer-agent",
  description: "Evaluates corporate travel policy compliance",
  model: "saga-model",
  promptUrls: ["./compliance-reviewer.agent.prompt.md"],
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: ReviewerVoteDto,
  maxTokens: 512,
})
export class ComplianceReviewerAgent {}

@Agent({
  name: "risk-reviewer-agent",
  description: "Evaluates destination and vendor risk",
  model: "saga-model",
  promptUrls: ["./risk-reviewer.agent.prompt.md"],
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

@Arbiter({
  name: "booking-quorum-arbiter",
  decidedBy: DecidedBy.Code,
})
export class BookingQuorumArbiter {
  @OnAnswer(FinanceReviewerAgent)
  fromFinanceReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }

  @OnAnswer(ComplianceReviewerAgent)
  fromComplianceReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }

  @OnAnswer(RiskReviewerAgent)
  fromRiskReviewer(answer: ReviewerVoteDto): boolean {
    return answer.approved && answer.confidenceScore >= 80;
  }
}
