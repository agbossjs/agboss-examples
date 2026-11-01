import { WorkflowStart } from "@agboss/core";
import { CheckoutRequestDto } from "../../dto/checkout-request.dto.js";

@WorkflowStart({ name: "checkout-workflow-start", description: "An order to pay and ship", input: CheckoutRequestDto })
export class CheckoutWorkflowStart {}
