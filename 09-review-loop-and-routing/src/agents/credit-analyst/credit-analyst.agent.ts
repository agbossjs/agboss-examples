import { Agent } from "@agboss/core";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";
import { CreditMemoDto } from "../../dto/credit-memo.dto.js";
import { CHAT_MODEL } from "../../model-providers/models.js";

/** Writes the first credit memo on an application that passed the routing. */
@Agent({
  name: "credit-analyst-agent",
  description: "Writes the credit memo on an application",
  promptUrls: ["./credit-analyst.prompt.md"],
  model: CHAT_MODEL,
  input: {
    application: CreditApplicationDto,
  },
  output: CreditMemoDto,
  maxVisits: 1,
})
export class CreditAnalystAgent {}
