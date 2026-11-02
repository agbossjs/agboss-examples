import { listOf, WorkflowStart } from "@agboss/core";
import { JobDto } from "../../dto/job.dto.js";

@WorkflowStart({
  name: "batch-workflow-start",
  description: "A batch of jobs, each queued for any worker",
  input: listOf(JobDto),
})
export class BatchWorkflowStart {}
