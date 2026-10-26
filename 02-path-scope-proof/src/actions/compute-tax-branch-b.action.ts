import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { PricingQuoteDto } from "../dto/pricing-quote.dto.js";
import { TaxCalculationDto } from "../dto/tax-calculation.dto.js";

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
