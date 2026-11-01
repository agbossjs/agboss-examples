import { WorkflowFinish } from "@agboss/core";
import { WorkflowFinishTextDto } from "@agboss/core/dto";

@WorkflowFinish({ name: "approved-checkout-workflow-finish", description: "What the agent says", output: WorkflowFinishTextDto })
export class ApprovedCheckoutWorkflowFinish {}
