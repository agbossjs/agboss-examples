import { WorkflowFinish } from "agboss";
import { TravelBookingOutcomeDto } from "../../dto/travel-booking-outcome.dto.js";

@WorkflowFinish({
  name: "budget-saga-workflow-finish",
  description: "Terminal finish for budget itinerary saga",
  output: TravelBookingOutcomeDto,
})
export class BudgetSagaWorkflowFinish {}
