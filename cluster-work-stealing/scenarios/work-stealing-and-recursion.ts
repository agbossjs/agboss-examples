import { createApp, ExecutionStatus } from "agboss";
import { ClusterWorkStealingApplication } from "../src/cluster-work-stealing.application.js";
import type { BatchJobSummaryDto } from "../src/dto/batch-job-summary.dto.js";
import type { DecomposedLeafDto } from "../src/dto/decomposed-leaf.dto.js";
import {
  getClusterLedgerSnapshot,
  resetClusterLedger,
} from "../src/services/cluster-ledger.service.js";
import { CoordinatorWorkflowStart } from "../src/workflow-starts/coordinator.workflow-start.js";
import { RecursiveDecomposerWorkflowStart } from "../src/workflow-starts/recursive-decomposer.workflow-start.js";

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
