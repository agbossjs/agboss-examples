import {
  StepFailedError,
  ThisWorkflow,
  Workflow,
  caseOf,
  listOf,
  oneOf,
  start,
  toAction,
} from "agboss";
import { MarkShardFailedAction } from "../actions/mark-shard-failed.action.js";
import { MergeShardsAction } from "../actions/merge-shards.action.js";
import { SplitShardAction } from "../actions/split-shard.action.js";
import { ShardAnalyzerAgent } from "../agents/shard-analyzer/shard-analyzer.agent.js";
import { DecomposeFailedDto } from "../dto/decompose-failed.dto.js";
import { DecomposeNodeDto } from "../dto/decompose-node.dto.js";
import { DecomposeSplitDecisionDto } from "../dto/decompose-split-decision.dto.js";
import { DecomposedLeafDto } from "../dto/decomposed-leaf.dto.js";
import { RecursiveDecomposerFailedWorkflowFinish } from "../workflow-finishes/recursive-decomposer-failed.workflow-finish.js";
import { RecursiveDecomposerWorkflowFinish } from "../workflow-finishes/recursive-decomposer.workflow-finish.js";
import { RecursiveDecomposerWorkflowStart } from "../workflow-starts/recursive-decomposer.workflow-start.js";

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
