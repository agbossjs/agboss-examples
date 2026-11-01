import { Agent } from "@agboss/core";
import { BudgetCheckDto } from "../../dto/budget-check.dto.js";
import { PurchaseRequestDto } from "../../dto/purchase-request.dto.js";
import { CHAT_MODEL } from "../../model-providers/models.js";

/** One of the four parallel reviews of a purchase request. */
@Agent({
  name: "budget-check-agent",
  description: "Checks the purchase against the team's budget",
  promptUrls: ["./budget-check.prompt.md"],
  model: CHAT_MODEL,
  input: {
    request: PurchaseRequestDto,
  },
  output: BudgetCheckDto,
})
export class BudgetCheckAgent {}
