import { OfflineNoopModelProvider } from "../../../src/noop-provider.js";
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
  route,
  start,
} from "agboss";
import { Integer, Text } from "agboss/dto";
import { usd, type Usd } from "agboss/units";

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
  name: "apply-vip-coupon-fixed-action",
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
  name: "render-vip-invoice-action",
  description: "Renders VIP invoice with guaranteed CouponDiscountDto on path",
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

@Action({
  name: "render-standard-invoice-action",
  description: "Renders standard invoice requiring only CheckoutRequestDto",
  input: {
    request: CheckoutRequestDto,
  },
  output: InvoiceSummaryDto,
})
export class RenderStandardInvoiceAction
  implements ActionHandler<RenderStandardInvoiceAction>
{
  async execute(
    input: InputOf<RenderStandardInvoiceAction>,
  ): Promise<OutputOf<RenderStandardInvoiceAction>> {
    const finalTotalCents = input.request.value.subtotalCents;
    return Object.assign(new InvoiceSummaryDto(), {
      orderId: input.request.value.orderId,
      finalTotalCents,
      invoiceText: `Order ${input.request.value.orderId} (NO-COUPON): $${(
        finalTotalCents / 100
      ).toFixed(2)}`,
    });
  }
}

@Router({
  name: "tier-fixed-router",
  description: "Routes VIP customers to coupon branch and standard customers to standard invoice branch",
  decidedBy: DecidedBy.Code,
  input: { request: CheckoutRequestDto },
  routes: [{ target: ApplyVipCouponAction }, { target: RenderStandardInvoiceAction }],
})
export class TierRouter implements RouterHandler<TierRouter> {
  route(input: InputOf<TierRouter>): Route<TierRouter> {
    return input.request.value.tier === "vip"
      ? ApplyVipCouponAction
      : RenderStandardInvoiceAction;
  }
}

@WorkflowStart({
  name: "missing-input-fixed-workflow-start",
  description: "Starts fixed missing-input workflow",
  input: CheckoutRequestDto,
})
export class MissingInputFixedStart {}

@WorkflowFinish({
  name: "missing-input-fixed-workflow-finish",
  description: "Finishes fixed missing-input workflow",
  output: InvoiceSummaryDto,
})
export class MissingInputFixedFinish {}

@Workflow({
  name: "missing-input-fixed-workflow",
  version: "0.1.0",
  flow: [
    start(MissingInputFixedStart)
      .returns(CheckoutRequestDto)
      .toRouter(TierRouter)
      .chooseOne(
        route(ApplyVipCouponAction)
          .returns(CouponDiscountDto)
          .toAction(RenderInvoiceAction)
          .returns(InvoiceSummaryDto)
          .toFinish(MissingInputFixedFinish),
        route(RenderStandardInvoiceAction)
          .returns(InvoiceSummaryDto)
          .toFinish(MissingInputFixedFinish),
      ),
  ],
})
export class MissingInputFixedWorkflow {}

@Budget({
  name: "case01-fixed-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class Case01FixedAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "case01-fixed-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class Case01FixedTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "case01-fixed-exec-budget",
  scope: BudgetScope.Execution,
})
export class Case01FixedExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "case-01-missing-input-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [MissingInputFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [Case01FixedAppBudget, Case01FixedTenantBudget, Case01FixedExecBudget],
})
export class MissingInputFixedApplication {}
