import { OutputGuardrail } from "@agboss/core";

@OutputGuardrail({
  name: "unauthorized-payout-guardrail",
  description: "Blocks responses that promise unauthorized legal settlements or punitive damages.",
  promptUrls: ["./policy-promise.prompt.md"],
  model: "offline/guardrail-chat",
  threshold: 0.8,
  refusal: "Response withheld: support agents cannot promise legal settlements or extra-contractual payouts.",
})
export class UnauthorizedPayoutGuardrail {}
