import { WorkflowStart } from "@agboss/core";
import { CaptureRequestDto } from "../../dto/capture-request.dto.js";

@WorkflowStart({ name: "capture-workflow-start", description: "PS18: fulfilment captures one shipment", input: CaptureRequestDto })
export class CaptureWorkflowStart {}
