import { Action, listOf, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { SplitSummaryDto } from "../dto/split-summary.dto.js";
import { WalletDrawDto } from "../dto/wallet-draw.dto.js";

/** The side path of a split the wallet could not cover: what was asked, nothing claimed as charged. */
@Action({
  name: "refuse-split-action",
  description: "Answers a split order that was refused: its parts asked, nothing charged",
  input: { draws: listOf(WalletDrawDto) },
  output: SplitSummaryDto,
})
export class RefuseSplitAction implements ActionHandler<RefuseSplitAction> {
  execute(input: InputOf<RefuseSplitAction>): Promise<OutputOf<RefuseSplitAction>> {
    return Promise.resolve({ parts: input.draws.length, totalCents: 0 });
  }
}
