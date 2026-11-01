import { WorkflowStart } from "@agboss/core";
import { RefundRequestDto } from "../../dto/refund-request.dto.js";

@WorkflowStart({ name: "refund-workflow-start", description: "An operator or the customer refunds a payment", input: RefundRequestDto })
export class RefundWorkflowStart {}
