import { Workflow, onStart, Ttl } from "@agboss/core";
import { ChargeOrderAction } from "../../actions/charge-order.action.js";
import { ShipOrderAction } from "../../actions/ship-order.action.js";
import { CheckoutWorkflowFinish } from "./checkout.workflow-finish.js";
import { CheckoutWorkflowStart } from "./checkout.workflow-start.js";

/** Charge → ship; a refused shipment fails the execution and its automatic undo refunds the charge. */
@Workflow({
  name: "checkout-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(CheckoutWorkflowStart)
      .toAction(ChargeOrderAction)
      .toAction(ShipOrderAction)
      .toFinish(CheckoutWorkflowFinish),
  ],
})
export class CheckoutWorkflow {}
