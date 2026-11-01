import { Action, listOf, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { PaymentDto } from "../dto/payment.dto.js";
import { SplitSummaryDto } from "../dto/split-summary.dto.js";

/** Adds up the parts of a split order. */
@Action({
  name: "summarize-split-action",
  description: "Adds up the charged parts of a split order",
  input: { payments: listOf(PaymentDto) },
  output: SplitSummaryDto,
})
export class SummarizeSplitAction implements ActionHandler<SummarizeSplitAction> {
  execute(input: InputOf<SummarizeSplitAction>): Promise<OutputOf<SummarizeSplitAction>> {
    const payments = input.payments.map((produced) => produced.value);
    return Promise.resolve({
      parts: payments.length,
      totalCents: payments.reduce((sum, payment) => sum + payment.amountCents, 0),
    });
  }
}
