import { Compaction, CompactionStrategy } from "agboss";

@Compaction({
  name: "support-conversation-compaction",
  description: "Summarizes older conversation turns into a bounded queue while preserving order IDs and customer claims.",
  prompt:
    "Summarize the turns under `Turns to compact`: preserve order IDs, amounts, purchase age, and customer claims, and mark any v1.0 policy numbers as superseded by active v2.0 policy.",
  model: "offline/support-chat",
  strategy: CompactionStrategy.SummaryQueue,
  turnsBetweenCompactions: 2,
  summaryQueueLength: 4,
  summaryMaxTokens: 300,
})
export class SupportConversationCompaction {}
