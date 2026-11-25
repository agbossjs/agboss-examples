import { Workflow, onStart, Ttl } from "@agboss/core";
import { ChargeOrderAction } from "../../actions/charge-order.action.js";
import { ReserveStockAction } from "../../actions/reserve-stock.action.js";
import { ShipOrderAction } from "../../actions/ship-order.action.js";
import { CheckoutWorkflowFinish } from "./checkout.workflow-finish.js";
import { CheckoutWorkflowStart } from "./checkout.workflow-start.js";

/**
 * Reserve → charge → ship. When the carrier refuses (`CarrierRefusedError`, uncaught), the
 * execution fails and its automatic undo runs newest first: the refund (`refund-order-action`),
 * then the release — each marked done once and never run again (PS10).
 */
@Workflow({
  name: "checkout-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(CheckoutWorkflowStart)
      .toAction(ReserveStockAction)
      .toAction(ChargeOrderAction)
      .toAction(ShipOrderAction)
      .toFinish(CheckoutWorkflowFinish),
  ],
})
export class CheckoutWorkflow {}
