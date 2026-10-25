import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { FinalInvoiceDto } from "../dto/final-invoice.dto.js";
import { LoyaltyAdjustmentDto } from "../dto/loyalty-adjustment.dto.js";
import { PricingQuoteDto } from "../dto/pricing-quote.dto.js";
import { TaxCalculationDto } from "../dto/tax-calculation.dto.js";

@Action({
  name: "reconcile-invoice-fixed-action",
  description: "Deterministically reconciles PricingQuoteDto, LoyaltyAdjustmentDto, and TaxCalculationDto after join",
  input: {
    quote: PricingQuoteDto,
    loyalty: LoyaltyAdjustmentDto,
    tax: TaxCalculationDto,
  },
  output: FinalInvoiceDto,
})
export class ReconcileInvoiceAction implements ActionHandler<ReconcileInvoiceAction> {
  async execute(input: InputOf<ReconcileInvoiceAction>): Promise<OutputOf<ReconcileInvoiceAction>> {
    const netSubtotal =
      input.quote.value.totalCents - input.loyalty.value.discountCents;
    const adjustedTax = Math.round(netSubtotal * 0.1);
    return Object.assign(new FinalInvoiceDto(), {
      grandTotalCents: netSubtotal + adjustedTax + input.tax.value.taxCents * 0,
      pricingSource: `${input.quote.value.source}+reconciled-after-join`,
    });
  }
}
