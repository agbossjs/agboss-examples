import { StepFailedError, Workflow, toAction, onStart, toWorkflow, Ttl, toFinish } from "@agboss/core";
import { MarkShardFailedAction } from "../../actions/mark-shard-failed.action.js";
import { MergeShardsAction } from "../../actions/merge-shards.action.js";
import { SplitShardAction } from "../../actions/split-shard.action.js";
import { ShardAnalyzerAgent } from "../../agents/shard-analyzer/shard-analyzer.agent.js";
import { RecursiveDecomposerFailedWorkflowFinish } from "./recursive-decomposer-failed.workflow-finish.js";
import { RecursiveDecomposerWorkflowFinish } from "./recursive-decomposer.workflow-finish.js";
import { RecursiveDecomposerWorkflowStart } from "./recursive-decomposer.workflow-start.js";

@Workflow({
  name: "recursive-decomposer-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(RecursiveDecomposerWorkflowStart)
      .toAgent(ShardAnalyzerAgent)
      .onError(
        StepFailedError,
        toAction(MarkShardFailedAction)
          .toFinish(RecursiveDecomposerFailedWorkflowFinish),
      )
      .toOneOf([toFinish(RecursiveDecomposerWorkflowFinish), toAction(SplitShardAction)
          .forEachItem(toWorkflow(() => RecursiveDecomposerWorkflow), {
            maxConcurrency: 2,
            takeFirst: 2,
          })
          .join()
          .toAction(MergeShardsAction)
          .toFinish(RecursiveDecomposerWorkflowFinish)]),
  ],
  executionLimits: { maxConcurrency: 4, maxSteps: 4, maxDepth: 2 },
})
export class RecursiveDecomposerWorkflow {}
