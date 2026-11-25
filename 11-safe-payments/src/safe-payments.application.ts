import { Application } from "@agboss/core";
import { AppEnvironment } from "./environments/app.environment.js";
import { PaymentsApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { PaymentsExecutionBudget } from "./budgets/execution.budget.js";
import { PaymentsTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { RightPaymentOperations } from "./payments/right-payment-operations.js";
import { SafePaymentsDatabaseStorage } from "./storages/safe-payments.database-storage.js";
import { PaymentAuditObserver } from "./observers/payment-audit.observer.js";
import { OnCallLogService } from "./services/on-call-log.service.js";
import { ApprovalInboxChannel } from "./channels/approval-inbox.channel.js";
import { AwaitedOutcomeChannel } from "./channels/awaited-outcome.channel.js";
import { OpenRouterModelProvider } from "./model-providers/openrouter.model-provider.js";
import { ApprovedCheckoutWorkflow } from "./workflows/approved-checkout/approved-checkout.workflow.js";
import { CancelWorkflow } from "./workflows/cancel/cancel.workflow.js";
import { CaptureWorkflow } from "./workflows/capture/capture.workflow.js";
import { CheckoutWorkflow } from "./workflows/checkout/checkout.workflow.js";
import { GatewayEventWorkflow } from "./workflows/gateway-event/gateway-event.workflow.js";
import { PaymentAgentWorkflow } from "./workflows/payment-agent/payment-agent.workflow.js";
import { RefundWorkflow } from "./workflows/refund/refund.workflow.js";
import { SecureCheckoutWorkflow } from "./workflows/secure-checkout/secure-checkout.workflow.js";
import { SettleWorkflow } from "./workflows/settle/settle.workflow.js";
import { SplitOrderWorkflow } from "./workflows/split-order/split-order.workflow.js";

/** The workflows: one per way money moves in the shop. */
export const SAFE_PAYMENTS_WORKFLOWS = [
  CheckoutWorkflow,
  PaymentAgentWorkflow,
  SplitOrderWorkflow,
  ApprovedCheckoutWorkflow,
  SecureCheckoutWorkflow,
  GatewayEventWorkflow,
  CaptureWorkflow,
  SettleWorkflow,
  RefundWorkflow,
  CancelWorkflow,
];

export const SAFE_PAYMENTS_BUDGETS = [PaymentsApplicationDailyBudget, PaymentsTenantDailyBudget, PaymentsExecutionBudget];

/** What the instance is built from: the money's one service, the shop's books (the stores are `SafePaymentsDatabaseStorage`'s). */
export const SAFE_PAYMENTS_PROVIDERS = [
  OpenRouterModelProvider, // never called: every model turn is scripted
  RightPaymentOperations,
  OnCallLogService, // where PaymentAuditObserver writes (agbossjs/agboss#889)
];

/** The two ways a paused payment is answered (PS11, PS21): the customer's inbox, the 3DS outcome. */
export const SAFE_PAYMENTS_CHANNELS = [ApprovalInboxChannel, AwaitedOutcomeChannel];

/**
 * A shop that takes payments through the stub gateway, on SQLite — every store on one file, which
 * every instance (and every process of PS2 / PS5) shares. `RightPaymentOperations` moves the money;
 * a test swaps it for a wrong version (`services: [Wrong…]`) or for yours.
 */
@Application({
  name: "safe-payments-application",
  version: "1.0.0",
  environment: AppEnvironment,
  storage: SafePaymentsDatabaseStorage, // with the idempotency secret: agbossjs/agboss#825, business-key fingerprints
  modelProvider: OpenRouterModelProvider,
  channels: SAFE_PAYMENTS_CHANNELS,
  workflows: SAFE_PAYMENTS_WORKFLOWS,
  budgets: SAFE_PAYMENTS_BUDGETS,
  providers: SAFE_PAYMENTS_PROVIDERS,
  observers: [PaymentAuditObserver], // the four hooks of the execution audit log (agbossjs/agboss#889)
})
export class SafePaymentsApplication {}
