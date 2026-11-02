import { WorkflowStart } from "@agboss/core";
import { JobDto } from "../../dto/job.dto.js";

@WorkflowStart({
  name: "job-workflow-start",
  description: "One job to work on",
  input: JobDto,
})
export class JobWorkflowStart {}
