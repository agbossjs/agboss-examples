import {
  Application,
  SqliteCheckpointSaver,
  SqliteConnection,
  SqliteCostLedgerRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqliteFencedEffectRepository,
  SqliteOutboundCallRepository,
  SqlitePausedExecutionRepository,
} from "@agboss/core";
import { GatewaysApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { GatewaysExecutionBudget } from "./budgets/execution.budget.js";
import { GatewaysTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { AppEnvironment } from "./environments/app.environment.js";
import { StripeGatewayPayments } from "./gateways/stripe/stripe.gateway-payments.js";
import { BooksRepository } from "./repositories/books.repository.js";
import { GatewayStubService } from "./services/gateway-stub.service.js";
import { PaymentBooksService } from "./services/payment-books.service.js";
import { CaptureWorkflow } from "./workflows/capture/capture.workflow.js";
import { CheckoutWorkflow } from "./workflows/checkout/checkout.workflow.js";
import { GatewayEventWorkflow } from "./workflows/gateway-event/gateway-event.workflow.js";
import { RefundWorkflow } from "./workflows/refund/refund.workflow.js";

/**
 * A shop on one gateway: the checkout (charge → ship, the undo refunds), refunds, partial captures
 * and gateway events, every store on one SQLite file. It lists Stripe's wiring; the tests and the
 * demo run each supported gateway's (`override(GatewayPayments, <Slug>GatewayPayments)`).
 */
@Application({
  name: "payment-gateways-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [CheckoutWorkflow, RefundWorkflow, CaptureWorkflow, GatewayEventWorkflow],
  budgets: [GatewaysApplicationDailyBudget, GatewaysTenantDailyBudget, GatewaysExecutionBudget],
  providers: [
    StripeGatewayPayments,
    GatewayStubService,
    PaymentBooksService,
    BooksRepository,
    SqliteCheckpointSaver,
    SqliteExecutionRecordRepository,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteFencedEffectRepository,
    SqliteOutboundCallRepository,
    SqliteConnection,
  ],
})
export class PaymentGatewaysApplication {}
