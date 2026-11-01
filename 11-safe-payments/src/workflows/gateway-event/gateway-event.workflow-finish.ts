import { WorkflowFinish } from "@agboss/core";
import { OrderStatusDto } from "../../dto/order-status.dto.js";

@WorkflowFinish({ name: "gateway-event-workflow-finish", description: "What moved", output: OrderStatusDto })
export class GatewayEventWorkflowFinish {}
