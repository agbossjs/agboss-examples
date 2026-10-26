import { WorkflowFinish } from "@agboss/core";
import { TravelBookingOutcomeDto } from "../../dto/travel-booking-outcome.dto.js";

@WorkflowFinish({
  name: "quorum-saga-workflow-finish",
  description: "Terminal finish for 2-of-3 parallel reviewer quorum booking saga",
  output: TravelBookingOutcomeDto,
})
export class QuorumSagaWorkflowFinish {}
