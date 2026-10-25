import { WorkflowFinish } from "agboss";
import { TravelBookingOutcomeDto } from "../dto/travel-booking-outcome.dto.js";

@WorkflowFinish({
  name: "hitl-hold-saga-workflow-finish",
  description: "Terminal finish for human manager approval pause saga",
  output: TravelBookingOutcomeDto,
})
export class HitlHoldSagaWorkflowFinish {}
