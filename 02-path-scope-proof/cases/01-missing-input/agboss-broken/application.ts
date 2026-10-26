import {
  Action,
  type ActionHandler,
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  type BudgetHandler,
  DecidedBy,
  EmptyEnvironment,
  type InputOf,
  type OutputOf,
  type Route,
  Router,
  type RouterHandler,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  action,
  route,
  start,
} from "@agboss/core";
import { Integer, Text } from "@agboss/core/dto";
import { usd, type Usd } from "@agboss/core/units";

export class CheckoutRequestDto {
  @Text({ prompt: "Order identifier" })
  orderId!: string;

  @Text({ prompt: "Customer tier (vip or standard)" })
  tier!: string;

  @Integer({ prompt: "Subtotal in cents" })
  subtotalCents!: number;
}

export class CouponDiscountDto {
  @Text({ prompt: "Coupon code" })
  code!: string;

  @Integer({ prompt: "Discount amount in cents" })
  discountCents!: number;
}

export class InvoiceSummaryDto {
  @Text({ prompt: "Order identifier" })
  orderId!: string;

  @Integer({ prompt: "Final payable total in cents" })
  finalTotalCents!: number;

  @Text({ prompt: "Formatted invoice line" })
  invoiceText!: string;
}

@Action({
  name: "apply-vip-coupon-action",
  description: "Computes 20% VIP promotional coupon discount",
  input: { request: CheckoutRequestDto },
  output: CouponDiscountDto,
})
export class ApplyVipCouponAction implements ActionHandler<ApplyVipCouponAction> {
  async execute(input: InputOf<ApplyVipCouponAction>): Promise<OutputOf<ApplyVipCouponAction>> {
    return Object.assign(new CouponDiscountDto(), {
      code: "VIP20",
      discountCents: Math.round(input.request.value.subtotalCents * 0.2),
    });
  }
}

@Action({
  name: "render-invoice-action",
  description: "Renders final invoice assuming CouponDiscountDto was produced on every path",
  input: {
    request: CheckoutRequestDto,
    coupon: CouponDiscountDto,
  },
  output: InvoiceSummaryDto,
})
export class RenderInvoiceAction implements ActionHandler<RenderInvoiceAction> {
  async execute(input: InputOf<RenderInvoiceAction>): Promise<OutputOf<RenderInvoiceAction>> {
    const finalTotalCents =
      input.request.value.subtotalCents - input.coupon.value.discountCents;
    return Object.assign(new InvoiceSummaryDto(), {
      orderId: input.request.value.orderId,
      finalTotalCents,
      invoiceText: `Order ${input.request.value.orderId} (${input.coupon.value.code}): $${(
        finalTotalCents / 100
      ).toFixed(2)}`,
    });
  }
}

@Router({
  name: "tier-broken-router",
  description: "Routes VIP customers to coupon calculation and standard customers straight to invoice",
  decidedBy: DecidedBy.Code,
  input: { request: CheckoutRequestDto },
  routes: [{ target: ApplyVipCouponAction }, { target: RenderInvoiceAction }],
})
export class TierBrokenRouter implements RouterHandler<TierBrokenRouter> {
  route(input: InputOf<TierBrokenRouter>): Route<TierBrokenRouter> {
    return input.request.value.tier === "vip"
      ? ApplyVipCouponAction
      : RenderInvoiceAction;
  }
}

@WorkflowStart({
  name: "missing-input-broken-workflow-start",
  description: "Starts broken missing-input workflow",
  input: CheckoutRequestDto,
})
export class MissingInputBrokenStart {}

@WorkflowFinish({
  name: "missing-input-broken-workflow-finish",
  description: "Finishes broken missing-input workflow",
  output: InvoiceSummaryDto,
})
export class MissingInputBrokenFinish {}

@Workflow({
  name: "missing-input-broken-workflow",
  version: "0.1.0",
  flow: [
    start(MissingInputBrokenStart)
      .returns(CheckoutRequestDto)
      .toRouter(TierBrokenRouter)
      .chooseOne(
        route(ApplyVipCouponAction)
          .returns(CouponDiscountDto)
          .toAction(RenderInvoiceAction),
        route(RenderInvoiceAction),
      ),
    action(RenderInvoiceAction)
      .returns(InvoiceSummaryDto)
      .toFinish(MissingInputBrokenFinish),
  ],
})
export class MissingInputBrokenWorkflow {}

@Budget({
  name: "case01-broken-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class Case01BrokenAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "case01-broken-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class Case01BrokenTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "case01-broken-exec-budget",
  scope: BudgetScope.Execution,
})
export class Case01BrokenExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "case-01-missing-input-broken-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [MissingInputBrokenWorkflow],
  budgets: [Case01BrokenAppBudget, Case01BrokenTenantBudget, Case01BrokenExecBudget],
})
export class MissingInputBrokenApplication {}
