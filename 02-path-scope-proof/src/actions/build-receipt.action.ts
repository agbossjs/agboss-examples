import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
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
      input.draft.subtotalCents +
      input.shipping.shippingCents +
      input.tax.taxCents;
    return Object.assign(new FinalReceiptDto(), {
      grandTotalCents,
      summary: `Order ${input.draft.orderId} [dest=${input.draft.destinationCountry}, shipFor=${input.shipping.quotedForCountry}]: $${(
        grandTotalCents / 100
      ).toFixed(2)}`,
    });
  }
}
