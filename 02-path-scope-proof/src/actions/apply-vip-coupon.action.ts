import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { CouponDiscountDto } from "../dto/coupon-discount.dto.js";

@Action({
  name: "apply-vip-coupon-fixed-action",
  description: "Computes 20% VIP promotional coupon discount",
  input: { request: CheckoutRequestDto },
  output: CouponDiscountDto,
})
export class ApplyVipCouponAction implements ActionHandler<ApplyVipCouponAction> {
  async execute(input: InputOf<ApplyVipCouponAction>): Promise<OutputOf<ApplyVipCouponAction>> {
    return Object.assign(new CouponDiscountDto(), {
      code: "VIP20",
      discountCents: Math.round(input.request.value.subtotalCents * 0.2),
    });
  }
}
