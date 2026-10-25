import {
  Application,
  SqliteCheckpointSaver,
  SqliteChildExecutionQueueRepository,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
} from "agboss";
import { hours, seconds } from "agboss/units";
import { ClusterAppDailyBudget } from "./budgets/cluster-app-daily.budget.js";
import { ClusterExecutionBudget } from "./budgets/cluster-execution.budget.js";
import { ClusterTenantDailyBudget } from "./budgets/cluster-tenant-daily.budget.js";
import { ClusterQueueChunkSignOffChannel } from "./channels/cluster-queue-chunk-sign-off.channel.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { StorageClusterHealthCheck } from "./health-checks/storage-cluster.health-check.js";
import { ClusterLedgerService } from "./services/cluster-ledger.service.js";
import { StorageBackendProbeService } from "./services/storage-backend-probe.service.js";
import { ChunkFailedWorkflowFinish } from "./workflow-finishes/chunk-failed.workflow-finish.js";
import { ChunkWorkerWorkflowFinish } from "./workflow-finishes/chunk-worker.workflow-finish.js";
import { CoordinatorWorkflowFinish } from "./workflow-finishes/coordinator.workflow-finish.js";
import { RecursiveDecomposerFailedWorkflowFinish } from "./workflow-finishes/recursive-decomposer-failed.workflow-finish.js";
import { RecursiveDecomposerWorkflowFinish } from "./workflow-finishes/recursive-decomposer.workflow-finish.js";
import { ChunkWorkerWorkflowStart } from "./workflow-starts/chunk-worker.workflow-start.js";
import { CoordinatorWorkflowStart } from "./workflow-starts/coordinator.workflow-start.js";
import { RecursiveDecomposerWorkflowStart } from "./workflow-starts/recursive-decomposer.workflow-start.js";
import { ChunkWorkerWorkflow } from "./workflows/chunk-worker.workflow.js";
import { CoordinatorWorkflow } from "./workflows/coordinator.workflow.js";
import { RecursiveDecomposerWorkflow } from "./workflows/recursive-decomposer.workflow.js";

@Application({
  name: "cluster-work-stealing-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [
    CoordinatorWorkflow,
    ChunkWorkerWorkflow,
    RecursiveDecomposerWorkflow,
  ],
  budgets: [
    ClusterAppDailyBudget,
    ClusterTenantDailyBudget,
    ClusterExecutionBudget,
  ],
  healthChecks: [StorageClusterHealthCheck],
  maxConcurrentSteps: 2,
  providers: [
    ClusterQueueChunkSignOffChannel,
    ClusterLedgerService,
    StorageBackendProbeService,
    SqliteCheckpointSaver,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteRateLimitRepository,
    SqliteExecutionHistoryRepository,
    SqliteChildExecutionQueueRepository,
  ],
  executionRecordRetention: hours(24 * 30),
  pauseRecordRetention: hours(24),
  shutdownTimeout: seconds(15),
})
export class ClusterWorkStealingApplication {}

export {
  ChunkFailedWorkflowFinish,
  ChunkWorkerWorkflow,
  ChunkWorkerWorkflowFinish,
  ChunkWorkerWorkflowStart,
  CoordinatorWorkflow,
  CoordinatorWorkflowFinish,
  CoordinatorWorkflowStart,
  RecursiveDecomposerFailedWorkflowFinish,
  RecursiveDecomposerWorkflow,
  RecursiveDecomposerWorkflowFinish,
  RecursiveDecomposerWorkflowStart,
};
