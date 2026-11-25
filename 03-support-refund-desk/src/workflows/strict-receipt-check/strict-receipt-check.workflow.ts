import { Workflow, onStart, Ttl } from "@agboss/core";
import { ReceiptFilePolicy } from "../../file-policies/receipt.file-policy.js";
import { StrictReceiptReaderAgent } from "../../agents/strict-receipt-reader/strict-receipt-reader.agent.js";
import { StrictReceiptCheckWorkflowFinish } from "./strict-receipt-check.workflow-finish.js";
import { StrictReceiptCheckWorkflowStart } from "./strict-receipt-check.workflow-start.js";

@Workflow({
  name: "strict-receipt-check-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  filePolicy: ReceiptFilePolicy,
  flow: [
    onStart(StrictReceiptCheckWorkflowStart)
      .toAgent(StrictReceiptReaderAgent)
      .toFinish(StrictReceiptCheckWorkflowFinish),
  ],
})
export class StrictReceiptCheckWorkflow {}
