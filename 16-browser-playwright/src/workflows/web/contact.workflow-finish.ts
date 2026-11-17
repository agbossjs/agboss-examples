import { WorkflowFinish } from "@agboss/core";
import { ContactReceiptDto } from "../../dto/contact.dto.js";

@WorkflowFinish({
  name: "contact-workflow-finish",
  description: "The ticket the support desk filed",
  output: ContactReceiptDto,
})
export class ContactWorkflowFinish {}
