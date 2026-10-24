import {
  Action,
  Agent,
  Channel,
  ChannelOf,
  ChannelOutcome,
  ChannelRole,
  ExecutionContext,
  PauseAnswerer,
  StepFailedError,
  Tool,
  Workflow,
  WorkflowFinish,
  WorkflowSettings,
  WorkflowStart,
  action,
  start,
  toAction,
  type ActionHandler,
  type ChannelAsk,
  type IncompatibleResume,
  type InputOf,
  type OutputOf,
  type ResumeDecision,
  type ToolHandler,
  type WorkflowDefinition,
} from "agboss";
import { Text } from "agboss/dto";
import { seconds } from "agboss/units";
import { ClusterLedgerService } from "../storage/cluster-ledger.service.js";

export class ChunkTaskDto {
  @Text({ prompt: "Unique chunk identifier (e.g. chunk-01)" })
  chunkId!: string;

  @Text({ prompt: "Work payload for the chunk" })
  payload!: string;
}

export class ChunkDraftDto {
  @Text({ prompt: "Unique chunk identifier" })
  chunkId!: string;

  @Text({ prompt: "Processed summary produced by the worker agent" })
  summary!: string;
}

export class ChunkResultDto {
  @Text({ prompt: "Unique chunk identifier" })
  chunkId!: string;

  @Text({ prompt: "Processed summary produced by the worker" })
  summary!: string;

  @Text({ prompt: "Step idempotency key recorded in the shared ledger" })
  idempotencyKey!: string;
}

export class ChunkFailedDto {
  @Text({ prompt: "Chunk identifier that failed" })
  chunkId!: string;

  @Text({ prompt: "Failure reason" })
  reason!: string;
}

@ChannelRole({
  name: "chunk-sign-off-channel",
  description: "Operator approval required before committing a high-risk chunk",
  approves: ChunkTaskDto,
  answeredBy: PauseAnswerer.ThreadOwner,
})
export abstract class ChunkSignOffChannel extends ChannelOf<ChunkSignOffChannel> {}

@Channel({
  name: "cluster-queue-chunk-sign-off-channel",
  description: "Queues chunk approval in the shared cluster pause table",
})
export class ClusterQueueChunkSignOffChannel extends ChunkSignOffChannel {
  send(
    ask: ChannelAsk<ChunkSignOffChannel>,
  ): Promise<ChannelOutcome<ChunkSignOffChannel>> {
    void ask.pauseId;
    return Promise.resolve(ChannelOutcome.awaitReply());
  }
}

@Tool({
  name: "request-chunk-sign-off-tool",
  description: "Requests operator sign-off for a high-risk chunk before completion",
  input: ChunkTaskDto,
  output: ChunkDraftDto,
  timeout: seconds(15),
  channel: ChunkSignOffChannel,
})
export class RequestChunkSignOffTool
  implements ToolHandler<ChunkTaskDto, ChunkDraftDto>
{
  run({ chunkId, payload }: ChunkTaskDto): Promise<ChunkDraftDto> {
    return Promise.resolve({
      chunkId,
      summary: `Approved high-risk chunk ${chunkId}: ${payload}`,
    });
  }
}

@Agent({
  name: "chunk-worker-agent",
  description: "Processes one work chunk on a cluster worker instance",
  prompt:
    "Process the chunk payload and return ChunkDraftDto. If the payload requires sign-off, call request-chunk-sign-off-tool first.",
  model: "offline/cluster-worker",
  input: { task: ChunkTaskDto },
  output: ChunkDraftDto,
  tools: [RequestChunkSignOffTool],
  maxToolCalls: 2,
})
export class ChunkWorkerAgent {}

@Action({
  name: "commit-chunk-effect-action",
  description:
    "Records the chunk completion in ClusterLedgerService keyed by executionContext.step.idempotencyKey",
  input: { draft: ChunkDraftDto },
  output: ChunkResultDto,
  deps: [ClusterLedgerService, ExecutionContext],
})
export class CommitChunkEffectAction
  implements ActionHandler<CommitChunkEffectAction>
{
  constructor(
    private readonly clusterLedgerService: ClusterLedgerService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(
    input: InputOf<CommitChunkEffectAction>,
  ): Promise<OutputOf<CommitChunkEffectAction>> {
    const { chunkId, summary } = input.draft.value;
    const idempotencyKey = this.executionContext.step.idempotencyKey;
    const record = await this.clusterLedgerService.recordChunkCommit(
      chunkId,
      idempotencyKey,
      summary,
    );
    return {
      chunkId: record.chunkId,
      summary: record.summary,
      idempotencyKey: record.idempotencyKey,
    };
  }
}

@Action({
  name: "mark-chunk-failed-action",
  description: "Produces a soft failure record for a failed chunk",
  input: { task: ChunkTaskDto },
  output: ChunkFailedDto,
})
export class MarkChunkFailedAction
  implements ActionHandler<MarkChunkFailedAction>
{
  execute(
    input: InputOf<MarkChunkFailedAction>,
  ): Promise<OutputOf<MarkChunkFailedAction>> {
    return Promise.resolve({
      chunkId: input.task.value.chunkId,
      reason: `Chunk ${input.task.value.chunkId} failed softly on worker`,
    });
  }
}

@WorkflowStart({
  name: "chunk-worker-workflow-start",
  description: "Executes a single chunk on any available cluster instance",
  input: ChunkTaskDto,
})
export class ChunkWorkerWorkflowStart {}

@WorkflowFinish({
  name: "chunk-worker-workflow-finish",
  description: "Completed chunk result",
  output: ChunkResultDto,
})
export class ChunkWorkerWorkflowFinish {}

@WorkflowFinish({
  name: "chunk-failed-workflow-finish",
  description: "Soft-failed chunk result",
  output: ChunkFailedDto,
})
export class ChunkFailedWorkflowFinish {}

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
