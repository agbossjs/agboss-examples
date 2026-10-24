import { createApp, ExecutionStatus } from "agboss";
import {
  CoordinatorWorkflowStart,
  type BatchJobSummaryDto,
} from "../coordinator/coordinator.workflow.js";
import { ClusterWorkStealingApplication } from "../src/application.js";
import {
  getClusterLedgerSnapshot,
  resetClusterLedger,
} from "../storage/cluster-ledger.service.js";
import {
  RecursiveDecomposerWorkflowStart,
  type DecomposedLeafDto,
} from "../worker/recursive-decomposer.workflow.js";

export interface WorkStealingScenarioResult {
  readonly batchStatus: ExecutionStatus;
  readonly batchSummary: BatchJobSummaryDto;
  readonly committedChunkEffects: number;
  readonly recursiveStatus: ExecutionStatus;
  readonly recursiveReport: DecomposedLeafDto;
}

export async function runWorkStealingAndRecursionScenario(): Promise<WorkStealingScenarioResult> {
  resetClusterLedger();
  const app = await createApp(ClusterWorkStealingApplication);

  const batchExecution = await app.execute(CoordinatorWorkflowStart, {
    batchId: "batch-demo-100",
    chunkCount: 4,
  });

  const recursiveExecution = await app.execute(
    RecursiveDecomposerWorkflowStart,
    {
      nodeLabel: "root-shard",
      level: 1,
    },
  );

  const ledger = getClusterLedgerSnapshot();
  await app.close();

  return {
    batchStatus: batchExecution.status,
    batchSummary: batchExecution.output as BatchJobSummaryDto,
    committedChunkEffects: ledger.length,
    recursiveStatus: recursiveExecution.status,
    recursiveReport: recursiveExecution.output as DecomposedLeafDto,
  };
}
