import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CartRequestDto } from "../dto/cart-request.dto.js";
import { PricingQuoteDto } from "../dto/pricing-quote.dto.js";

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
