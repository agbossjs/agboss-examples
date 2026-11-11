import { OutboundCallUnreconciledError, Workflow, start, toFinish } from "@agboss/core";
import { CaptureShipmentAction } from "../../actions/capture-shipment.action.js";
import { CaptureRequestDto } from "../../dto/capture-request.dto.js";
import { MovementDto } from "../../dto/movement.dto.js";
import { CaptureHeldWorkflowFinish } from "./capture-held.workflow-finish.js";
import { CaptureWorkflowFinish } from "./capture.workflow-finish.js";
import { CaptureWorkflowStart } from "./capture.workflow-start.js";

/**
 * PS18: fulfilment captures one shipment. The operator's path (agbossjs/agboss#890): a capture whose
 * answer was lost cannot be looked up by shipment — `reconcile` says `unknown` — so it is never
 * sent again; instead of failing the execution, the side path ends it at its own finish, for a
 * person to decide from `app.pendingOutboundCallsOf`.
 */
@Workflow({
  name: "capture-workflow",
  version: "1.0.0",
  flow: [
    start(CaptureWorkflowStart)
      .returns(CaptureRequestDto)
      .toAction(CaptureShipmentAction)
      .onError(OutboundCallUnreconciledError, toFinish(CaptureHeldWorkflowFinish))
      .returns(MovementDto)
      .toFinish(CaptureWorkflowFinish),
  ],
})
export class CaptureWorkflow {}
