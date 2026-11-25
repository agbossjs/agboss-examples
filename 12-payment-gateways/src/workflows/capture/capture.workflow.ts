import { Workflow, onStart, Ttl } from "@agboss/core";
import { CaptureShipmentAction } from "../../actions/capture-shipment.action.js";
import { CaptureWorkflowFinish } from "./capture.workflow-finish.js";
import { CaptureWorkflowStart } from "./capture.workflow-start.js";

/** Fulfilment captures one shipment. */
@Workflow({
  name: "capture-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(CaptureWorkflowStart)
      .toAction(CaptureShipmentAction)
      .toFinish(CaptureWorkflowFinish),
  ],
})
export class CaptureWorkflow {}
