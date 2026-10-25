import { Integer, Text } from "agboss/dto";

export class BatchJobSummaryDto {
  @Text({ prompt: "Batch job identifier" })
  batchId!: string;

  @Integer({ prompt: "Number of succeeded chunks", min: 0 })
  succeededCount!: number;

  @Integer({ prompt: "Number of soft-failed chunks", min: 0 })
  failedCount!: number;

  @Text({ prompt: "Aggregated summary of all chunk outputs" })
  combinedSummary!: string;
}
