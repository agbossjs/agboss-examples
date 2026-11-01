import { WorkflowFinish } from "@agboss/core";
import { MovementDto } from "../../dto/movement.dto.js";

@WorkflowFinish({ name: "capture-workflow-finish", description: "What the gateway answered", output: MovementDto })
export class CaptureWorkflowFinish {}
