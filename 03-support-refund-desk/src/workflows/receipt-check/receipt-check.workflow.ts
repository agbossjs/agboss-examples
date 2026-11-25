import { Workflow, onStart, Ttl } from "@agboss/core";
import { ReceiptFilePolicy } from "../../file-policies/receipt.file-policy.js";
import { ReceiptReaderAgent } from "../../agents/receipt-reader/receipt-reader.agent.js";
import { ReceiptCheckWorkflowFinish } from "./receipt-check.workflow-finish.js";
import { ReceiptCheckWorkflowStart } from "./receipt-check.workflow-start.js";

@Workflow({
  name: "receipt-check-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  filePolicy: ReceiptFilePolicy,
  flow: [
    onStart(ReceiptCheckWorkflowStart)
      .toAgent(ReceiptReaderAgent)
      .toFinish(ReceiptCheckWorkflowFinish),
  ],
})
export class ReceiptCheckWorkflow {}
