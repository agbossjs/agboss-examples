import { Workflow, onStart, Ttl } from "@agboss/core";
import { PaymentAgent } from "../../agents/payment/payment.agent.js";
import { PaymentAgentWorkflowFinish } from "./payment-agent.workflow-finish.js";
import { PaymentAgentWorkflowStart } from "./payment-agent.workflow-start.js";

/** PS7: the model takes the payment. */
@Workflow({
  name: "payment-agent-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(PaymentAgentWorkflowStart)
      .toAgent(PaymentAgent)
      .toFinish(PaymentAgentWorkflowFinish),
  ],
  defaults: { models: { temperature: 0 } },
})
export class PaymentAgentWorkflow {}
