import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({
  name: "ask-workflow-start",
  description: "A request the agent answers by reading allowed pages",
  input: WorkflowStartTextDto,
})
export class AskWorkflowStart {}
