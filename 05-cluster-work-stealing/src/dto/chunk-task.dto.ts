import { Text } from "@agboss/core/dto";

export class ChunkTaskDto {
  @Text({ prompt: "Unique chunk identifier (e.g. chunk-01)" })
  chunkId!: string;

  @Text({ prompt: "Work payload for the chunk" })
  payload!: string;
}
