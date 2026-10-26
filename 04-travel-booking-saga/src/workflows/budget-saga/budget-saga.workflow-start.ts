import { WorkflowStart } from "@agboss/core";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";

@WorkflowStart({
  name: "budget-saga-workflow-start",
  description: "Entry point for flight + hotel + LLM itinerary brief saga (tests BudgetExceededError rollback)",
  input: TravelBookingRequestDto,
})
export class BudgetSagaWorkflowStart {}
