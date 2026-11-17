import { WorkflowFinish } from "@agboss/core";
import { WorkflowFinishTextDto } from "@agboss/core/dto";

@WorkflowFinish({
  name: "receipt-check-workflow-finish",
  description: "What the agent read on the receipt",
  output: WorkflowFinishTextDto,
})
export class ReceiptCheckWorkflowFinish {}
