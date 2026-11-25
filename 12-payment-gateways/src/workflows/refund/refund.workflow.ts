import { Workflow, onStart, Ttl } from "@agboss/core";
import { RefundPaymentAction } from "../../actions/refund-payment.action.js";
import { RefundWorkflowFinish } from "./refund.workflow-finish.js";
import { RefundWorkflowStart } from "./refund.workflow-start.js";

/** An operator or the customer refunds a payment. */
@Workflow({
  name: "refund-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(RefundWorkflowStart)
      .toAction(RefundPaymentAction)
      .toFinish(RefundWorkflowFinish),
  ],
})
export class RefundWorkflow {}
