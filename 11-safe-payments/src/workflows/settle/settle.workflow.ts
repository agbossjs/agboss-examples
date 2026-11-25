import { Workflow, onStart, Ttl } from "@agboss/core";
import { SettleAuthorizationAction } from "../../actions/settle-authorization.action.js";
import { SettleWorkflowFinish } from "./settle.workflow-finish.js";
import { SettleWorkflowStart } from "./settle.workflow-start.js";

/** PS20: fulfilment captures the whole authorization. */
@Workflow({
  name: "settle-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(SettleWorkflowStart)
      .toAction(SettleAuthorizationAction)
      .toFinish(SettleWorkflowFinish),
  ],
})
export class SettleWorkflow {}
