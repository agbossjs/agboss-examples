import { WorkflowStart } from "@agboss/core";
import { ReceiptRefundRequestDto } from "../../dto/receipt-refund-request.dto.js";

@WorkflowStart({
  name: "strict-receipt-check-workflow-start",
  description: "A refund request with the photo of the receipt",
  input: ReceiptRefundRequestDto,
})
export class StrictReceiptCheckWorkflowStart {}
