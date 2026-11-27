import { Application } from "@agboss/core";
import { GatewaysApplicationDailyBudget } from "./budgets/application-daily.budget.js";
import { GatewaysExecutionBudget } from "./budgets/execution.budget.js";
import { GatewaysTenantDailyBudget } from "./budgets/tenant-daily.budget.js";
import { StripeGatewayPayments } from "./gateways/stripe/stripe.gateway-payments.js";
import { GatewaysDatabaseStorage } from "./storages/gateways.database-storage.js";
import { CaptureWorkflow } from "./workflows/capture/capture.workflow.js";
import { CheckoutWorkflow } from "./workflows/checkout/checkout.workflow.js";
import { GatewayEventWorkflow } from "./workflows/gateway-event/gateway-event.workflow.js";
import { RefundWorkflow } from "./workflows/refund/refund.workflow.js";

/**
 * A shop on one gateway: the checkout (charge → ship, the undo refunds), refunds, partial captures
 * and gateway events, every store on one SQLite file (`GatewaysDatabaseStorage`, with the idempotency
 * secret of the business-key fingerprints). It lists Stripe's wiring; the tests and the demo run each
 * supported gateway's (`testWith(…, { services: [<Slug>GatewayPayments] })`).
 */
@Application({
  name: "payment-gateways-application",
  version: "1.0.0",
  storage: GatewaysDatabaseStorage,
  workflows: [CheckoutWorkflow, RefundWorkflow, CaptureWorkflow, GatewayEventWorkflow],
  budgets: [GatewaysApplicationDailyBudget, GatewaysTenantDailyBudget, GatewaysExecutionBudget],
  providers: [StripeGatewayPayments],
})
export class PaymentGatewaysApplication {}
