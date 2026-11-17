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
import { OpenRouterModelProvider } from "@agboss/core/models";
import { hours, seconds } from "@agboss/core/units";
import { OnCallRefundApproverChannel } from "./channels/on-call-refund-approver.channel.js";
import { OnCallSeniorApproverChannel } from "./channels/on-call-senior-approver.channel.js";
import { SupportAppDailyBudget } from "./budgets/support-app-daily.budget.js";
import { SupportExecutionBudget } from "./budgets/support-execution.budget.js";
import { SupportTenantDailyBudget } from "./budgets/support-tenant-daily.budget.js";
import { RECEIPT_LIVE } from "./config/receipt-live.js";
import { SupportExecutionContext } from "./contexts/support-execution.context.js";
import { SupportTenantContext } from "./contexts/support-tenant.context.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { AuditTrailToolInterceptor } from "./interceptors/audit.interceptor.js";
import { SupportOfflineModelProvider } from "./model-providers/support-offline.model-provider.js";
import { CustomerContactPiiPolicy } from "./pii-policies/customer-contact.pii-policy.js";
import { RefundDeskPauseListener } from "./listeners/refund-desk.pause-listener.js";
import { ApprovalInboxService } from "./services/approval-inbox.service.js";
import { OnCallLogService } from "./services/on-call-log.service.js";
import { LiveSupportRefundWorkflow } from "./workflows/live-support-refund/live-support-refund.workflow.js";
import { ReceiptCheckWorkflow } from "./workflows/receipt-check/receipt-check.workflow.js";
import { RefundApprovalWorkflow } from "./workflows/refund-approval/refund-approval.workflow.js";
import { StrictReceiptCheckWorkflow } from "./workflows/strict-receipt-check/strict-receipt-check.workflow.js";
import { SupportRefundWorkflow } from "./workflows/support-refund/support-refund.workflow.js";

@Application({
  name: "support-refund-desk-application",
  version: "1.0.0",
  environment: AppEnvironment,
  tenantContext: SupportTenantContext,
  executionContext: SupportExecutionContext,
  piiKeyField: "piiPseudonymKey",
  workflows: [
    SupportRefundWorkflow,
    LiveSupportRefundWorkflow,
    RefundApprovalWorkflow,
    ReceiptCheckWorkflow,
    StrictReceiptCheckWorkflow,
  ],
  budgets: [SupportAppDailyBudget, SupportTenantDailyBudget, SupportExecutionBudget],
  piiPolicies: [CustomerContactPiiPolicy],
  toolInterceptors: [AuditTrailToolInterceptor],
  providers: [
    SupportOfflineModelProvider,
    ...(RECEIPT_LIVE ? [OpenRouterModelProvider] : []),
    OnCallRefundApproverChannel,
    OnCallSeniorApproverChannel,
    RefundDeskPauseListener,
    ApprovalInboxService,
    OnCallLogService,
    SqliteCheckpointSaver,
    SqliteExecutionRecordRepository,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteRateLimitRepository,
    SqliteExecutionHistoryRepository,
  ],
  retention: { executionRecords: hours(24 * 30), pauseRecords: hours(24) },
  shutdownTimeout: seconds(15),
  defaults: {
    models: { temperature: 0 },
    // the receipt photo's redaction: flash-lite (the default) sometimes answers in pixels, not the fractions asked for; the call is then refused, fail closed
    files: { redactionModel: "google/gemini-2.5-flash" },
  },
})
export class SupportRefundDeskApplication {}
