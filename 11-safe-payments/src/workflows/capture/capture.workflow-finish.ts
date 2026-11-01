import { WorkflowFinish } from "@agboss/core";
import { MovementDto } from "../../dto/movement.dto.js";

@WorkflowFinish({ name: "capture-workflow-finish", description: "What moved", output: MovementDto })
export class CaptureWorkflowFinish {}
