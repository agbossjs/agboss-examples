import {
  StepFailedError,
  Workflow,
  WorkflowSettings,
  action,
  start,
  toAction,
  type IncompatibleResume,
  type ResumeDecision,
  type WorkflowDefinition,
} from "agboss";
import { CommitChunkEffectAction } from "../../actions/commit-chunk-effect.action.js";
import { MarkChunkFailedAction } from "../../actions/mark-chunk-failed.action.js";
import { ChunkWorkerAgent } from "../../agents/chunk-worker/chunk-worker.agent.js";
import { ChunkDraftDto } from "../../dto/chunk-draft.dto.js";
import { ChunkFailedDto } from "../../dto/chunk-failed.dto.js";
import { ChunkResultDto } from "../../dto/chunk-result.dto.js";
import { ChunkTaskDto } from "../../dto/chunk-task.dto.js";
import { ClusterLedgerService } from "../../services/cluster-ledger.service.js";
import { ChunkFailedWorkflowFinish } from "./chunk-failed.workflow-finish.js";
import { ChunkWorkerWorkflowFinish } from "./chunk-worker.workflow-finish.js";
import { ChunkWorkerWorkflowStart } from "./chunk-worker.workflow-start.js";

let allowIncompatibleResume = false;

export function setAllowIncompatibleResume(allow: boolean): void {
  allowIncompatibleResume = allow;
}

const resumeVersionPolicy = (resume: IncompatibleResume): ResumeDecision => {
  if (allowIncompatibleResume) {
    return "resume";
  }
  return resume.paused.workflowVersion === resume.current.workflowVersion
    ? "resume"
    : "reject";
};

@Workflow({
  name: "chunk-worker-workflow",
  version: "1.0.0",
  flow: [
    start(ChunkWorkerWorkflowStart)
      .returns(ChunkTaskDto)
      .toAgent(ChunkWorkerAgent)
      .onError(StepFailedError, toAction(MarkChunkFailedAction))
      .returns(ChunkDraftDto)
      .toAction(CommitChunkEffectAction)
      .onError(StepFailedError, toAction(MarkChunkFailedAction))
      .returns(ChunkResultDto)
      .toFinish(ChunkWorkerWorkflowFinish),

    action(MarkChunkFailedAction)
      .returns(ChunkFailedDto)
      .toFinish(ChunkFailedWorkflowFinish),
  ],
  maxSteps: 3,
  providers: [ClusterLedgerService],
})
export class ChunkWorkerWorkflow implements WorkflowDefinition {
  settings(): WorkflowSettings {
    return WorkflowSettings.builder()
      .onIncompatibleResume(resumeVersionPolicy)
      .build();
  }
}
