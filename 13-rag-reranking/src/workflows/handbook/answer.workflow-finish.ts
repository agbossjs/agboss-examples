import { WorkflowFinish } from "@agboss/core";
import { WorkflowFinishTextDto } from "@agboss/core/dto";

@WorkflowFinish({
  name: "answer-workflow-finish",
  description: "The answer, with its source",
  output: WorkflowFinishTextDto,
})
export class AnswerWorkflowFinish {}
