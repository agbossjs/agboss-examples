import { WorkflowStart } from "@agboss/core";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";

@WorkflowStart({
  name: "payment-saga-workflow-start",
  description: "Entry point for flight + hotel + payment booking saga",
  input: TravelBookingRequestDto,
})
export class PaymentSagaWorkflowStart {}
