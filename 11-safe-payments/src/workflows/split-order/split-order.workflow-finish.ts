import { WorkflowFinish } from "@agboss/core";
import { SplitSummaryDto } from "../../dto/split-summary.dto.js";

@WorkflowFinish({ name: "split-order-workflow-finish", description: "Every part charged", output: SplitSummaryDto })
export class SplitOrderWorkflowFinish {}
