import { WorkflowFinish } from "@agboss/core";
import { TriageResponseDto } from "../../dto/triage-response.dto.js";

@WorkflowFinish({
  name: "triage-workflow-finish",
  description: "Completed triage response",
  output: TriageResponseDto,
})
export class TriageWorkflowFinish {}
