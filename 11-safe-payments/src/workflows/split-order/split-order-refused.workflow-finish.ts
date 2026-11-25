import { WorkflowFinish } from "@agboss/core";
import { SplitSummaryDto } from "../../dto/split-summary.dto.js";

/** The wallet could not cover every part (or too many parts came): what was asked, nothing claimed as charged here. */
@WorkflowFinish({
  name: "split-order-refused-workflow-finish",
  description: "The wallet could not cover every part",
  output: SplitSummaryDto,
})
export class SplitOrderRefusedWorkflowFinish {}
