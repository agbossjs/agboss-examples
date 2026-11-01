import { WorkflowFinish } from "@agboss/core";
import { ShipmentDto } from "../../dto/shipment.dto.js";

@WorkflowFinish({ name: "checkout-workflow-finish", description: "The order, paid and shipped", output: ShipmentDto })
export class CheckoutWorkflowFinish {}
