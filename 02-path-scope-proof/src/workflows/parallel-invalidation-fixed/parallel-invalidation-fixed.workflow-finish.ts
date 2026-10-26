import { WorkflowFinish } from "@agboss/core";
import { FinalInvoiceDto } from "../../dto/final-invoice.dto.js";

@WorkflowFinish({
  name: "parallel-invalidation-fixed-workflow-finish",
  description: "Finishes fixed parallel invalidation workflow",
  output: FinalInvoiceDto,
})
export class ParallelInvalidationFixedFinish {}
