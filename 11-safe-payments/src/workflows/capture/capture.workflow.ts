import { Workflow, start } from "@agboss/core";
import { CaptureShipmentAction } from "../../actions/capture-shipment.action.js";
import { CaptureRequestDto } from "../../dto/capture-request.dto.js";
import { MovementDto } from "../../dto/movement.dto.js";
import { CaptureWorkflowFinish } from "./capture.workflow-finish.js";
import { CaptureWorkflowStart } from "./capture.workflow-start.js";

/** PS18: fulfilment captures one shipment. */
@Workflow({
  name: "capture-workflow",
  version: "1.0.0",
  flow: [
    start(CaptureWorkflowStart)
      .returns(CaptureRequestDto)
      .toAction(CaptureShipmentAction)
      .returns(MovementDto)
      .toFinish(CaptureWorkflowFinish),
  ],
})
export class CaptureWorkflow {}
