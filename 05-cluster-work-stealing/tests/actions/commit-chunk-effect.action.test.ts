import { ExecutionFencedError, FencedEffectRepository, SqliteFencedEffectRepository } from "@agboss/core";
import { override, testAction } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { CommitChunkEffectAction } from "../../src/actions/commit-chunk-effect.action.js";
import { ChunkWorkerAgent } from "../../src/agents/chunk-worker/chunk-worker.agent.js";

/**
 * The chunk's commit is a fenced effect keyed by the chunk (#500, #508). `testAction` runs every
 * call as the same step of the same execution under the runner's held lease, on one container and
 * one SQLite connection: a second call for one chunk is the step run again.
 */

const draft = (chunkId: string, summary: string) => ({
  draft: { producer: ChunkWorkerAgent, value: { chunkId, summary } },
});
// the action injects FencedEffects (agbossjs/agboss#890): the store is the one the application lists, SQLite's
const onFile = {
  environment: { sqlitePath: ":memory:" },
  overrides: [override(FencedEffectRepository, SqliteFencedEffectRepository)],
};

describe("CommitChunkEffectAction — one commit per chunk", () => {
  it("the step run again gets the commit it made, and writes no second row", async () => {
    const commit = testAction(CommitChunkEffectAction, onFile);

    const first = await commit(draft("batch-7-chunk-1", "done #1"));
    const retry = await commit(draft("batch-7-chunk-1", "done #1"));

    expect(first.output).toMatchObject({ chunkId: "batch-7-chunk-1", summary: "done #1" });
    expect(first.output.idempotencyKey).not.toBe("");
    expect(retry.output).toEqual(first.output);
  });

  it("a second worker's summary for a committed chunk replays the first commit (the key is the chunk)", async () => {
    const commit = testAction(CommitChunkEffectAction, onFile);

    const first = await commit(draft("batch-7-chunk-2", "worker A"));
    const late = await commit(draft("batch-7-chunk-2", "worker B, after a takeover"));

    expect(late.output).toEqual(first.output);
    expect(late.output.summary).toBe("worker A");
  });

  it("another chunk is a commit of its own", async () => {
    const commit = testAction(CommitChunkEffectAction, onFile);

    const one = await commit(draft("batch-7-chunk-3", "three"));
    const two = await commit(draft("batch-7-chunk-4", "four"));

    expect(two.output.chunkId).toBe("batch-7-chunk-4");
    expect(two.output.summary).toBe("four");
    expect(one.output.chunkId).toBe("batch-7-chunk-3");
  });

  it("a worker that lost its lease is refused: ExecutionFencedError, nothing committed", async () => {
    const zombie = testAction(CommitChunkEffectAction, { ...onFile, fence: { isLost: true } });

    await expect(zombie(draft("batch-7-chunk-5", "stale"))).rejects.toBeInstanceOf(
      ExecutionFencedError,
    );
  });
});
