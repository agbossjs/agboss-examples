import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({ name: "secure-checkout-workflow-start", description: "PS21: a 3DS payment, confirmed once its outcome arrives", input: WorkflowStartTextDto })
export class SecureCheckoutWorkflowStart {}
