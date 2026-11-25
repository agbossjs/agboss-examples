import { Channel, ChannelOutcome, type ChannelAsk } from "@agboss/core";
import { days } from "@agboss/core/units";
import { ChunkSignOffToolApproval } from "./chunk-sign-off.tool-approval.js";

@Channel({
  name: "cluster-queue-chunk-sign-off-channel",
  description: "Queues chunk approval in the shared cluster pause table",
  target: ChunkSignOffToolApproval,
  ttl: days(14), // how long a closed pause is kept for the channel
})
export class ClusterQueueChunkSignOffChannel {
  send(ask: ChannelAsk<ChunkSignOffToolApproval>): Promise<ChannelOutcome<ChunkSignOffToolApproval>> {
    void ask.pauseId;
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}
