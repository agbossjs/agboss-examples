import { ExecutionStatus } from "agboss";
import { failWith, ModelFailure, replyWith, testWith } from "agboss/testing";
import { beforeEach, describe, expect } from "vitest";
import {
  CoordinatorWorkflowFinish,
  CoordinatorWorkflowStart,
} from "../coordinator/coordinator.workflow.js";
import { ClusterWorkStealingApplication } from "../src/application.js";
import {
  getClusterLedgerSnapshot,
  resetClusterLedger,
} from "../storage/cluster-ledger.service.js";
import {
  ChunkDraftDto,
  ChunkWorkerAgent,
} from "../worker/chunk-worker.workflow.js";
import {
  DecomposedLeafDto,
  DecomposeSplitDecisionDto,
  RecursiveDecomposerWorkflowFinish,
  RecursiveDecomposerWorkflowStart,
  ShardAnalyzerAgent,
} from "../worker/recursive-decomposer.workflow.js";

const clusterTest = testWith(ClusterWorkStealingApplication, { instances: 2 });

beforeEach(() => {
  resetClusterLedger();
});

describe("Cluster Work Stealing & Recursive Decomposition (EX-18 / EX-19)", () => {
  clusterTest(
    "fans out ChunkWorkerWorkflow with ChildPlacement.AnyInstance across 2 cluster instances and isolates soft-failed chunks",
    async ({ apps, mockLlm }) => {
      const [coordinatorApp] = apps;
      expect(apps.length).toBe(2);

      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "batch-200-chunk-1" } })
        .thenReturn(
          replyWith(ChunkDraftDto, {
            chunkId: "batch-200-chunk-1",
            summary: "Completed #1",
          }),
        );
      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "batch-200-chunk-2" } })
        .thenReturn(
          replyWith(ChunkDraftDto, {
            chunkId: "batch-200-chunk-2",
            summary: "Completed #2",
          }),
        );
      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "batch-200-chunk-3" } })
        .thenReturn(failWith(ModelFailure.RateLimited));
      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "batch-200-chunk-4" } })
        .thenReturn(
          replyWith(ChunkDraftDto, {
            chunkId: "batch-200-chunk-4",
            summary: "Completed #4",
          }),
        );

      const execution = await coordinatorApp!.execute(
        CoordinatorWorkflowStart,
        {
          batchId: "batch-200",
          chunkCount: 4,
        },
      );

      expect(execution.status).toBe(ExecutionStatus.Finished);
      expect(execution).toFinishWith(CoordinatorWorkflowFinish, {
        batchId: "batch-200",
        succeededCount: 3,
        failedCount: 1,
        combinedSummary:
          "batch-200-chunk-1:Completed #1 | batch-200-chunk-2:Completed #2 | batch-200-chunk-3:FAILED(Chunk batch-200-chunk-3 failed softly on worker) | batch-200-chunk-4:Completed #4",
      });

      const ledger = getClusterLedgerSnapshot();
      expect(ledger.length).toBe(3);
      expect(ledger.every((entry) => entry.attempts === 1)).toBe(true);
    },
  );

  clusterTest(
    "recursively decomposes ThisWorkflow up to maxDepth: 2 and merges child shard reports",
    async ({ app, mockLlm }) => {
      mockLlm(ShardAnalyzerAgent)
        .when({ node: { nodeLabel: "shard-root" } })
        .thenReturn(
          replyWith(DecomposeSplitDecisionDto, {
            reason: "Root shard exceeds single-worker threshold",
          }),
        );
      mockLlm(ShardAnalyzerAgent)
        .when({ node: { nodeLabel: "shard-root/L" } })
        .thenReturn(
          replyWith(DecomposedLeafDto, {
            report: "Left leaf analyzed",
          }),
        );
      mockLlm(ShardAnalyzerAgent)
        .when({ node: { nodeLabel: "shard-root/R" } })
        .thenReturn(
          replyWith(DecomposedLeafDto, {
            report: "Right leaf analyzed",
          }),
        );

      const execution = await app.execute(RecursiveDecomposerWorkflowStart, {
        nodeLabel: "shard-root",
        level: 1,
      });

      expect(execution.status).toBe(ExecutionStatus.Finished);
      expect(execution).toFinishWith(RecursiveDecomposerWorkflowFinish, {
        report: "shard-root: [Left leaf analyzed, Right leaf analyzed]",
      });
    },
  );
});
