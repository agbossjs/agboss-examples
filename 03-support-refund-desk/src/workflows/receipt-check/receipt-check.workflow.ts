import { Workflow, start } from "@agboss/core";
import { ReceiptReaderAgent } from "../../agents/receipt-reader/receipt-reader.agent.js";
import { ReceiptRefundRequestDto } from "../../dto/receipt-refund-request.dto.js";
import { ReceiptCheckWorkflowFinish } from "./receipt-check.workflow-finish.js";
import { ReceiptCheckWorkflowStart } from "./receipt-check.workflow-start.js";

@Workflow({
  name: "receipt-check-workflow",
  version: "1.0.0",
  flow: [
    start(ReceiptCheckWorkflowStart)
      .returns(ReceiptRefundRequestDto)
      .toAgent(ReceiptReaderAgent)
      .toFinish(ReceiptCheckWorkflowFinish),
  ],
})
export class ReceiptCheckWorkflow {}
