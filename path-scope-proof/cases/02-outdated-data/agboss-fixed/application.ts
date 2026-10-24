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
  action,
  route,
  start,
} from "agboss";
import { Integer, Text } from "agboss/dto";
import { usd, type Usd } from "agboss/units";

export class OrderDraftDto {
  @Text({ prompt: "Order identifier" })
  orderId!: string;

  @Integer({ prompt: "Subtotal in cents" })
  subtotalCents!: number;

  @Text({ prompt: "Current destination country code" })
  destinationCountry!: string;

  @Text({ prompt: "Requested country change (empty if none)" })
  requestedCountryChange!: string;
}

export class ShippingQuoteDto {
  @Integer({ prompt: "Shipping cost in cents" })
  shippingCents!: number;

  @Text({ prompt: "Country code the quote was calculated for" })
  quotedForCountry!: string;
}

export class TaxSummaryDto {
  @Integer({ prompt: "Tax in cents" })
  taxCents!: number;
}

export class FinalReceiptDto {
  @Integer({ prompt: "Grand total in cents" })
  grandTotalCents!: number;

  @Text({ prompt: "Summary description" })
  summary!: string;
}

@Action({
  name: "calculate-initial-shipping-fixed-action",
  description: "Calculates shipping quote from the initial OrderDraftDto",
  input: { draft: OrderDraftDto },
  output: ShippingQuoteDto,
})
export class CalculateInitialShippingAction
  implements ActionHandler<CalculateInitialShippingAction>
{
  async execute(
    input: InputOf<CalculateInitialShippingAction>,
  ): Promise<OutputOf<CalculateInitialShippingAction>> {
    const country = input.draft.value.destinationCountry;
    return Object.assign(new ShippingQuoteDto(), {
      shippingCents: country === "US" ? 1_500 : 4_500,
      quotedForCountry: country,
    });
  }
}

@Action({
  name: "mutate-destination-fixed-action",
  description: "Produces a new OrderDraftDto with updated destinationCountry",
  input: { draft: OrderDraftDto },
  output: OrderDraftDto,
})
export class MutateDestinationAction implements ActionHandler<MutateDestinationAction> {
  async execute(input: InputOf<MutateDestinationAction>): Promise<OutputOf<MutateDestinationAction>> {
    return Object.assign(new OrderDraftDto(), {
      orderId: input.draft.value.orderId,
      subtotalCents: input.draft.value.subtotalCents,
      destinationCountry: input.draft.value.requestedCountryChange,
      requestedCountryChange: "",
    });
  }
}

@Action({
  name: "recompute-shipping-fixed-action",
  description: "Recomputes fresh ShippingQuoteDto from the updated OrderDraftDto",
  input: { draft: OrderDraftDto },
  output: ShippingQuoteDto,
})
export class RecomputeShippingAction implements ActionHandler<RecomputeShippingAction> {
  async execute(input: InputOf<RecomputeShippingAction>): Promise<OutputOf<RecomputeShippingAction>> {
    const country = input.draft.value.destinationCountry;
    return Object.assign(new ShippingQuoteDto(), {
      shippingCents: country === "US" ? 1_500 : 4_500,
      quotedForCountry: country,
    });
  }
}

@Action({
  name: "compute-tax-fixed-action",
  description: "Computes destination tax from current OrderDraftDto",
  input: { draft: OrderDraftDto },
  output: TaxSummaryDto,
})
export class ComputeTaxAction implements ActionHandler<ComputeTaxAction> {
  async execute(input: InputOf<ComputeTaxAction>): Promise<OutputOf<ComputeTaxAction>> {
    const rate = input.draft.value.destinationCountry === "DE" ? 0.19 : 0.08;
    return Object.assign(new TaxSummaryDto(), {
      taxCents: Math.round(input.draft.value.subtotalCents * rate),
    });
  }
}

@Action({
  name: "build-receipt-fixed-action",
  description: "Builds final receipt reading fresh OrderDraftDto, ShippingQuoteDto, and TaxSummaryDto",
  input: {
    draft: OrderDraftDto,
    shipping: ShippingQuoteDto,
    tax: TaxSummaryDto,
  },
  output: FinalReceiptDto,
})
export class BuildReceiptAction implements ActionHandler<BuildReceiptAction> {
  async execute(input: InputOf<BuildReceiptAction>): Promise<OutputOf<BuildReceiptAction>> {
    const grandTotalCents =
      input.draft.value.subtotalCents +
      input.shipping.value.shippingCents +
      input.tax.value.taxCents;
    return Object.assign(new FinalReceiptDto(), {
      grandTotalCents,
      summary: `Order ${input.draft.value.orderId} [dest=${input.draft.value.destinationCountry}, shipFor=${input.shipping.value.quotedForCountry}]: $${(
        grandTotalCents / 100
      ).toFixed(2)}`,
    });
  }
}

@Router({
  name: "address-change-fixed-router",
  description: "Routes orders with a requested destination change to MutateDestinationAction",
  decidedBy: DecidedBy.Code,
  input: { draft: OrderDraftDto },
  routes: [{ target: MutateDestinationAction }, { target: ComputeTaxAction }],
})
export class AddressChangeRouter implements RouterHandler<AddressChangeRouter> {
  route(input: InputOf<AddressChangeRouter>): Route<AddressChangeRouter> {
    return input.draft.value.requestedCountryChange !== ""
      ? MutateDestinationAction
      : ComputeTaxAction;
  }
}

@WorkflowStart({
  name: "outdated-data-fixed-workflow-start",
  description: "Starts fixed outdated-data workflow",
  input: OrderDraftDto,
})
export class OutdatedDataFixedStart {}

@WorkflowFinish({
  name: "outdated-data-fixed-workflow-finish",
  description: "Finishes fixed outdated-data workflow",
  output: FinalReceiptDto,
})
export class OutdatedDataFixedFinish {}

@Workflow({
  name: "outdated-data-fixed-workflow",
  version: "0.1.0",
  flow: [
    start(OutdatedDataFixedStart)
      .returns(OrderDraftDto)
      .toAction(CalculateInitialShippingAction)
      .returns(ShippingQuoteDto)
      .toRouter(AddressChangeRouter)
      .chooseOne(
        route(MutateDestinationAction)
          .returns(OrderDraftDto)
          .toAction(RecomputeShippingAction)
          .returns(ShippingQuoteDto)
          .toAction(ComputeTaxAction),
        route(ComputeTaxAction),
      ),
    action(ComputeTaxAction)
      .returns(TaxSummaryDto)
      .toAction(BuildReceiptAction)
      .returns(FinalReceiptDto)
      .toFinish(OutdatedDataFixedFinish),
  ],
})
export class OutdatedDataFixedWorkflow {}

@Budget({
  name: "case02-fixed-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class Case02FixedAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "case02-fixed-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class Case02FixedTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "case02-fixed-exec-budget",
  scope: BudgetScope.Execution,
})
export class Case02FixedExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "case-02-outdated-data-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [OutdatedDataFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [Case02FixedAppBudget, Case02FixedTenantBudget, Case02FixedExecBudget],
})
export class OutdatedDataFixedApplication {}
