import { Injectable } from "agboss";

export interface CommittedChunkEffect {
  readonly chunkId: string;
  readonly idempotencyKey: string;
  readonly summary: string;
  readonly attempts: number;
}

const effectsByIdempotencyKey = new Map<string, CommittedChunkEffect>();

export function resetClusterLedger(): void {
  effectsByIdempotencyKey.clear();
}

export function getClusterLedgerSnapshot(): readonly CommittedChunkEffect[] {
  return [...effectsByIdempotencyKey.values()];
}

@Injectable()
export class ClusterLedgerService {
  recordChunkCommit(
    chunkId: string,
    idempotencyKey: string,
    summary: string,
  ): Promise<CommittedChunkEffect> {
    const existing = effectsByIdempotencyKey.get(idempotencyKey);
    if (existing !== undefined) {
      const updated: CommittedChunkEffect = {
        ...existing,
        attempts: existing.attempts + 1,
      };
      effectsByIdempotencyKey.set(idempotencyKey, updated);
      return Promise.resolve(updated);
    }
    const created: CommittedChunkEffect = {
      chunkId,
      idempotencyKey,
      summary,
      attempts: 1,
    };
    effectsByIdempotencyKey.set(idempotencyKey, created);
    return Promise.resolve(created);
  }
}
