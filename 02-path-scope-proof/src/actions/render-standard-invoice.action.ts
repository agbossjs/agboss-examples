import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { InvoiceSummaryDto } from "../dto/invoice-summary.dto.js";

@Action({
  name: "render-standard-invoice-action",
  description: "Renders standard invoice requiring only CheckoutRequestDto",
  input: {
    request: CheckoutRequestDto,
  },
  output: InvoiceSummaryDto,
})
export class RenderStandardInvoiceAction
  implements ActionHandler<RenderStandardInvoiceAction>
{
  async execute(
    input: InputOf<RenderStandardInvoiceAction>,
  ): Promise<OutputOf<RenderStandardInvoiceAction>> {
    const finalTotalCents = input.request.value.subtotalCents;
    return Object.assign(new InvoiceSummaryDto(), {
      orderId: input.request.value.orderId,
      finalTotalCents,
      invoiceText: `Order ${input.request.value.orderId} (NO-COUPON): $${(
        finalTotalCents / 100
      ).toFixed(2)}`,
    });
  }
}
