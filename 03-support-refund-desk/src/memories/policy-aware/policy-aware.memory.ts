import { ExecutionContext, Memory, type CompactionInput } from "@agboss/core";
import { days } from "@agboss/core/units";
import { PolicyDriftCompactionService } from "../../services/policy-drift-compaction.service.js";

@Memory({
  name: "policy-aware-memory",
  description: "Keeps two turns in full and compacts the older ones in code: order facts stay, superseded v1.0 policy claims go.",
  ttl: days(30),
  uncompactedTurns: 2,
  turnsBetweenCompactions: 2,
  deps: [PolicyDriftCompactionService, ExecutionContext],
})
export class PolicyAwareMemory {
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
