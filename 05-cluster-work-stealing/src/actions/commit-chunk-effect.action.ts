import {
  Action,
  ExecutionContext,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { ChunkDraftDto } from "../dto/chunk-draft.dto.js";
import { ChunkResultDto } from "../dto/chunk-result.dto.js";
import { ClusterLedgerService } from "../services/cluster-ledger.service.js";

@Action({
  name: "commit-chunk-effect-action",
  description:
    "Records the chunk completion in ClusterLedgerService keyed by executionContext.step.idempotencyKey",
  input: { draft: ChunkDraftDto },
  output: ChunkResultDto,
  deps: [ClusterLedgerService, ExecutionContext],
})
export class CommitChunkEffectAction
  implements ActionHandler<CommitChunkEffectAction>
{
  constructor(
    private readonly clusterLedgerService: ClusterLedgerService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(
    input: InputOf<CommitChunkEffectAction>,
  ): Promise<OutputOf<CommitChunkEffectAction>> {
    const { chunkId, summary } = input.draft.value;
    const idempotencyKey = this.executionContext.step.idempotencyKey;
    const record = await this.clusterLedgerService.recordChunkCommit(
      chunkId,
      idempotencyKey,
      summary,
    );
    return {
      chunkId: record.chunkId,
      summary: record.summary,
      idempotencyKey: record.idempotencyKey,
    };
  }
}
