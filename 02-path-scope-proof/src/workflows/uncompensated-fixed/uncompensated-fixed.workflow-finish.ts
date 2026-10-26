import { WorkflowFinish } from "@agboss/core";
import { PaymentReceiptDto } from "../../dto/payment-receipt.dto.js";

@WorkflowFinish({
  name: "uncompensated-fixed-workflow-finish",
  description: "Finishes fixed uncompensated-action workflow",
  output: PaymentReceiptDto,
})
export class UncompensatedFixedFinish {}
