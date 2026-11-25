import { Workflow, onStart, Ttl } from "@agboss/core";
import { ResolveBillingInquiryAction } from "../../actions/resolve-billing-inquiry.action.js";
import { BillingWorkflowFinish } from "./billing.workflow-finish.js";
import { BillingWorkflowStart } from "./billing.workflow-start.js";

@Workflow({
  name: "billing-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(BillingWorkflowStart)
      .toAction(ResolveBillingInquiryAction)
      .toFinish(BillingWorkflowFinish),
  ],
})
export class BillingWorkflow {}
