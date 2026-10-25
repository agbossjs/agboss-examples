import {
  Action,
  Agent,
  StepFailedError,
  ThisWorkflow,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  caseOf,
  listOf,
  oneOf,
  start,
  toAction,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "agboss";
import { Integer, Text } from "agboss/dto";

export class DecomposeNodeDto {
  @Text({ prompt: "Task node label (e.g. root-shard or root-shard/left)" })
  nodeLabel!: string;

  @Integer({ prompt: "Tree level starting at 1", min: 1 })
  level!: number;
}

export class DecomposedLeafDto {
  @Text({ prompt: "Completed leaf or merged report" })
  report!: string;
}

export class DecomposeSplitDecisionDto {
  @Text({ prompt: "Why this node must split into two sub-shards" })
  reason!: string;
}

export class DecomposeFailedDto {
  @Text({ prompt: "Node label that failed" })
  nodeLabel!: string;
}

@WorkflowStart({
  name: "recursive-decomposer-workflow-start",
  description: "Recursively decomposes a cluster shard task up to maxDepth",
  input: DecomposeNodeDto,
})
export class RecursiveDecomposerWorkflowStart {}

@WorkflowFinish({
  name: "recursive-decomposer-workflow-finish",
  description: "Completed recursive decomposition report",
  output: DecomposedLeafDto,
})
export class RecursiveDecomposerWorkflowFinish {}

@WorkflowFinish({
  name: "recursive-decomposer-failed-workflow-finish",
  description: "Soft-failed recursive node",
  output: DecomposeFailedDto,
})
export class RecursiveDecomposerFailedWorkflowFinish {}

@Agent({
  name: "shard-analyzer-agent",
  description:
    "Completes a shard directly as DecomposedLeafDto or requests a recursive split via DecomposeSplitDecisionDto",
  prompt:
    "If node.level is 1, return DecomposeSplitDecisionDto to split the root shard into two child shards. If node.level is 2 or higher, return DecomposedLeafDto with a concise report.",
  model: "openai/gpt-4o-mini",
  input: { node: DecomposeNodeDto },
  output: oneOf(DecomposedLeafDto, DecomposeSplitDecisionDto),
})
export class ShardAnalyzerAgent {}

@Action({
  name: "split-shard-action",
  description: "Splits a broad shard into left and right child shards",
  input: { node: DecomposeNodeDto },
  output: listOf(DecomposeNodeDto),
})
export class SplitShardAction implements ActionHandler<SplitShardAction> {
  execute(input: InputOf<SplitShardAction>): Promise<OutputOf<SplitShardAction>> {
    const { nodeLabel, level } = input.node.value;
    return Promise.resolve([
      { nodeLabel: `${nodeLabel}/L`, level: level + 1 },
      { nodeLabel: `${nodeLabel}/R`, level: level + 1 },
    ]);
  }
}

@Action({
  name: "merge-shards-action",
  description: "Merges child shard reports into a single parent report",
  input: {
    node: DecomposeNodeDto,
    children: listOf(oneOf(DecomposedLeafDto, DecomposeFailedDto)),
  },
  output: DecomposedLeafDto,
})
export class MergeShardsAction implements ActionHandler<MergeShardsAction> {
  execute(input: InputOf<MergeShardsAction>): Promise<OutputOf<MergeShardsAction>> {
    const parts = input.children.map((child) =>
      "report" in child.value
        ? child.value.report
        : `FAILED(${child.value.nodeLabel})`,
    );
    return Promise.resolve({
      report: `${input.node.value.nodeLabel}: [${parts.join(", ")}]`,
    });
  }
}

@Action({
  name: "mark-shard-failed-action",
  description: "Marks a shard node as soft-failed",
  input: { node: DecomposeNodeDto },
  output: DecomposeFailedDto,
})
export class MarkShardFailedAction
  implements ActionHandler<MarkShardFailedAction>
{
  execute(
    input: InputOf<MarkShardFailedAction>,
  ): Promise<OutputOf<MarkShardFailedAction>> {
    return Promise.resolve({
      nodeLabel: input.node.value.nodeLabel,
    });
  }
}

@Workflow({
  name: "recursive-decomposer-workflow",
  version: "1.0.0",
  flow: [
    start(RecursiveDecomposerWorkflowStart)
      .returns(DecomposeNodeDto)
      .toAgent(ShardAnalyzerAgent)
      .onError(
        StepFailedError,
        toAction(MarkShardFailedAction)
          .returns(DecomposeFailedDto)
          .toFinish(RecursiveDecomposerFailedWorkflowFinish),
      )
      .returns(oneOf(DecomposedLeafDto, DecomposeSplitDecisionDto))
      .switch(
        caseOf(DecomposedLeafDto)
          .toFinish(RecursiveDecomposerWorkflowFinish),
        caseOf(DecomposeSplitDecisionDto)
          .toAction(SplitShardAction)
          .returns(listOf(DecomposeNodeDto))
          .toParallelWorkflows(ThisWorkflow, {
            maxConcurrency: 2,
            maxItems: 2,
          })
          .join()
          .returns(listOf(oneOf(DecomposedLeafDto, DecomposeFailedDto)))
          .toAction(MergeShardsAction)
          .returns(DecomposedLeafDto)
          .toFinish(RecursiveDecomposerWorkflowFinish),
      ),
  ],
  maxSteps: 4,
  maxDepth: 2,
  maxConcurrentExecutions: 4,
})
export class RecursiveDecomposerWorkflow {}
