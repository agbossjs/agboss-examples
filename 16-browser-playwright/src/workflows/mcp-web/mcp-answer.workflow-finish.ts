import { WorkflowFinish } from "@agboss/core";
import { WorkflowFinishTextDto } from "@agboss/core/dto";

@WorkflowFinish({
  name: "mcp-answer-workflow-finish",
  description: "The agent's answer",
  output: WorkflowFinishTextDto,
})
export class McpAnswerWorkflowFinish {}
