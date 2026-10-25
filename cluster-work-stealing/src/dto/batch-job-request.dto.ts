import { Integer, Text } from "agboss/dto";

export class BatchJobRequestDto {
  @Text({ prompt: "Batch job identifier (e.g. batch-100)" })
  batchId!: string;

  @Integer({ prompt: "Number of work chunks to fan out across the cluster", min: 1, max: 8 })
  chunkCount!: number;
}
