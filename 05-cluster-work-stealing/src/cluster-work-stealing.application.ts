import { Application, EmptyEnvironment } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { ClusterAppDailyBudget } from "./budgets/cluster-app-daily.budget.js";
import { ClusterExecutionBudget } from "./budgets/cluster-execution.budget.js";
import { ClusterTenantDailyBudget } from "./budgets/cluster-tenant-daily.budget.js";
import { ClusterQueueChunkSignOffChannel } from "./channels/cluster-queue-chunk-sign-off.channel.js";
import { StorageClusterHealthCheck } from "./health-checks/storage-cluster.health-check.js";
import { ClusterDatabaseStorage } from "./storages/cluster.database-storage.js";
import { ClusterOfflineModelProvider } from "./model-providers/cluster-offline.model-provider.js";
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
  environment: EmptyEnvironment,
  storage: ClusterDatabaseStorage, // one SQLite file for every instance; the idempotency and PII keys are read through defineEnv
  modelProvider: ClusterOfflineModelProvider,
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
  channels: [ClusterQueueChunkSignOffChannel],
  providers: [
    ClusterOfflineModelProvider,
    StorageBackendProbeService,
  ],
  retention: { executionRecords: hours(24 * 30), pauseRecords: hours(24) },
  executionLimits: { maxConcurrentSteps: 2, shutdownTimeout: seconds(15) },
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
