import { Compaction, CompactionStrategy } from "agboss";

@Compaction({
  name: "support-conversation-compaction",
  description: "Summarizes older conversation turns into a bounded queue while preserving order IDs and customer claims.",
  promptUrls: ["./support-conversation.prompt.md"],
  model: "offline/support-chat",
  strategy: CompactionStrategy.SummaryQueue,
  turnsBetweenCompactions: 2,
  summaryQueueLength: 4,
  summaryMaxTokens: 300,
})
export class SupportConversationCompaction {}
