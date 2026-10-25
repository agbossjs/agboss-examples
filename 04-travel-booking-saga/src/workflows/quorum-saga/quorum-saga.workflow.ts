import { Workflow, listOf, start } from "agboss";
import { seconds } from "agboss/units";
import { FinalizeQuorumBookingAction } from "../../actions/finalize-quorum-booking.action.js";
import { ReserveFlightAction } from "../../actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../../actions/reserve-hotel.action.js";
import { ComplianceReviewerAgent } from "../../agents/compliance-reviewer/compliance-reviewer.agent.js";
import { FinanceReviewerAgent } from "../../agents/finance-reviewer/finance-reviewer.agent.js";
import { RiskReviewerAgent } from "../../agents/risk-reviewer/risk-reviewer.agent.js";
import { BookingQuorumArbiter } from "../../arbiters/booking-quorum/booking-quorum.arbiter.js";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { ReviewerVoteDto } from "../../dto/reviewer-vote.dto.js";
import { TravelBookingOutcomeDto } from "../../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../../services/fake-airline.service.js";
import { FakeHotelService } from "../../services/fake-hotel.service.js";
import { RequestManagerApprovalTool } from "../../tools/request-manager-approval.tool.js";
import { QuorumSagaWorkflowFinish } from "./quorum-saga.workflow-finish.js";
import { QuorumSagaWorkflowStart } from "./quorum-saga.workflow-start.js";

@Workflow({
  name: "quorum-saga-workflow",
  version: "0.1.0",
  flow: [
    start(QuorumSagaWorkflowStart)
      .returns(TravelBookingRequestDto)
      .toAction(ReserveFlightAction)
      .returns(FlightReservationDto)
      .toAction(ReserveHotelAction)
      .returns(HotelReservationDto)
      .toParallelAgents(
        FinanceReviewerAgent,
        ComplianceReviewerAgent,
        RiskReviewerAgent,
      )
      .acceptedBy(BookingQuorumArbiter)
      .joinQuorum({ min: 2, max: 2, deadline: seconds(15) })
      .returns(listOf(ReviewerVoteDto))
      .toAction(FinalizeQuorumBookingAction)
      .returns(TravelBookingOutcomeDto)
      .toFinish(QuorumSagaWorkflowFinish),
  ],
  providers: [
    FakeAirlineService,
    FakeHotelService,
    RequestManagerApprovalTool,
  ],
})
export class QuorumSagaWorkflow {}
