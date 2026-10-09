import { WorkflowStartText } from "graphcompose/dto";
// eslint-disable-next-line no-restricted-imports
import { WorkflowStart } from "graphcompose/router";

/** Where a turn of the chat starts: the job seeker's message. */
@WorkflowStart({
  name: "chat",
  description: "A message from the job seeker",
  input: WorkflowStartText,
})
export class ChatWorkflowStart {}
