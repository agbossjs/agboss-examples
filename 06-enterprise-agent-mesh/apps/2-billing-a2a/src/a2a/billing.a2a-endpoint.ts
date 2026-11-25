import { A2AEndpoint } from "@agboss/core/a2a";
import { hours, minutes } from "@agboss/core/units";
import { BillingWorkflowStart } from "../workflows/billing/billing.workflow-start.js";
import { InvoiceReviewWorkflowStart } from "../workflows/invoice-review/invoice-review.workflow-start.js";

/**
 * What billing serves over A2A v1.0: the card's skills are the two starts (the card's `securitySchemes` come
 * from the authenticator the listener is given). A message that names no skill runs the original one; the
 * invoice review is asked for by name. Its file limits are the review workflow's `@FilePolicy`.
 */
@A2AEndpoint({
  name: "billing",
  version: "1.0.0",
  description: "Resolves invoice questions and applies SLA credits for a tenant",
  ttl: { tasks: hours(24), messages: minutes(15) },
  skills: [
    { start: BillingWorkflowStart, tags: ["billing", "invoices", "sla"] },
    { start: InvoiceReviewWorkflowStart, tags: ["billing", "invoices", "files"] },
  ],
  defaultSkill: BillingWorkflowStart,
})
export class BillingA2AEndpoint {}
