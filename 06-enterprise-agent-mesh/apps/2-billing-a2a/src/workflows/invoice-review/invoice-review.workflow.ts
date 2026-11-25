import { Workflow, onStart, Ttl } from "@agboss/core";
import { InvoiceReviewerAgent } from "../../agents/invoice-reviewer/invoice-reviewer.agent.js";
import { InvoiceReviewFilePolicy } from "../../file-policies/invoice-review.file-policy.js";
import { InvoiceReviewWorkflowFinish } from "./invoice-review.workflow-finish.js";
import { InvoiceReviewWorkflowStart } from "./invoice-review.workflow-start.js";

@Workflow({
  name: "invoice-review-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  filePolicy: InvoiceReviewFilePolicy,
  flow: [
    onStart(InvoiceReviewWorkflowStart)
      .toAgent(InvoiceReviewerAgent)
      .toFinish(InvoiceReviewWorkflowFinish),
  ],
})
export class InvoiceReviewWorkflow {}
