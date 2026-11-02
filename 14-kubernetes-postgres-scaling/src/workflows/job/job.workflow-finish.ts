import { WorkflowFinish } from "@agboss/core";
import { JobReceiptDto } from "../../dto/job-receipt.dto.js";

@WorkflowFinish({
  name: "job-done-workflow-finish",
  description: "The job, done",
  output: JobReceiptDto,
})
export class JobDoneWorkflowFinish {}
