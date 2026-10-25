import { Application, EmptyEnvironment } from "agboss";
import { SuiteAppBudget } from "../../../src/budgets/suite-app.budget.js";
import { SuiteExecBudget } from "../../../src/budgets/suite-exec.budget.js";
import { SuiteTenantBudget } from "../../../src/budgets/suite-tenant.budget.js";
import { OfflineNoopModelProvider } from "../../../src/model-providers/offline-noop.model-provider.js";
import { OutdatedDataFixedWorkflow } from "../../../src/workflows/outdated-data-fixed/outdated-data-fixed.workflow.js";

export { BuildReceiptAction } from "../../../src/actions/build-receipt.action.js";
export { CalculateInitialShippingAction } from "../../../src/actions/calculate-initial-shipping.action.js";
export { ComputeTaxAction } from "../../../src/actions/compute-tax.action.js";
export { MutateDestinationAction } from "../../../src/actions/mutate-destination.action.js";
export { RecomputeShippingAction } from "../../../src/actions/recompute-shipping.action.js";
export { FinalReceiptDto } from "../../../src/dto/final-receipt.dto.js";
export { OrderDraftDto } from "../../../src/dto/order-draft.dto.js";
export { ShippingQuoteDto } from "../../../src/dto/shipping-quote.dto.js";
export { TaxSummaryDto } from "../../../src/dto/tax-summary.dto.js";
export { AddressChangeRouter } from "../../../src/routers/address-change/address-change.router.js";
export { OutdatedDataFixedFinish } from "../../../src/workflows/outdated-data-fixed/outdated-data-fixed.workflow-finish.js";
export { OutdatedDataFixedStart } from "../../../src/workflows/outdated-data-fixed/outdated-data-fixed.workflow-start.js";
export { OutdatedDataFixedWorkflow } from "../../../src/workflows/outdated-data-fixed/outdated-data-fixed.workflow.js";

@Application({
  name: "case-02-outdated-data-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [OutdatedDataFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [SuiteAppBudget, SuiteTenantBudget, SuiteExecBudget],
})
export class OutdatedDataFixedApplication {}
