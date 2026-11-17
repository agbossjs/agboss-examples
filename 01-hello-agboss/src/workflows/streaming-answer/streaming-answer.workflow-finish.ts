import { WorkflowFinish } from "@agboss/core";
import { WorkflowFinishTextDto } from "@agboss/core/dto";

@WorkflowFinish({
  name: "streaming-answer-workflow-finish",
  description: "The reply, as the widget showed it",
  output: WorkflowFinishTextDto,
})
export class StreamingAnswerWorkflowFinish {}
