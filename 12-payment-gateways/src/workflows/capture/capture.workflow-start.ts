import { WorkflowStart } from "@agboss/core";
import { CaptureRequestDto } from "../../dto/capture-request.dto.js";

@WorkflowStart({ name: "capture-workflow-start", description: "Fulfilment captures one shipment", input: CaptureRequestDto })
export class CaptureWorkflowStart {}
