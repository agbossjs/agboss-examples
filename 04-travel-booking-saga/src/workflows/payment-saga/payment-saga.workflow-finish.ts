import { WorkflowFinish } from "@agboss/core";
import { TravelBookingOutcomeDto } from "../../dto/travel-booking-outcome.dto.js";

@WorkflowFinish({
  name: "payment-saga-workflow-finish",
  description: "Terminal finish for flight + hotel + payment booking saga",
  output: TravelBookingOutcomeDto,
})
export class PaymentSagaWorkflowFinish {}
