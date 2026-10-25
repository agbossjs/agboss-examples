import { Workflow, route, start } from "agboss";
import { ApplyVipCouponAction } from "../actions/apply-vip-coupon.action.js";
import { RenderInvoiceAction } from "../actions/render-invoice.action.js";
import { RenderStandardInvoiceAction } from "../actions/render-standard-invoice.action.js";
import { CheckoutRequestDto } from "../dto/checkout-request.dto.js";
import { CouponDiscountDto } from "../dto/coupon-discount.dto.js";
import { InvoiceSummaryDto } from "../dto/invoice-summary.dto.js";
import { TierRouter } from "../routers/tier/tier.router.js";
import { MissingInputFixedFinish } from "../workflow-finishes/missing-input-fixed.workflow-finish.js";
import { MissingInputFixedStart } from "../workflow-starts/missing-input-fixed.workflow-start.js";

@Workflow({
  name: "missing-input-fixed-workflow",
  version: "0.1.0",
  flow: [
    start(MissingInputFixedStart)
      .returns(CheckoutRequestDto)
      .toRouter(TierRouter)
      .chooseOne(
        route(ApplyVipCouponAction)
          .returns(CouponDiscountDto)
          .toAction(RenderInvoiceAction)
          .returns(InvoiceSummaryDto)
          .toFinish(MissingInputFixedFinish),
        route(RenderStandardInvoiceAction)
          .returns(InvoiceSummaryDto)
          .toFinish(MissingInputFixedFinish),
      ),
  ],
})
export class MissingInputFixedWorkflow {}
