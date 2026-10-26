import { ThisWorkflow } from "@agboss/core";
import { testAction, testTool } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { AggregateBatchResultsAction } from "../../src/actions/aggregate-batch-results.action.js";
import { CommitChunkEffectAction } from "../../src/actions/commit-chunk-effect.action.js";
import { MarkChunkFailedAction } from "../../src/actions/mark-chunk-failed.action.js";
import { MarkShardFailedAction } from "../../src/actions/mark-shard-failed.action.js";
import { MergeShardsAction } from "../../src/actions/merge-shards.action.js";
import { PartitionBatchAction } from "../../src/actions/partition-batch.action.js";
import { SplitShardAction } from "../../src/actions/split-shard.action.js";
import { ChunkWorkerAgent } from "../../src/agents/chunk-worker/chunk-worker.agent.js";
import { BatchJobRequestDto } from "../../src/dto/batch-job-request.dto.js";
import { ChunkDraftDto } from "../../src/dto/chunk-draft.dto.js";
import { ChunkFailedDto } from "../../src/dto/chunk-failed.dto.js";
import { ChunkResultDto } from "../../src/dto/chunk-result.dto.js";
import { ChunkTaskDto } from "../../src/dto/chunk-task.dto.js";
import { DecomposeFailedDto } from "../../src/dto/decompose-failed.dto.js";
import { DecomposeNodeDto } from "../../src/dto/decompose-node.dto.js";
import { DecomposedLeafDto } from "../../src/dto/decomposed-leaf.dto.js";
import { RequestChunkSignOffTool } from "../../src/tools/request-chunk-sign-off.tool.js";
import { ChunkWorkerWorkflowStart } from "../../src/workflows/chunk-worker/chunk-worker.workflow-start.js";
import { ChunkWorkerWorkflow } from "../../src/workflows/chunk-worker/chunk-worker.workflow.js";
import { CoordinatorWorkflowStart } from "../../src/workflows/coordinator/coordinator.workflow-start.js";
import { RecursiveDecomposerWorkflowStart } from "../../src/workflows/recursive-decomposer/recursive-decomposer.workflow-start.js";

describe("05-cluster-work-stealing — Isolated Action & Tool Unit Tests", () => {
  it("tests PartitionBatchAction, CommitChunkEffectAction, MarkChunkFailedAction, and AggregateBatchResultsAction via testAction()", async () => {
    const runPartition = testAction(PartitionBatchAction);
    const partitioned = await runPartition({
      request: {
        producer: CoordinatorWorkflowStart,
        value: Object.assign(new BatchJobRequestDto(), {
          batchId: "batch-1",
          chunkCount: 3,
        }),
      },
    });
    expect(partitioned.output).toHaveLength(3);
    expect(partitioned.output[0]).toEqual({
      chunkId: "batch-1-chunk-1",
      payload: "Segment #1 of batch-1",
    });

    const runCommit = testAction(CommitChunkEffectAction);
    const committed = await runCommit({
      draft: {
        producer: ChunkWorkerAgent,
        value: Object.assign(new ChunkDraftDto(), {
          chunkId: "batch-1-chunk-1",
          summary: "Processed #1",
        }),
      },
    });
    expect(committed.output.chunkId).toBe("batch-1-chunk-1");
    expect(committed.output.summary).toBe("Processed #1");
    expect(committed.output.idempotencyKey).toBeTruthy();

    const runMarkFailed = testAction(MarkChunkFailedAction);
    const failedChunk = await runMarkFailed({
      task: {
        producer: ChunkWorkerWorkflowStart,
        value: Object.assign(new ChunkTaskDto(), {
          chunkId: "batch-1-chunk-2",
          payload: "Segment #2 of batch-1",
        }),
      },
    });
    expect(failedChunk.output.chunkId).toBe("batch-1-chunk-2");
    expect(failedChunk.output.reason).toContain("failed softly on worker");

    const runAggregate = testAction(AggregateBatchResultsAction);
    const aggregated = await runAggregate({
      request: {
        producer: CoordinatorWorkflowStart,
        value: Object.assign(new BatchJobRequestDto(), {
          batchId: "batch-1",
          chunkCount: 2,
        }),
      },
      outcomes: [
        {
          producer: ChunkWorkerWorkflow,
          value: Object.assign(new ChunkResultDto(), committed.output),
        },
        {
          producer: ChunkWorkerWorkflow,
          value: Object.assign(new ChunkFailedDto(), failedChunk.output),
        },
      ],
    });
    expect(aggregated.output.batchId).toBe("batch-1");
    expect(aggregated.output.succeededCount).toBe(1);
    expect(aggregated.output.failedCount).toBe(1);
    expect(aggregated.output.combinedSummary).toContain("batch-1-chunk-1:Processed #1");
    expect(aggregated.output.combinedSummary).toContain("batch-1-chunk-2:FAILED");
  });

  it("tests SplitShardAction, MarkShardFailedAction, MergeShardsAction, and RequestChunkSignOffTool", async () => {
    const runSplit = testAction(SplitShardAction);
    const splitRes = await runSplit({
      node: {
        producer: RecursiveDecomposerWorkflowStart,
        value: Object.assign(new DecomposeNodeDto(), {
          nodeLabel: "ROOT",
          level: 0,
        }),
      },
    });
    expect(splitRes.output).toEqual([
      { nodeLabel: "ROOT/L", level: 1 },
      { nodeLabel: "ROOT/R", level: 1 },
    ]);

    const runMarkShardFailed = testAction(MarkShardFailedAction);
    const failedShard = await runMarkShardFailed({
      node: {
        producer: RecursiveDecomposerWorkflowStart,
        value: Object.assign(new DecomposeNodeDto(), {
          nodeLabel: "ROOT/R",
          level: 1,
        }),
      },
    });
    expect(failedShard.output).toEqual({ nodeLabel: "ROOT/R" });

    const runMerge = testAction(MergeShardsAction);
    const merged = await runMerge({
      node: {
        producer: RecursiveDecomposerWorkflowStart,
        value: Object.assign(new DecomposeNodeDto(), {
          nodeLabel: "ROOT",
          level: 0,
        }),
      },
      children: [
        {
          producer: ThisWorkflow,
          value: Object.assign(new DecomposedLeafDto(), {
            report: "ROOT/L=ok",
          }),
        },
        {
          producer: ThisWorkflow,
          value: Object.assign(new DecomposeFailedDto(), failedShard.output),
        },
      ],
    });
    expect(merged.output.report).toBe("ROOT: [ROOT/L=ok, FAILED(ROOT/R)]");

    const runSignOff = testTool(RequestChunkSignOffTool);
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
