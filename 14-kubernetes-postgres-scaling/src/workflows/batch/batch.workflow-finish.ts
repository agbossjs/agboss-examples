import { WorkflowFinish } from "@agboss/core";
import { BatchDoneDto } from "../../dto/batch-done.dto.js";

@WorkflowFinish({
  name: "batch-done-workflow-finish",
  description: "Every job of the batch, ended: done or failed",
  output: BatchDoneDto,
})
export class BatchDoneWorkflowFinish {}
