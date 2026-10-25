import {
  Compaction,
  CompactionStrategy,
  ExecutionContext,
  type CompactionHandler,
  type CompactionInput,
} from "agboss";
import { PolicyDriftCompactionService } from "../../services/policy-drift-compaction.service.js";

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
