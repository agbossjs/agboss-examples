import { WorkflowFinish } from "@agboss/core";
import { JobDoneDto } from "../../dto/job-done.dto.js";

@WorkflowFinish({
  name: "job-done-workflow-finish",
  description: "The job, done",
  output: JobDoneDto,
})
export class JobDoneWorkflowFinish {}
