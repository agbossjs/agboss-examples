import { Application } from "@agboss/core";
import { SagaApplicationDailyBudget } from "./budgets/saga-application-daily.budget.js";
import { SagaExecutionBudget } from "./budgets/saga-execution.budget.js";
import { SagaTenantDailyBudget } from "./budgets/saga-tenant-daily.budget.js";
import {
  BookingApprovalChannelSelector,
  CorporateBookingApprovalChannel,
  DeputyBookingApprovalChannel,
} from "./channels/corporate-booking-approval.channel.js";
import { TravelSagaDatabaseStorage } from "./storages/travel-saga.database-storage.js";
import { SagaOfflineModelProvider } from "./model-providers/saga-offline.model-provider.js";
import { BudgetSagaWorkflow } from "./workflows/budget-saga/budget-saga.workflow.js";
import { HitlHoldSagaWorkflow } from "./workflows/hitl-hold-saga/hitl-hold-saga.workflow.js";
import { PaymentSagaWorkflow } from "./workflows/payment-saga/payment-saga.workflow.js";
import { QuorumSagaWorkflow } from "./workflows/quorum-saga/quorum-saga.workflow.js";

@Application({
  name: "travel-booking-saga-application",
  version: "0.1.1",
  storage: TravelSagaDatabaseStorage, // its own PII key (#825), read through defineEnv
  modelProvider: SagaOfflineModelProvider, // every model of the saga: the offline script
  workflows: [
    PaymentSagaWorkflow,
    BudgetSagaWorkflow,
    HitlHoldSagaWorkflow,
    QuorumSagaWorkflow,
  ],
  providers: [SagaOfflineModelProvider],
  channels: [CorporateBookingApprovalChannel, DeputyBookingApprovalChannel],
  channelSelectors: [BookingApprovalChannelSelector],
  budgets: [
    SagaApplicationDailyBudget,
    SagaTenantDailyBudget,
    SagaExecutionBudget,
  ],
})
export class TravelBookingSagaApplication {}
