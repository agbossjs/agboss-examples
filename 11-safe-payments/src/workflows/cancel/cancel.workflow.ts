import { Workflow, onStart, Ttl } from "@agboss/core";
import { CancelOrderAction } from "../../actions/cancel-order.action.js";
import { CancelWorkflowFinish } from "./cancel.workflow-finish.js";
import { CancelWorkflowStart } from "./cancel.workflow-start.js";

/** PS20: the customer cancels the order. */
@Workflow({
  name: "cancel-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(CancelWorkflowStart)
      .toAction(CancelOrderAction)
      .toFinish(CancelWorkflowFinish),
  ],
})
export class CancelWorkflow {}
