import { WorkflowFinish } from "@agboss/core";
import { WorkflowFinishTextDto } from "@agboss/core/dto";

@WorkflowFinish({
  name: "invoice-review-workflow-finish",
  description: "The reviewer's answer, as text",
  output: WorkflowFinishTextDto,
})
export class InvoiceReviewWorkflowFinish {}
