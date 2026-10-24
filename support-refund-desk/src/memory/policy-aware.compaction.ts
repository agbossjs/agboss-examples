import {
  Compaction,
  CompactionStrategy,
  ExecutionContext,
  Injectable,
  type CompactionHandler,
  type CompactionInput,
  type CompactionTurn,
} from "agboss";

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

@Compaction({
  name: "policy-aware-compaction",
  description: "Custom deterministic compaction that preserves order facts while stripping superseded v1.0 policy claims.",
  strategy: CompactionStrategy.Custom,
  turnsBetweenCompactions: 2,
  deps: [PolicyDriftCompactionService, ExecutionContext],
})
export class PolicyAwareCompaction implements CompactionHandler {
  constructor(
    private readonly policyDriftCompactionService: PolicyDriftCompactionService,
    private readonly executionContext: ExecutionContext,
  ) {}

  compact(input: CompactionInput): readonly string[] {
    return this.policyDriftCompactionService.summarizeWithoutStalePolicy(
      this.executionContext.threadId,
      input.turnsToCompact,
      input.previousSummaries,
    );
  }
}
