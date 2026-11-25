import { CompactionStrategy, Memory } from "@agboss/core";
import { days } from "@agboss/core/units";
import { KIMI } from "../config/settings.js";

/**
 * How the job-scout conversation is remembered (#120 PR 3, #1303): the last 8 turns in full, every 5 turns past the
 * window become one self-contained summary, the latest 10 are kept, for 30 days.
 */
@Memory({
  name: "conversation-memory",
  description: "Remembers 8 turns of the job-scout conversation in full and summarises the older ones",
  ttl: days(30),
  uncompactedTurns: 8,
  turnsBetweenCompactions: 5,
  compaction: {
    strategy: CompactionStrategy.SummaryQueue,
    prompt: "./conversation.prompt.md",
    model: KIMI,
    summaryQueueLength: 10,
    summaryMaxTokens: 400,
  },
})
export class ConversationMemory {}
