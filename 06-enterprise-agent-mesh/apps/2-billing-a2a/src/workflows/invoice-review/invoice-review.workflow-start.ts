import { WorkflowStart } from "@agboss/core";
import { InvoiceReviewRequestDto } from "../../dto/invoice-review-request.dto.js";

@WorkflowStart({
  name: "invoice-review-workflow-start",
  description: "Reviews an invoice sent as a CSV file and answers a question about it",
  input: InvoiceReviewRequestDto,
})
export class InvoiceReviewWorkflowStart {}
