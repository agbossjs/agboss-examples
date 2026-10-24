import { OutputGuardrail } from "agboss";

@OutputGuardrail({
  name: "unauthorized-payout-guardrail",
  description: "Blocks responses that promise unauthorized legal settlements or punitive damages.",
  prompt: "Does the response promise a legal settlement, punitive damages, or compensation outside the order refund?",
  model: "offline/guardrail-chat",
  threshold: 0.8,
  refusal: "Response withheld: support agents cannot promise legal settlements or extra-contractual payouts.",
})
export class UnauthorizedPayoutGuardrail {}
