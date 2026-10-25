import { ChannelOf, ChannelRole, PauseAnswerer } from "agboss";
import { ChunkTaskDto } from "../dto/chunk-task.dto.js";

@ChannelRole({
  name: "chunk-sign-off-channel",
  description: "Operator approval required before committing a high-risk chunk",
  approves: ChunkTaskDto,
  answeredBy: PauseAnswerer.ThreadOwner,
})
export abstract class ChunkSignOffChannel extends ChannelOf<ChunkSignOffChannel> {}
