import { isVariant, listOf, oneOf, WorkflowFinish, type Produced } from "@agboss/core";
import { BatchDoneDto } from "../../dto/batch-done.dto.js";
import { JobFailedDto } from "../../dto/job-failed.dto.js";
import { JobReceiptDto } from "../../dto/job-receipt.dto.js";

@WorkflowFinish({
  name: "batch-done-workflow-finish",
  description: "Every job of the batch, ended: done or failed",
  input: { results: listOf(oneOf(JobReceiptDto, JobFailedDto)) },
  output: BatchDoneDto,
})
export class BatchDoneWorkflowFinish {
  finish(input: {
    readonly results: readonly Produced<JobReceiptDto | JobFailedDto, unknown>[];
  }): BatchDoneDto {
    const done = input.results.filter((result) => isVariant(result, JobReceiptDto));
    const workers = new Set(done.map((job) => job.value.instanceId));
    return {
      jobs: input.results.length,
      succeeded: done.length,
      failed: input.results.length - done.length,
      workers: workers.size,
    };
  }
}
