import { Workflow, action, route, start } from "agboss";
import { BuildReceiptAction } from "../../actions/build-receipt.action.js";
import { CalculateInitialShippingAction } from "../../actions/calculate-initial-shipping.action.js";
import { ComputeTaxAction } from "../../actions/compute-tax.action.js";
import { MutateDestinationAction } from "../../actions/mutate-destination.action.js";
import { RecomputeShippingAction } from "../../actions/recompute-shipping.action.js";
import { FinalReceiptDto } from "../../dto/final-receipt.dto.js";
import { OrderDraftDto } from "../../dto/order-draft.dto.js";
import { ShippingQuoteDto } from "../../dto/shipping-quote.dto.js";
import { TaxSummaryDto } from "../../dto/tax-summary.dto.js";
import { AddressChangeRouter } from "../../routers/address-change/address-change.router.js";
import { OutdatedDataFixedFinish } from "./outdated-data-fixed.workflow-finish.js";
import { OutdatedDataFixedStart } from "./outdated-data-fixed.workflow-start.js";

@Workflow({
  name: "outdated-data-fixed-workflow",
  version: "0.1.0",
  flow: [
    start(OutdatedDataFixedStart)
      .returns(OrderDraftDto)
      .toAction(CalculateInitialShippingAction)
      .returns(ShippingQuoteDto)
      .toRouter(AddressChangeRouter)
      .chooseOne(
        route(MutateDestinationAction)
          .returns(OrderDraftDto)
          .toAction(RecomputeShippingAction)
          .returns(ShippingQuoteDto)
          .toAction(ComputeTaxAction),
        route(ComputeTaxAction),
      ),
    action(ComputeTaxAction)
      .returns(TaxSummaryDto)
      .toAction(BuildReceiptAction)
      .returns(FinalReceiptDto)
      .toFinish(OutdatedDataFixedFinish),
  ],
})
export class OutdatedDataFixedWorkflow {}
