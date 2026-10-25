import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { LoyaltyAdjustmentDto } from "../dto/loyalty-adjustment.dto.js";
import { PricingQuoteDto } from "../dto/pricing-quote.dto.js";

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
