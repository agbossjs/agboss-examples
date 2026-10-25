import {
  ExecutionLeaseLostError,
  ExecutionLeaseRepository,
  ExecutionStatus,
  IncompatibleResumeError,
} from "agboss";
import { studioOf } from "agboss/internal";
import {
  callTool,
  failWith,
  ModelFailure,
  replyWith,
  testWith,
  waitFor,
} from "agboss/testing";
import { seconds } from "agboss/units";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  setAllowIncompatibleResume,
  simulateVersionDriftOnPausedThread,
} from "../../../scenarios/cross-instance-cancel-and-resume.js";
import {
  createLeaseFencingAssertionSummary,
  simulateHolderLeaseWindowExpiredInStore,
  verifyLeaseRepositoryPing,
} from "../../../scenarios/lease-expiration-and-fencing.js";
import { ChunkWorkerAgent } from "../../../src/agents/chunk-worker/chunk-worker.agent.js";
import { ShardAnalyzerAgent } from "../../../src/agents/shard-analyzer/shard-analyzer.agent.js";
import { ClusterWorkStealingApplication } from "../../../src/cluster-work-stealing.application.js";
import { ChunkDraftDto } from "../../../src/dto/chunk-draft.dto.js";
import { DecomposeSplitDecisionDto } from "../../../src/dto/decompose-split-decision.dto.js";
import { DecomposedLeafDto } from "../../../src/dto/decomposed-leaf.dto.js";
import {
  getClusterLedgerSnapshot,
  resetClusterLedger,
} from "../../../src/services/cluster-ledger.service.js";
import { RequestChunkSignOffTool } from "../../../src/tools/request-chunk-sign-off.tool.js";
import { ChunkWorkerWorkflowFinish } from "../../../src/workflows/chunk-worker/chunk-worker.workflow-finish.js";
import { ChunkWorkerWorkflowStart } from "../../../src/workflows/chunk-worker/chunk-worker.workflow-start.js";
import { CoordinatorWorkflowFinish } from "../../../src/workflows/coordinator/coordinator.workflow-finish.js";
import { CoordinatorWorkflowStart } from "../../../src/workflows/coordinator/coordinator.workflow-start.js";
import { RecursiveDecomposerWorkflowFinish } from "../../../src/workflows/recursive-decomposer/recursive-decomposer.workflow-finish.js";
import { RecursiveDecomposerWorkflowStart } from "../../../src/workflows/recursive-decomposer/recursive-decomposer.workflow-start.js";

const clusterTest = testWith(ClusterWorkStealingApplication, { instances: 2 });

beforeEach(() => {
  resetClusterLedger();
});

afterEach(() => {
  setAllowIncompatibleResume(false);
});

