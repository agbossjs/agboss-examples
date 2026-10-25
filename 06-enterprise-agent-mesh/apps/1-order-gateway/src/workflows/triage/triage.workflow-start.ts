import { WorkflowStart } from "agboss";
import { TriageRequestDto } from "../../dto/triage-request.dto.js";

@WorkflowStart({
  name: "triage-workflow-start",
  description: "Entry point for enterprise triage requests across A2A and MCP",
  input: TriageRequestDto,
})
export class TriageWorkflowStart {}
