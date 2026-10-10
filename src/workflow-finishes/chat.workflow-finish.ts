import { WorkflowFinishText } from "graphcompose/dto";
import { WorkflowFinish } from "graphcompose";

/** Where a turn of the chat finishes: the answer sent back to the job seeker. */
@WorkflowFinish({
  name: "chat",
  description: "The answer sent back to the job seeker",
  output: WorkflowFinishText,
})
export class ChatWorkflowFinish {}
