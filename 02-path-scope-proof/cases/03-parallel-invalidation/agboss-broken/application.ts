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
} from "@agboss/core";
import { Integer, Text } from "@agboss/core/dto";
import { usd, type Usd } from "@agboss/core/units";

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

export class TaxCalculationDto {
  @Integer({ prompt: "Tax in cents" })
  taxCents!: number;
}

export class FinalInvoiceDto {
  @Integer({ prompt: "Grand total in cents" })
  grandTotalCents!: number;

  @Text({ prompt: "Pricing source used" })
  pricingSource!: string;
}

@Action({
  name: "initial-quote-broken-action",
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
  name: "overwrite-quote-branch-a-action",
  description: "Parallel Branch A: overwrites PricingQuoteDto while sibling Branch B is reading it",
  input: { quote: PricingQuoteDto },
  output: PricingQuoteDto,
})
export class OverwriteQuoteInBranchAAction
  implements ActionHandler<OverwriteQuoteInBranchAAction>
{
  async execute(
    input: InputOf<OverwriteQuoteInBranchAAction>,
  ): Promise<OutputOf<OverwriteQuoteInBranchAAction>> {
    return Object.assign(new PricingQuoteDto(), {
      totalCents: Math.round(input.quote.value.totalCents * 0.8),
      source: "branch-a-recomputed",
    });
  }
}

@Action({
  name: "compute-tax-branch-b-action",
  description: "Parallel Branch B: computes tax from PricingQuoteDto concurrently",
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
  name: "merge-invoice-broken-action",
  description: "Merges parallel branches into final invoice",
  input: {
    quote: PricingQuoteDto,
    tax: TaxCalculationDto,
  },
  output: FinalInvoiceDto,
})
export class MergeInvoiceAction implements ActionHandler<MergeInvoiceAction> {
  async execute(input: InputOf<MergeInvoiceAction>): Promise<OutputOf<MergeInvoiceAction>> {
    return Object.assign(new FinalInvoiceDto(), {
      grandTotalCents: input.quote.value.totalCents + input.tax.value.taxCents,
      pricingSource: input.quote.value.source,
    });
  }
}

@WorkflowStart({
  name: "parallel-invalidation-broken-workflow-start",
  description: "Starts broken parallel invalidation workflow",
  input: CartRequestDto,
})
export class ParallelInvalidationBrokenStart {}

@WorkflowFinish({
  name: "parallel-invalidation-broken-workflow-finish",
  description: "Finishes broken parallel invalidation workflow",
  output: FinalInvoiceDto,
})
export class ParallelInvalidationBrokenFinish {}

@Workflow({
  name: "parallel-invalidation-broken-workflow",
  version: "0.1.0",
  flow: [
    start(ParallelInvalidationBrokenStart)
      .returns(CartRequestDto)
      .toAction(InitialQuoteAction)
      .returns(PricingQuoteDto)
      .toParallelActions(OverwriteQuoteInBranchAAction, ComputeTaxBranchBAction)
      .join()
      .returns(PricingQuoteDto)
      .returns(TaxCalculationDto)
      .toAction(MergeInvoiceAction)
      .returns(FinalInvoiceDto)
      .toFinish(ParallelInvalidationBrokenFinish),
  ],
})
export class ParallelInvalidationBrokenWorkflow {}

@Budget({
  name: "case03-broken-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class Case03BrokenAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "case03-broken-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class Case03BrokenTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "case03-broken-exec-budget",
  scope: BudgetScope.Execution,
})
export class Case03BrokenExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "case-03-parallel-invalidation-broken-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [ParallelInvalidationBrokenWorkflow],
  budgets: [Case03BrokenAppBudget, Case03BrokenTenantBudget, Case03BrokenExecBudget],
})
export class ParallelInvalidationBrokenApplication {}
