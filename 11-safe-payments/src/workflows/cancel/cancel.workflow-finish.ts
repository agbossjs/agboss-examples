import { WorkflowFinish } from "@agboss/core";
import { MovementDto } from "../../dto/movement.dto.js";

@WorkflowFinish({ name: "cancel-workflow-finish", description: "What moved", output: MovementDto })
export class CancelWorkflowFinish {}
