import { WorkflowFinish, listOf, type FinishHandler, type InputOf, type OutputOf } from "@agboss/core";
import { SplitSummaryDto } from "../../dto/split-summary.dto.js";
import { WalletDrawDto } from "../../dto/wallet-draw.dto.js";

/** The wallet could not cover every part: what was asked, nothing claimed as charged here. */
@WorkflowFinish({
  name: "split-order-refused-workflow-finish",
  description: "The wallet could not cover every part",
  input: { draws: listOf(WalletDrawDto) },
  output: SplitSummaryDto,
})
export class SplitOrderRefusedWorkflowFinish implements FinishHandler<SplitOrderRefusedWorkflowFinish> {
  finish(input: InputOf<SplitOrderRefusedWorkflowFinish>): OutputOf<SplitOrderRefusedWorkflowFinish> {
    return { parts: input.draws.length, totalCents: 0 };
  }
}
