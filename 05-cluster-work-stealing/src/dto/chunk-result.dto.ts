import { Text } from "agboss/dto";

export class ChunkResultDto {
  @Text({ prompt: "Unique chunk identifier" })
  chunkId!: string;

  @Text({ prompt: "Processed summary produced by the worker" })
  summary!: string;

  @Text({ prompt: "Step idempotency key recorded in the shared ledger" })
  idempotencyKey!: string;
}
