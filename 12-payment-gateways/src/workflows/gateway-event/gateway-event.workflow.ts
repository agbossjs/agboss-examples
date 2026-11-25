import { Workflow, onStart, Ttl } from "@agboss/core";
import { ApplyGatewayEventAction } from "../../actions/apply-gateway-event.action.js";
import { GatewayEventWorkflowFinish } from "./gateway-event.workflow-finish.js";
import { GatewayEventWorkflowStart } from "./gateway-event.workflow-start.js";

/** A gateway event, applied once. */
@Workflow({
  name: "gateway-event-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(GatewayEventWorkflowStart)
      .toAction(ApplyGatewayEventAction)
      .toFinish(GatewayEventWorkflowFinish),
  ],
})
export class GatewayEventWorkflow {}
