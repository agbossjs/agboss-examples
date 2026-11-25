import { Workflow, onStart, Ttl } from "@agboss/core";
import { SecureCheckoutAgent } from "../../agents/secure-checkout/secure-checkout.agent.js";
import { SecureCheckoutWorkflowFinish } from "./secure-checkout.workflow-finish.js";
import { SecureCheckoutWorkflowStart } from "./secure-checkout.workflow-start.js";

/** PS21: a 3DS payment, confirmed once its outcome arrives. */
@Workflow({
  name: "secure-checkout-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(SecureCheckoutWorkflowStart)
      .toAgent(SecureCheckoutAgent)
      .toFinish(SecureCheckoutWorkflowFinish),
  ],
  defaults: { models: { temperature: 0 } },
})
export class SecureCheckoutWorkflow {}
