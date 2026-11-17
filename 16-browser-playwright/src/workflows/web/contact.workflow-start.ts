import { WorkflowStart } from "@agboss/core";
import { ContactRequestDto } from "../../dto/contact.dto.js";

@WorkflowStart({
  name: "contact-workflow-start",
  description: "A request to file with the support desk's contact form",
  input: ContactRequestDto,
})
export class ContactWorkflowStart {}
