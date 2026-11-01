import { Workflow, start } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { SecureCheckoutAgent } from "../../agents/secure-checkout/secure-checkout.agent.js";
import { SecureCheckoutWorkflowFinish } from "./secure-checkout.workflow-finish.js";
import { SecureCheckoutWorkflowStart } from "./secure-checkout.workflow-start.js";

/** PS21: a 3DS payment, confirmed once its outcome arrives. */
@Workflow({
  name: "secure-checkout-workflow",
  version: "1.0.0",
  flow: [
    start(SecureCheckoutWorkflowStart)
      .returns(WorkflowStartTextDto)
      .toAgent(SecureCheckoutAgent)
      .toFinish(SecureCheckoutWorkflowFinish),
  ],
  defaults: { models: { temperature: 0 } },
})
export class SecureCheckoutWorkflow {}
