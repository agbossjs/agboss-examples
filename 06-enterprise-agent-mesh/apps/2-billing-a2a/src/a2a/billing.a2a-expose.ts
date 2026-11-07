import { A2AExpose } from "@agboss/core/a2a";
import { BillingWorkflowStart } from "../workflows/billing/billing.workflow-start.js";

@A2AExpose({
  name: "billing-a2a-expose",
  description: "Resolves invoice questions and applies SLA credits for a tenant",
  version: "1.0.0",
  exports: [BillingWorkflowStart],
})
export class BillingA2AExpose {}
