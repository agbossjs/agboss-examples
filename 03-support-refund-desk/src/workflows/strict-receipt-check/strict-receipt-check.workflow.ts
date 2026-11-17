import { Workflow, start } from "@agboss/core";
import { StrictReceiptReaderAgent } from "../../agents/strict-receipt-reader/strict-receipt-reader.agent.js";
import { ReceiptRefundRequestDto } from "../../dto/receipt-refund-request.dto.js";
import { StrictReceiptCheckWorkflowFinish } from "./strict-receipt-check.workflow-finish.js";
import { StrictReceiptCheckWorkflowStart } from "./strict-receipt-check.workflow-start.js";

@Workflow({
  name: "strict-receipt-check-workflow",
  version: "1.0.0",
  flow: [
    start(StrictReceiptCheckWorkflowStart)
      .returns(ReceiptRefundRequestDto)
      .toAgent(StrictReceiptReaderAgent)
      .toFinish(StrictReceiptCheckWorkflowFinish),
  ],
})
export class StrictReceiptCheckWorkflow {}
