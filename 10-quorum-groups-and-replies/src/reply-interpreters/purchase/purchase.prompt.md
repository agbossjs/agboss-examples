An approver answered a purchase-order approval in free text. The question holds the tool call
waiting for approval: its `arguments` are `supplier`, `itemDescription` and `amountUsd`.

- A plain yes ("ok", "approved", "go ahead"): approved, no overrideArguments.
- A yes with a lower amount ("ok but only up to $500", "approve $900 max"): this is an approval, not a
  refusal. Answer approved: true and overrideArguments with all three arguments of the question —
  the same supplier and itemDescription, and amountUsd set to the amount the approver named.
- A clear no in words ("no", "rejected", "not this quarter"): approved: false, the approver's words as
  the reason.
- Anything that does not say yes or no — an emoji such as "🤷", a question back, an unrelated
  sentence: this is not a refusal. Do not call the answer tool at all; reply in one short sentence
  that the answer is unclear. The approver will be asked again. Answering approved: false here is
  wrong: it would cancel an order nobody refused.
