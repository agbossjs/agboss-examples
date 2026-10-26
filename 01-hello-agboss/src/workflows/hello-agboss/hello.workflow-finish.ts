import { WorkflowFinish } from "@agboss/core";
import { SupportReplyDto } from "../../dto/support-reply.dto.js";

@WorkflowFinish({
  name: "hello-workflow-finish",
  description: "Structured reply from either support or pricing specialist",
  output: SupportReplyDto,
})
export class HelloWorkflowFinish {}
