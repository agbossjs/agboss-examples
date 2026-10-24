import { HealthComponentKind, HealthStatus } from "agboss";
import { replyWith, testWith, waitFor } from "agboss/testing";
import { seconds } from "agboss/units";
import { describe, expect } from "vitest";
import { summarizeHealthReport } from "../scenarios/backpressure-and-readiness.js";
import { ClusterWorkStealingApplication } from "../src/application.js";
import { StorageBackendProbeService } from "../storage/storage-cluster.health-check.js";
import {
  ChunkDraftDto,
  ChunkWorkerAgent,
  ChunkWorkerWorkflowStart,
} from "../worker/chunk-worker.workflow.js";

const test = testWith(ClusterWorkStealingApplication);

describe("Cluster Work Stealing — maxConcurrentSteps Backpressure & @HealthCheck Probes (EX-18 / EX-19)", () => {
  test(
    "reports step-slots Degraded when maxConcurrentSteps: 2 is saturated and returns to Healthy when slots free up",
    async ({ app, clock, mockLlm }) => {
      const initialLiveness = await app.checkLiveness();
      const initialReadiness = await app.checkReadiness();
      const summary = summarizeHealthReport(initialLiveness, initialReadiness);

      expect(summary.livenessStatus).toBe(HealthStatus.Healthy);
      expect(summary.readinessStatus).toBe(HealthStatus.Healthy);
      expect(summary.hasStepSlotsComponent).toBe(true);
      expect(summary.hasProjectHealthCheckComponent).toBe(true);

      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "slot-1" } })
        .thenReturn(
          waitFor(seconds(5)),
          replyWith(ChunkDraftDto, {
            chunkId: "slot-1",
            summary: "Slot 1 done",
          }),
        );
      mockLlm(ChunkWorkerAgent)
        .when({ task: { chunkId: "slot-2" } })
        .thenReturn(
          waitFor(seconds(5)),
          replyWith(ChunkDraftDto, {
            chunkId: "slot-2",
            summary: "Slot 2 done",
          }),
        );

      const run1 = app.execute(ChunkWorkerWorkflowStart, {
        chunkId: "slot-1",
        payload: "Occupy slot 1",
      });
      const run2 = app.execute(ChunkWorkerWorkflowStart, {
        chunkId: "slot-2",
        payload: "Occupy slot 2",
      });

      await clock.advance(seconds(1));

      const saturatedReadiness = await app.checkReadiness();
      const stepSlotsComponent = saturatedReadiness.components.find(
        (c) => c.kind === HealthComponentKind.StepSlots,
      );
      expect(stepSlotsComponent?.status).toBe(HealthStatus.Degraded);
      expect(saturatedReadiness.status).toBe(HealthStatus.Degraded);

      await clock.advance(seconds(5));
      await Promise.all([run1, run2]);

      const recoveredReadiness = await app.checkReadiness();
      expect(recoveredReadiness.status).toBe(HealthStatus.Healthy);
    },
  );

  test(
    "propagates StorageClusterHealthCheck degraded and unhealthy statuses into checkReadiness()",
    async ({ app, mockOf }) => {
      mockOf(StorageBackendProbeService).ping.mockResolvedValueOnce("degraded");
      const degradedReport = await app.checkReadiness();
      expect(degradedReport.status).toBe(HealthStatus.Degraded);

      mockOf(StorageBackendProbeService).ping.mockResolvedValueOnce("unhealthy");
      const unhealthyReport = await app.checkReadiness();
      expect(unhealthyReport.status).toBe(HealthStatus.Unhealthy);
    },
  );
});
