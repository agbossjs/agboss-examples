import { WorkflowStart } from "agboss";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";

@WorkflowStart({
  name: "hitl-hold-saga-workflow-start",
  description: "Entry point for flight + hotel + human manager approval pause saga",
  input: TravelBookingRequestDto,
})
export class HitlHoldSagaWorkflowStart {}
