import { WorkflowStart } from "agboss";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";

@WorkflowStart({
  name: "missing-input-fixed-workflow-start",
  description: "Starts fixed missing-input workflow",
  input: CheckoutRequestDto,
})
export class MissingInputFixedStart {}
