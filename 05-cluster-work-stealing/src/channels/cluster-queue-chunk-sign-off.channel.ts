import {
  Channel,
  ChannelOutcome,
  type ChannelAsk,
} from "@agboss/core";
import { ChunkSignOffChannel } from "./chunk-sign-off.channel-role.js";

@Channel({
  name: "cluster-queue-chunk-sign-off-channel",
  description: "Queues chunk approval in the shared cluster pause table",
})
export class ClusterQueueChunkSignOffChannel extends ChunkSignOffChannel {
  send(
    ask: ChannelAsk<ChunkSignOffChannel>,
  ): Promise<ChannelOutcome<ChunkSignOffChannel>> {
    void ask.pauseId;
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}
