import { Application, EmptyEnvironment } from "@agboss/core";
import { SuiteAppBudget } from "../../../src/budgets/suite-app.budget.js";
import { SuiteExecBudget } from "../../../src/budgets/suite-exec.budget.js";
import { SuiteTenantBudget } from "../../../src/budgets/suite-tenant.budget.js";
import { OfflineNoopModelProvider } from "../../../src/model-providers/offline-noop.model-provider.js";
import { MissingInputFixedWorkflow } from "../../../src/workflows/missing-input-fixed/missing-input-fixed.workflow.js";

export { ApplyVipCouponAction } from "../../../src/actions/apply-vip-coupon.action.js";
export { RenderInvoiceAction } from "../../../src/actions/render-invoice.action.js";
export { RenderStandardInvoiceAction } from "../../../src/actions/render-standard-invoice.action.js";
export { CheckoutRequestDto } from "../../../src/dto/checkout-request.dto.js";
export { CouponDiscountDto } from "../../../src/dto/coupon-discount.dto.js";
export { InvoiceSummaryDto } from "../../../src/dto/invoice-summary.dto.js";
export { TierRouter } from "../../../src/routers/tier/tier.router.js";
export { MissingInputFixedFinish } from "../../../src/workflows/missing-input-fixed/missing-input-fixed.workflow-finish.js";
export { MissingInputFixedStart } from "../../../src/workflows/missing-input-fixed/missing-input-fixed.workflow-start.js";
export { MissingInputFixedWorkflow } from "../../../src/workflows/missing-input-fixed/missing-input-fixed.workflow.js";

@Application({
  name: "case-01-missing-input-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [MissingInputFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [SuiteAppBudget, SuiteTenantBudget, SuiteExecBudget],
})
export class MissingInputFixedApplication {}
