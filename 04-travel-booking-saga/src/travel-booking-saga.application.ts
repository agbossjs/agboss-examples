import {
  Application,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
} from "agboss";
import { OpenRouterModelProvider } from "agboss/models";
import { SagaApplicationDailyBudget } from "./budgets/saga-application-daily.budget.js";
import { SagaExecutionBudget } from "./budgets/saga-execution.budget.js";
import { SagaTenantDailyBudget } from "./budgets/saga-tenant-daily.budget.js";
import { CorporateBookingApprovalChannel } from "./channels/corporate-booking-approval.channel.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { SagaOfflineModelProvider } from "./model-providers/saga-offline.model-provider.js";
import { BudgetSagaWorkflow } from "./workflows/budget-saga/budget-saga.workflow.js";
import { HitlHoldSagaWorkflow } from "./workflows/hitl-hold-saga/hitl-hold-saga.workflow.js";
import { PaymentSagaWorkflow } from "./workflows/payment-saga/payment-saga.workflow.js";
import { QuorumSagaWorkflow } from "./workflows/quorum-saga/quorum-saga.workflow.js";

@Application({
  name: "travel-booking-saga-application",
  version: "0.1.0",
  environment: AppEnvironment,
  pseudonymKey: "openRouterApiKey",
  workflows: [
    PaymentSagaWorkflow,
    BudgetSagaWorkflow,
    HitlHoldSagaWorkflow,
    QuorumSagaWorkflow,
  ],
  providers: [
    OpenRouterModelProvider,
    SagaOfflineModelProvider,
    CorporateBookingApprovalChannel,
    SqliteCheckpointSaver,
    SqliteCostLedgerRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionHistoryRepository,
    SqliteExecutionTreeRepository,
    SqlitePausedExecutionRepository,
  ],
  budgets: [
    SagaApplicationDailyBudget,
    SagaTenantDailyBudget,
    SagaExecutionBudget,
  ],
})
export class TravelBookingSagaApplication {}
