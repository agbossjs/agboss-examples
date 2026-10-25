import {
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  SqliteCheckpointSaver,
  SqliteChildExecutionQueueRepository,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
  type BudgetHandler,
} from "agboss";
import {
  ModelCost,
  ModelProvider,
  RetryPolicy,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { hours, minutes, seconds, usd, type Usd } from "agboss/units";
import {
  CoordinatorWorkflow,
  CoordinatorWorkflowFinish,
  CoordinatorWorkflowStart,
} from "../coordinator/coordinator.workflow.js";
import { ClusterLedgerService } from "../storage/cluster-ledger.service.js";
import {
  StorageBackendProbeService,
  StorageClusterHealthCheck,
} from "../storage/storage-cluster.health-check.js";
import {
  ChunkFailedWorkflowFinish,
  ChunkWorkerWorkflow,
  ChunkWorkerWorkflowFinish,
  ChunkWorkerWorkflowStart,
  ClusterQueueChunkSignOffChannel,
} from "../worker/chunk-worker.workflow.js";
import {
  RecursiveDecomposerFailedWorkflowFinish,
  RecursiveDecomposerWorkflow,
  RecursiveDecomposerWorkflowFinish,
  RecursiveDecomposerWorkflowStart,
} from "../worker/recursive-decomposer.workflow.js";
import { AppEnvironment } from "./environments/app.environment.js";

@ModelProvider({
  name: "cluster-offline-model-provider",
  description: "Deterministic offline model provider for cluster worker and shard agents",
  serves: [/^offline\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class ClusterOfflineModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ??
      "answer-chunk-draft-dto";
    const userMessage =
      request.messages.find((m) => m.role === "user")?.text ?? "";

    if (answerTool.includes("decomposed")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_leaf_1",
            name: "answer-decomposed-leaf-dto",
            arguments: {
              report: "Leaf shard completed offline",
            },
          },
        ],
        usage: { inputTokens: 20, outputTokens: 10 },
        cost: usd(0.0001),
      });
    }

    const chunkMatch = /"chunkId"\s*:\s*"([^"]+)"/u.exec(userMessage);
    const chunkId = chunkMatch?.[1] ?? "chunk-1";

    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: `call_${chunkId}`,
          name: answerTool,
          arguments: {
            chunkId,
            summary: `Processed ${chunkId}`,
          },
        },
      ],
      usage: { inputTokens: 20, outputTokens: 10 },
      cost: usd(0.0001),
    });
  }
}

@Budget({
  name: "cluster-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class ClusterAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "cluster-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class ClusterTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "cluster-execution-budget",
  scope: BudgetScope.Execution,
})
export class ClusterExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(2);
  }
}

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
