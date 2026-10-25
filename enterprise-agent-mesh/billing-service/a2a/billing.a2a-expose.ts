import { A2AExpose } from "agboss/a2a";
import { BillingWorkflowStart } from "../workflow-starts/billing.workflow-start.js";

@A2AExpose({
  name: "billing-a2a-expose",
  version: "1.0.0",
  exports: [BillingWorkflowStart],
})
export class BillingA2AExpose {}
