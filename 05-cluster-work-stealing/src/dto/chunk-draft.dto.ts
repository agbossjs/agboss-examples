import { Text } from "@agboss/core/dto";

export class ChunkDraftDto {
  @Text({ prompt: "Unique chunk identifier" })
  chunkId!: string;

  @Text({ prompt: "Processed summary produced by the worker agent" })
  summary!: string;
}
