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
} from "agboss";
import { OpenRouterModelProvider } from "agboss/models";
import { hours, seconds } from "agboss/units";
import { SupportAppDailyBudget } from "./budgets/support-app-daily.budget.js";
import { SupportExecutionBudget } from "./budgets/support-execution.budget.js";
import { SupportTenantDailyBudget } from "./budgets/support-tenant-daily.budget.js";
import { SupportExecutionContext } from "./dto/support-execution-context.dto.js";
import { SupportTenantContext } from "./dto/support-tenant-context.dto.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { AuditTrailToolInterceptor } from "./interceptors/audit.interceptor.js";
import { SupportOfflineModelProvider } from "./model-providers/support-offline.model-provider.js";
import { CustomerContactPiiPolicy } from "./pii-policies/customer-contact.pii-policy.js";
import { LiveSupportRefundWorkflow } from "./workflows/live-support-refund.workflow.js";
import { SupportRefundWorkflow } from "./workflows/support-refund.workflow.js";

@Application({
  name: "support-refund-desk-application",
  version: "1.0.0",
  environment: AppEnvironment,
  tenantContext: SupportTenantContext,
  executionContext: SupportExecutionContext,
  pseudonymKey: "piiPseudonymKey",
  workflows: [SupportRefundWorkflow, LiveSupportRefundWorkflow],
  budgets: [SupportAppDailyBudget, SupportTenantDailyBudget, SupportExecutionBudget],
  piiPolicies: [CustomerContactPiiPolicy],
  toolInterceptors: [AuditTrailToolInterceptor],
  providers: [
    OpenRouterModelProvider,
    SupportOfflineModelProvider,
    SqliteCheckpointSaver,
    SqliteExecutionRecordRepository,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
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
export class SupportRefundDeskApplication {}
