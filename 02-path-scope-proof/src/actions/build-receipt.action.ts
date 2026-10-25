import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { FinalReceiptDto } from "../dto/final-receipt.dto.js";
import { OrderDraftDto } from "../dto/order-draft.dto.js";
import { ShippingQuoteDto } from "../dto/shipping-quote.dto.js";
import { TaxSummaryDto } from "../dto/tax-summary.dto.js";

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
