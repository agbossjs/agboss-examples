import { SqliteFencedEffectRepository, provide } from "@agboss/core";
import { DATABASE_SETTINGS } from "@agboss/core/stores";
import { testUnit } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { AggregateBatchResultsAction } from "../../src/actions/aggregate-batch-results.action.js";
import { CommitChunkEffectAction } from "../../src/actions/commit-chunk-effect.action.js";
import { MarkChunkFailedAction } from "../../src/actions/mark-chunk-failed.action.js";
import { MarkShardFailedAction } from "../../src/actions/mark-shard-failed.action.js";
import { MergeShardsAction } from "../../src/actions/merge-shards.action.js";
import { PartitionBatchAction } from "../../src/actions/partition-batch.action.js";
import { SplitShardAction } from "../../src/actions/split-shard.action.js";
import { BatchJobRequestDto } from "../../src/dto/batch-job-request.dto.js";
import { ChunkDraftDto } from "../../src/dto/chunk-draft.dto.js";
import { ChunkFailedDto } from "../../src/dto/chunk-failed.dto.js";
import { ChunkResultDto } from "../../src/dto/chunk-result.dto.js";
import { ChunkTaskDto } from "../../src/dto/chunk-task.dto.js";
import { DecomposeFailedDto } from "../../src/dto/decompose-failed.dto.js";
import { DecomposeNodeDto } from "../../src/dto/decompose-node.dto.js";
import { DecomposedLeafDto } from "../../src/dto/decomposed-leaf.dto.js";
import { RequestChunkSignOffTool } from "../../src/tools/request-chunk-sign-off.tool.js";

describe("05-cluster-work-stealing — Isolated Action & Tool Unit Tests", () => {
  it("tests PartitionBatchAction, CommitChunkEffectAction, MarkChunkFailedAction, and AggregateBatchResultsAction via testUnit()", async () => {
    const runPartition = testUnit(PartitionBatchAction);
    const partitioned = await runPartition({
      request: Object.assign(new BatchJobRequestDto(), {
          batchId: "batch-1",
          chunkCount: 3,
        }),
    });
    expect(partitioned.output).toHaveLength(3);
    expect(partitioned.output[0]).toEqual({
      chunkId: "batch-1-chunk-1",
      payload: "Segment #1 of batch-1",
    });

    // the commit is a fenced effect on the SQLite file (#500): the runner needs the file, and the
    // application's store (the action injects Idempotency, agbossjs/agboss#890)
    const runCommit = testUnit(CommitChunkEffectAction, {
      services: [
        SqliteFencedEffectRepository,
        provide(DATABASE_SETTINGS, { kind: "sqlite", path: ":memory:" }),
      ],
    });
    const committed = await runCommit({
      draft: Object.assign(new ChunkDraftDto(), {
          chunkId: "batch-1-chunk-1",
          summary: "Processed #1",
        }),
    });
    expect(committed.output.chunkId).toBe("batch-1-chunk-1");
    expect(committed.output.summary).toBe("Processed #1");
    expect(committed.output.idempotencyKey).toBeTruthy();

    const runMarkFailed = testUnit(MarkChunkFailedAction);
    const failedChunk = await runMarkFailed({
      task: Object.assign(new ChunkTaskDto(), {
          chunkId: "batch-1-chunk-2",
          payload: "Segment #2 of batch-1",
        }),
    });
    expect(failedChunk.output.chunkId).toBe("batch-1-chunk-2");
    expect(failedChunk.output.reason).toContain("failed softly on worker");

    const runAggregate = testUnit(AggregateBatchResultsAction);
    const aggregated = await runAggregate({
      request: Object.assign(new BatchJobRequestDto(), {
          batchId: "batch-1",
          chunkCount: 2,
        }),
      outcomes: [
        Object.assign(new ChunkResultDto(), committed.output),
        Object.assign(new ChunkFailedDto(), failedChunk.output),
      ],
    });
    expect(aggregated.output.batchId).toBe("batch-1");
    expect(aggregated.output.succeededCount).toBe(1);
    expect(aggregated.output.failedCount).toBe(1);
    expect(aggregated.output.combinedSummary).toContain("batch-1-chunk-1:Processed #1");
    expect(aggregated.output.combinedSummary).toContain("batch-1-chunk-2:FAILED");
  });

  it("tests SplitShardAction, MarkShardFailedAction, MergeShardsAction, and RequestChunkSignOffTool", async () => {
    const runSplit = testUnit(SplitShardAction);
    const splitRes = await runSplit({
      node: Object.assign(new DecomposeNodeDto(), {
          nodeLabel: "ROOT",
          level: 0,
        }),
    });
    expect(splitRes.output).toEqual([
      { nodeLabel: "ROOT/L", level: 1 },
      { nodeLabel: "ROOT/R", level: 1 },
    ]);

    const runMarkShardFailed = testUnit(MarkShardFailedAction);
    const failedShard = await runMarkShardFailed({
      node: Object.assign(new DecomposeNodeDto(), {
          nodeLabel: "ROOT/R",
          level: 1,
        }),
    });
    expect(failedShard.output).toEqual({ nodeLabel: "ROOT/R" });

    const runMerge = testUnit(MergeShardsAction);
    const merged = await runMerge({
      node: Object.assign(new DecomposeNodeDto(), {
          nodeLabel: "ROOT",
          level: 0,
        }),
      children: [
        Object.assign(new DecomposedLeafDto(), {
            report: "ROOT/L=ok",
          }),
        Object.assign(new DecomposeFailedDto(), failedShard.output),
      ],
    });
    expect(merged.output.report).toBe("ROOT: [ROOT/L=ok, FAILED(ROOT/R)]");

    const runSignOff = testUnit(RequestChunkSignOffTool);
    const approved = await runSignOff(
      Object.assign(new ChunkTaskDto(), {
        chunkId: "batch-1-chunk-3",
        payload: "Segment #3",
      }),
    );
    expect(approved.output).toEqual({
      chunkId: "batch-1-chunk-3",
      summary: "Approved high-risk chunk batch-1-chunk-3: Segment #3",
    });
  });
});
