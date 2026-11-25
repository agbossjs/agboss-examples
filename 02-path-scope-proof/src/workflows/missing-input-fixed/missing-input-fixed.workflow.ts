import { Workflow, onStart, toAction, Ttl } from "@agboss/core";
import { ApplyVipCouponAction } from "../../actions/apply-vip-coupon.action.js";
import { RenderInvoiceAction } from "../../actions/render-invoice.action.js";
import { RenderStandardInvoiceAction } from "../../actions/render-standard-invoice.action.js";
import { CheckoutRequestDto } from "../../dto/checkout-request.dto.js";
import { CouponDiscountDto } from "../../dto/coupon-discount.dto.js";
import { InvoiceSummaryDto } from "../../dto/invoice-summary.dto.js";
import { TierRouter } from "../../routers/tier/tier.router.js";
import { MissingInputFixedFinish } from "./missing-input-fixed.workflow-finish.js";
import { MissingInputFixedStart } from "./missing-input-fixed.workflow-start.js";

@Workflow({
  name: "missing-input-fixed-workflow",
  version: "0.1.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(MissingInputFixedStart)
      .toRouter(TierRouter)
      .onRoute(toAction(ApplyVipCouponAction)
          .toAction(RenderInvoiceAction)
          .toFinish(MissingInputFixedFinish))
      .onRoute(toAction(RenderStandardInvoiceAction)
          .toFinish(MissingInputFixedFinish)),
  ],
})
export class MissingInputFixedWorkflow {}
