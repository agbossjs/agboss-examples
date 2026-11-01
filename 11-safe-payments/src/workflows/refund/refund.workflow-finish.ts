import { WorkflowFinish } from "@agboss/core";
import { MovementDto } from "../../dto/movement.dto.js";

@WorkflowFinish({ name: "refund-workflow-finish", description: "What moved", output: MovementDto })
export class RefundWorkflowFinish {}
