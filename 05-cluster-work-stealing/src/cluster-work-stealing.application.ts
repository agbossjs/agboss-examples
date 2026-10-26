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
} from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { ClusterAppDailyBudget } from "./budgets/cluster-app-daily.budget.js";
import { ClusterExecutionBudget } from "./budgets/cluster-execution.budget.js";
import { ClusterTenantDailyBudget } from "./budgets/cluster-tenant-daily.budget.js";
import { ClusterQueueChunkSignOffChannel } from "./channels/cluster-queue-chunk-sign-off.channel.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { StorageClusterHealthCheck } from "./health-checks/storage-cluster.health-check.js";
import { ClusterOfflineModelProvider } from "./model-providers/cluster-offline.model-provider.js";
import { ClusterLedgerService } from "./services/cluster-ledger.service.js";
import { StorageBackendProbeService } from "./services/storage-backend-probe.service.js";
import { ChunkFailedWorkflowFinish } from "./workflows/chunk-worker/chunk-failed.workflow-finish.js";
import { ChunkWorkerWorkflowFinish } from "./workflows/chunk-worker/chunk-worker.workflow-finish.js";
import { ChunkWorkerWorkflowStart } from "./workflows/chunk-worker/chunk-worker.workflow-start.js";
import { ChunkWorkerWorkflow } from "./workflows/chunk-worker/chunk-worker.workflow.js";
import { CoordinatorWorkflowFinish } from "./workflows/coordinator/coordinator.workflow-finish.js";
import { CoordinatorWorkflowStart } from "./workflows/coordinator/coordinator.workflow-start.js";
import { CoordinatorWorkflow } from "./workflows/coordinator/coordinator.workflow.js";
import { RecursiveDecomposerFailedWorkflowFinish } from "./workflows/recursive-decomposer/recursive-decomposer-failed.workflow-finish.js";
import { RecursiveDecomposerWorkflowFinish } from "./workflows/recursive-decomposer/recursive-decomposer.workflow-finish.js";
import { RecursiveDecomposerWorkflowStart } from "./workflows/recursive-decomposer/recursive-decomposer.workflow-start.js";
import { RecursiveDecomposerWorkflow } from "./workflows/recursive-decomposer/recursive-decomposer.workflow.js";

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
    ClusterOfflineModelProvider,
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
