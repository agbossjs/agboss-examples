import { A2AExpose, A2ASecurity } from "@agboss/core/a2a";
import { BillingWorkflowStart } from "../workflows/billing/billing.workflow-start.js";

@A2AExpose({
  name: "billing-a2a-expose",
  description: "Resolves invoice questions and applies SLA credits for a tenant",
  version: "1.0.0",
  exports: [BillingWorkflowStart],
  // what a caller that searches the card by tag finds
  skills: { "billing-workflow-start": { tags: ["billing", "invoices", "sla"] } },
  // the card's securitySchemes; BillingA2aCallerResolver enforces it
  security: [A2ASecurity.bearer()],
})
export class BillingA2AExpose {}
