import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({
  name: "handbook-workflow-start",
  description: "A question about the handbook",
  input: WorkflowStartTextDto,
})
export class HandbookWorkflowStart {}
