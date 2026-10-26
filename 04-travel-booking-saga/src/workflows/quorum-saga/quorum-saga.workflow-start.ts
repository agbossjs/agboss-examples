import { WorkflowStart } from "@agboss/core";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";

@WorkflowStart({
  name: "quorum-saga-workflow-start",
  description: "Entry point for 2-of-3 parallel reviewer quorum booking saga",
  input: TravelBookingRequestDto,
})
export class QuorumSagaWorkflowStart {}
