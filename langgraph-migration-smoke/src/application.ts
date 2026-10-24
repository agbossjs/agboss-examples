import {
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  SqliteCheckpointSaver,
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
import { AppEnvironment } from "./environments/app.environment.js";
import { SupervisorQueueRefundSignOffChannel } from "./support/channels/refund-sign-off.channel.js";
import { SupervisorQueueService } from "./support/support.services.js";
import { SupportWorkflow } from "./support/support.workflow.js";

@ModelProvider({
  name: "offline-migration-model-provider",
  description: "Deterministic offline provider serving migrated SupportWorkflow models without API keys.",
  serves: [/^moonshotai\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class OfflineMigrationModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const answerTool = request.tools[0]?.name ?? "answer";
    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: "call_offline_1",
          name: answerTool,
          arguments: {},
        },
      ],
      usage: { inputTokens: 20, outputTokens: 10 },
      cost: usd(0.0001),
    });
  }
}

@Budget({
  name: "support-application-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SupportApplicationBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(10);
  }
}

@Budget({
  name: "support-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class SupportTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(2);
  }
}

@Budget({
  name: "support-execution-budget",
  scope: BudgetScope.Execution,
})
export class SupportExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.2);
  }
}

@Application({
  name: "support-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [SupportWorkflow],
  budgets: [SupportApplicationBudget, SupportTenantBudget, SupportExecutionBudget],
  providers: [
    OfflineMigrationModelProvider,
    SupervisorQueueRefundSignOffChannel,
    SupervisorQueueService,
    SqliteCheckpointSaver,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteRateLimitRepository,
    SqliteExecutionHistoryRepository,
  ],
  executionRecordRetention: hours(24 * 30),
  pauseRecordRetention: hours(24),
  shutdownTimeout: seconds(15),
  defaults: {
    models: { temperature: 0 },
  },
})
export class SupportApplication {}
