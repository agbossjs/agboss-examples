import { Workflow, start } from "agboss";
import { FinalizeApprovedHoldAction } from "../actions/finalize-approved-hold.action.js";
import { ReserveFlightAction } from "../actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../actions/reserve-hotel.action.js";
import { ManagerApprovalCoordinatorAgent } from "../agents/manager-approval-coordinator/manager-approval-coordinator.agent.js";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HighValueHoldOutputDto } from "../dto/high-value-hold-output.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { TravelBookingOutcomeDto } from "../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../services/fake-airline.service.js";
import { FakeHotelService } from "../services/fake-hotel.service.js";
import { RequestManagerApprovalTool } from "../tools/request-manager-approval.tool.js";
import { HitlHoldSagaWorkflowFinish } from "../workflow-finishes/hitl-hold-saga.workflow-finish.js";
import { HitlHoldSagaWorkflowStart } from "../workflow-starts/hitl-hold-saga.workflow-start.js";

@Workflow({
  name: "hitl-hold-saga-workflow",
  version: "0.1.0",
  flow: [
    start(HitlHoldSagaWorkflowStart)
      .returns(TravelBookingRequestDto)
      .toAction(ReserveFlightAction)
      .returns(FlightReservationDto)
      .toAction(ReserveHotelAction)
      .returns(HotelReservationDto)
      .toAgent(ManagerApprovalCoordinatorAgent)
      .returns(HighValueHoldOutputDto)
      .toAction(FinalizeApprovedHoldAction)
      .returns(TravelBookingOutcomeDto)
      .toFinish(HitlHoldSagaWorkflowFinish),
  ],
  providers: [
    FakeAirlineService,
    FakeHotelService,
    RequestManagerApprovalTool,
  ],
})
export class HitlHoldSagaWorkflow {}
