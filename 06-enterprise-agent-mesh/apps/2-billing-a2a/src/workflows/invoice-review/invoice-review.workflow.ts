import { Workflow, start } from "@agboss/core";
import { InvoiceReviewerAgent } from "../../agents/invoice-reviewer/invoice-reviewer.agent.js";
import { InvoiceReviewRequestDto } from "../../dto/invoice-review-request.dto.js";
import { InvoiceReviewWorkflowFinish } from "./invoice-review.workflow-finish.js";
import { InvoiceReviewWorkflowStart } from "./invoice-review.workflow-start.js";

@Workflow({
  name: "invoice-review-workflow",
  version: "1.0.0",
  flow: [
    start(InvoiceReviewWorkflowStart)
      .returns(InvoiceReviewRequestDto)
      .toAgent(InvoiceReviewerAgent)
      .toFinish(InvoiceReviewWorkflowFinish),
  ],
})
export class InvoiceReviewWorkflow {}
