import { Action, ExecutionContext, Idempotency, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { ChunkDraftDto } from "../dto/chunk-draft.dto.js";
import { ChunkResultDto } from "../dto/chunk-result.dto.js";
import { ChunkLedgerRepository } from "../repositories/chunk-ledger.repository.js";

/**
 * Commits a finished chunk to the cluster's books — a side effect, and the step runs at least
 * once. It is a fenced effect (#500): the ledger's row and the effect's stored result in one
 * transaction of the shared SQLite file, checked against the step's lease. It is keyed by the
 * chunk (#508, `chunk:<chunkId>`), not the step: the step run again after a crash, or a second
 * worker for the same chunk on another instance, gets the first commit back and writes nothing; a
 * worker whose lease was taken over is refused (`ExecutionFencedError`, a hand-over) and writes
 * nothing either. It injects the application's `Idempotency` (agbossjs/agboss#890, #1317), never the
 * store: the store is the one the application's `@DatabaseStorage` builds, and the ledger writes through its
 * connection's `requireTransaction()` (#1317c).
 */
@Action({
  name: "commit-chunk-effect-action",
  description: "Commits the chunk to the cluster's ledger, once per chunk",
  input: { draft: ChunkDraftDto },
  output: ChunkResultDto,
  deps: [ExecutionContext, Idempotency, ChunkLedgerRepository],
})
export class CommitChunkEffectAction implements ActionHandler<CommitChunkEffectAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly idempotency: Idempotency,
    private readonly chunkLedgerRepository: ChunkLedgerRepository,
  ) {}

  async execute(input: InputOf<CommitChunkEffectAction>): Promise<OutputOf<CommitChunkEffectAction>> {
    const { chunkId, summary } = input.draft;
    const stepKey = this.executionContext.step.idempotencyKey;
    // agbossjs/agboss#825, said on purpose: a chunk is committed once, by whichever instance commits it first — a
    // summary a stolen chunk's second run writes replays the first, never a conflict
    const { result } = await this.idempotency.runOnce({
      name: "commit-chunk",
      key: `chunk:${chunkId}`,
      withoutFingerprint: true,
      ttl: hours(24),
      execute: () => this.chunkLedgerRepository.recordCommit({ chunkId, summary, stepKey }),
    });
    return { chunkId: result.chunkId, summary: result.summary, idempotencyKey: result.stepKey };
  }
}
