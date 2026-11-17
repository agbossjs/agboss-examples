import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({
  name: "streaming-answer-workflow-start",
  description: "A customer's message for the live chat widget",
  input: WorkflowStartTextDto,
})
export class StreamingAnswerWorkflowStart {}
