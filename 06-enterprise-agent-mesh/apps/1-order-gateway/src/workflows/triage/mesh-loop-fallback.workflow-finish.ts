import { WorkflowFinish } from "@agboss/core";
import { TriageRequestDto } from "../../dto/triage-request.dto.js";

@WorkflowFinish({
  name: "mesh-loop-fallback-workflow-finish",
  description: "Fallback finish when a cyclic A2A/MCP mesh call or hop limit is detected",
  output: TriageRequestDto,
})
export class MeshLoopFallbackWorkflowFinish {}
