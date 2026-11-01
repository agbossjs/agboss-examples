import { Workflow, start } from "@agboss/core";
import { ApplyGatewayEventAction } from "../../actions/apply-gateway-event.action.js";
import { GatewayEventDto } from "../../dto/gateway-event.dto.js";
import { MovementDto } from "../../dto/movement.dto.js";
import { GatewayEventWorkflowFinish } from "./gateway-event.workflow-finish.js";
import { GatewayEventWorkflowStart } from "./gateway-event.workflow-start.js";

/** A gateway event, applied once. */
@Workflow({
  name: "gateway-event-workflow",
  version: "1.0.0",
  flow: [
    start(GatewayEventWorkflowStart)
      .returns(GatewayEventDto)
      .toAction(ApplyGatewayEventAction)
      .returns(MovementDto)
      .toFinish(GatewayEventWorkflowFinish),
  ],
})
export class GatewayEventWorkflow {}
