import { Workflow, start } from "@agboss/core";
import { ChargeOrderAction } from "../../actions/charge-order.action.js";
import { ReserveStockAction } from "../../actions/reserve-stock.action.js";
import { ShipOrderAction } from "../../actions/ship-order.action.js";
import { CheckoutRequestDto } from "../../dto/checkout-request.dto.js";
import { PaymentDto } from "../../dto/payment.dto.js";
import { ShipmentDto } from "../../dto/shipment.dto.js";
import { StockReservationDto } from "../../dto/stock-reservation.dto.js";
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
  flow: [
    start(CheckoutWorkflowStart)
      .returns(CheckoutRequestDto)
      .toAction(ReserveStockAction)
      .returns(StockReservationDto)
      .toAction(ChargeOrderAction)
      .returns(PaymentDto)
      .toAction(ShipOrderAction)
      .returns(ShipmentDto)
      .toFinish(CheckoutWorkflowFinish),
  ],
})
export class CheckoutWorkflow {}
