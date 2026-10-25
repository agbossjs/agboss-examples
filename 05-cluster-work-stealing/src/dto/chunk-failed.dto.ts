import { Text } from "agboss/dto";

export class ChunkFailedDto {
  @Text({ prompt: "Chunk identifier that failed" })
  chunkId!: string;

  @Text({ prompt: "Failure reason" })
  reason!: string;
}
