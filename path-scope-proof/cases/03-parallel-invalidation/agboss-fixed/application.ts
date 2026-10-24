import { OfflineNoopModelProvider } from "../../../src/noop-provider.js";
import {
  Action,
  type ActionHandler,
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  type BudgetHandler,
  EmptyEnvironment,
  type InputOf,
  type OutputOf,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  start,
} from "agboss";
import { Integer, Text } from "agboss/dto";
import { usd, type Usd } from "agboss/units";

export class CartRequestDto {
  @Text({ prompt: "Cart ID" })
  cartId!: string;

  @Integer({ prompt: "Base subtotal in cents" })
  baseCents!: number;
}

export class PricingQuoteDto {
  @Integer({ prompt: "Quoted total in cents" })
  totalCents!: number;

  @Text({ prompt: "Source of quote" })
  source!: string;
}

export class LoyaltyAdjustmentDto {
  @Integer({ prompt: "Discount amount in cents" })
  discountCents!: number;
}

export class TaxCalculationDto {
  @Integer({ prompt: "Tax amount on base quote in cents" })
  taxCents!: number;
}

export class FinalInvoiceDto {
  @Integer({ prompt: "Grand total in cents" })
  grandTotalCents!: number;

  @Text({ prompt: "Pricing source used" })
  pricingSource!: string;
}

@Action({
  name: "initial-quote-fixed-action",
  description: "Produces the initial pricing quote before parallel branches",
  input: { cart: CartRequestDto },
  output: PricingQuoteDto,
})
export class InitialQuoteAction implements ActionHandler<InitialQuoteAction> {
  async execute(input: InputOf<InitialQuoteAction>): Promise<OutputOf<InitialQuoteAction>> {
    return Object.assign(new PricingQuoteDto(), {
      totalCents: input.cart.value.baseCents,
      source: "initial-quote",
    });
  }
}

@Action({
  name: "compute-loyalty-adjustment-action",
  description: "Parallel Branch A: computes isolated LoyaltyAdjustmentDto without overwriting PricingQuoteDto",
  input: { quote: PricingQuoteDto },
  output: LoyaltyAdjustmentDto,
})
export class ComputeLoyaltyAdjustmentAction
  implements ActionHandler<ComputeLoyaltyAdjustmentAction>
{
  async execute(
    input: InputOf<ComputeLoyaltyAdjustmentAction>,
  ): Promise<OutputOf<ComputeLoyaltyAdjustmentAction>> {
    return Object.assign(new LoyaltyAdjustmentDto(), {
      discountCents: Math.round(input.quote.value.totalCents * 0.2),
    });
  }
}

@Action({
  name: "compute-tax-branch-b-fixed-action",
  description: "Parallel Branch B: computes tax from the same immutable PricingQuoteDto",
  input: { quote: PricingQuoteDto },
  output: TaxCalculationDto,
})
export class ComputeTaxBranchBAction implements ActionHandler<ComputeTaxBranchBAction> {
  async execute(input: InputOf<ComputeTaxBranchBAction>): Promise<OutputOf<ComputeTaxBranchBAction>> {
    return Object.assign(new TaxCalculationDto(), {
      taxCents: Math.round(input.quote.value.totalCents * 0.1),
    });
  }
}

@Action({
  name: "reconcile-invoice-fixed-action",
  description: "Deterministically reconciles PricingQuoteDto, LoyaltyAdjustmentDto, and TaxCalculationDto after join",
  input: {
    quote: PricingQuoteDto,
    loyalty: LoyaltyAdjustmentDto,
    tax: TaxCalculationDto,
  },
  output: FinalInvoiceDto,
})
export class ReconcileInvoiceAction implements ActionHandler<ReconcileInvoiceAction> {
  async execute(input: InputOf<ReconcileInvoiceAction>): Promise<OutputOf<ReconcileInvoiceAction>> {
    const netSubtotal =
      input.quote.value.totalCents - input.loyalty.value.discountCents;
    const adjustedTax = Math.round(netSubtotal * 0.1);
    return Object.assign(new FinalInvoiceDto(), {
      grandTotalCents: netSubtotal + adjustedTax + input.tax.value.taxCents * 0,
      pricingSource: `${input.quote.value.source}+reconciled-after-join`,
    });
  }
}

@WorkflowStart({
  name: "parallel-invalidation-fixed-workflow-start",
  description: "Starts fixed parallel invalidation workflow",
  input: CartRequestDto,
})
export class ParallelInvalidationFixedStart {}

@WorkflowFinish({
  name: "parallel-invalidation-fixed-workflow-finish",
  description: "Finishes fixed parallel invalidation workflow",
  output: FinalInvoiceDto,
})
export class ParallelInvalidationFixedFinish {}

@Workflow({
  name: "parallel-invalidation-fixed-workflow",
  version: "0.1.0",
  flow: [
    start(ParallelInvalidationFixedStart)
      .returns(CartRequestDto)
      .toAction(InitialQuoteAction)
      .returns(PricingQuoteDto)
      .toParallelActions(ComputeLoyaltyAdjustmentAction, ComputeTaxBranchBAction)
      .join()
      .returns(LoyaltyAdjustmentDto)
      .returns(TaxCalculationDto)
      .toAction(ReconcileInvoiceAction)
      .returns(FinalInvoiceDto)
      .toFinish(ParallelInvalidationFixedFinish),
  ],
})
export class ParallelInvalidationFixedWorkflow {}

@Budget({
  name: "case03-fixed-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class Case03FixedAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "case03-fixed-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class Case03FixedTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "case03-fixed-exec-budget",
  scope: BudgetScope.Execution,
})
export class Case03FixedExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "case-03-parallel-invalidation-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [ParallelInvalidationFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [Case03FixedAppBudget, Case03FixedTenantBudget, Case03FixedExecBudget],
})
export class ParallelInvalidationFixedApplication {}
