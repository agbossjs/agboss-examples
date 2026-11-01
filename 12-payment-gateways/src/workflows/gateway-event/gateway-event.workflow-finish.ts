import { WorkflowFinish } from "@agboss/core";
import { MovementDto } from "../../dto/movement.dto.js";

@WorkflowFinish({ name: "gateway-event-workflow-finish", description: "What the gateway answered", output: MovementDto })
export class GatewayEventWorkflowFinish {}
