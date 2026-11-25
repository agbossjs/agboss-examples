import { Action, listOf, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { BatchJobRequestDto } from "../dto/batch-job-request.dto.js";
import { BatchJobSummaryDto } from "../dto/batch-job-summary.dto.js";
import { ChunkFailedDto } from "../dto/chunk-failed.dto.js";
import { ChunkResultDto } from "../dto/chunk-result.dto.js";

@Action({
  name: "aggregate-batch-results-action",
  description: "Aggregates the results from all distributed child chunk executions",
  input: {
    request: BatchJobRequestDto,
    outcomes: listOf(ChunkResultDto, ChunkFailedDto),
  },
  output: BatchJobSummaryDto,
})
export class AggregateBatchResultsAction
  implements ActionHandler<AggregateBatchResultsAction>
{
  execute(
    input: InputOf<AggregateBatchResultsAction>,
  ): Promise<OutputOf<AggregateBatchResultsAction>> {
    let succeededCount = 0;
    let failedCount = 0;
    const summaries: string[] = [];

    for (const outcome of input.outcomes) {
      if ("summary" in outcome) {
        succeededCount += 1;
        summaries.push(`${outcome.chunkId}:${outcome.summary}`);
      } else {
        failedCount += 1;
        summaries.push(`${outcome.chunkId}:FAILED(${outcome.reason})`);
      }
    }

    return Promise.resolve({
      batchId: input.request.batchId,
      succeededCount,
      failedCount,
      combinedSummary: summaries.join(" | "),
    });
  }
}
