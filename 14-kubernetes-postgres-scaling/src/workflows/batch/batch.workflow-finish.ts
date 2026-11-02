import { listOf, WorkflowFinish, type Produced } from "@agboss/core";
import { BatchDoneDto } from "../../dto/batch-done.dto.js";
import { JobDoneDto } from "../../dto/job-done.dto.js";

@WorkflowFinish({
  name: "batch-done-workflow-finish",
  description: "Every job of the batch, done",
  input: { done: listOf(JobDoneDto) },
  output: BatchDoneDto,
})
export class BatchDoneWorkflowFinish {
  finish(input: {
    readonly done: readonly Produced<JobDoneDto, unknown>[];
  }): BatchDoneDto {
    const workers = new Set(input.done.map((job) => job.value.instanceId));
    return { jobs: input.done.length, workers: workers.size };
  }
}
