import { Workflow, onStart, Ttl } from "@agboss/core";
import { FinalizeBudgetItineraryAction } from "../../actions/finalize-budget-itinerary.action.js";
import { ReserveFlightAction } from "../../actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../../actions/reserve-hotel.action.js";
import { ItineraryBriefAgent } from "../../agents/itinerary-brief/itinerary-brief.agent.js";
import { FakeAirlineService } from "../../services/fake-airline.service.js";
import { FakeHotelService } from "../../services/fake-hotel.service.js";
import { BudgetSagaWorkflowFinish } from "./budget-saga.workflow-finish.js";
import { BudgetSagaWorkflowStart } from "./budget-saga.workflow-start.js";

@Workflow({
  name: "budget-saga-workflow",
  version: "0.1.0",
  historyTtl: Ttl.Forever,
  executionLimits: { maxSteps: 4 },
  flow: [
    onStart(BudgetSagaWorkflowStart)
      .toAction(ReserveFlightAction)
      .toAction(ReserveHotelAction)
      .toAgent(ItineraryBriefAgent)
      .toAction(FinalizeBudgetItineraryAction)
      .toFinish(BudgetSagaWorkflowFinish),
  ],
  providers: [FakeAirlineService, FakeHotelService],
})
export class BudgetSagaWorkflow {}
