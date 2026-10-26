import { DecidedBy, Router, type InputOf, type Route, type RouterHandler } from "@agboss/core";
import { ApplyVipCouponAction } from "../../actions/apply-vip-coupon.action.js";
import { RenderStandardInvoiceAction } from "../../actions/render-standard-invoice.action.js";
import { CheckoutRequestDto } from "../../dto/checkout-request.dto.js";

@Router({
  name: "tier-fixed-router",
  description: "Routes VIP customers to coupon branch and standard customers to standard invoice branch",
  decidedBy: DecidedBy.Code,
  input: { request: CheckoutRequestDto },
  routes: [{ target: ApplyVipCouponAction }, { target: RenderStandardInvoiceAction }],
})
export class TierRouter implements RouterHandler<TierRouter> {
  route(input: InputOf<TierRouter>): Route<TierRouter> {
    return input.request.value.tier === "vip"
      ? ApplyVipCouponAction
      : RenderStandardInvoiceAction;
  }
}
