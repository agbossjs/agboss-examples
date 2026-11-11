import { WorkflowFinish } from "@agboss/core";
import { CaptureRequestDto } from "../../dto/capture-request.dto.js";

/**
 * A shipment's capture an operator decides (agbossjs/agboss#890): its outcome is unknown and cannot
 * be reconciled — the gateway has no lookup by shipment (`OutboundCallUnreconciledError`) — so
 * nothing was booked and nothing is sent again; the capture as asked, its intent listed by
 * `app.pendingOutboundCallsOf` for a person to check against the charge.
 */
@WorkflowFinish({
  name: "capture-held-workflow-finish",
  description: "A capture an operator decides: the capture as asked",
  output: CaptureRequestDto,
})
export class CaptureHeldWorkflowFinish {}
