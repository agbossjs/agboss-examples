import { WorkflowStart } from "@agboss/core";
import { DispositionRequestDto } from "../../dto/disposition-request.dto.js";

@WorkflowStart({ name: "cancel-workflow-start", description: "PS20: the customer cancels the order", input: DispositionRequestDto })
export class CancelWorkflowStart {}
