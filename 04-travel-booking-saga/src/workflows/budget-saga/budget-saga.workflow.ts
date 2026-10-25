import { Workflow, start } from "agboss";
import { FinalizeBudgetItineraryAction } from "../../actions/finalize-budget-itinerary.action.js";
import { ReserveFlightAction } from "../../actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../../actions/reserve-hotel.action.js";
import { ItineraryBriefAgent } from "../../agents/itinerary-brief/itinerary-brief.agent.js";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { ItineraryBriefDto } from "../../dto/itinerary-brief.dto.js";
import { TravelBookingOutcomeDto } from "../../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../../services/fake-airline.service.js";
import { FakeHotelService } from "../../services/fake-hotel.service.js";
import { BudgetSagaWorkflowFinish } from "./budget-saga.workflow-finish.js";
import { BudgetSagaWorkflowStart } from "./budget-saga.workflow-start.js";

@Workflow({
  name: "budget-saga-workflow",
  version: "0.1.0",
  flow: [
    start(BudgetSagaWorkflowStart)
      .returns(TravelBookingRequestDto)
      .toAction(ReserveFlightAction)
      .returns(FlightReservationDto)
      .toAction(ReserveHotelAction)
      .returns(HotelReservationDto)
      .toAgent(ItineraryBriefAgent)
      .returns(ItineraryBriefDto)
      .toAction(FinalizeBudgetItineraryAction)
      .returns(TravelBookingOutcomeDto)
      .toFinish(BudgetSagaWorkflowFinish),
  ],
  providers: [FakeAirlineService, FakeHotelService],
})
export class BudgetSagaWorkflow {}
