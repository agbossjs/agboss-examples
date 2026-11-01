import { WorkflowStart } from "@agboss/core";
import { GatewayEventDto } from "../../dto/gateway-event.dto.js";

@WorkflowStart({ name: "gateway-event-workflow-start", description: "A gateway event, applied once", input: GatewayEventDto })
export class GatewayEventWorkflowStart {}
