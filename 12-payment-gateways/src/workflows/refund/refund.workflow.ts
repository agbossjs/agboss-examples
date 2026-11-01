import { Workflow, start } from "@agboss/core";
import { RefundPaymentAction } from "../../actions/refund-payment.action.js";
import { RefundRequestDto } from "../../dto/refund-request.dto.js";
import { MovementDto } from "../../dto/movement.dto.js";
import { RefundWorkflowFinish } from "./refund.workflow-finish.js";
import { RefundWorkflowStart } from "./refund.workflow-start.js";

/** An operator or the customer refunds a payment. */
@Workflow({
  name: "refund-workflow",
  version: "1.0.0",
  flow: [
    start(RefundWorkflowStart)
      .returns(RefundRequestDto)
      .toAction(RefundPaymentAction)
      .returns(MovementDto)
      .toFinish(RefundWorkflowFinish),
  ],
})
export class RefundWorkflow {}
