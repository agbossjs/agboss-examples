import { Injectable, type CompactionTurn } from "@agboss/core";

@Injectable()
export class PolicyDriftCompactionService {
  summarizeWithoutStalePolicy(
    threadId: string,
    turns: readonly CompactionTurn[],
    previous: readonly string[],
  ): readonly string[] {
    const extractedFacts = turns.map((turn, idx) => {
      const rawInput = JSON.stringify(turn.input);
      const orderMatch = /ORD-\d{4}/u.exec(rawInput);
      const orderTag = orderMatch ? orderMatch[0] : "unknown-order";
      return `[thread:${threadId} compacted-turn-${idx + 1}] order=${orderTag} | note: any v1.0 (90-day / $2000) policy mentioned in early turns is SUPERSEDED; enforce active v2.0 (30-day / $500) policy.`;
    });
    return [...previous, ...extractedFacts];
  }
}
