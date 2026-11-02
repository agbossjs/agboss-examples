import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({
  name: "briefing-workflow-start",
  description: "A question answered from the handbook given first",
  input: WorkflowStartTextDto,
})
export class BriefingWorkflowStart {}
