import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { CouponDiscountDto } from "../dto/coupon-discount.dto.js";
import { InvoiceSummaryDto } from "../dto/invoice-summary.dto.js";

@Action({
  name: "render-vip-invoice-action",
  description: "Renders VIP invoice with guaranteed CouponDiscountDto on path",
  input: {
    request: CheckoutRequestDto,
    coupon: CouponDiscountDto,
  },
  output: InvoiceSummaryDto,
})
export class RenderInvoiceAction implements ActionHandler<RenderInvoiceAction> {
  async execute(input: InputOf<RenderInvoiceAction>): Promise<OutputOf<RenderInvoiceAction>> {
    const finalTotalCents =
      input.request.value.subtotalCents - input.coupon.value.discountCents;
    return Object.assign(new InvoiceSummaryDto(), {
      orderId: input.request.value.orderId,
      finalTotalCents,
      invoiceText: `Order ${input.request.value.orderId} (${input.coupon.value.code}): $${(
        finalTotalCents / 100
      ).toFixed(2)}`,
    });
  }
}
