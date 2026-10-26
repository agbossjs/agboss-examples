import { WorkflowStart } from "@agboss/core";
import { SupportRequestDto } from "../../dto/support-request.dto.js";

@WorkflowStart({
  name: "support-workflow-start",
  description: "A customer's message about an order",
  input: SupportRequestDto,
})
export class SupportWorkflowStart {}
