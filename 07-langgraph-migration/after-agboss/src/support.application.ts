import { Application, EmptyEnvironment } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { MigrationDatabaseStorage } from "./storages/migration.database-storage.js";
import { SupportApplicationBudget } from "./budgets/support-application.budget.js";
import { SupportExecutionBudget } from "./budgets/support-execution.budget.js";
import { SupportTenantBudget } from "./budgets/support-tenant.budget.js";
import { SupervisorQueueRefundSignOffChannel } from "./channels/supervisor-queue-refund-sign-off.channel.js";
import { OfflineMigrationModelProvider } from "./model-providers/offline-migration.model-provider.js";
import { SupervisorQueueService } from "./services/supervisor-queue.service.js";
import { SupportWorkflow } from "./workflows/support/support.workflow.js";

@Application({
  name: "support-application",
  version: "1.0.0",
  environment: EmptyEnvironment,
  storage: MigrationDatabaseStorage,
  modelProvider: OfflineMigrationModelProvider,
  workflows: [SupportWorkflow],
  budgets: [SupportApplicationBudget, SupportTenantBudget, SupportExecutionBudget],
  providers: [OfflineMigrationModelProvider, SupervisorQueueService],
  channels: [SupervisorQueueRefundSignOffChannel],
  retention: { executionRecords: hours(24 * 30), pauseRecords: hours(24) },
  defaults: {
    models: { temperature: 0 },
  },
  executionLimits: { shutdownTimeout: seconds(15) },
})
export class SupportApplication {}
