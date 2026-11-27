import { Action, listOf, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { BatchDoneDto } from "../dto/batch-done.dto.js";
import { JobFailedDto } from "../dto/job-failed.dto.js";
import { JobReceiptDto } from "../dto/job-receipt.dto.js";

/** The batch's totals from every job's own finish: a receipt is a job done, the rest failed. */
@Action({
  name: "summarize-batch-action",
  description: "Counts the jobs of the batch that were done and that failed, and the workers that did them",
  input: { results: listOf(JobReceiptDto, JobFailedDto) },
  output: BatchDoneDto,
})
export class SummarizeBatchAction implements ActionHandler<SummarizeBatchAction> {
  execute(input: InputOf<SummarizeBatchAction>): Promise<OutputOf<SummarizeBatchAction>> {
    const done = input.results.filter((result) => "instanceId" in result);
    return Promise.resolve({
      jobs: input.results.length,
      succeeded: done.length,
      failed: input.results.length - done.length,
      workers: new Set(done.map((job) => job.instanceId)).size,
    });
  }
}
