import {
  ExecutionLeaseLostError,
  ExecutionLeaseRepository,
  ExecutionStatus,
} from "agboss";
import { replyWith, testWith, waitFor } from "agboss/testing";
import { seconds } from "agboss/units";
import { beforeEach, describe, expect } from "vitest";
import {
  createLeaseFencingAssertionSummary,
  resetClusterLedger,
  simulateHolderLeaseWindowExpiredInStore,
  verifyLeaseRepositoryPing,
} from "../scenarios/lease-expiration-and-fencing.js";
import { ClusterWorkStealingApplication } from "../src/application.js";
import {
  ChunkDraftDto,
  ChunkWorkerAgent,
  ChunkWorkerWorkflowFinish,
  ChunkWorkerWorkflowStart,
} from "../worker/chunk-worker.workflow.js";

const clusterTest = testWith(ClusterWorkStealingApplication, { instances: 2 });

beforeEach(() => {
  resetClusterLedger();
});

describe("Cluster Work Stealing — 30s Lease Expiration, Fencing & Idempotent Recovery (EX-18 / EX-19)", () => {
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
});
