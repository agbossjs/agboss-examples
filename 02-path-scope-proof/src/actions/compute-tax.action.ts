import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { OrderDraftDto } from "../dto/order-draft.dto.js";
import { TaxSummaryDto } from "../dto/tax-summary.dto.js";

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
