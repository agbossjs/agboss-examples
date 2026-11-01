import { Workflow, start } from "@agboss/core";
import { ChargeOrderAction } from "../../actions/charge-order.action.js";
import { ShipOrderAction } from "../../actions/ship-order.action.js";
import { CheckoutRequestDto } from "../../dto/checkout-request.dto.js";
import { PaymentDto } from "../../dto/payment.dto.js";
import { ShipmentDto } from "../../dto/shipment.dto.js";
import { CheckoutWorkflowFinish } from "./checkout.workflow-finish.js";
import { CheckoutWorkflowStart } from "./checkout.workflow-start.js";

/** Charge → ship; a refused shipment fails the execution and its automatic undo refunds the charge. */
@Workflow({
  name: "checkout-workflow",
  version: "1.0.0",
  flow: [
    start(CheckoutWorkflowStart)
      .returns(CheckoutRequestDto)
      .toAction(ChargeOrderAction)
      .returns(PaymentDto)
      .toAction(ShipOrderAction)
      .returns(ShipmentDto)
      .toFinish(CheckoutWorkflowFinish),
  ],
})
export class CheckoutWorkflow {}
