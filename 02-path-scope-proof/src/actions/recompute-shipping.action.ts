import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { OrderDraftDto } from "../dto/order-draft.dto.js";
import { ShippingQuoteDto } from "../dto/shipping-quote.dto.js";

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
