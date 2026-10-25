import { WorkflowStart } from "agboss";
import { CustomerInquiryDto } from "../../dto/customer-inquiry.dto.js";

@WorkflowStart({
  name: "hello-workflow-start",
  description: "Entry point for customer product or pricing inquiries",
  input: CustomerInquiryDto,
})
export class HelloWorkflowStart {}
