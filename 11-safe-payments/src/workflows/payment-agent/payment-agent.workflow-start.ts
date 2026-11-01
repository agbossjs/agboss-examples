import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({ name: "payment-agent-workflow-start", description: "PS7: the model takes the payment", input: WorkflowStartTextDto })
export class PaymentAgentWorkflowStart {}
