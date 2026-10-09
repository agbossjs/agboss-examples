import { WorkflowFinishText } from "graphcompose/dto";
// eslint-disable-next-line no-restricted-imports
import { WorkflowFinish } from "graphcompose/router";

/** Where a turn of the chat finishes: the answer sent back to the job seeker. */
@WorkflowFinish({
  name: "chat",
  description: "The answer sent back to the job seeker",
  output: WorkflowFinishText,
})
export class ChatWorkflowFinish {}
