import { Application, EmptyEnvironment } from "agboss";
import { SuiteAppBudget } from "../../../src/budgets/suite-app.budget.js";
import { SuiteExecBudget } from "../../../src/budgets/suite-exec.budget.js";
import { SuiteTenantBudget } from "../../../src/budgets/suite-tenant.budget.js";
import { OfflineNoopModelProvider } from "../../../src/model-providers/offline-noop.model-provider.js";
import { ParallelInvalidationFixedWorkflow } from "../../../src/workflows/parallel-invalidation-fixed/parallel-invalidation-fixed.workflow.js";

export { ComputeLoyaltyAdjustmentAction } from "../../../src/actions/compute-loyalty-adjustment.action.js";
export { ComputeTaxBranchBAction } from "../../../src/actions/compute-tax-branch-b.action.js";
export { InitialQuoteAction } from "../../../src/actions/initial-quote.action.js";
export { ReconcileInvoiceAction } from "../../../src/actions/reconcile-invoice.action.js";
export { CartRequestDto } from "../../../src/dto/cart-request.dto.js";
export { FinalInvoiceDto } from "../../../src/dto/final-invoice.dto.js";
export { LoyaltyAdjustmentDto } from "../../../src/dto/loyalty-adjustment.dto.js";
export { PricingQuoteDto } from "../../../src/dto/pricing-quote.dto.js";
export { TaxCalculationDto } from "../../../src/dto/tax-calculation.dto.js";
export { ParallelInvalidationFixedFinish } from "../../../src/workflows/parallel-invalidation-fixed/parallel-invalidation-fixed.workflow-finish.js";
export { ParallelInvalidationFixedStart } from "../../../src/workflows/parallel-invalidation-fixed/parallel-invalidation-fixed.workflow-start.js";
export { ParallelInvalidationFixedWorkflow } from "../../../src/workflows/parallel-invalidation-fixed/parallel-invalidation-fixed.workflow.js";

@Application({
  name: "case-03-parallel-invalidation-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [ParallelInvalidationFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [SuiteAppBudget, SuiteTenantBudget, SuiteExecBudget],
})
export class ParallelInvalidationFixedApplication {}
