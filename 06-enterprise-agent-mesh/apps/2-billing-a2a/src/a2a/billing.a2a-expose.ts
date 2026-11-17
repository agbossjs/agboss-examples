import { A2AExpose, A2ASecurity } from "@agboss/core/a2a";
import { kilobytes } from "@agboss/core/units";
import { InvoiceReviewWorkflowStart } from "../workflows/invoice-review/invoice-review.workflow-start.js";
import { BillingWorkflowStart } from "../workflows/billing/billing.workflow-start.js";

@A2AExpose({
  name: "billing-a2a-expose",
  description: "Resolves invoice questions and applies SLA credits for a tenant",
  version: "1.0.0",
  exports: [BillingWorkflowStart, InvoiceReviewWorkflowStart],
  // a message that names no skill runs the original one; the invoice review is asked for by name
  defaultSkill: BillingWorkflowStart,
  // what a caller that searches the card by tag finds, and how much the review takes as files:
  // one CSV of at most 8 KB (a bigger file, another media type or a second file is refused at the door)
  skills: {
    "billing-workflow-start": { tags: ["billing", "invoices", "sla"] },
    "invoice-review-workflow-start": {
      tags: ["billing", "invoices", "files"],
      files: {
        allowedMediaTypes: ["text/csv"],
        maxFileSize: kilobytes(8),
        maxTotalFileSize: kilobytes(8),
        maxFiles: 1,
      },
    },
  },
  // the card's securitySchemes; BillingA2aCallerResolver enforces it
  security: [A2ASecurity.bearer()],
})
export class BillingA2AExpose {}
