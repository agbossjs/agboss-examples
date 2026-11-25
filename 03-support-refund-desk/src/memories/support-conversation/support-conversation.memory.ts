import { CompactionStrategy, Memory } from "@agboss/core";
import { days } from "@agboss/core/units";

@Memory({
  name: "support-conversation-memory",
  description: "Summarizes older conversation turns into a bounded queue while preserving order IDs and customer claims.",
  ttl: days(30),
  uncompactedTurns: 5,
  turnsBetweenCompactions: 2,
  compaction: {
    strategy: CompactionStrategy.SummaryQueue,
    prompt: "./support-conversation.prompt.md",
    model: "offline/support-chat",
    summaryQueueLength: 4,
    summaryMaxTokens: 300,
  },
})
export class SupportConversationMemory {}
