import { WorkflowStart } from "agboss";
import { BillingInquiryDto } from "../../src/dto/billing-inquiry.dto.js";

@WorkflowStart({
  name: "billing-workflow-start",
  description: "Inspects an invoice and resolves billing inquiries over A2A",
  input: BillingInquiryDto,
})
export class BillingWorkflowStart {}
