import { WorkflowFinish } from "@agboss/core";
import { FinalReceiptDto } from "../../dto/final-receipt.dto.js";

@WorkflowFinish({
  name: "outdated-data-fixed-workflow-finish",
  description: "Finishes fixed outdated-data workflow",
  output: FinalReceiptDto,
})
export class OutdatedDataFixedFinish {}
