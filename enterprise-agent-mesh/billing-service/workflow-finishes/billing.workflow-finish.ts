import { WorkflowFinish } from "agboss";
import { BillingResolutionDto } from "../../src/dto/billing-resolution.dto.js";

@WorkflowFinish({
  name: "billing-workflow-finish",
  description: "Returns the billing resolution",
  output: BillingResolutionDto,
})
export class BillingWorkflowFinish {}
