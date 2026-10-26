import {
  Application,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
} from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { SupportApplicationBudget } from "./budgets/support-application.budget.js";
import { SupportExecutionBudget } from "./budgets/support-execution.budget.js";
import { SupportTenantBudget } from "./budgets/support-tenant.budget.js";
import { SupervisorQueueRefundSignOffChannel } from "./channels/supervisor-queue-refund-sign-off.channel.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { OfflineMigrationModelProvider } from "./model-providers/offline-migration.model-provider.js";
import { SupervisorQueueService } from "./services/supervisor-queue.service.js";
import { SupportWorkflow } from "./workflows/support/support.workflow.js";

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