describe("CoordinatorWorkflow, ChunkWorkerWorkflow & RecursiveDecomposerWorkflow", () => {
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

  clusterTest(
    "fences a stalled instance with ExecutionLeaseLostError when another instance steals the expired lease",
    async ({ apps, clock, mockLlm }) => {
      const [instance1, instance2] = apps;
      await instance1!.ready();
      await instance2!.ready();
      expect(await verifyLeaseRepositoryPing(instance1!)).toBe(true);
      expect(await verifyLeaseRepositoryPing(instance2!)).toBe(true);

      const leaseRepo = instance2!.resolve(ExecutionLeaseRepository);

      mockLlm(ChunkWorkerAgent).thenReturn(
        waitFor(seconds(35)),
        replyWith(ChunkDraftDto, {
          chunkId: "chunk-lease-01",
          summary: "Stale instance attempt after stall",
        }),
      );

      const inFlightOutcome = instance1!
        .execute(ChunkWorkerWorkflowStart, {
          chunkId: "chunk-lease-01",
          payload: "Long-running step exceeding lease window",
        })
        .then(
          () => undefined,
          (error: unknown) => error,
        );

      await clock.advance(seconds(1));

      simulateHolderLeaseWindowExpiredInStore(instance1!, "execution-1");

      const stolenLease = await leaseRepo.acquire(
        "default",
        "execution-1",
        seconds(30),
      );
      expect(stolenLease?.leaseEpoch).toBeGreaterThan(1);

      await clock.advance(seconds(10));

      const caughtError = await inFlightOutcome;

      expect(caughtError).toBeInstanceOf(ExecutionLeaseLostError);
      if (stolenLease !== undefined) {
        await leaseRepo.release(stolenLease);
      }

      mockLlm(ChunkWorkerAgent).thenReturn(
        replyWith(ChunkDraftDto, {
          chunkId: "chunk-lease-02",
          summary: "Completed cleanly on instance 2",
        }),
      );

      const takeoverRun = await instance2!.execute(ChunkWorkerWorkflowStart, {
        chunkId: "chunk-lease-02",
        payload: "Healthy execution on instance 2",
      });

      expect(takeoverRun.status).toBe(ExecutionStatus.Finished);
      expect(takeoverRun).toFinishWith(ChunkWorkerWorkflowFinish, {
        chunkId: "chunk-lease-02",
        summary: "Completed cleanly on instance 2",
        idempotencyKey: expect.any(String) as string,
      });

      const summary = createLeaseFencingAssertionSummary(
        caughtError,
        takeoverRun.status,
      );
      expect(summary.staleHolderErrorCode).toBe("execution.lease-lost");
      expect(summary.ledgerEntries.length).toBe(1);
      expect(summary.ledgerEntries[0]?.chunkId).toBe("chunk-lease-02");
    },
  );

  clusterTest(
    "pauses on instance 1, resumes/cancels from instance 2, and rejects incompatible version drift with IncompatibleResumeError",
    async ({ apps, mockLlm }) => {
      const [instance1, instance2] = apps;

      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "chunk-pause-resume" } })
        .thenReturn(
          callTool(RequestChunkSignOffTool, {
            chunkId: "chunk-pause-resume",
            payload: "Requires cross-instance operator sign-off",
          }),
          replyWith(ChunkDraftDto, {
            chunkId: "chunk-pause-resume",
            summary: "Resumed and completed on instance 2",
          }),
        );

      const pausedOn1 = await instance1!.execute(
        ChunkWorkerWorkflowStart,
        {
          chunkId: "chunk-pause-resume",
          payload: "Requires cross-instance operator sign-off",
        },
        { ownerId: "operator-alice" },
      );

      expect(pausedOn1.status).toBe(ExecutionStatus.Paused);
      if (pausedOn1.status !== ExecutionStatus.Paused) {
        throw new Error("Expected paused execution");
      }
      const pauseId = pausedOn1.pending[0]?.pauseId ?? "";

      const resumedOn2 = await instance2!.resume(
        { pauseId, decision: { approved: true } },
        { ownerId: "operator-alice" },
      );

      expect(resumedOn2.status).toBe(ExecutionStatus.Finished);
      expect(resumedOn2).toFinishWith(ChunkWorkerWorkflowFinish, {
        chunkId: "chunk-pause-resume",
        summary: "Resumed and completed on instance 2",
        idempotencyKey: expect.any(String) as string,
      });

      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "chunk-pause-cancel" } })
        .thenReturn(
          callTool(RequestChunkSignOffTool, {
            chunkId: "chunk-pause-cancel",
            payload: "Will be cancelled from instance 2",
          }),
        );

      const pausedToCancel = await instance1!.execute(
        ChunkWorkerWorkflowStart,
        {
          chunkId: "chunk-pause-cancel",
          payload: "Will be cancelled from instance 2",
        },
        { ownerId: "operator-alice" },
      );
      expect(pausedToCancel.status).toBe(ExecutionStatus.Paused);

      const cancelledFrom2 = await instance2!.cancel(pausedToCancel.threadId, {
        ownerId: "operator-alice",
      });
      expect(cancelledFrom2.cancelled).toBe(true);

      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "chunk-version-drift" } })
        .thenReturn(
          callTool(RequestChunkSignOffTool, {
            chunkId: "chunk-version-drift",
            payload: "Paused under older deployment",
          }),
          replyWith(ChunkDraftDto, {
            chunkId: "chunk-version-drift",
            summary: "Resumed after explicit policy override",
          }),
        );

      const pausedDrift = await instance1!.execute(
        ChunkWorkerWorkflowStart,
        {
          chunkId: "chunk-version-drift",
          payload: "Paused under older deployment",
        },
        { ownerId: "operator-alice" },
      );
      const driftPauseId = pausedDrift.pending[0]?.pauseId ?? "";
      await simulateVersionDriftOnPausedThread(
        instance1!,
        pausedDrift.threadId,
        "0.9.0",
      );

      await expect(
        instance1!.resume(
          { pauseId: driftPauseId, decision: { approved: true } },
          { ownerId: "operator-alice" },
        ),
      ).rejects.toThrow(IncompatibleResumeError);

      setAllowIncompatibleResume(true);
      const resumedAfterOverride = await instance1!.resume(
        { pauseId: driftPauseId, decision: { approved: true } },
        { ownerId: "operator-alice" },
      );
      expect(resumedAfterOverride.status).toBe(ExecutionStatus.Finished);
    },
  );

  it("renders child workflows as subgraphs (xray: true) and marks ThisWorkflow with recursive maxDepth in LangGraph Studio", async () => {
    const studio = await studioOf(ClusterWorkStealingApplication, {
      processEnv: {
        ...process.env,
        OPENROUTER_API_KEY:
          process.env.OPENROUTER_API_KEY ??
          process.env.OPEN_ROUTER_KEY ??
          "offline-test-openrouter-api-key",
      },
    });
    try {
      expect(studio.names).toEqual(
        expect.arrayContaining([
          "coordinator-workflow",
          "chunk-worker-workflow",
          "recursive-decomposer-workflow",
        ]),
      );

      const coordinatorGraph = await studio
        .graph("coordinator-workflow")
        .getGraphAsync({ xray: true });
      const coordinatorNodeIds = Object.keys(coordinatorGraph.nodes);
      expect(coordinatorNodeIds).toContain("chunk-worker-workflow:chunk-worker-agent");

      const recursiveGraph = await studio
        .graph("recursive-decomposer-workflow")
        .getGraphAsync({ xray: true });
      const recursiveNodeIds = Object.keys(recursiveGraph.nodes);
      expect(recursiveNodeIds).toContain("this-workflow");
      expect(
        recursiveNodeIds.filter((id) => id.startsWith("this-workflow:")),
      ).toEqual([]);
      expect(recursiveGraph.nodes["this-workflow"]?.metadata).toEqual({
        recursive: "maxDepth 2",
      });
    } finally {
      await studio.close();
    }
  });
});
