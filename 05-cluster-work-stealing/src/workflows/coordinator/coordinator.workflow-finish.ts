import { WorkflowFinish } from "@agboss/core";
import { BatchJobSummaryDto } from "../../dto/batch-job-summary.dto.js";

@WorkflowFinish({
  name: "coordinator-workflow-finish",
  description: "Completed batch job summary",
  output: BatchJobSummaryDto,
})
export class CoordinatorWorkflowFinish {}
