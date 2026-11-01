import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({ name: "approved-checkout-workflow-start", description: "PS11: a large order, charged once the customer approves", input: WorkflowStartTextDto })
export class ApprovedCheckoutWorkflowStart {}
