import { ExecutionStatus, IncompatibleResumeError } from "agboss";
import { callTool, replyWith, testWith } from "agboss/testing";
import { afterEach, describe, expect } from "vitest";
import {
  setAllowIncompatibleResume,
  simulateVersionDriftOnPausedThread,
} from "../scenarios/cross-instance-cancel-and-resume.js";
import { ClusterWorkStealingApplication } from "../src/application.js";
import {
  ChunkDraftDto,
  ChunkWorkerAgent,
  ChunkWorkerWorkflowFinish,
  ChunkWorkerWorkflowStart,
  RequestChunkSignOffTool,
} from "../worker/chunk-worker.workflow.js";

const clusterTest = testWith(ClusterWorkStealingApplication, { instances: 2 });

afterEach(() => {
  setAllowIncompatibleResume(false);
});

describe("Cluster Work Stealing — Cross-Instance Resume, Cancel & Version Guard (EX-18 / EX-19)", () => {
  clusterTest(
    "pauses on instance 1 and resumes or cancels from instance 2 across shared SQLite stores",
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
    },
  );

  clusterTest(
    "rejects resuming a paused execution with IncompatibleResumeError when workflow version/configHash drifted",
    async ({ app, mockLlm }) => {
      mockLlm(ChunkWorkerAgent).thenReturn(
        callTool(RequestChunkSignOffTool, {
          chunkId: "chunk-version-drift",
          payload: "Paused under older deployment",
        }),
        replyWith(ChunkDraftDto, {
          chunkId: "chunk-version-drift",
          summary: "Resumed after explicit policy override",
        }),
      );

      const paused = await app.execute(
        ChunkWorkerWorkflowStart,
        {
          chunkId: "chunk-version-drift",
          payload: "Paused under older deployment",
        },
        { ownerId: "operator-alice" },
      );

      expect(paused.status).toBe(ExecutionStatus.Paused);
      if (paused.status !== ExecutionStatus.Paused) {
        throw new Error("Expected paused execution");
      }
      const pauseId = paused.pending[0]?.pauseId ?? "";

      await simulateVersionDriftOnPausedThread(app, paused.threadId, "0.9.0");

      await expect(
        app.resume(
          { pauseId, decision: { approved: true } },
          { ownerId: "operator-alice" },
        ),
      ).rejects.toThrow(IncompatibleResumeError);

      setAllowIncompatibleResume(true);
      const resumed = await app.resume(
        { pauseId, decision: { approved: true } },
        { ownerId: "operator-alice" },
      );
      expect(resumed.status).toBe(ExecutionStatus.Finished);
    },
  );
});
