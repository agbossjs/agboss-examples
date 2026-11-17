import { WorkflowFinish } from "@agboss/core";
import { WorkflowFinishTextDto } from "@agboss/core/dto";

@WorkflowFinish({
  name: "answer-workflow-finish",
  description: "The agent's answer",
  output: WorkflowFinishTextDto,
})
export class AnswerWorkflowFinish {}
