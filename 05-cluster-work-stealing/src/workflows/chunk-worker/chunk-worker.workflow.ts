import { ChildPlacement, StepError, Workflow, WorkflowSettings, toAction, type IncompatibleResume, ResumeDecision, type WorkflowDefinition, onStart, onAction, Ttl } from "@agboss/core";
import { CommitChunkEffectAction } from "../../actions/commit-chunk-effect.action.js";
import { MarkChunkFailedAction } from "../../actions/mark-chunk-failed.action.js";
import { ChunkWorkerAgent } from "../../agents/chunk-worker/chunk-worker.agent.js";
import { ChunkFailedWorkflowFinish } from "./chunk-failed.workflow-finish.js";
import { ChunkWorkerWorkflowFinish } from "./chunk-worker.workflow-finish.js";
import { ChunkWorkerWorkflowStart } from "./chunk-worker.workflow-start.js";

let allowIncompatibleResume = false;

export function setAllowIncompatibleResume(allow: boolean): void {
  allowIncompatibleResume = allow;
}

const resumeVersionPolicy = (resume: IncompatibleResume): ResumeDecision => {
  if (allowIncompatibleResume) {
    return ResumeDecision.Resume;
  }
  return resume.paused.workflowVersion === resume.current.workflowVersion
    ? ResumeDecision.Resume
    : ResumeDecision.Reject;
};

@Workflow({
  name: "chunk-worker-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  placement: ChildPlacement.AnyWorker, // a coordinator's chunk runs on any instance with a free step slot
  flow: [
    onStart(ChunkWorkerWorkflowStart)
      .toAgent(ChunkWorkerAgent)
      .onError(StepError, toAction(MarkChunkFailedAction))
      .toAction(CommitChunkEffectAction)
      .onError(StepError, toAction(MarkChunkFailedAction))
      .toFinish(ChunkWorkerWorkflowFinish),

    onAction(MarkChunkFailedAction)
      .toFinish(ChunkFailedWorkflowFinish),
  ],
  executionLimits: { maxSteps: 3 },
})
export class ChunkWorkerWorkflow implements WorkflowDefinition {
  settings(): WorkflowSettings {
    return WorkflowSettings.builder()
      .onIncompatibleResume(resumeVersionPolicy)
      .build();
  }
}
