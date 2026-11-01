import { Workflow, start } from "@agboss/core";
import { CancelOrderAction } from "../../actions/cancel-order.action.js";
import { DispositionRequestDto } from "../../dto/disposition-request.dto.js";
import { MovementDto } from "../../dto/movement.dto.js";
import { CancelWorkflowFinish } from "./cancel.workflow-finish.js";
import { CancelWorkflowStart } from "./cancel.workflow-start.js";

/** PS20: the customer cancels the order. */
@Workflow({
  name: "cancel-workflow",
  version: "1.0.0",
  flow: [
    start(CancelWorkflowStart)
      .returns(DispositionRequestDto)
      .toAction(CancelOrderAction)
      .returns(MovementDto)
      .toFinish(CancelWorkflowFinish),
  ],
})
export class CancelWorkflow {}
