import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { OrderDraftDto } from "../dto/order-draft.dto.js";
import { ShippingQuoteDto } from "../dto/shipping-quote.dto.js";

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
