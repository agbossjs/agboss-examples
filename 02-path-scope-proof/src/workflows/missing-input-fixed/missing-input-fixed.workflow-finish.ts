import { WorkflowFinish } from "@agboss/core";
import { InvoiceSummaryDto } from "../../dto/invoice-summary.dto.js";

@WorkflowFinish({
  name: "missing-input-fixed-workflow-finish",
  description: "Finishes fixed missing-input workflow",
  output: InvoiceSummaryDto,
})
export class MissingInputFixedFinish {}
